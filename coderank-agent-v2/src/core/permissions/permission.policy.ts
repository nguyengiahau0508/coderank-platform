import {
  PermissionMode,
  PermissionOutcome,
  IPermissionPolicy,
} from './permission.interface';

/**
 * Default permission requirements for built-in tools.
 * Keep explicit overrides for exceptions, then apply naming conventions.
 */
const DEFAULT_TOOL_PERMISSIONS: Record<string, PermissionMode> = {
  // Read-only tools (explicit exceptions + AI analysis helpers)
  get_problems: PermissionMode.ReadOnly,
  get_problem: PermissionMode.ReadOnly,
  get_my_problems: PermissionMode.ReadOnly,
  get_testcases: PermissionMode.ReadOnly,
  get_hints: PermissionMode.ReadOnly,
  get_submission: PermissionMode.ReadOnly,
  get_my_submissions: PermissionMode.ReadOnly,
  get_courses: PermissionMode.ReadOnly,
  get_course: PermissionMode.ReadOnly,
  get_my_courses: PermissionMode.ReadOnly,
  get_lesson: PermissionMode.ReadOnly,
  download_assignment_submission: PermissionMode.ReadOnly,
  analyze_code_structure: PermissionMode.ReadOnly,
  analyze_complexity: PermissionMode.ReadOnly,
  analyze_code_quality: PermissionMode.ReadOnly,
  suggest_algorithm: PermissionMode.ReadOnly,
  suggest_data_structure: PermissionMode.ReadOnly,
  generate_problem: PermissionMode.ReadOnly,
};

const WRITE_TOOL_PREFIXES = [
  'create_',
  'update_',
  'delete_',
  'submit_',
  'add_',
  'remove_',
  'mark_',
  'enroll_',
  'unenroll_',
  'grade_',
  'duplicate_',
];

/**
 * Permission level comparison (higher value = more permissions)
 */
const PERMISSION_LEVELS: Record<PermissionMode, number> = {
  [PermissionMode.ReadOnly]: 1,
  [PermissionMode.WorkspaceWrite]: 2,
  [PermissionMode.DangerFullAccess]: 3,
};

/**
 * Permission policy implementation.
 * Checks if the active mode meets the required permission for a tool.
 */
export class PermissionPolicy implements IPermissionPolicy {
  private toolOverrides = new Map<string, PermissionMode>();

  constructor(public readonly activeMode: PermissionMode = PermissionMode.DangerFullAccess) {}

  getRequiredMode(toolName: string): PermissionMode {
    // Check for tool-specific override first
    if (this.toolOverrides.has(toolName)) {
      return this.toolOverrides.get(toolName)!;
    }

    if (DEFAULT_TOOL_PERMISSIONS[toolName]) {
      return DEFAULT_TOOL_PERMISSIONS[toolName];
    }

    // Convention-based fallback to avoid stale hard-coded mapping.
    if (WRITE_TOOL_PREFIXES.some(prefix => toolName.startsWith(prefix))) {
      return PermissionMode.WorkspaceWrite;
    }

    return PermissionMode.ReadOnly;
  }

  authorize(toolName: string, input: unknown): PermissionOutcome {
    const requiredMode = this.getRequiredMode(toolName);
    const activeLevel = PERMISSION_LEVELS[this.activeMode];
    const requiredLevel = PERMISSION_LEVELS[requiredMode];

    if (activeLevel >= requiredLevel) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Tool '${toolName}' requires '${requiredMode}' permission, but current mode is '${this.activeMode}'`,
    };
  }

  setToolOverride(toolName: string, mode: PermissionMode): void {
    this.toolOverrides.set(toolName, mode);
  }

  /**
   * Create a policy with full access (for backward compatibility).
   */
  static fullAccess(): PermissionPolicy {
    return new PermissionPolicy(PermissionMode.DangerFullAccess);
  }

  /**
   * Create a policy with read-only access.
   */
  static readOnly(): PermissionPolicy {
    return new PermissionPolicy(PermissionMode.ReadOnly);
  }

  /**
   * Create a policy with workspace write access.
   */
  static workspaceWrite(): PermissionPolicy {
    return new PermissionPolicy(PermissionMode.WorkspaceWrite);
  }
}
