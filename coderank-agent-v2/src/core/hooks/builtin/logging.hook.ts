import { IHook, HookContext, HookResult, HookEvent } from '../hook.interface';

/**
 * Built-in logging hook that logs all tool executions.
 * Useful for debugging and monitoring agent behavior.
 */
export class LoggingHook implements IHook {
  readonly name = 'builtin:logging';
  readonly events: HookEvent[] = ['PreToolUse', 'PostToolUse'];
  readonly priority = 0; // Run first

  private logPrefix: string;
  private verbose: boolean;

  constructor(options?: { logPrefix?: string; verbose?: boolean }) {
    this.logPrefix = options?.logPrefix ?? '[Hook:Logging]';
    this.verbose = options?.verbose ?? false;
  }

  async execute(context: HookContext): Promise<HookResult> {
    if (context.event === 'PreToolUse') {
      console.log(`${this.logPrefix} PreToolUse: ${context.toolName}`);
      if (this.verbose && context.toolInput) {
        console.log(`${this.logPrefix}   Input:`, JSON.stringify(context.toolInput, null, 2));
      }
    }

    if (context.event === 'PostToolUse') {
      const status = context.isError ? 'ERROR' : 'OK';
      console.log(`${this.logPrefix} PostToolUse: ${context.toolName} [${status}]`);
      if (this.verbose && context.toolOutput) {
        const outputStr = JSON.stringify(context.toolOutput);
        const truncated = outputStr.length > 500 ? outputStr.slice(0, 500) + '...' : outputStr;
        console.log(`${this.logPrefix}   Output:`, truncated);
      }
    }

    return { action: 'allow' };
  }
}
