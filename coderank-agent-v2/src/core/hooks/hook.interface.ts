/**
 * Hook events that can be triggered during agent execution.
 */
export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'PreQuery' | 'PostQuery';

/**
 * Context provided to hooks during execution.
 */
export interface HookContext {
  event: HookEvent;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  isError?: boolean;
  query?: string;
  response?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by a hook after execution.
 */
export interface HookResult {
  /** Action to take based on hook execution */
  action: 'allow' | 'deny' | 'warn' | 'modify';
  /** Optional message explaining the result */
  message?: string;
  /** Modified output (only used when action is 'modify') */
  modifiedOutput?: unknown;
}

/**
 * Hook interface for extending agent behavior.
 * Hooks can intercept and modify tool execution flow.
 */
export interface IHook {
  /** Unique name for this hook */
  name: string;
  /** Event(s) this hook responds to */
  events: HookEvent[];
  /** Priority for execution order (lower = earlier) */
  priority?: number;
  /** Execute the hook logic */
  execute(context: HookContext): Promise<HookResult>;
}
