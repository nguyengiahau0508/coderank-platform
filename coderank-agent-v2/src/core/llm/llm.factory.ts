import { ILLMProvider, ILLMConfig } from './llm.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { config } from '../../config';

export type LLMProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama';

/**
 * Provider fallback order for resilience.
 * When a provider fails, the factory can try the next one in order.
 */
const PROVIDER_FALLBACK_ORDER: LLMProviderType[] = ['gemini', 'openai', 'anthropic', 'groq', 'ollama'];

export class LLMFactory {
  static normalizeProviderType(providerType?: string): LLMProviderType {
    const candidate = (providerType || config.DEFAULT_MODEL_PROVIDER).toLowerCase();
    if (
      candidate === 'gemini' ||
      candidate === 'openai' ||
      candidate === 'anthropic' ||
      candidate === 'groq' ||
      candidate === 'ollama'
    ) {
      return candidate;
    }
    return 'gemini';
  }

  /**
   * Creates an instance of ILLMProvider based on the provider type.
   */
  static createProvider(providerType?: string, modelName?: string, providerConfig?: ILLMConfig): ILLMProvider {
    const type = this.normalizeProviderType(providerType);
    return this.instantiateProvider(type, modelName, providerConfig);
  }

  /**
   * Creates a provider with automatic fallback.
   * If the primary provider fails to initialize, tries fallback providers.
   */
  static createProviderWithFallback(
    providerType?: string,
    modelName?: string,
    providerConfig?: ILLMConfig
  ): { provider: ILLMProvider; actualType: LLMProviderType } {
    const primaryType = this.normalizeProviderType(providerType);
    
    // Try primary provider first
    try {
      const provider = this.instantiateProvider(primaryType, modelName, providerConfig);
      return { provider, actualType: primaryType };
    } catch (error: any) {
      console.warn(`[LLM Factory] Primary provider '${primaryType}' failed: ${error.message}`);
    }

    // Try fallback providers
    for (const fallbackType of PROVIDER_FALLBACK_ORDER) {
      if (fallbackType === primaryType) continue;
      
      try {
        const provider = this.instantiateProvider(fallbackType, undefined, providerConfig);
        console.log(`[LLM Factory] Fell back to provider '${fallbackType}'`);
        return { provider, actualType: fallbackType };
      } catch (error: any) {
        console.warn(`[LLM Factory] Fallback provider '${fallbackType}' failed: ${error.message}`);
      }
    }

    throw new Error('No LLM providers available. Please configure at least one API key.');
  }

  /**
   * Get available providers based on configured API keys.
   */
  static getAvailableProviders(): LLMProviderType[] {
    const available: LLMProviderType[] = [];
    
    if (config.GEMINI_API_KEY) available.push('gemini');
    if (config.OPENAI_API_KEY) available.push('openai');
    if (config.ANTHROPIC_API_KEY) available.push('anthropic');
    if (config.GROQ_API_KEY) available.push('groq');
    // Ollama doesn't require API key, check if host is configured
    if (config.OLLAMA_HOST) available.push('ollama');
    
    return available;
  }

  static getFallbackProviders(currentType: LLMProviderType): LLMProviderType[] {
    const available = new Set(this.getAvailableProviders());
    return PROVIDER_FALLBACK_ORDER.filter(
      (provider) => provider !== currentType && available.has(provider),
    );
  }

  private static instantiateProvider(
    type: LLMProviderType,
    modelName?: string,
    providerConfig?: ILLMConfig
  ): ILLMProvider {
    switch (type) {
      case 'gemini':
        return new GeminiProvider(modelName, providerConfig);
      case 'openai':
        return new OpenAIProvider(modelName, providerConfig);
      case 'anthropic':
        return new AnthropicProvider(modelName, providerConfig);
      case 'groq':
        return new GroqProvider(modelName, providerConfig);
      case 'ollama':
        return new OllamaProvider(modelName, providerConfig);
      default:
        console.warn(`[LLM Factory] Provider '${type}' is not recognized, falling back to gemini.`);
        return new GeminiProvider(modelName, providerConfig);
    }
  }
}
