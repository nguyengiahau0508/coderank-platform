import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ILLMProvider, LLMResponse, ILLMConfig, ConversationHistoryMessage } from '../llm.interface';
import { ITool } from '../../tools/tool.interface';
import { config } from '../../../config';
import { ContextWindowPolicy, trimHistoryToBudget } from '../../context-window';
import { TokenUsage } from '../../usage';

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicTool = Anthropic.Tool;

export class AnthropicProvider implements ILLMProvider {
  private client: Anthropic;
  private modelName: string;
  private tools: AnthropicTool[] = [];
  private history: AnthropicMessage[] = [];
  private systemPrompt: string = '';
  private readonly contextPolicy: ContextWindowPolicy;
  private lastToolUseIds: Map<string, string> = new Map();

  constructor(modelName?: string, providerConfig?: ILLMConfig) {
    const apiKey = providerConfig?.apiKey || config.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured and not provided');
    }
    
    const clientConfig: { apiKey: string; baseURL?: string } = { apiKey };
    if (providerConfig?.baseHost) {
      clientConfig.baseURL = providerConfig.baseHost;
    }
    
    this.client = new Anthropic(clientConfig);
    this.modelName = modelName || config.DEFAULT_ANTHROPIC_MODEL;
    this.contextPolicy = {
      maxInputTokens: config.CONTEXT_WINDOW_MAX_INPUT_TOKENS,
      outputReserveTokens: config.CONTEXT_WINDOW_OUTPUT_RESERVE_TOKENS,
      historyRetentionRatio: config.CONTEXT_WINDOW_HISTORY_RETENTION_RATIO,
      maxToolResponseChars: config.CONTEXT_WINDOW_TOOL_RESULT_MAX_CHARS,
      maxToolResponsesTotalChars: config.CONTEXT_WINDOW_TOOL_RESULTS_MAX_TOTAL_CHARS,
      summaryMaxChars: config.CONTEXT_WINDOW_SUMMARY_MAX_CHARS,
      ...(providerConfig?.contextPolicy || {}),
    };
  }

  init(systemPrompt: string, tools: ITool[], initialHistory: ConversationHistoryMessage[] = []): void {
    this.tools = this.formatToolsForAnthropic(tools);
    this.systemPrompt = systemPrompt;
    this.history = [];
    this.lastToolUseIds = new Map();

    for (const msg of initialHistory) {
      if (!msg?.content || (msg.role !== 'user' && msg.role !== 'assistant')) {
        continue;
      }
      this.history.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  async sendMessage(message: any): Promise<LLMResponse> {
    if (typeof message === 'string') {
      this.history.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle tool results - Anthropic requires tool_result blocks in user messages
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      
      message.forEach(msg => {
        if (msg.functionResponse) {
          const { name, response } = msg.functionResponse;
          const toolUseId = this.lastToolUseIds.get(name);
          if (toolUseId) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: typeof response === 'string' ? response : JSON.stringify(response),
            });
          }
        }
      });

      if (toolResults.length > 0) {
        this.history.push({
          role: 'user',
          content: toolResults,
        });
      }
    }

    // Trim history if needed (excluding system prompt which is separate in Anthropic)
    const trimResult = trimHistoryToBudget(this.history, {
      maxInputTokens: this.contextPolicy.maxInputTokens,
      outputReserveTokens: this.contextPolicy.outputReserveTokens,
      historyRetentionRatio: this.contextPolicy.historyRetentionRatio,
      isPinned: () => false, // No pinned messages in Anthropic history (system is separate)
    });

    if (trimResult.droppedCount > 0) {
      console.warn(
        `[Anthropic Context] Trimmed ${trimResult.droppedCount} message(s), estimated ${trimResult.estimatedTokens}/${trimResult.budgetTokens} tokens.`,
      );
      this.history = trimResult.messages as AnthropicMessage[];
    }

    try {
      const response = await this.client.messages.create({
        model: this.modelName,
        max_tokens: 4096,
        temperature: 0,
        system: this.systemPrompt,
        messages: this.history,
        tools: this.tools.length > 0 ? this.tools : undefined,
      });

      // Build assistant message for history
      const assistantContent: Anthropic.ContentBlock[] = response.content;
      this.history.push({
        role: 'assistant',
        content: assistantContent.map(block => {
          if (block.type === 'text') {
            return { type: 'text' as const, text: block.text };
          } else if (block.type === 'tool_use') {
            return {
              type: 'tool_use' as const,
              id: block.id,
              name: block.name,
              input: block.input,
            };
          }
          return block as any;
        }),
      });

      const usage = this.extractUsage(response);

      // Check for tool use
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length > 0) {
        this.lastToolUseIds = new Map();
        toolUseBlocks.forEach(block => {
          this.lastToolUseIds.set(block.name, block.id);
        });

        return {
          toolCalls: toolUseBlocks.map(block => ({
            id: block.id,
            name: block.name,
            arguments: block.input as any,
          })),
          usage,
        };
      }

      // Extract text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      const text = textBlocks.map(b => b.text).join('\n');

      return {
        text,
        usage,
      };
    } catch (error: any) {
      console.error('[Anthropic Error]', error.message || error);
      throw error;
    }
  }

  private extractUsage(response: Anthropic.Message): TokenUsage | undefined {
    try {
      const usage = response.usage;
      if (usage) {
        return {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
          cacheReadTokens: (usage as any).cache_read_input_tokens || 0,
        };
      }
    } catch {
      // Usage not available
    }
    return undefined;
  }

  private formatToolsForAnthropic(tools: ITool[]): AnthropicTool[] {
    return tools.map(t => {
      const jsonSchema = zodToJsonSchema(t.parameters as any);
      let properties = {};
      let required: string[] = [];
      if ((jsonSchema as any).type === 'object') {
        properties = (jsonSchema as any).properties || {};
        required = (jsonSchema as any).required || [];
      }
      return {
        name: t.name,
        description: t.description,
        input_schema: {
          type: 'object' as const,
          properties,
          required,
        },
      };
    });
  }
}
