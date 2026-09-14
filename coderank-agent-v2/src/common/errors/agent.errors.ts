/**
 * Error codes for categorizing agent errors.
 */
export enum AgentErrorCode {
  // LLM Provider Errors (1xxx)
  LLM_PROVIDER_ERROR = 1000,
  LLM_RATE_LIMIT = 1001,
  LLM_SERVICE_UNAVAILABLE = 1002,
  LLM_INVALID_RESPONSE = 1003,
  LLM_CONTEXT_OVERFLOW = 1004,
  LLM_AUTHENTICATION_FAILED = 1005,

  // Tool Errors (2xxx)
  TOOL_NOT_FOUND = 2000,
  TOOL_VALIDATION_FAILED = 2001,
  TOOL_EXECUTION_FAILED = 2002,
  TOOL_PERMISSION_DENIED = 2003,
  TOOL_TIMEOUT = 2004,
  TOOL_HOOK_DENIED = 2005,

  // Session Errors (3xxx)
  SESSION_NOT_FOUND = 3000,
  SESSION_SAVE_FAILED = 3001,
  SESSION_LOAD_FAILED = 3002,
  SESSION_CORRUPTED = 3003,

  // API Client Errors (4xxx)
  API_CONNECTION_FAILED = 4000,
  API_AUTHENTICATION_FAILED = 4001,
  API_REQUEST_FAILED = 4002,
  API_TIMEOUT = 4003,

  // Agent Errors (5xxx)
  AGENT_NOT_INITIALIZED = 5000,
  AGENT_MAX_ITERATIONS = 5001,
  AGENT_UNKNOWN_ERROR = 5999,
}

/**
 * Base error class for all agent-related errors.
 */
export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly isRetryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AgentErrorCode,
    message: string,
    options?: {
      isRetryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;
    this.details = options?.details;

    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }

  /**
   * Create a user-friendly error message.
   */
  toUserMessage(): string {
    switch (this.code) {
      case AgentErrorCode.LLM_SERVICE_UNAVAILABLE:
        return 'AI service is temporarily unavailable. Please try again in a moment.';
      case AgentErrorCode.LLM_RATE_LIMIT:
        return 'Too many requests. Please wait a moment before trying again.';
      case AgentErrorCode.TOOL_PERMISSION_DENIED:
        return 'You do not have permission to perform this action.';
      case AgentErrorCode.TOOL_NOT_FOUND:
        return 'The requested operation is not available.';
      case AgentErrorCode.API_CONNECTION_FAILED:
        return 'Unable to connect to the server. Please check your connection.';
      case AgentErrorCode.AGENT_MAX_ITERATIONS:
        return 'I was unable to complete the task after multiple attempts. Please try rephrasing your request.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Convert to a JSON-serializable object.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      isRetryable: this.isRetryable,
      details: this.details,
    };
  }
}

/**
 * LLM provider-specific error.
 */
export class LLMError extends AgentError {
  readonly provider: string;

  constructor(
    code: AgentErrorCode,
    message: string,
    provider: string,
    options?: {
      isRetryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'LLMError';
    this.provider = provider;
  }

  static serviceUnavailable(provider: string, cause?: Error): LLMError {
    return new LLMError(
      AgentErrorCode.LLM_SERVICE_UNAVAILABLE,
      `${provider} service is temporarily unavailable`,
      provider,
      { isRetryable: true, cause }
    );
  }

  static rateLimited(provider: string): LLMError {
    return new LLMError(
      AgentErrorCode.LLM_RATE_LIMIT,
      `Rate limit exceeded for ${provider}`,
      provider,
      { isRetryable: true }
    );
  }

  static authenticationFailed(provider: string): LLMError {
    return new LLMError(
      AgentErrorCode.LLM_AUTHENTICATION_FAILED,
      `Authentication failed for ${provider}`,
      provider,
      { isRetryable: false }
    );
  }
}

/**
 * Tool execution error.
 */
export class ToolError extends AgentError {
  readonly toolName: string;

