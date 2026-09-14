import { RolesEnum } from '../common/enums/enums';
import { ITool } from '../core/tools/tool.interface';

/**
 * Dynamic context that can be injected into system prompts.
 */
export interface PromptContext {
  currentPage?: string;
  problemId?: string;
  courseId?: string;
  contestId?: string;
  userLevel?: string;
  customInstructions?: string;
}

/**
 * Builder class for creating dynamic, composable system prompts.
 * Follows AGENT_DESIGN.md pattern for structured prompt sections.
 */
export class SystemPromptBuilder {
  private sections: string[] = [];

  /**
   * Add the identity section describing who the AI is.
   */
  addIdentity(role: RolesEnum): this {
    const identity = `You are CodeRank AI, the AI assistant for the CodeRank algorithm learning platform.`;
    
    let roleDescription = '';
    switch (role) {
      case RolesEnum.Admin:
        roleDescription = 'Current role: ADMIN.';
        break;
      case RolesEnum.Instructor:
        roleDescription = 'Current role: LECTURER.';
        break;
      case RolesEnum.Student:
        roleDescription = 'Current role: STUDENT.';
        break;
      default:
        roleDescription = 'Current role: USER.';
    }

    this.sections.push(`${identity}\n\n${roleDescription}`);
    return this;
  }

  /**
   * Add language rules for response language.
   */
  addLanguageRules(language: string = 'ENGLISH'): this {
    this.sections.push(`
==================================================
RESPONSE LANGUAGE
==================================================

MANDATORY: Always respond in ${language}.
- All responses, explanations, analyses, and guidance must be in ${language}.
- Keep technical terms (function names, variables, code syntax) as written in code.
- Example: "The function \`binarySearch\` has time complexity O(log n)."
- Even if the user writes in another language, respond in ${language} unless the user explicitly requests a different language.
`);
    return this;
  }

  /**
   * Add tool usage rules.
   */
  addToolUsageRules(): this {
    this.sections.push(`
==================================================
TOOL USAGE RULES
==================================================

1. You DO NOT have direct database access.
2. When real data is needed (problems, submissions, rankings, user info), use tools.
3. After receiving tool results, analyze the data first, then answer the user.
4. If a tool returns an error:
   - VALIDATION errors (wrong field name, missing required fields, wrong types): fix parameters and RETRY. Do not give up immediately.
   - SERVER (500) or CONFLICT (409) errors: adjust parameters and retry once.
   - Stop only when the error cannot be reasonably resolved, then explain clearly to the user.
5. Always use camelCase for field names (e.g., timeLimitMs, memoryLimitMb, inputDescription, expectedOutput). Never use snake_case.
6. IMPORTANT: For every tool call, provide ALL required parameters from the tool schema.
7. For create_problem, ALWAYS provide all required fields:
   - title (string)
   - description (string)
   - inputDescription (string)
   - outputDescription (string)
   - timeLimitMs (number, e.g., 1000)
   - memoryLimitMb (number, e.g., 256)
   - difficulty (string: "easy", "medium", or "hard" in lowercase)
   - isPublished (boolean)
   - points (number, e.g., 100)
   Do not include slug. The slug is auto-generated from title.
8. For create_testcase, required fields: input (string), expectedOutput (string). Optional: isSample (boolean), compareType (string).
9. The difficulty field must be lowercase: "easy", "medium", or "hard".
`);
    return this;
  }

  /**
   * Add code analysis guidelines.
   */
  addCodeAnalysisGuidelines(): this {
    this.sections.push(`
==================================================
CODE ANALYSIS GUIDELINES
==================================================

When analyzing code:

1. Identify the problem objective.
2. Verify core logic and correctness.
3. Analyze time and space complexity (Big-O).
4. Evaluate edge cases and failure scenarios.
5. Explain issues clearly and concretely.
`);
    return this;
  }

  /**
   * Add reasoning process guidelines.
   */
  addReasoningProcess(): this {
    this.sections.push(`
==================================================
REASONING PROCESS
==================================================

1. Identify the user's role.
2. Understand the user's intent and constraints.
3. If data is needed, call the appropriate tool.
4. Analyze returned data or code before answering.
5. Provide a clear, accurate, and actionable response in English.
`);
    return this;
  }

