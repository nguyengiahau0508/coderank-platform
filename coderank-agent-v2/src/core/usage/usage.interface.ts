/**
 * Token usage information from LLM responses.
 * Follows the design pattern from AGENT_DESIGN.md
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/**
 * Aggregated usage statistics for a session or conversation turn.
 */
export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  turnCount: number;
  toolCallCount: number;
}

/**
 * Usage tracker interface for monitoring token consumption.
 */
export interface IUsageTracker {
  record(usage: TokenUsage): void;
  recordToolCall(): void;
  getStats(): UsageStats;
  reset(): void;
}
