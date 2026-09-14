import { ContextWindowPolicy, ToolCompactionResult, CompactionMeta } from './context-window.interface';
import { stringifySafe } from './token-estimator';

export class ContextWindowManager {
  constructor(private readonly policy: ContextWindowPolicy) {}

  compactToolResponses(toolResponses: any[]): ToolCompactionResult {
    if (!Array.isArray(toolResponses) || toolResponses.length === 0) {
      return {
        payload: toolResponses,
        compactedCount: 0,
        totalCharsBefore: 0,
        totalCharsAfter: 0,
      };
    }

    const compactedPayload: any[] = [];
    let compactedCount = 0;
    let totalCharsBefore = 0;
    let totalCharsAfter = 0;

    for (const item of toolResponses) {
      const beforeText = stringifySafe(item?.functionResponse?.response);
      const beforeChars = beforeText.length;
      totalCharsBefore += beforeChars;

      const limited = this.limitToolPayload(item, beforeText, beforeChars, totalCharsAfter);
      if (limited.compacted) {
        compactedCount += 1;
      }

      const afterText = stringifySafe(limited.payload?.functionResponse?.response);
      totalCharsAfter += afterText.length;
      compactedPayload.push(limited.payload);
    }

    return {
      payload: compactedPayload,
      compactedCount,
      totalCharsBefore,
      totalCharsAfter,
    };
  }

  private limitToolPayload(item: any, serializedResponse: string, responseChars: number, currentTotalChars: number) {
    if (!item?.functionResponse) {
      return { payload: item, compacted: false };
    }

    const singleLimitExceeded = responseChars > this.policy.maxToolResponseChars;
    const totalLimitExceeded = currentTotalChars + responseChars > this.policy.maxToolResponsesTotalChars;

    if (!singleLimitExceeded && !totalLimitExceeded) {
      return { payload: item, compacted: false };
    }

    const name = item.functionResponse.name || 'unknown_tool';
    const reason = singleLimitExceeded ? 'single_limit' : 'total_limit';
    const summary = this.toSummary(serializedResponse, name);

    const meta: CompactionMeta = {
      truncated: true,
      originalChars: responseChars,
      summaryChars: summary.length,
      reason,
      hint: this.getCompactionHint(name, reason),
    };

    const compacted = {
      functionResponse: {
        name,
        response: {
          _compaction: meta,
          data: summary,
        },
      },
    };

    return { payload: compacted, compacted: true };
  }

  private toSummary(text: string, toolName: string): string {
    if (!text) {
      return '';
    }

    if (text.length <= this.policy.summaryMaxChars) {
      return text;
    }

    // Try to preserve structured data better
    const preservedChars = this.policy.summaryMaxChars;
    const truncatedChars = text.length - preservedChars;

    // For array responses, try to show count and sample
    if (text.startsWith('[') && text.includes('{')) {
      const arrayInfo = this.summarizeArray(text);
      if (arrayInfo) {
        return arrayInfo;
      }
    }

    // For object responses, try to show key structure
    if (text.startsWith('{')) {
      const objectInfo = this.summarizeObject(text);
      if (objectInfo && objectInfo.length <= this.policy.summaryMaxChars) {
        return objectInfo;
      }
    }

    // Default: truncate with marker
    const clipped = text.slice(0, preservedChars);
    return `${clipped}\n\n[... ${truncatedChars} more characters truncated. Full data available via tool call with more specific filters.]`;
  }

  private summarizeArray(text: string): string | null {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const count = parsed.length;
        const sample = parsed.slice(0, 3);
        const sampleStr = JSON.stringify(sample, null, 2);
        
        if (count > 3) {
          return `[Array of ${count} items. First 3 shown:]\n${sampleStr}\n\n[... and ${count - 3} more items]`;
        }
        return sampleStr;
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }

  private summarizeObject(text: string): string | null {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        
        // Create a summary with key names and truncated values
        const summary: Record<string, any> = {};
        for (const key of keys.slice(0, 10)) {
          const value = parsed[key];
          if (typeof value === 'string' && value.length > 100) {
            summary[key] = value.slice(0, 100) + '...';
          } else if (Array.isArray(value)) {
            summary[key] = `[Array of ${value.length} items]`;
          } else if (typeof value === 'object' && value !== null) {
            summary[key] = `{Object with ${Object.keys(value).length} keys}`;
          } else {
            summary[key] = value;
          }
        }

        if (keys.length > 10) {
          summary['_moreKeys'] = `... and ${keys.length - 10} more properties`;
        }

        return JSON.stringify(summary, null, 2);
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }

  private getCompactionHint(toolName: string, reason: 'single_limit' | 'total_limit'): string {
    if (reason === 'total_limit') {
      return 'Context limit reached. Consider using more specific queries or filtering results.';
    }

    // Tool-specific hints
    if (toolName.includes('get_problems') || toolName.includes('get_courses')) {
      return 'Large result set. Consider using pagination or filtering by specific criteria.';
    }

    if (toolName.includes('get_testcases')) {
      return 'Many test cases returned. Consider requesting specific test case IDs.';
    }

    return 'Response truncated due to size. The most relevant data has been preserved.';
  }
}
