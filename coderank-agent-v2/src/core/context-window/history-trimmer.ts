import { HistoryTrimResult } from './context-window.interface';
import { estimateTokens } from './token-estimator';

interface TrimOptions<T> {
  maxInputTokens: number;
  outputReserveTokens: number;
  historyRetentionRatio: number;
  isPinned?: (message: T) => boolean;
}

export function trimHistoryToBudget<T>(history: T[], options: TrimOptions<T>): HistoryTrimResult<T> {
  const isPinned = options.isPinned || (() => false);
  const budgetTokens = Math.max(
    1,
    Math.floor(options.maxInputTokens * options.historyRetentionRatio) - options.outputReserveTokens,
  );

  const totalTokens = estimateTokens(history);
  if (totalTokens <= budgetTokens) {
    return {
      messages: history,
      droppedCount: 0,
      estimatedTokens: totalTokens,
      budgetTokens,
    };
  }

  const pinnedMessages = history.filter(isPinned);
  const pinnedSet = new Set(pinnedMessages);
  const pinnedTokens = estimateTokens(pinnedMessages);

  const selected: T[] = [];
  let runningTokens = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (pinnedSet.has(message)) {
      continue;
    }

    const messageTokens = estimateTokens(message);
    if (runningTokens + messageTokens + pinnedTokens > budgetTokens) {
      continue;
    }

    runningTokens += messageTokens;
    selected.push(message);
  }

  selected.reverse();

  const merged = [...pinnedMessages, ...selected];
  const mergedTokens = estimateTokens(merged);

  return {
    messages: merged,
    droppedCount: Math.max(0, history.length - merged.length),
    estimatedTokens: mergedTokens,
    budgetTokens,
  };
}
