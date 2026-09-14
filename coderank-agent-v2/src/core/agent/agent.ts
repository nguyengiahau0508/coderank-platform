import { ILLMProvider, ILLMConfig } from '../llm/llm.interface';
import { LLMFactory, LLMProviderType } from '../llm/llm.factory';
import { ToolRegistry, registerAllTools } from '../tools';
import { createInternalClient } from '../../api/api-client';
import { STUDENT_SYSTEM_PROMPT,LECTURER_SYSTEM_PROMPT,ADMIN_SYSTEM_PROMPT, SYSTEM_PROMPT } from '../../prompts/system.prompt';
import { RolesEnum } from '../../common/enums/enums';
import { config } from '../../config';
import { ContextWindowManager, ContextWindowPolicy } from '../context-window';
import { UsageTracker, UsageStats } from '../usage';
import { PermissionPolicy, PermissionMode } from '../permissions';
import { HookRunner, IHook, LoggingHook } from '../hooks';

export interface ChatContext {
  type: 'problem' | 'course' | 'lesson' | 'contest' | 'submission';
  title: string;
  description?: string;
  problemId?: string;
  difficulty?: string;
  tags?: string[];
  userCode?: string;
  lastSubmissionStatus?: string;
  courseId?: string;
  level?: string;
  currentLessonTitle?: string;
  lessonId?: string;
  courseTitle?: string;
  contestId?: string;
  currentProblemTitle?: string;
  submissionId?: string;
  problemTitle?: string;
  status?: string;
  language?: string;
}

export class Agent {
  private llm: ILLMProvider;
  private toolRegistry: ToolRegistry;
  private contextWindowManager: ContextWindowManager;
  private usageTracker: UsageTracker;
  private permissionPolicy: PermissionPolicy;
  private hookRunner: HookRunner;
  private readonly LLM_RETRY_ATTEMPTS = 2;
  private readonly LLM_RETRY_BASE_DELAY_MS = 700;
  private readonly systemPrompt: string;
  private readonly providerConfig?: ILLMConfig;
  private readonly initialHistory: ILLMConfig['initialHistory'];
  private currentProviderType: LLMProviderType;

  constructor(role: RolesEnum, providerName?: string, modelName?: string, providerConfig?: ILLMConfig) {
    const contextPolicy = this.buildContextPolicy(providerConfig?.contextPolicy);
    this.contextWindowManager = new ContextWindowManager(contextPolicy);
    
    // Initialize usage tracker, permission policy, and hook runner
    this.usageTracker = new UsageTracker();
    this.permissionPolicy = this.buildPermissionPolicy(role);
    this.hookRunner = new HookRunner();
    this.registerDefaultHooks();

    this.providerConfig = providerConfig;
    this.initialHistory = providerConfig?.initialHistory;
    this.currentProviderType = LLMFactory.normalizeProviderType(providerName);
    this.llm = LLMFactory.createProvider(this.currentProviderType, modelName, providerConfig);
    
    this.toolRegistry = new ToolRegistry();
    this.registerDefaultTools();

    let systemPrompt = SYSTEM_PROMPT;
    switch (role) {
      case RolesEnum.Admin:
        systemPrompt = ADMIN_SYSTEM_PROMPT;
        break;
      case RolesEnum.Instructor:
        systemPrompt = LECTURER_SYSTEM_PROMPT;
        break;
      case RolesEnum.Student:
        systemPrompt = STUDENT_SYSTEM_PROMPT;
        break;
    }
    this.systemPrompt = systemPrompt;
    this.llm.init(systemPrompt, this.toolRegistry.getAll(), providerConfig?.initialHistory);
  }

  private buildPermissionPolicy(role: RolesEnum): PermissionPolicy {
    // Admin and Instructor get full access, Student gets workspace write
    switch (role) {
      case RolesEnum.Admin:
        return PermissionPolicy.fullAccess();
      case RolesEnum.Instructor:
        return PermissionPolicy.fullAccess();
      case RolesEnum.Student:
        return PermissionPolicy.workspaceWrite();
      default:
        return PermissionPolicy.readOnly();
    }
  }