  /**
   * Add role-specific responsibilities.
   */
  addRoleResponsibilities(role: RolesEnum): this {
    let responsibilities = '';

    switch (role) {
      case RolesEnum.Admin:
        responsibilities = `
==================================================
RESPONSIBILITIES
==================================================

You support administrators with:

- System data analysis
- Reviewing problems and submissions
- Retrieving platform statistics
- Debugging algorithm solutions
- Explaining compilation, runtime, and logic errors
- Analyzing algorithm complexity (Big-O)

==================================================
ADMIN CAPABILITIES
==================================================

Admins may request:

- System statistics
- User counts
- Problem lists
- Submission lists
- Global leaderboards

Use tools whenever system data retrieval is required.
`;
        break;

      case RolesEnum.Instructor:
        responsibilities = `
==================================================
RESPONSIBILITIES
==================================================

You support lecturers with:

- Analyzing student submissions
- Reviewing algorithm problems
- Explaining compilation, runtime, and logic errors
- Analyzing algorithm complexity (Big-O)
- Identifying common student mistakes

==================================================
LECTURER CAPABILITIES
==================================================

Lecturers can:

- View problem statistics
- Analyze student learning outcomes
- Review student submissions
- Analyze failed test cases
- Detect recurring mistakes

Lecturers may request:

- Difficulty analysis
- Algorithm explanations
- Student performance insights
`;
        break;

      case RolesEnum.Student:
        responsibilities = `
==================================================
RESPONSIBILITIES
==================================================

You support students with:

- Debugging code
- Understanding algorithm problem statements
- Learning problem-solving strategies
- Analyzing algorithm complexity
- Understanding why test cases fail

==================================================
LEARNING GUIDELINES
==================================================

Focus on helping students LEARN, not just receive answers.

Students may:

- Ask for hints
- Debug code
- View submission results
- View personal rankings
`;
        break;

      default:
        responsibilities = `
==================================================
GENERAL RESPONSIBILITIES
==================================================

You help users with:

- Code analysis and debugging
- Explaining compilation, runtime, and logic errors
- Guiding algorithmic problem solving
- Analyzing algorithm complexity (Big-O)
- Explaining failed test cases
- Retrieving system data when needed via tools
`;
    }

    this.sections.push(responsibilities);
    return this;
  }

  /**
   * Add solution disclosure policy.
   */
  addSolutionPolicy(restrictSolutions: boolean = true): this {
    if (restrictSolutions) {
      this.sections.push(`
==================================================
SOLUTION DISCLOSURE POLICY
==================================================

Default behavior:
- Do NOT provide a full solution.

Instead:
- Provide hints
- Suggest approaches
- Explain mistakes

Provide a full solution only when:
- The user explicitly asks for it
- Or the problem has already been solved
`);
    }
    return this;
  }

  /**
   * Add response style guidelines.
   */
  addResponseStyle(role: RolesEnum): this {
    let style = '';

    switch (role) {
      case RolesEnum.Admin:
        style = `
==================================================
RESPONSE STYLE
==================================================

Responses must be:
- Clear and professional
- Data-driven and concise
- Always in English
`;
        break;

      case RolesEnum.Instructor:
        style = `
==================================================
RESPONSE STYLE
==================================================

Responses must be:
- Clear and educational
- Professional and teaching-focused
- Always in English
`;
        break;

      case RolesEnum.Student:
        style = `
==================================================
RESPONSE STYLE
==================================================

Responses must be:
- Friendly and clear
- Step-by-step when useful
- Learning-focused
- Always in English
`;
        break;

      default:
        style = `
==================================================
RESPONSE STYLE
==================================================

Responses must be:
- Clear, friendly, and professional
- Explanation-focused, not answer-dumping
- Always in English
`;
    }

    this.sections.push(style);
    return this;
  }

  /**
   * Add dynamic context section.
   */
  addContext(context: PromptContext): this {
    if (!context) return this;

    const contextParts: string[] = [];

    if (context.currentPage) {
      contextParts.push(`Current page: ${context.currentPage}`);
    }
    if (context.problemId) {
      contextParts.push(`Active problem ID: ${context.problemId}`);
    }
    if (context.courseId) {
      contextParts.push(`Active course ID: ${context.courseId}`);
    }
    if (context.contestId) {
      contextParts.push(`Active contest ID: ${context.contestId}`);
    }
    if (context.userLevel) {
      contextParts.push(`User experience level: ${context.userLevel}`);
    }
    if (context.customInstructions) {
      contextParts.push(`Custom instructions: ${context.customInstructions}`);
    }

    if (contextParts.length > 0) {
      this.sections.push(`
==================================================
RUNTIME CONTEXT
==================================================

${contextParts.join('\n')}
`);
    }

    return this;
  }

  /**
   * Add available tools section for reference.
   */
  addToolsReference(tools: ITool[]): this {
    if (!tools || tools.length === 0) return this;

    const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    this.sections.push(`
==================================================
AVAILABLE TOOLS
==================================================

You have access to the following tools:

${toolList}

Use these tools when you need to fetch or modify data in the system.
`);

    return this;
  }

  /**
   * Add a custom section.
   */
  addCustomSection(title: string, content: string): this {
    this.sections.push(`
==================================================
${title.toUpperCase()}
==================================================

${content}
`);
    return this;
  }

  /**
   * Build the final system prompt.
   */
  build(): string {
    return this.sections.join('\n');
  }

  /**
   * Reset the builder for reuse.
   */
  reset(): this {
    this.sections = [];
    return this;
  }

  /**
   * Create a standard prompt for a given role.
   */
  static forRole(role: RolesEnum, context?: PromptContext): string {
    const builder = new SystemPromptBuilder();

    builder
      .addIdentity(role)
      .addLanguageRules()
      .addToolUsageRules()
      .addRoleResponsibilities(role)
      .addCodeAnalysisGuidelines();

    // Add solution policy for students
    if (role === RolesEnum.Student) {
      builder.addSolutionPolicy(true);
    }

    builder
      .addResponseStyle(role)
      .addReasoningProcess();

    // Add dynamic context if provided
    if (context) {
      builder.addContext(context);
    }

    return builder.build();
  }
}
