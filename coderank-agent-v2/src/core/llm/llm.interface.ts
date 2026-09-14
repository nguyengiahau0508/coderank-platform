import { ITool } from '../tools/tool.interface';
import { ContextWindowPolicy } from '../context-window';
import { TokenUsage } from '../usage';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: any; // Can be text, or structured data for tool calls/responses
}

export interface ConversationHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ILLMConfig {
  apiKey?: string;
  baseHost?: string;
  contextPolicy?: Partial<ContextWindowPolicy>;
  initialHistory?: ConversationHistoryMessage[];
}

export interface ILLMProvider {
  /**
   * Initializes the chat session with the system prompt and tools.
   */
  init(systemPrompt: string, tools: ITool[], initialHistory?: ConversationHistoryMessage[]): void;

  /**
   * Sends a message to the LLM and gets the response.
   * If the LLM decides to call a tool, it returns the tool call request.
   * Includes token usage information when available.
   */
  sendMessage(message: any): Promise<LLMResponse>;
}

export interface ToolCallRequest {
  id?: string;
  name: string;
  arguments: any;
}

/**
 * LLM response with optional usage tracking.
 * Follows AGENT_DESIGN.md pattern for usage metadata per message.
 */
export interface LLMResponse {
  text?: string;
  toolCalls?: ToolCallRequest[];
  usage?: TokenUsage;
}
