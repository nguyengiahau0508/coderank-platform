import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ILLMProvider, LLMResponse, ILLMConfig, ConversationHistoryMessage } from '../llm.interface';
import { ITool } from '../../tools/tool.interface';
import { config } from '../../../config';
import { ContextWindowPolicy, trimHistoryToBudget } from '../../context-window';
import { TokenUsage } from '../../usage';

export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private modelName: string;
  private tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
  private history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  private readonly contextPolicy: ContextWindowPolicy;
  private lastToolCallIds: Map<string, string> = new Map();

  constructor(modelName?: string, providerConfig?: ILLMConfig) {
    const apiKey = providerConfig?.apiKey || config.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured and not provided');
    }
    
    const clientConfig: { apiKey: string; baseURL?: string } = { apiKey };
    if (providerConfig?.baseHost) {
      clientConfig.baseURL = providerConfig.baseHost;
    }
    
    this.client = new OpenAI(clientConfig);
    this.modelName = modelName || config.DEFAULT_OPENAI_MODEL;
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
    this.tools = this.formatToolsForOpenAI(tools);
    this.history = [];
    this.lastToolCallIds = new Map();

    if (systemPrompt) {
      this.history.push({ role: 'system', content: systemPrompt });
    }

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
      // Handle tool responses
      message.forEach(msg => {
        if (msg.functionResponse) {
          const { name, response } = msg.functionResponse;
          const toolCallId = this.lastToolCallIds.get(name) || name;
          this.history.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: typeof response === 'string' ? response : JSON.stringify(response),
          });
        } else {
          this.history.push({ role: 'user', content: JSON.stringify(msg) });
        }
      });
    }

    // Trim history if needed
    const trimResult = trimHistoryToBudget(this.history, {
      maxInputTokens: this.contextPolicy.maxInputTokens,
      outputReserveTokens: this.contextPolicy.outputReserveTokens,
      historyRetentionRatio: this.contextPolicy.historyRetentionRatio,
      isPinned: msg => msg.role === 'system',
    });

    if (trimResult.droppedCount > 0) {
      console.warn(
        `[OpenAI Context] Trimmed ${trimResult.droppedCount} message(s), estimated ${trimResult.estimatedTokens}/${trimResult.budgetTokens} tokens.`,
      );
      this.history = trimResult.messages;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: this.history,
        temperature: 0,
        tools: this.tools.length > 0 ? this.tools : undefined,
      });

      const assistantMessage = response.choices[0].message;
      this.history.push(assistantMessage as OpenAI.Chat.Completions.ChatCompletionMessageParam);

      const usage = this.extractUsage(response);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        this.lastToolCallIds = new Map();
        assistantMessage.tool_calls.forEach((tc: any) => {
          this.lastToolCallIds.set(tc.function.name, tc.id);
        });

        return {
          toolCalls: assistantMessage.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}') ?? {},
          })),
          usage,
        };
      }

      return {
        text: assistantMessage.content || '',
        usage,
      };
    } catch (error: any) {
      console.error('[OpenAI Error]', error.message || error);
      throw error;
    }
  }

  private extractUsage(response: OpenAI.Chat.Completions.ChatCompletion): TokenUsage | undefined {
    try {
      const usage = response.usage;
      if (usage) {
        return {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        };
      }
    } catch {
      // Usage not available
    }
    return undefined;
  }

  private formatToolsForOpenAI(tools: ITool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map(t => {
      const jsonSchema = zodToJsonSchema(t.parameters as any);
      let properties = {};
      let required: string[] = [];
      if ((jsonSchema as any).type === 'object') {
        properties = (jsonSchema as any).properties || {};
        required = (jsonSchema as any).required || [];
      }
      return {
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      };
    });
  }
}
