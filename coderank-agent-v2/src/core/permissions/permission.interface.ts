/**
 * Permission modes from lowest to highest access level.
 * Based on AGENT_DESIGN.md permission hierarchy.
 */
export enum PermissionMode {
  /** Read-only operations: read_file, grep, glob, search */
  ReadOnly = 'read-only',
  /** Write operations within workspace: write_file, edit_file, create_file */
  WorkspaceWrite = 'workspace-write',
  /** Dangerous operations: bash, external API calls, agent spawning */
  DangerFullAccess = 'danger-full-access',
}

/**
 * Result of a permission check.
 */
export type PermissionOutcome =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Request context for permission check.
 */
export interface PermissionRequest {
  toolName: string;
  toolInput: unknown;
  requiredMode: PermissionMode;
}

/**
 * Permission policy for controlling tool access.
 */
export interface IPermissionPolicy {
  /** Current active permission mode */
  readonly activeMode: PermissionMode;
  
  /** Get required permission mode for a specific tool */
  getRequiredMode(toolName: string): PermissionMode;
  
  /** Check if a tool call is authorized */
  authorize(toolName: string, input: unknown): PermissionOutcome;
  
  /** Set override for a specific tool */
  setToolOverride(toolName: string, mode: PermissionMode): void;
}
