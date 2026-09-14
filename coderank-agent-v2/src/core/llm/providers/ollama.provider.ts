import { Ollama, Message, Tool } from 'ollama';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ILLMProvider, LLMResponse, ILLMConfig, ConversationHistoryMessage } from '../llm.interface';
import { ITool } from '../../tools/tool.interface';
import { config } from '../../../config';
import { ContextWindowPolicy, trimHistoryToBudget } from '../../context-window';
import { TokenUsage } from '../../usage';

export class OllamaProvider implements ILLMProvider {
  private client: Ollama;
  private modelName: string;
  private systemPrompt?: string;
  private tools: Tool[] = [];
  private history: Message[] = [];
  private readonly contextPolicy: ContextWindowPolicy;

  constructor(modelName?: string, providerConfig?: ILLMConfig) {
    const host = providerConfig?.baseHost || config.OLLAMA_HOST;
    this.client = new Ollama({ host });
    this.modelName = modelName || config.DEFAULT_OLLAMA_MODEL;
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
    this.systemPrompt = systemPrompt;
    this.tools = this.formatToolsForOllama(tools);
    this.history = [];
    
    // Add system message to history
    this.history.push({
      role: 'system',
      content: this.systemPrompt,
    });

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
    const historyBeforeRequest = [...this.history];

    // Determine the role and content to append to history
    if (typeof message === 'string') {
      this.history.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle tool responses that were passed back to LLM
      message.forEach(msg => {
        if (msg.functionResponse) {
           this.history.push({
             role: 'tool',
             content: JSON.stringify(msg.functionResponse.response),
             name: msg.functionResponse.name
           } as Message);
        } else {
           this.history.push({ role: 'user', content: JSON.stringify(msg) });
        }
      });
    }

    const trimResult = trimHistoryToBudget(this.history, {
      maxInputTokens: this.contextPolicy.maxInputTokens,
      outputReserveTokens: this.contextPolicy.outputReserveTokens,
      historyRetentionRatio: this.contextPolicy.historyRetentionRatio,
      isPinned: msg => msg.role === 'system',
    });

    if (trimResult.droppedCount > 0) {
      console.warn(
        `[Ollama Context] Trimmed ${trimResult.droppedCount} message(s), estimated input tokens ${trimResult.estimatedTokens}/${trimResult.budgetTokens}.`,
      );
      this.history = trimResult.messages;
    }

    try {
      const response = await this.client.chat({
        model: this.modelName,
        messages: this.history,
        tools: this.tools.length > 0 ? this.tools : undefined,
        options: {
          temperature: 0,
          top_p: 1,
          seed: 42,
        },
      });

      this.history.push(response.message);

      // Extract usage from Ollama response
      const usage = this.extractUsage(response);

      if (response.message.tool_calls && response.message.tool_calls.length > 0) {
        return {
          toolCalls: response.message.tool_calls.map(call => ({
            name: call.function.name,
            arguments: call.function.arguments,
          })),
          usage,
        };
      }

      return {
        text: response.message.content,
        usage,
      };
    } catch (error: any) {
      // Keep provider state consistent across retries.
      this.history = historyBeforeRequest;

      const status = error?.status_code ?? error?.status ?? error?.response?.status;
      const errorMessage = String(error?.message ?? error?.error ?? 'unknown error');
      console.error(`[Ollama Error] status=${status ?? 'n/a'} message=${errorMessage}`, error);
      throw error;
    }
  }

  private extractUsage(response: any): TokenUsage | undefined {
    try {
      // Ollama provides eval_count and prompt_eval_count
      if (response.prompt_eval_count !== undefined || response.eval_count !== undefined) {
        const inputTokens = response.prompt_eval_count || 0;
        const outputTokens = response.eval_count || 0;
        return {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        };
      }
    } catch {
      // Usage not available
    }
    return undefined;
  }

  private formatToolsForOllama(tools: ITool[]): Tool[] {
    return tools.map(t => {
      const jsonSchema = zodToJsonSchema(t.parameters as any);
      let properties = {};
      let required = [];
      if ((jsonSchema as any).type === 'object') {
        properties = (jsonSchema as any).properties || {};
        required = (jsonSchema as any).required || [];
      }
      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        }
      };
    });
  }
}
