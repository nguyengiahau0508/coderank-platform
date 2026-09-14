import { IHook, HookEvent, HookContext, HookResult } from './hook.interface';

/**
 * Manages and executes hooks in the agent lifecycle.
 * Hooks are executed in priority order (lower priority number = earlier execution).
 */
export class HookRunner {
  private hooks: IHook[] = [];

  /**
   * Register a hook with the runner.
   */
  register(hook: IHook): this {
    this.hooks.push(hook);
    // Sort by priority (lower = earlier)
    this.hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    return this;
  }

  /**
   * Register multiple hooks at once.
   */
  registerMany(hooks: IHook[]): this {
    hooks.forEach(hook => this.register(hook));
    return this;
  }

  /**
   * Unregister a hook by name.
   */
  unregister(hookName: string): boolean {
    const index = this.hooks.findIndex(h => h.name === hookName);
    if (index >= 0) {
      this.hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all registered hooks.
   */
  getAll(): IHook[] {
    return [...this.hooks];
  }

  /**
   * Get hooks that respond to a specific event.
   */
  getForEvent(event: HookEvent): IHook[] {
    return this.hooks.filter(h => h.events.includes(event));
  }

  /**
   * Run all hooks for a PreToolUse event.
   * Returns deny result if any hook denies, otherwise allow.
   */
  async runPreToolUse(toolName: string, input: unknown): Promise<HookResult> {
    const context: HookContext = {
      event: 'PreToolUse',
      toolName,
      toolInput: input,
    };

    return this.runHooks('PreToolUse', context);
  }

  /**
   * Run all hooks for a PostToolUse event.
   * Can modify the tool output if a hook returns action: 'modify'.
   */
  async runPostToolUse(
    toolName: string,
    input: unknown,
    output: unknown,
    isError: boolean
  ): Promise<HookResult & { finalOutput?: unknown }> {
    const context: HookContext = {
      event: 'PostToolUse',
      toolName,
      toolInput: input,
      toolOutput: output,
      isError,
    };

    const result = await this.runHooks('PostToolUse', context);
    return {
      ...result,
      finalOutput: result.action === 'modify' ? result.modifiedOutput : output,
    };
  }

  /**
   * Run all hooks for a PreQuery event.
   */
  async runPreQuery(query: string): Promise<HookResult> {
    const context: HookContext = {
      event: 'PreQuery',
      query,
    };

    return this.runHooks('PreQuery', context);
  }

  /**
   * Run all hooks for a PostQuery event.
   */
  async runPostQuery(query: string, response: string): Promise<HookResult> {
    const context: HookContext = {
      event: 'PostQuery',
      query,
      response,
    };

    return this.runHooks('PostQuery', context);
  }

  /**
   * Internal method to run hooks for a specific event.
   */
  private async runHooks(event: HookEvent, context: HookContext): Promise<HookResult> {
    const hooks = this.getForEvent(event);
    
    let finalResult: HookResult = { action: 'allow' };

    for (const hook of hooks) {
      try {
        const result = await hook.execute(context);

        // Deny takes precedence
        if (result.action === 'deny') {
          return result;
        }

        // Warn is logged but continues
        if (result.action === 'warn') {
          console.warn(`[Hook:${hook.name}] Warning: ${result.message}`);
          finalResult = result;
        }

        // Modify updates the output for subsequent hooks
        if (result.action === 'modify' && result.modifiedOutput !== undefined) {
          context.toolOutput = result.modifiedOutput;
          finalResult = result;
        }
      } catch (error: any) {
        console.error(`[Hook:${hook.name}] Error during execution:`, error.message);
        // Continue with other hooks on error
      }
    }

    return finalResult;
  }
}
