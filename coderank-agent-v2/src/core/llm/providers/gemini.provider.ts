import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ILLMProvider, LLMResponse, ILLMConfig, ConversationHistoryMessage } from '../llm.interface';
import { ITool } from '../../tools/tool.interface';
import { config } from '../../../config';
import { TokenUsage } from '../../usage';

export class GeminiProvider implements ILLMProvider {
  private genAI: GoogleGenerativeAI;
  private chatSession?: ChatSession;
  private modelName: string;

  constructor(modelName?: string, providerConfig?: ILLMConfig) {
    const apiKey = providerConfig?.apiKey || config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured and not provided by user');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName || config.DEFAULT_GEMINI_MODEL;
  }

  init(systemPrompt: string, tools: ITool[], initialHistory: ConversationHistoryMessage[] = []): void {
    const geminiTools = this.formatToolsForGemini(tools);
    
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
    });

    this.chatSession = model.startChat({
      history: this.formatHistoryForGemini(initialHistory),
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2000,
      },
    });
  }

  async sendMessage(message: any): Promise<LLMResponse> {
    if (!this.chatSession) {
      throw new Error('GeminiProvider not initialized. Call init() first.');
    }

    const result = await this.chatSession.sendMessage(message);
    const response = result.response;
    
    // Extract usage metadata from response
    const usage = this.extractUsage(response);
    
    // Check if there are function calls
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      return {
        toolCalls: functionCalls.map(call => ({
          name: call.name,
          arguments: call.args,
        })),
        usage,
      };
    }

    return {
      text: response.text(),
      usage,
    };
  }

  private extractUsage(response: any): TokenUsage | undefined {
    try {
      const metadata = response.usageMetadata;
      if (metadata) {
        return {
          inputTokens: metadata.promptTokenCount || 0,
          outputTokens: metadata.candidatesTokenCount || 0,
          totalTokens: metadata.totalTokenCount || 0,
          cacheReadTokens: metadata.cachedContentTokenCount || 0,
        };
      }
    } catch {
      // Usage metadata not available
    }
    return undefined;
  }

  private formatToolsForGemini(tools: ITool[]) {
    return tools.map(t => {
      const jsonSchema = zodToJsonSchema(t.parameters as any);
      let properties = {};
      let required = [];
      if ((jsonSchema as any).type === 'object') {
        properties = (jsonSchema as any).properties || {};
        required = (jsonSchema as any).required || [];
      }
      return {
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT" as any,
          properties,
          required,
        },
      };
    });
  }

  private formatHistoryForGemini(initialHistory: ConversationHistoryMessage[]) {
    if (!Array.isArray(initialHistory) || initialHistory.length === 0) {
      return [];
    }

    return initialHistory
      .filter(msg => msg?.content && (msg.role === 'user' || msg.role === 'assistant'))
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
  }
}
