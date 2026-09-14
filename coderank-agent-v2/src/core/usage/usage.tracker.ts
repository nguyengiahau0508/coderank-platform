import { IUsageTracker, TokenUsage, UsageStats } from './usage.interface';

/**
 * Tracks token usage across conversation turns.
 * Implements the UsageTracker pattern from AGENT_DESIGN.md
 */
export class UsageTracker implements IUsageTracker {
  private stats: UsageStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    turnCount: 0,
    toolCallCount: 0,
  };

  record(usage: TokenUsage): void {
    this.stats.totalInputTokens += usage.inputTokens;
    this.stats.totalOutputTokens += usage.outputTokens;
    this.stats.totalTokens += usage.totalTokens;
    this.stats.turnCount += 1;
  }

  recordToolCall(): void {
    this.stats.toolCallCount += 1;
  }

  getStats(): UsageStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      turnCount: 0,
      toolCallCount: 0,
    };
  }
}
