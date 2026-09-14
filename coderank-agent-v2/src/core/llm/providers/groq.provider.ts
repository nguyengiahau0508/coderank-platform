import Groq from 'groq-sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ILLMProvider, LLMResponse, ILLMConfig, ConversationHistoryMessage } from '../llm.interface';
import { ITool } from '../../tools/tool.interface';
import { config } from '../../../config';
import { ContextWindowPolicy, trimHistoryToBudget } from '../../context-window';
import { TokenUsage } from '../../usage';

export class GroqProvider implements ILLMProvider {
  private client: Groq;
  private modelName: string;
  private tools: Groq.Chat.Completions.ChatCompletionTool[] = [];
  private history: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
  private readonly contextPolicy: ContextWindowPolicy;
  // Maps tool name -> tool_call_id so tool results can reference the right call
  private lastToolCallIds: Map<string, string> = new Map();

  constructor(modelName?: string, providerConfig?: ILLMConfig) {
    const apiKey = providerConfig?.apiKey || config.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured and not provided');
    }
    this.client = new Groq({ apiKey });
    this.modelName = modelName || config.DEFAULT_GROQ_MODEL;
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
    this.tools = this.formatToolsForGroq(tools);
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
      // Handle tool responses in the agent's functionResponse format
      message.forEach(msg => {
        if (msg.functionResponse) {
          const { name, response } = msg.functionResponse;
          const toolCallId = this.lastToolCallIds.get(name) || name;
          this.history.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: JSON.stringify(response),
          });
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
        `[Groq Context] Trimmed ${trimResult.droppedCount} message(s), estimated input tokens ${trimResult.estimatedTokens}/${trimResult.budgetTokens}.`,
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
      this.history.push(assistantMessage as Groq.Chat.Completions.ChatCompletionMessageParam);

      // Extract usage from response
      const usage = this.extractUsage(response);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        this.lastToolCallIds = new Map();
        assistantMessage.tool_calls.forEach(tc => {
          this.lastToolCallIds.set(tc.function.name, tc.id);
        });

        return {
          toolCalls: assistantMessage.tool_calls.map(tc => ({
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
      // Handle Groq's tool_use_failed error by recovering the malformed JSON
      const failedGen = error?.error?.error?.failed_generation;
      if (failedGen && error?.error?.error?.code === 'tool_use_failed') {
        console.warn('[Groq Warning] Tool call JSON was malformed. Attempting to recover...');
        const recovered = this.recoverToolCall(failedGen);
        if (recovered) {
          console.log(`[Groq Recovery] Recovered tool call: ${recovered.name}`);
          // Push a synthetic assistant message with the recovered tool call into history
          const syntheticId = `recovered_${Date.now()}`;
          this.history.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: syntheticId,
              type: 'function',
              function: { name: recovered.name, arguments: JSON.stringify(recovered.arguments) },
            }],
          } as any);
          this.lastToolCallIds = new Map();
          this.lastToolCallIds.set(recovered.name, syntheticId);
          return {
            toolCalls: [{
              id: syntheticId,
              name: recovered.name,
              arguments: recovered.arguments,
            }],
          };
        }
      }
      console.error('[Groq Error]', error);
      throw error;
    }
  }

  private extractUsage(response: any): TokenUsage | undefined {
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

  /**
   * Attempt to recover a tool call from Groq's failed_generation string.
   * The model sometimes produces slightly malformed JSON (e.g. trailing quotes).
   */
  private recoverToolCall(raw: string): { name: string; arguments: any } | null {
    try {
      // First try direct parse
      const parsed = JSON.parse(raw);
      if (parsed.name && parsed.arguments) {
        return { name: parsed.name, arguments: parsed.arguments };
      }
    } catch { /* direct parse failed, try fixups */ }

    try {
      // Extract the name
      const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/);
      if (!nameMatch) return null;
      const name = nameMatch[1];

      // Extract the arguments substring
      const argStart = raw.indexOf('"arguments"');
      if (argStart === -1) return null;
      const colonPos = raw.indexOf(':', argStart);
      if (colonPos === -1) return null;

      let argStr = raw.substring(colonPos + 1).trim();
      // Remove trailing }  that wraps the outer object
      if (argStr.endsWith('}')) {
        argStr = argStr.substring(0, argStr.lastIndexOf('}'));
        argStr = argStr.trim();
        // Remove another trailing } if the outer wrapper had double
        if (argStr.endsWith('"}}') || argStr.endsWith('"]"}')) {
          // Malformed: trailing quote after array/object close - remove it
        }
      }

      // Try increasingly aggressive fixups
      const fixups = [
        argStr,
        argStr.replace(/\]"\s*$/, ']'),     // remove stray quote after ]
        argStr.replace(/\}"\s*$/, '}'),      // remove stray quote after }
        argStr + '}',                         // maybe missing closing brace
      ];

      for (const attempt of fixups) {
        try {
          // Ensure it ends with }
          let candidate = attempt.trim();
          if (!candidate.endsWith('}')) {
            candidate += '}';
          }
          const args = JSON.parse(candidate);
          if (typeof args === 'object') {
            return { name, arguments: args };
          }
        } catch { continue; }
      }
    } catch { /* recovery failed */ }

    return null;
  }

  private formatToolsForGroq(tools: ITool[]): Groq.Chat.Completions.ChatCompletionTool[] {
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
