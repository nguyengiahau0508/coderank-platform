import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient } from '../tool.interface';
import { CodeAnalysisInputSchema, CodeQualityDimensionSchema, ProgrammingLanguage } from './schemas';

const QualityInputSchema = CodeAnalysisInputSchema;

type QualityInput = z.infer<typeof QualityInputSchema>;

interface QualityResult {
  overallScore: number;
  dimensions: {
    readability: z.infer<typeof CodeQualityDimensionSchema>;
    maintainability: z.infer<typeof CodeQualityDimensionSchema>;
    efficiency: z.infer<typeof CodeQualityDimensionSchema>;
    bestPractices: z.infer<typeof CodeQualityDimensionSchema>;
  };
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    line?: number;
    message: string;
    rule: string;
  }>;
}

/**
 * Code Quality Tool
 * Evaluates code quality across multiple dimensions.
 */
export class CodeQualityTool extends BaseTool {
  readonly name = 'analyze_code_quality';
  readonly description = `Evaluates code quality across multiple dimensions:
- Readability: naming, formatting, comments, structure clarity
- Maintainability: modularity, coupling, complexity
- Efficiency: algorithm choices, resource usage patterns
- Best Practices: language idioms, security patterns, error handling

Returns scores (0-100) for each dimension with specific feedback and suggestions.`;

  readonly parameters = QualityInputSchema;

