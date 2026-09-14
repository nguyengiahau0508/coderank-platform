export interface ContextWindowPolicy {
  maxInputTokens: number;
  outputReserveTokens: number;
  historyRetentionRatio: number;
  maxToolResponseChars: number;
  maxToolResponsesTotalChars: number;
  summaryMaxChars: number;
}

export interface HistoryTrimResult<T> {
  messages: T[];
  droppedCount: number;
  estimatedTokens: number;
  budgetTokens: number;
}

export interface ToolCompactionResult {
  payload: any[];
  compactedCount: number;
  totalCharsBefore: number;
  totalCharsAfter: number;
}

/**
 * Compaction metadata added to truncated tool results.
 * Provides context to the LLM about what was removed.
 */
export interface CompactionMeta {
  truncated: boolean;
  originalChars: number;
  summaryChars: number;
  reason: 'single_limit' | 'total_limit';
  hint?: string;
}