  /**
   * Get usage statistics for this agent session.
   */
  getUsageStats(): UsageStats {
    return this.usageTracker.getStats();
  }

  /**
   * Register a custom hook with the agent.
   */
  registerHook(hook: IHook): this {
    this.hookRunner.register(hook);
    return this;
  }

  /**
   * Get the hook runner for advanced hook management.
   */
  getHookRunner(): HookRunner {
    return this.hookRunner;
  }

  private registerDefaultHooks(): void {
    // Register built-in logging hook (disabled by default, enable via env)
    if (config.AGENT_HOOKS_LOGGING_ENABLED) {
      this.hookRunner.register(new LoggingHook({ verbose: config.AGENT_HOOKS_LOGGING_VERBOSE }));
    }
  }

  private buildContextPolicy(overrides?: Partial<ContextWindowPolicy>): ContextWindowPolicy {
    const basePolicy: ContextWindowPolicy = {
      maxInputTokens: config.CONTEXT_WINDOW_MAX_INPUT_TOKENS,
      outputReserveTokens: config.CONTEXT_WINDOW_OUTPUT_RESERVE_TOKENS,
      historyRetentionRatio: config.CONTEXT_WINDOW_HISTORY_RETENTION_RATIO,
      maxToolResponseChars: config.CONTEXT_WINDOW_TOOL_RESULT_MAX_CHARS,
      maxToolResponsesTotalChars: config.CONTEXT_WINDOW_TOOL_RESULTS_MAX_TOTAL_CHARS,
      summaryMaxChars: config.CONTEXT_WINDOW_SUMMARY_MAX_CHARS,
    };

    return {
      ...basePolicy,
      ...overrides,
    };
  }

  private registerDefaultTools() {
    registerAllTools(this.toolRegistry);
  }

