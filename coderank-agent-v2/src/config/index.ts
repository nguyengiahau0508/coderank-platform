import 'dotenv/config';

export const config = {
  PORT: Number(process.env.PORT) || 4000,
  // LLM Provider API Keys
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  // Default provider and models
  DEFAULT_MODEL_PROVIDER: process.env.DEFAULT_MODEL_PROVIDER || 'gemini', // 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama'
  DEFAULT_GEMINI_MODEL: process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash',
  DEFAULT_OPENAI_MODEL: process.env.DEFAULT_OPENAI_MODEL || 'gpt-4o',
  DEFAULT_ANTHROPIC_MODEL: process.env.DEFAULT_ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  DEFAULT_OLLAMA_MODEL: process.env.DEFAULT_OLLAMA_MODEL || 'qwen2.5',
  DEFAULT_GROQ_MODEL: process.env.DEFAULT_GROQ_MODEL || 'llama-3.3-70b-versatile',
  AGENT_SECRET_TOKEN: process.env.AGENT_SECRET_TOKEN || '',
  NESTJS_API_URL: process.env.NESTJS_API_URL || 'http://localhost:3000/api',
  CONTEXT_WINDOW_MAX_INPUT_TOKENS: Number(process.env.CONTEXT_WINDOW_MAX_INPUT_TOKENS) || 12000,
  CONTEXT_WINDOW_OUTPUT_RESERVE_TOKENS: Number(process.env.CONTEXT_WINDOW_OUTPUT_RESERVE_TOKENS) || 2000,
  CONTEXT_WINDOW_HISTORY_RETENTION_RATIO: Number(process.env.CONTEXT_WINDOW_HISTORY_RETENTION_RATIO) || 0.8,
  CONTEXT_WINDOW_TOOL_RESULT_MAX_CHARS: Number(process.env.CONTEXT_WINDOW_TOOL_RESULT_MAX_CHARS) || 6000,
  CONTEXT_WINDOW_TOOL_RESULTS_MAX_TOTAL_CHARS: Number(process.env.CONTEXT_WINDOW_TOOL_RESULTS_MAX_TOTAL_CHARS) || 12000,
  CONTEXT_WINDOW_SUMMARY_MAX_CHARS: Number(process.env.CONTEXT_WINDOW_SUMMARY_MAX_CHARS) || 1200,
  // Hook system configuration
  AGENT_HOOKS_LOGGING_ENABLED: process.env.AGENT_HOOKS_LOGGING_ENABLED === 'true',
  AGENT_HOOKS_LOGGING_VERBOSE: process.env.AGENT_HOOKS_LOGGING_VERBOSE === 'true',
  // Session persistence configuration
  SESSION_STORAGE_PATH: process.env.SESSION_STORAGE_PATH || './.sessions',
};