  constructor(
    code: AgentErrorCode,
    message: string,
    toolName: string,
    options?: {
      isRetryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'ToolError';
    this.toolName = toolName;
  }

  static notFound(toolName: string): ToolError {
    return new ToolError(
      AgentErrorCode.TOOL_NOT_FOUND,
      `Tool '${toolName}' not found`,
      toolName,
      { isRetryable: false }
    );
  }

  static validationFailed(toolName: string, details: Record<string, unknown>): ToolError {
    return new ToolError(
      AgentErrorCode.TOOL_VALIDATION_FAILED,
      `Validation failed for tool '${toolName}'`,
      toolName,
      { isRetryable: false, details }
    );
  }

  static executionFailed(toolName: string, cause: Error): ToolError {
    return new ToolError(
      AgentErrorCode.TOOL_EXECUTION_FAILED,
      `Tool '${toolName}' execution failed: ${cause.message}`,
      toolName,
      { isRetryable: false, cause }
    );
  }

  static permissionDenied(toolName: string, reason: string): ToolError {
    return new ToolError(
      AgentErrorCode.TOOL_PERMISSION_DENIED,
      `Permission denied for tool '${toolName}': ${reason}`,
      toolName,
      { isRetryable: false, details: { reason } }
    );
  }

  static hookDenied(toolName: string, hookName: string, reason: string): ToolError {
    return new ToolError(
      AgentErrorCode.TOOL_HOOK_DENIED,
      `Hook '${hookName}' denied tool '${toolName}': ${reason}`,
      toolName,
      { isRetryable: false, details: { hookName, reason } }
    );
  }
}

/**
 * Session-related error.
 */
export class SessionError extends AgentError {
  readonly sessionId?: string;

  constructor(
    code: AgentErrorCode,
    message: string,
    sessionId?: string,
    options?: {
      isRetryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'SessionError';
    this.sessionId = sessionId;
  }

  static notFound(sessionId: string): SessionError {
    return new SessionError(
      AgentErrorCode.SESSION_NOT_FOUND,
      `Session '${sessionId}' not found`,
      sessionId,
      { isRetryable: false }
    );
  }

  static saveFailed(sessionId: string, cause: Error): SessionError {
    return new SessionError(
      AgentErrorCode.SESSION_SAVE_FAILED,
      `Failed to save session '${sessionId}'`,
      sessionId,
      { isRetryable: true, cause }
    );
  }

  static loadFailed(sessionId: string, cause: Error): SessionError {
    return new SessionError(
      AgentErrorCode.SESSION_LOAD_FAILED,
      `Failed to load session '${sessionId}'`,
      sessionId,
      { isRetryable: true, cause }
    );
  }
}

/**
 * API client error.
 */
export class ApiClientError extends AgentError {
  readonly statusCode?: number;
  readonly endpoint?: string;

  constructor(
    code: AgentErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      endpoint?: string;
      isRetryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'ApiClientError';
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
  }

  static connectionFailed(endpoint: string, cause?: Error): ApiClientError {
    return new ApiClientError(
      AgentErrorCode.API_CONNECTION_FAILED,
      `Failed to connect to ${endpoint}`,
      { endpoint, isRetryable: true, cause }
    );
  }

  static requestFailed(endpoint: string, statusCode: number, message: string): ApiClientError {
    return new ApiClientError(
      AgentErrorCode.API_REQUEST_FAILED,
      `Request to ${endpoint} failed: ${message}`,
      { endpoint, statusCode, isRetryable: statusCode >= 500 }
    );
  }
}

/**
 * Determine if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AgentError) {
    return error.isRetryable;
  }

  // Check for common retryable error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('service unavailable') ||
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }

  return false;
}

/**
 * Wrap an unknown error in an AgentError.
 */
export function wrapError(error: unknown, context?: string): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new AgentError(
    AgentErrorCode.AGENT_UNKNOWN_ERROR,
    context ? `${context}: ${message}` : message,
    { cause }
  );
}