  protected async run(args: QualityInput, _client: IApiClient): Promise<unknown> {
    const { code, language } = args;
    
    try {
      const result = this.analyzeQuality(code, language);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to analyze code quality',
      };
    }
  }

  private analyzeQuality(code: string, language: ProgrammingLanguage): QualityResult {
    const issues: QualityResult['issues'] = [];
    
    const readability = this.analyzeReadability(code, language, issues);
    const maintainability = this.analyzeMaintainability(code, language, issues);
    const efficiency = this.analyzeEfficiency(code, language, issues);
    const bestPractices = this.analyzeBestPractices(code, language, issues);

    const overallScore = Math.round(
      (readability.score + maintainability.score + efficiency.score + bestPractices.score) / 4
    );

    return {
      overallScore,
      dimensions: {
        readability,
        maintainability,
        efficiency,
        bestPractices,
      },
      issues,
    };
  }

  private analyzeReadability(
    code: string, 
    language: ProgrammingLanguage,
    issues: QualityResult['issues']
  ): z.infer<typeof CodeQualityDimensionSchema> {
    let score = 100;
    const suggestions: string[] = [];
    const feedback: string[] = [];

    const lines = code.split('\n');
    
    // Check line length
    const longLines = lines.filter(l => l.length > 100);
    if (longLines.length > 0) {
      score -= Math.min(20, longLines.length * 2);
      suggestions.push('Break long lines (>100 chars) for better readability');
      issues.push({
        severity: 'warning',
        message: `${longLines.length} line(s) exceed 100 characters`,
        rule: 'max-line-length',
      });
    }

    // Check naming conventions
    const badNames = this.checkNamingConventions(code, language);
    if (badNames.length > 0) {
      score -= Math.min(25, badNames.length * 5);
      suggestions.push('Use descriptive names (avoid single letters except for loop counters)');
      badNames.forEach(name => {
        issues.push({
          severity: 'warning',
          message: `Poor variable name: "${name}"`,
          rule: 'naming-convention',
        });
      });
    }

    // Check for comments
    const commentRatio = this.getCommentRatio(code, language);
    if (commentRatio < 0.05 && lines.length > 20) {
      score -= 10;
      suggestions.push('Add comments to explain complex logic');
      feedback.push('Code lacks sufficient documentation');
    } else if (commentRatio > 0.3) {
      score -= 5;
      suggestions.push('Consider reducing excessive comments; code should be self-documenting');
    }

    // Check function length
    const longFunctions = this.checkFunctionLength(code, language);
    if (longFunctions > 0) {
      score -= Math.min(15, longFunctions * 5);
      suggestions.push('Break long functions into smaller, focused functions');
    }

    // Check indentation consistency
    if (!this.hasConsistentIndentation(code)) {
      score -= 10;
      suggestions.push('Use consistent indentation throughout the code');
      issues.push({
        severity: 'warning',
        message: 'Inconsistent indentation detected',
        rule: 'consistent-indent',
      });
    }

    score = Math.max(0, score);
    feedback.push(`Readability score: ${score}/100`);

    return {
      score,
      feedback: feedback.join('. '),
      suggestions,
    };
  }

  private analyzeMaintainability(
    code: string,
    _language: ProgrammingLanguage,
    issues: QualityResult['issues']
  ): z.infer<typeof CodeQualityDimensionSchema> {
    let score = 100;
    const suggestions: string[] = [];
    const feedback: string[] = [];

    // Check for magic numbers
    const magicNumbers = this.findMagicNumbers(code);
    if (magicNumbers.length > 0) {
      score -= Math.min(15, magicNumbers.length * 3);
      suggestions.push('Extract magic numbers into named constants');
      issues.push({
        severity: 'warning',
        message: `Found ${magicNumbers.length} magic number(s)`,
        rule: 'no-magic-numbers',
      });
    }

    // Check for code duplication (simplified)
    const duplication = this.detectDuplication(code);
    if (duplication > 0) {
      score -= Math.min(20, duplication * 5);
      suggestions.push('Extract duplicated code into reusable functions');
      issues.push({
        severity: 'warning',
        message: 'Potential code duplication detected',
        rule: 'no-duplicate-code',
      });
    }

    // Check function count (too many suggests poor modularity)
    const functionCount = (code.match(/function\s+\w+|=>\s*\{|def\s+\w+/g) || []).length;
    const lines = code.split('\n').length;
    const functionsPerLine = functionCount / Math.max(1, lines);
    
    if (functionCount === 0 && lines > 30) {
      score -= 15;
      suggestions.push('Consider breaking code into functions for better modularity');
    } else if (functionsPerLine > 0.1) {
      suggestions.push('Consider consolidating very small functions');
    }

    // Check global variables
    const globals = this.countGlobalVariables(code);
    if (globals > 3) {
      score -= Math.min(15, (globals - 3) * 5);
      suggestions.push('Minimize global variables; use encapsulation');
      issues.push({
        severity: 'warning',
        message: `${globals} global variable(s) detected`,
        rule: 'no-global-vars',
      });
    }

    score = Math.max(0, score);
    feedback.push(`Maintainability score: ${score}/100`);

    return {
      score,
      feedback: feedback.join('. '),
      suggestions,
    };
  }

  private analyzeEfficiency(
    code: string,
    language: ProgrammingLanguage,
    issues: QualityResult['issues']
  ): z.infer<typeof CodeQualityDimensionSchema> {
    let score = 100;
    const suggestions: string[] = [];
    const feedback: string[] = [];

    // Check for nested loops
    const nestedLoops = this.countNestedLoops(code);
    if (nestedLoops >= 3) {
      score -= 25;
      suggestions.push('Consider optimizing deeply nested loops');
      issues.push({
        severity: 'error',
        message: `Deeply nested loops (${nestedLoops} levels) may cause performance issues`,
        rule: 'complexity-nested-loops',
      });
    } else if (nestedLoops === 2) {
      score -= 10;
      feedback.push('Nested loops detected; ensure they are necessary');
    }

    // Check for inefficient patterns
    const inefficientPatterns = this.findInefficientPatterns(code, language);
    for (const pattern of inefficientPatterns) {
      score -= pattern.penalty;
      suggestions.push(pattern.suggestion);
      issues.push({
        severity: 'warning',
        message: pattern.message,
        rule: pattern.rule,
      });
    }

    // Check for proper data structure usage
    const dsIssues = this.checkDataStructureUsage(code, language);
    for (const issue of dsIssues) {
      score -= 10;
      suggestions.push(issue);
    }

    score = Math.max(0, score);
    feedback.push(`Efficiency score: ${score}/100`);

    return {
      score,
      feedback: feedback.join('. '),
      suggestions,
    };
  }

  private analyzeBestPractices(
    code: string,
    language: ProgrammingLanguage,
    issues: QualityResult['issues']
  ): z.infer<typeof CodeQualityDimensionSchema> {
    let score = 100;
    const suggestions: string[] = [];
    const feedback: string[] = [];

    // Check for error handling
    const hasErrorHandling = this.hasProperErrorHandling(code, language);
    if (!hasErrorHandling && code.length > 200) {
      score -= 15;
      suggestions.push('Add proper error handling (try-catch or error checks)');
      issues.push({
        severity: 'warning',
        message: 'No error handling detected',
        rule: 'require-error-handling',
      });
    }

    // Check for console.log / print statements
    const debugStatements = this.countDebugStatements(code, language);
    if (debugStatements > 0) {
      score -= Math.min(10, debugStatements * 2);
      suggestions.push('Remove debug/console statements before production');
      issues.push({
        severity: 'info',
        message: `${debugStatements} debug statement(s) found`,
        rule: 'no-console',
      });
    }

    // Check for hardcoded values
    const hardcodedStrings = this.findHardcodedStrings(code);
    if (hardcodedStrings.length > 5) {
      score -= 10;
      suggestions.push('Consider extracting hardcoded strings to constants');
    }

    // Check for input validation (simplified)
    if (!this.hasInputValidation(code, language)) {
      score -= 10;
      suggestions.push('Add input validation for function parameters');
    }

    // Language-specific checks
    const langIssues = this.checkLanguageSpecificPractices(code, language);
    for (const issue of langIssues) {
      score -= issue.penalty;
      suggestions.push(issue.suggestion);
      issues.push({
        severity: issue.severity as 'error' | 'warning' | 'info',
        message: issue.message,
        rule: issue.rule,
      });
    }

    score = Math.max(0, score);
    feedback.push(`Best practices score: ${score}/100`);

    return {
      score,
      feedback: feedback.join('. '),
      suggestions,
    };
  }

  // Helper methods
  private checkNamingConventions(code: string, _language: ProgrammingLanguage): string[] {
    const badNames: string[] = [];
    
    // Find single-letter variables (except common loop counters)
    const varMatches = code.matchAll(/(?:const|let|var|int|string|float|double)\s+([a-zA-Z_]\w*)/g);
    for (const match of varMatches) {
      const name = match[1];
      if (name.length === 1 && !['i', 'j', 'k', 'n', 'm', 'x', 'y', 'z'].includes(name)) {
        badNames.push(name);
      }
    }

    // Check for names that are too short or non-descriptive
    const shortNames = code.matchAll(/(?:const|let|var)\s+([a-z]{2})\s*=/g);
    for (const match of shortNames) {
      if (!['id', 'ok', 'fn'].includes(match[1])) {
        badNames.push(match[1]);
      }
    }

    return [...new Set(badNames)];
  }

  private getCommentRatio(code: string, language: ProgrammingLanguage): number {
    const lines = code.split('\n');
    let commentLines = 0;

    const singleLineComment = language === 'python' ? /^\s*#/ : /^\s*\/\//;

    for (const line of lines) {
      if (singleLineComment.test(line)) {
        commentLines++;
      }
    }

    return commentLines / Math.max(1, lines.length);
  }

  private checkFunctionLength(code: string, _language: ProgrammingLanguage): number {
    // Simplified: count functions that appear to span many lines
    const functionStarts = [...code.matchAll(/function\s+\w+|=>\s*\{|def\s+\w+/g)];
    let longFunctions = 0;

    for (let i = 0; i < functionStarts.length; i++) {
      const start = functionStarts[i].index || 0;
      const end = functionStarts[i + 1]?.index || code.length;
      const funcCode = code.substring(start, end);
      const lines = funcCode.split('\n').length;
      
      if (lines > 50) {
        longFunctions++;
      }
    }

    return longFunctions;
  }

  private hasConsistentIndentation(code: string): boolean {
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    const indents = lines.map(l => {
      const match = l.match(/^(\s*)/);
      return match ? match[1] : '';
    });

    // Check if all indents use same character (spaces or tabs)
    const usesTabs = indents.some(i => i.includes('\t'));
    const usesSpaces = indents.some(i => i.includes(' ') && !i.includes('\t'));

    return !(usesTabs && usesSpaces);
  }

  private findMagicNumbers(code: string): number[] {
    const magicNumbers: number[] = [];
    const matches = code.matchAll(/(?<![a-zA-Z_\d])(\d+)(?![a-zA-Z_\d])/g);
    
    for (const match of matches) {
      const num = parseInt(match[1]);
      // Ignore common acceptable numbers
      if (![0, 1, 2, -1, 10, 100].includes(num) && num > 2) {
        magicNumbers.push(num);
      }
    }

    return magicNumbers.slice(0, 10); // Limit results
  }

  private detectDuplication(code: string): number {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 10);
    const seen = new Map<string, number>();
    let duplicates = 0;

    for (const line of lines) {
      const count = seen.get(line) || 0;
      seen.set(line, count + 1);
      if (count === 1) {
        duplicates++;
      }
    }

    return duplicates;
  }

  private countGlobalVariables(code: string): number {
    // Simplified heuristic: count top-level variable declarations
    const lines = code.split('\n');
    let globals = 0;

    for (const line of lines) {
      if (/^(?:const|let|var|int|string|float)\s+\w+/.test(line.trim())) {
        globals++;
      }
    }

    return globals;
  }

  private countNestedLoops(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    const lines = code.split('\n');

    for (const line of lines) {
      if (/\bfor\s*\(|\bwhile\s*\(/.test(line)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
      if (/\}/.test(line)) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  private findInefficientPatterns(code: string, _language: ProgrammingLanguage) {
    const patterns: Array<{ message: string; suggestion: string; penalty: number; rule: string }> = [];

    // String concatenation in loops
    if (/for.*\{[\s\S]*?\+\s*=\s*['"`]/.test(code)) {
      patterns.push({
        message: 'String concatenation in loop',
        suggestion: 'Use array.join() or StringBuilder for string building in loops',
        penalty: 10,
        rule: 'no-string-concat-in-loop',
      });
    }

    // Array.includes in loop with large dataset
    if (/for.*\.includes\(/.test(code)) {
      patterns.push({
        message: 'Array.includes() in loop may be O(n²)',
        suggestion: 'Consider using Set for O(1) lookups',
        penalty: 10,
        rule: 'prefer-set-for-lookup',
      });
    }

    return patterns;
  }

  private checkDataStructureUsage(code: string, _language: ProgrammingLanguage): string[] {
    const suggestions: string[] = [];

    // Multiple array searches
    if ((code.match(/\.indexOf\(|\.find\(|\.includes\(/g) || []).length > 3) {
      suggestions.push('Multiple array searches detected; consider using a Map or Set');
    }

    return suggestions;
  }

  private hasProperErrorHandling(code: string, language: ProgrammingLanguage): boolean {
    if (language === 'python') {
      return /try\s*:|except\s*:/.test(code);
    }
    return /try\s*\{|\.catch\(|catch\s*\(/.test(code);
  }

  private countDebugStatements(code: string, language: ProgrammingLanguage): number {
    const patterns: Record<string, RegExp> = {
      javascript: /console\.(log|debug|info|warn|error)\(/g,
      typescript: /console\.(log|debug|info|warn|error)\(/g,
      python: /print\s*\(/g,
      java: /System\.out\.print/g,
      cpp: /cout\s*<</g,
      c: /printf\s*\(/g,
      go: /fmt\.Print/g,
      rust: /println!\s*\(/g,
    };

    const pattern = patterns[language] || patterns.javascript;
    return (code.match(pattern) || []).length;
  }

  private findHardcodedStrings(code: string): string[] {
    const matches = code.matchAll(/['"`]([^'"`]{10,})['"`]/g);
    return [...matches].map(m => m[1]).slice(0, 10);
  }

  private hasInputValidation(code: string, _language: ProgrammingLanguage): boolean {
    return /typeof\s+\w+\s*===|instanceof|\.length\s*[<>=]|if\s*\(\s*!\s*\w+\s*\)|if\s*\(\s*\w+\s*==\s*null/.test(code);
  }

  private checkLanguageSpecificPractices(code: string, language: ProgrammingLanguage) {
    const issues: Array<{ message: string; suggestion: string; penalty: number; severity: string; rule: string }> = [];

    if (language === 'javascript' || language === 'typescript') {
      // var usage
      if (/\bvar\s+/.test(code)) {
        issues.push({
          message: 'Using "var" instead of "let" or "const"',
          suggestion: 'Use "const" for constants and "let" for variables',
          penalty: 5,
          severity: 'warning',
          rule: 'no-var',
        });
      }

      // == instead of ===
      if (/[^=!]==[^=]/.test(code)) {
        issues.push({
          message: 'Using loose equality (==) instead of strict equality (===)',
          suggestion: 'Use === and !== for comparisons',
          penalty: 5,
          severity: 'warning',
          rule: 'eqeqeq',
        });
      }
    }

    return issues;
  }
}
