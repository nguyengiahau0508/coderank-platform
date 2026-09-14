import { IHook, HookContext, HookResult, HookEvent } from '../hook.interface';
import { UsageStats } from '../../usage';

/**
 * Built-in metrics hook that collects execution metrics.
 * Tracks tool execution times and success/failure rates.
 */
export class MetricsHook implements IHook {
  readonly name = 'builtin:metrics';
  readonly events: HookEvent[] = ['PreToolUse', 'PostToolUse', 'PreQuery', 'PostQuery'];
  readonly priority = 1; // Run early but after logging

  private toolMetrics = new Map<string, {
    calls: number;
    errors: number;
    totalDurationMs: number;
    lastCallTime?: number;
  }>();

  private queryMetrics: {
    total: number;
    errors: number;
    totalDurationMs: number;
    lastQueryTime?: number;
  } = { total: 0, errors: 0, totalDurationMs: 0 };

  async execute(context: HookContext): Promise<HookResult> {
    if (context.event === 'PreToolUse' && context.toolName) {
      this.ensureToolMetrics(context.toolName);
      const metrics = this.toolMetrics.get(context.toolName)!;
      metrics.lastCallTime = Date.now();
    }

    if (context.event === 'PostToolUse' && context.toolName) {
      const metrics = this.toolMetrics.get(context.toolName);
      if (metrics) {
        metrics.calls += 1;
        if (context.isError) {
          metrics.errors += 1;
        }
        if (metrics.lastCallTime) {
          metrics.totalDurationMs += Date.now() - metrics.lastCallTime;
          metrics.lastCallTime = undefined;
        }
      }
    }

    if (context.event === 'PreQuery') {
      this.queryMetrics.lastQueryTime = Date.now();
    }

    if (context.event === 'PostQuery') {
      this.queryMetrics.total += 1;
      if (this.queryMetrics.lastQueryTime) {
        this.queryMetrics.totalDurationMs += Date.now() - this.queryMetrics.lastQueryTime;
        this.queryMetrics.lastQueryTime = undefined;
      }
    }

    return { action: 'allow' };
  }

  private ensureToolMetrics(toolName: string): void {
    if (!this.toolMetrics.has(toolName)) {
      this.toolMetrics.set(toolName, {
        calls: 0,
        errors: 0,
        totalDurationMs: 0,
      });
    }
  }

  /**
   * Get metrics for a specific tool.
   */
  getToolMetrics(toolName: string) {
    return this.toolMetrics.get(toolName);
  }

  /**
   * Get metrics for all tools.
   */
  getAllToolMetrics(): Record<string, { calls: number; errors: number; avgDurationMs: number }> {
    const result: Record<string, { calls: number; errors: number; avgDurationMs: number }> = {};
    for (const [name, metrics] of this.toolMetrics) {
      result[name] = {
        calls: metrics.calls,
        errors: metrics.errors,
        avgDurationMs: metrics.calls > 0 ? metrics.totalDurationMs / metrics.calls : 0,
      };
    }
    return result;
  }

  /**
   * Get query metrics.
   */
  getQueryMetrics() {
    return {
      total: this.queryMetrics.total,
      errors: this.queryMetrics.errors,
      avgDurationMs: this.queryMetrics.total > 0 
        ? this.queryMetrics.totalDurationMs / this.queryMetrics.total 
        : 0,
    };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.toolMetrics.clear();
    this.queryMetrics = { total: 0, errors: 0, totalDurationMs: 0 };
  }
}
