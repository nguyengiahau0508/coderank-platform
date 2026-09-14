import * as fs from 'fs';
import * as path from 'path';

/**
 * Runtime configuration interface.
 * All configuration options with their types.
 */
export interface RuntimeConfig {
  // Server settings
  port: number;
  
  // LLM provider settings
  defaultModelProvider: string;
  geminiApiKey: string;
  defaultGeminiModel: string;
  ollamaHost: string;
  defaultOllamaModel: string;
  groqApiKey: string;
  defaultGroqModel: string;
  
  // Security
  agentSecretToken: string;
  nestjsApiUrl: string;
  
  // Context window settings
  contextWindow: {
    maxInputTokens: number;
    outputReserveTokens: number;
    historyRetentionRatio: number;
    toolResultMaxChars: number;
    toolResultsMaxTotalChars: number;
    summaryMaxChars: number;
  };
  
  // Hook settings
  hooks: {
    loggingEnabled: boolean;
    loggingVerbose: boolean;
  };
  
  // Session settings
  session: {
    storagePath: string;
    maxAgeDays: number;
  };
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: RuntimeConfig = {
  port: 4000,
  defaultModelProvider: 'gemini',
  geminiApiKey: '',
  defaultGeminiModel: 'gemini-2.5-flash',
  ollamaHost: 'http://localhost:11434',
  defaultOllamaModel: 'qwen2.5',
  groqApiKey: '',
  defaultGroqModel: 'llama-3.3-70b-versatile',
  agentSecretToken: '',
  nestjsApiUrl: 'http://localhost:3000/api',
  contextWindow: {
    maxInputTokens: 12000,
    outputReserveTokens: 2000,
    historyRetentionRatio: 0.8,
    toolResultMaxChars: 6000,
    toolResultsMaxTotalChars: 12000,
    summaryMaxChars: 1200,
  },
  hooks: {
    loggingEnabled: false,
    loggingVerbose: false,
  },
  session: {
    storagePath: './.sessions',
    maxAgeDays: 7,
  },
};

/**
 * Deep merge two objects, with source values overriding target values.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Load configuration from a JSON file.
 */
function loadJsonConfig(filePath: string): Partial<RuntimeConfig> {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`[ConfigLoader] Failed to load ${filePath}:`, error);
  }
  return {};
}

/**
 * Load configuration from environment variables.
 */
function loadEnvConfig(): Partial<RuntimeConfig> {
  const env = process.env;

  return {
    port: env.PORT ? Number(env.PORT) : undefined,
    defaultModelProvider: env.DEFAULT_MODEL_PROVIDER,
    geminiApiKey: env.GEMINI_API_KEY,
    defaultGeminiModel: env.DEFAULT_GEMINI_MODEL,
    ollamaHost: env.OLLAMA_HOST,
    defaultOllamaModel: env.DEFAULT_OLLAMA_MODEL,
    groqApiKey: env.GROQ_API_KEY,
    defaultGroqModel: env.DEFAULT_GROQ_MODEL,
    agentSecretToken: env.AGENT_SECRET_TOKEN,
    nestjsApiUrl: env.NESTJS_API_URL,
    contextWindow: {
      maxInputTokens: env.CONTEXT_WINDOW_MAX_INPUT_TOKENS
        ? Number(env.CONTEXT_WINDOW_MAX_INPUT_TOKENS)
        : undefined!,
      outputReserveTokens: env.CONTEXT_WINDOW_OUTPUT_RESERVE_TOKENS
        ? Number(env.CONTEXT_WINDOW_OUTPUT_RESERVE_TOKENS)
        : undefined!,
      historyRetentionRatio: env.CONTEXT_WINDOW_HISTORY_RETENTION_RATIO
        ? Number(env.CONTEXT_WINDOW_HISTORY_RETENTION_RATIO)
        : undefined!,
      toolResultMaxChars: env.CONTEXT_WINDOW_TOOL_RESULT_MAX_CHARS
        ? Number(env.CONTEXT_WINDOW_TOOL_RESULT_MAX_CHARS)
        : undefined!,
      toolResultsMaxTotalChars: env.CONTEXT_WINDOW_TOOL_RESULTS_MAX_TOTAL_CHARS
        ? Number(env.CONTEXT_WINDOW_TOOL_RESULTS_MAX_TOTAL_CHARS)
        : undefined!,
      summaryMaxChars: env.CONTEXT_WINDOW_SUMMARY_MAX_CHARS
        ? Number(env.CONTEXT_WINDOW_SUMMARY_MAX_CHARS)
        : undefined!,
    },
    hooks: {
      loggingEnabled: env.AGENT_HOOKS_LOGGING_ENABLED === 'true',
      loggingVerbose: env.AGENT_HOOKS_LOGGING_VERBOSE === 'true',
    },
    session: {
      storagePath: env.SESSION_STORAGE_PATH!,
      maxAgeDays: env.SESSION_MAX_AGE_DAYS
        ? Number(env.SESSION_MAX_AGE_DAYS)
        : undefined!,
    },
  };
}

/**
 * Clean undefined values from an object recursively.
 */
function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }

  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        const cleanedValue = cleanUndefined(value);
        if (Object.keys(cleanedValue).length > 0) {
          cleaned[key] = cleanedValue;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

/**
 * Configuration loader that merges configurations from multiple sources.
 * Priority (highest to lowest): local > project > env > defaults
 */
export class ConfigLoader {
  private projectRoot: string;
  private projectConfigName: string;
  private localConfigName: string;

  constructor(options?: {
    projectRoot?: string;
    projectConfigName?: string;
    localConfigName?: string;
  }) {
    this.projectRoot = options?.projectRoot || process.cwd();
    this.projectConfigName = options?.projectConfigName || '.coderank/settings.json';
    this.localConfigName = options?.localConfigName || '.coderank/settings.local.json';
  }

  /**
   * Load and merge all configuration sources.
   */
  load(): RuntimeConfig {
    // Start with defaults
    let config = { ...DEFAULT_CONFIG };

    // Merge environment variables
    const envConfig = cleanUndefined(loadEnvConfig());
    config = deepMerge(config, envConfig);

    // Merge project config
    const projectConfigPath = path.join(this.projectRoot, this.projectConfigName);
    const projectConfig = loadJsonConfig(projectConfigPath);
    config = deepMerge(config, projectConfig);

    // Merge local config (highest priority, typically gitignored)
    const localConfigPath = path.join(this.projectRoot, this.localConfigName);
    const localConfig = loadJsonConfig(localConfigPath);
    config = deepMerge(config, localConfig);

    return config;
  }

  /**
   * Get the default configuration.
   */
  static getDefaults(): RuntimeConfig {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Create a sample project configuration file.
   */
  createSampleConfig(): string {
    const sampleConfig = {
      defaultModelProvider: 'gemini',
      contextWindow: {
        maxInputTokens: 12000,
        toolResultMaxChars: 6000,
      },
      hooks: {
        loggingEnabled: false,
      },
    };

    return JSON.stringify(sampleConfig, null, 2);
  }
}

// Singleton instance for global config access
let _runtimeConfig: RuntimeConfig | null = null;

/**
 * Get the runtime configuration.
 * Loads and caches on first call.
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (!_runtimeConfig) {
    const loader = new ConfigLoader();
    _runtimeConfig = loader.load();
  }
  return _runtimeConfig;
}

/**
 * Reset the cached configuration (useful for testing).
 */
export function resetRuntimeConfig(): void {
  _runtimeConfig = null;
}