  private async wait(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private getLlmErrorMetadata(error: any): { status: number; message: string } {
    const rawStatus = error?.status_code ?? error?.status ?? error?.response?.status;
    const status = Number.isFinite(Number(rawStatus)) ? Number(rawStatus) : 0;

    const messageParts = [
      error?.message,
      error?.error,
      error?.response?.data?.error?.message,
      error?.response?.statusText,
    ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

    return {
      status,
      message: messageParts.join(' | ').toLowerCase(),
    };
  }

  private isRetryableLlmError(error: any): boolean {
    const { status, message } = this.getLlmErrorMetadata(error);

    if ([408, 429, 500, 502, 503, 504].includes(status)) {
      return true;
    }

    return (
      message.includes('service temporarily unavailable') ||
      message.includes('temporarily unavailable') ||
      message.includes('internal server error') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('rate limit') ||
      message.includes('try again later') ||
      message.includes('overloaded') ||
      message.includes('fetch failed') ||
      message.includes('connection reset') ||
      message.includes('econnreset') ||
      message.includes('socket hang up')
    );
  }

  private isProviderAuthError(error: any): boolean {
    const { status, message } = this.getLlmErrorMetadata(error);

    const hasAuthKeyword =
      message.includes('api key not valid') ||
      message.includes('api_key_invalid') ||
      message.includes('invalid api key') ||
      message.includes('authentication failed') ||
      message.includes('unauthorized') ||
      message.includes('invalid token') ||
      message.includes('forbidden');

    return status === 401 || status === 403 || hasAuthKeyword;
  }

  private async trySwitchProvider(
    attemptedProviders: Set<LLMProviderType>,
    logPrefix: string,
    onEvent?: (event: { type: string; content?: string }) => void,
  ): Promise<boolean> {
    const fallbackProviders = LLMFactory.getFallbackProviders(this.currentProviderType)
      .filter(provider => !attemptedProviders.has(provider));

    if (fallbackProviders.length === 0) {
      return false;
    }

    for (const providerType of fallbackProviders) {
      try {
        const fallbackConfig: ILLMConfig = {
          contextPolicy: this.providerConfig?.contextPolicy,
          initialHistory: this.initialHistory,
        };

        const fallbackProvider = LLMFactory.createProvider(
          providerType,
          undefined,
          fallbackConfig,
        );
        fallbackProvider.init(
          this.systemPrompt,
          this.toolRegistry.getAll(),
          this.initialHistory,
        );

        this.llm = fallbackProvider;
        this.currentProviderType = providerType;
        attemptedProviders.add(providerType);

        console.warn(`${logPrefix}:LLMFallback] Switched to provider '${providerType}'.`);
        if (onEvent) {
          onEvent({ type: 'status', content: `Đang chuyển sang provider ${providerType}...` });
        }
        return true;
      } catch (error: any) {
        console.warn(
          `${logPrefix}:LLMFallback] Provider '${providerType}' is not available: ${error?.message ?? 'unknown error'}`,
        );
        attemptedProviders.add(providerType);
      }
    }

    return false;
  }

  private async sendMessageWithRetry(
    message: any,
    logPrefix: string,
    onEvent?: (event: { type: string; content?: string }) => void,
  ) {
    const attemptedProviders = new Set<LLMProviderType>([this.currentProviderType]);
    let retryAttempt = 0;

    while (true) {
      try {
        return await this.llm.sendMessage(message);
      } catch (error: any) {
        const retryable = this.isRetryableLlmError(error);
        const canRetry = retryable && retryAttempt < this.LLM_RETRY_ATTEMPTS;
        const { status, message: normalizedMessage } = this.getLlmErrorMetadata(error);
        const shortMessage = normalizedMessage ? normalizedMessage.slice(0, 180) : 'unknown error';

        if (canRetry) {
          const delay = this.LLM_RETRY_BASE_DELAY_MS * (retryAttempt + 1);
          retryAttempt += 1;
          console.warn(
            `${logPrefix}:LLMRetry] Transient provider error (status=${status || 'n/a'}, attempt ${retryAttempt}/${this.LLM_RETRY_ATTEMPTS + 1}): ${shortMessage}. Retrying in ${delay}ms...`,
          );
          if (onEvent) {
            onEvent({ type: 'status', content: 'LLM tạm thời quá tải, đang thử lại...' });
          }
          await this.wait(delay);
          continue;
        }

        const shouldFallback = typeof message === 'string' && (this.isProviderAuthError(error) || retryable);
        if (shouldFallback) {
          const switched = await this.trySwitchProvider(attemptedProviders, logPrefix, onEvent);
          if (switched) {
            retryAttempt = 0;
            continue;
          }
        }

        throw error;
      }
    }
  }

  private extractValidationIssues(error: any): Array<{ code?: string; expected?: string; path?: Array<string | number> }> {
    if (Array.isArray(error?.issues)) {
      return error.issues;
    }

    const message = error?.message;
    if (typeof message !== 'string') {
      return [];
    }

    try {
      const parsed = JSON.parse(message);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getByPath(source: any, path: Array<string | number>) {
    return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
  }

  private setByPath(target: any, path: Array<string | number>, value: unknown) {
    if (path.length === 0) {
      return;
    }

    let cursor = target;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (cursor[key] == null || typeof cursor[key] !== 'object') {
        return;
      }
      cursor = cursor[key];
    }

    const leafKey = path[path.length - 1];
    cursor[leafKey] = value;
  }

  private coerceByValidationIssues(args: unknown, error: any): unknown {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return null;
    }

    const issues = this.extractValidationIssues(error);
    if (issues.length === 0) {
      return null;
    }

    const clonedArgs = JSON.parse(JSON.stringify(args));
    let hasChanges = false;

    for (const issue of issues) {
      if (issue?.code !== 'invalid_type' || !Array.isArray(issue.path) || issue.path.length === 0) {
        continue;
      }

      const currentValue = this.getByPath(clonedArgs, issue.path);
      if (typeof currentValue !== 'string') {
        continue;
      }

      if (issue.expected === 'number') {
        const numeric = Number(currentValue);
        if (!Number.isNaN(numeric)) {
          this.setByPath(clonedArgs, issue.path, numeric);
          hasChanges = true;
        }
      }

      if (issue.expected === 'boolean') {
        const lowered = currentValue.trim().toLowerCase();
        if (lowered === 'true' || lowered === 'false') {
          this.setByPath(clonedArgs, issue.path, lowered === 'true');
          hasChanges = true;
        }
      }
    }

    return hasChanges ? clonedArgs : null;
  }

  private async executeToolWithRecovery(tool: any, rawArgs: unknown, apiClient: any, logPrefix: string) {
    try {
      return await tool.execute(rawArgs, apiClient);
    } catch (error: any) {
      const repairedArgs = this.coerceByValidationIssues(rawArgs, error);
      if (!repairedArgs) {
        throw error;
      }

      console.warn(`${logPrefix}:ToolRecovery] Retrying ${tool.name} with coerced argument types.`);
      return await tool.execute(repairedArgs, apiClient);
    }
  }

  private formatContextMessage(context: ChatContext): string {
    let contextMsg = `\n[USER CONTEXT]\n`;
    contextMsg += `The user is currently viewing: ${context.type.toUpperCase()}\n`;
    contextMsg += `Title: ${context.title}\n`;

    switch (context.type) {
      case 'problem':
        if (context.difficulty) contextMsg += `Difficulty: ${context.difficulty}\n`;
        if (context.tags?.length) contextMsg += `Tags: ${context.tags.join(', ')}\n`;
        if (context.description) {
          const truncatedDesc = context.description.length > 500 
            ? context.description.substring(0, 500) + '...' 
            : context.description;
          contextMsg += `Description: ${truncatedDesc}\n`;
        }
        if (context.userCode) {
          const truncatedCode = context.userCode.length > 1000
            ? context.userCode.substring(0, 1000) + '...'
            : context.userCode;
          contextMsg += `User's current code:\n\`\`\`\n${truncatedCode}\n\`\`\`\n`;
        }
        if (context.lastSubmissionStatus) {
          contextMsg += `Last submission status: ${context.lastSubmissionStatus}\n`;
        }
        break;

      case 'course':
        if (context.level) contextMsg += `Level: ${context.level}\n`;
        if (context.currentLessonTitle) contextMsg += `Current lesson: ${context.currentLessonTitle}\n`;
        break;

      case 'lesson':
        if (context.courseTitle) contextMsg += `Course: ${context.courseTitle}\n`;
        break;

      case 'contest':
        if (context.currentProblemTitle) contextMsg += `Current problem: ${context.currentProblemTitle}\n`;
        break;

      case 'submission':
        if (context.problemTitle) contextMsg += `Problem: ${context.problemTitle}\n`;
        if (context.status) contextMsg += `Status: ${context.status}\n`;
        if (context.language) contextMsg += `Language: ${context.language}\n`;
        break;
    }

    contextMsg += `[END CONTEXT]\n\n`;
    return contextMsg;
  }

  async processQuery(userToken: string, userMessage: string, context?: ChatContext): Promise<string> {
    const apiClient = createInternalClient(userToken);
    
    // Reset usage tracker for new query
    this.usageTracker.reset();
    
    // Prepend context to user message if available
    let currentMessage: any = context 
      ? this.formatContextMessage(context) + userMessage 
      : userMessage;
    
    const MAX_ITERATIONS = 20;

    // Log the initial user query
    console.log(`\n==================================================`);
    console.log(`[Agent:Start] User query: "${userMessage}"`);

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`[Agent:Iteration ${i + 1}] Processing with LLM...`);
        // Send message to LLM
        const response = await this.sendMessageWithRetry(currentMessage, '[Agent');

        // Track usage if available
        if (response.usage) {
          this.usageTracker.record(response.usage);
        }

        // Record any intermediate thoughts or partial responses before tools
        if (response.text && response.toolCalls && response.toolCalls.length > 0) {
          console.log(`[Agent:Thought] Partial output before tools:`, response.text);
        }

        // If tools are required, execute them
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log(`[Agent:Tools] Requested ${response.toolCalls.length} tool(s).`);
          const toolResponses: any[] = [];

          for (const call of response.toolCalls) {
            console.log(`[Agent:ToolCall] -> Tool: ${call.name} | Args:`, JSON.stringify(call.arguments));
            
            const tool = this.toolRegistry.get(call.name);

            if (tool) {
              // Check permission before executing tool
              const permissionCheck = this.permissionPolicy.authorize(call.name, call.arguments);
              if (!permissionCheck.allowed) {
                console.warn(`[Agent:Permission] DENIED tool: ${call.name} - ${permissionCheck.reason}`);
                toolResponses.push({
                  functionResponse: {
                    name: call.name,
                    response: { error: `Permission denied: ${permissionCheck.reason}` }
                  }
                });
                continue;
              }

              // Run PreToolUse hooks
              const preHookResult = await this.hookRunner.runPreToolUse(call.name, call.arguments);
              if (preHookResult.action === 'deny') {
                console.warn(`[Agent:Hook] DENIED tool: ${call.name} - ${preHookResult.message}`);
                toolResponses.push({
                  functionResponse: {
                    name: call.name,
                    response: { error: `Hook denied: ${preHookResult.message}` }
                  }
                });
                continue;
              }

              try {
                this.usageTracker.recordToolCall();
                let apiResult = await this.executeToolWithRecovery(
                  tool,
                  call.arguments,
                  apiClient,
                  '[Agent',
                );
                
                // Run PostToolUse hooks
                const postHookResult = await this.hookRunner.runPostToolUse(call.name, call.arguments, apiResult, false);
                if (postHookResult.finalOutput !== undefined) {
                  apiResult = postHookResult.finalOutput;
                }

                console.log(`[Agent:ToolResult] <- Tool: ${tool.name} returned successfully.`);
                toolResponses.push({
                  functionResponse: {
                    name: tool.name,
                    response: apiResult
                  }
                });
              } catch (error: any) {
                // Run PostToolUse hooks for error case
                await this.hookRunner.runPostToolUse(call.name, call.arguments, { error: error.message }, true);
                
                console.error(`[Agent:ToolError] ERROR in ${tool.name}:`, error.message);
                toolResponses.push({
                  functionResponse: {
                    name: tool.name,
                    response: { error: error.message }
                  }
                });
              }
            } else {
              console.warn(`[Agent:ToolWarning] LLM requested unregistered tool: ${call.name}`);
              toolResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: `Tool ${call.name} not found` }
                }
              });
            }
          }

          const compactionResult = this.contextWindowManager.compactToolResponses(toolResponses);
          if (compactionResult.compactedCount > 0) {
            console.warn(
              `[Agent:Context] Compacted ${compactionResult.compactedCount} tool result(s) (${compactionResult.totalCharsBefore} -> ${compactionResult.totalCharsAfter} chars).`,
            );
          }

          // Output the result of tools as the next message to the LLM
          currentMessage = compactionResult.payload;
        } else if (response.text) {
          // If no tools required and we have text, return the final response
          this.logUsageStats();
          console.log(`[Agent:Finish] Returning final answer.`);
          console.log(`==================================================\n`);
          return response.text;
        }
      }
    } catch (error: any) {
      console.error("[Agent Error]:", error);
      this.logUsageStats();
      return "Tôi gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại!";
    }

    this.logUsageStats();
    return "Xin lỗi, tôi không thể tìm ra giải pháp sau nhiều bước xử lý.";
  }

  async processQueryStream(
    userToken: string,
    userMessage: string,
    onEvent: (event: { type: string; content?: string }) => void,
    context?: ChatContext,
  ): Promise<string> {
    const apiClient = createInternalClient(userToken);
    
    // Reset usage tracker for new query
    this.usageTracker.reset();
    
    // Prepend context to user message if available
    let currentMessage: any = context 
      ? this.formatContextMessage(context) + userMessage 
      : userMessage;
    
    const MAX_ITERATIONS = 10;

    console.log(`\n==================================================`);
    console.log(`[Agent:Stream:Start] User query: "${userMessage}"`);
    if (context) {
      console.log(`[Agent:Stream:Context] Type: ${context.type}, Title: ${context.title}`);
    }
    onEvent({ type: 'status', content: 'Thinking...' });

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`[Agent:Stream:Iteration ${i + 1}] Processing with LLM...`);
        const response = await this.sendMessageWithRetry(currentMessage, '[Agent:Stream', onEvent);

        // Track usage if available
        if (response.usage) {
          this.usageTracker.record(response.usage);
        }

        if (response.text && response.toolCalls && response.toolCalls.length > 0) {
          console.log(`[Agent:Stream:Thought] Partial output before tools:`, response.text);
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log(`[Agent:Stream:Tools] Requested ${response.toolCalls.length} tool(s).`);
          const toolResponses: any[] = [];

          for (const call of response.toolCalls) {
            onEvent({ type: 'status', content: `Analyzing with ${call.name}...` });
            console.log(`[Agent:Stream:ToolCall] -> Tool: ${call.name} | Args:`, JSON.stringify(call.arguments));

            const tool = this.toolRegistry.get(call.name);
            if (tool) {
              // Check permission before executing tool
              const permissionCheck = this.permissionPolicy.authorize(call.name, call.arguments);
              if (!permissionCheck.allowed) {
                console.warn(`[Agent:Stream:Permission] DENIED tool: ${call.name} - ${permissionCheck.reason}`);
                toolResponses.push({
                  functionResponse: { name: call.name, response: { error: `Permission denied: ${permissionCheck.reason}` } },
                });
                continue;
              }

              // Run PreToolUse hooks
              const preHookResult = await this.hookRunner.runPreToolUse(call.name, call.arguments);
              if (preHookResult.action === 'deny') {
                console.warn(`[Agent:Stream:Hook] DENIED tool: ${call.name} - ${preHookResult.message}`);
                toolResponses.push({
                  functionResponse: { name: call.name, response: { error: `Hook denied: ${preHookResult.message}` } },
                });
                continue;
              }

              try {
                this.usageTracker.recordToolCall();
                let apiResult = await this.executeToolWithRecovery(
                  tool,
                  call.arguments,
                  apiClient,
                  '[Agent:Stream',
                );

                // Run PostToolUse hooks
                const postHookResult = await this.hookRunner.runPostToolUse(call.name, call.arguments, apiResult, false);
                if (postHookResult.finalOutput !== undefined) {
                  apiResult = postHookResult.finalOutput;
                }

                console.log(`[Agent:Stream:ToolResult] <- Tool: ${tool.name} returned successfully.`);
                toolResponses.push({
                  functionResponse: { name: tool.name, response: apiResult },
                });
              } catch (error: any) {
                // Run PostToolUse hooks for error case
                await this.hookRunner.runPostToolUse(call.name, call.arguments, { error: error.message }, true);

                console.error(`[Agent:Stream:ToolError] ERROR in ${tool.name}:`, error.message);
                toolResponses.push({
                  functionResponse: { name: tool.name, response: { error: error.message } },
                });
              }
            } else {
              console.warn(`[Agent:Stream:ToolWarning] LLM requested unregistered tool: ${call.name}`);
              toolResponses.push({
                functionResponse: { name: call.name, response: { error: `Tool ${call.name} not found` } },
              });
            }
          }

          const compactionResult = this.contextWindowManager.compactToolResponses(toolResponses);
          if (compactionResult.compactedCount > 0) {
            console.warn(
              `[Agent:Stream:Context] Compacted ${compactionResult.compactedCount} tool result(s) (${compactionResult.totalCharsBefore} -> ${compactionResult.totalCharsAfter} chars).`,
            );
            onEvent({ type: 'status', content: 'Optimizing context window...' });
          }

          currentMessage = compactionResult.payload;
          console.log(`[Agent:Stream:Status] Processing tool results...`);
          onEvent({ type: 'status', content: 'Processing results...' });
        } else if (response.text) {
          this.logUsageStats();
          console.log(`[Agent:Stream:Finish] Returning final answer.`);
          console.log(`==================================================\n`);
          return response.text;
        }
      }
    } catch (error: any) {
      console.error('[Agent Stream Error]:', error);
      this.logUsageStats();
      return 'Tôi gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại!';
    }

    this.logUsageStats();
    return 'Xin lỗi, tôi không thể tìm ra giải pháp sau nhiều bước xử lý.';
  }

  private logUsageStats(): void {
    const stats = this.usageTracker.getStats();
    console.log(`[Agent:Usage] Tokens: ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out | Total: ${stats.totalTokens} | Turns: ${stats.turnCount} | Tools: ${stats.toolCallCount}`);
  }
}
