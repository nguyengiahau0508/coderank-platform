import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient } from '../tool.interface';
import { CodeAnalysisInputSchema, CodeStructureSchema, ProgrammingLanguage } from './schemas';

const AnalyzeCodeInputSchema = CodeAnalysisInputSchema;

type AnalyzeCodeInput = z.infer<typeof AnalyzeCodeInputSchema>;

/**
 * Code Analysis Tool
 * Analyzes code structure: functions, classes, imports, loops, complexity indicators.
 * This is a foundational tool used by other AI features.
 */
export class CodeAnalysisTool extends BaseTool {
  readonly name = 'analyze_code_structure';
  readonly description = `Analyzes source code to extract structural information including:
- Functions and methods (name, parameters, line numbers)
- Classes and their members
- Import statements
- Loop constructs and nesting
- Variable declarations
- Code metrics (lines of code, comments)

Use this tool to understand code structure before providing hints, suggestions, or reviews.`;

  readonly parameters = AnalyzeCodeInputSchema;

  protected async run(args: AnalyzeCodeInput, _client: IApiClient): Promise<unknown> {
    const { code, language } = args;
    
    try {
      const structure = this.analyzeStructure(code, language);
      return {
        success: true,
        language,
        structure,
        summary: this.generateSummary(structure),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to analyze code structure',
      };
    }
  }

  private analyzeStructure(code: string, language: ProgrammingLanguage): z.infer<typeof CodeStructureSchema> {
    const lines = code.split('\n');
    const linesOfCode = lines.filter(l => l.trim().length > 0).length;
    
    return {
      functions: this.extractFunctions(code, language),
      classes: this.extractClasses(code, language),
      imports: this.extractImports(code, language),
      variables: this.extractVariables(code, language),
      loops: this.extractLoops(code, language),
      conditionals: this.countConditionals(code, language),
      linesOfCode,
      commentLines: this.countComments(code, language),
    };
  }

  private extractFunctions(code: string, language: ProgrammingLanguage) {
    const functions: z.infer<typeof CodeStructureSchema>['functions'] = [];
    const lines = code.split('\n');
    
    const patterns: Record<string, RegExp[]> = {
      javascript: [
        /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
      ],
      typescript: [
        /(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g,
        /(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>/g,
      ],
      python: [
        /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/g,
      ],
      java: [
        /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+\w+)?\s*\{/g,
      ],
      cpp: [
        /(?:\w+::)?(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*\{/g,
      ],
      c: [
        /\w+\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
      ],
      go: [
        /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)/g,
      ],
      rust: [
        /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g,
      ],
    };

    const langPatterns = patterns[language] || patterns.javascript;
    
    for (const pattern of langPatterns) {
      let match;
      const codeWithLineNums = code;
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(codeWithLineNums)) !== null) {
        const name = match[1];
        const params = match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p) : [];
        const lineStart = code.substring(0, match.index).split('\n').length;
        const isAsync = match[0].includes('async');
        
        functions.push({
          name,
          lineStart,
          lineEnd: lineStart, // Would need more sophisticated parsing for accurate end
          parameters: params,
          isAsync,
        });
      }
    }

    return functions;
  }

  private extractClasses(code: string, language: ProgrammingLanguage) {
    const classes: z.infer<typeof CodeStructureSchema>['classes'] = [];
    
    const patterns: Record<string, RegExp> = {
      javascript: /class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g,
      typescript: /class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+\w+(?:<[^>]*>)?)?(?:\s+implements\s+[^{]+)?\s*\{/g,
      python: /class\s+(\w+)(?:\([^)]*\))?\s*:/g,
      java: /(?:public\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[^{]+)?\s*\{/g,
      cpp: /class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+\w+)?\s*\{/g,
      c: /struct\s+(\w+)\s*\{/g,
      go: /type\s+(\w+)\s+struct\s*\{/g,
      rust: /(?:pub\s+)?struct\s+(\w+)(?:<[^>]*>)?\s*\{/g,
    };

    const pattern = patterns[language] || patterns.javascript;
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(code)) !== null) {
      const lineStart = code.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        lineStart,
        lineEnd: lineStart,
        methods: [],
        properties: [],
      });
    }

    return classes;
  }

  private extractImports(code: string, language: ProgrammingLanguage) {
    const imports: z.infer<typeof CodeStructureSchema>['imports'] = [];
    
    const patterns: Record<string, RegExp> = {
      javascript: /import\s+(?:(\w+)|(?:\{([^}]+)\})|\*\s+as\s+(\w+))?\s*(?:,\s*(?:\{([^}]+)\}))?\s*from\s*['"]([^'"]+)['"]/g,
      typescript: /import\s+(?:type\s+)?(?:(\w+)|(?:\{([^}]+)\})|\*\s+as\s+(\w+))?\s*(?:,\s*(?:\{([^}]+)\}))?\s*from\s*['"]([^'"]+)['"]/g,
      python: /(?:from\s+(\S+)\s+)?import\s+(.+)/g,
      java: /import\s+(?:static\s+)?([a-zA-Z0-9_.]+)(?:\.\*)?;/g,
      cpp: /#include\s*[<"]([^>"]+)[>"]/g,
      c: /#include\s*[<"]([^>"]+)[>"]/g,
      go: /import\s+(?:\(\s*)?(?:"([^"]+)"|\w+\s+"([^"]+)")/g,
      rust: /use\s+([a-zA-Z0-9_:]+)(?:::\{([^}]+)\})?;/g,
    };

    const pattern = patterns[language] || patterns.javascript;
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(code)) !== null) {
      if (language === 'javascript' || language === 'typescript') {
        const defaultImport = match[1];
        const namedImports = match[2] || match[4];
        const namespaceImport = match[3];
        const module = match[5];
        
        const items: string[] = [];
        if (defaultImport) items.push(defaultImport);
        if (namedImports) items.push(...namedImports.split(',').map(s => s.trim()));
        if (namespaceImport) items.push(`* as ${namespaceImport}`);
        
        imports.push({
          module,
          items: items.length > 0 ? items : undefined,
          isDefault: !!defaultImport && !namedImports,
        });
      } else {
        imports.push({
          module: match[1] || match[2] || '',
          items: match[2] ? match[2].split(',').map(s => s.trim()) : undefined,
        });
      }
    }

    return imports;
  }

  private extractVariables(code: string, language: ProgrammingLanguage) {
    const variables: z.infer<typeof CodeStructureSchema>['variables'] = [];
    
    const patterns: Record<string, RegExp> = {
      javascript: /(?:const|let|var)\s+(\w+)(?:\s*:\s*(\w+))?\s*=/g,
      typescript: /(?:const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/g,
      python: /^(\w+)\s*(?::\s*(\w+))?\s*=/gm,
      java: /(?:final\s+)?(\w+)\s+(\w+)\s*(?:=|;)/g,
      cpp: /(?:const\s+)?(\w+)\s+(\w+)\s*(?:=|;)/g,
      c: /(?:const\s+)?(\w+)\s+(\w+)\s*(?:=|;)/g,
      go: /(?:var\s+)?(\w+)\s+(\w+)|(\w+)\s*:=/g,
      rust: /let\s+(?:mut\s+)?(\w+)(?:\s*:\s*([^=]+))?\s*=/g,
    };

    const pattern = patterns[language] || patterns.javascript;
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(code)) !== null) {
      variables.push({
        name: match[1] || match[2],
        type: match[2] || undefined,
        scope: 'local', // Would need more sophisticated parsing for accurate scope
      });
    }

    return variables.slice(0, 50); // Limit to avoid overwhelming output
  }

  private extractLoops(code: string, language: ProgrammingLanguage) {
    const loops: z.infer<typeof CodeStructureSchema>['loops'] = [];
    
    const loopPatterns = [
      { type: 'for' as const, pattern: /\bfor\s*\(/g },
      { type: 'while' as const, pattern: /\bwhile\s*\(/g },
      { type: 'forEach' as const, pattern: /\.forEach\s*\(/g },
      { type: 'map' as const, pattern: /\.map\s*\(/g },
    ];

    // Python-specific
    if (language === 'python') {
      loopPatterns[0] = { type: 'for', pattern: /\bfor\s+\w+\s+in\s+/g };
      loopPatterns[1] = { type: 'while', pattern: /\bwhile\s+/g };
    }

    for (const { type, pattern } of loopPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(code)) !== null) {
        const lineStart = code.substring(0, match.index).split('\n').length;
        loops.push({
          type,
          lineStart,
          nested: false, // Would need more sophisticated parsing
        });
      }
    }

    // Check for recursion
    const funcMatches = code.match(/function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=/g);
    if (funcMatches) {
      for (const funcMatch of funcMatches) {
        const nameMatch = funcMatch.match(/(?:function\s+|(?:const|let|var)\s+)(\w+)/);
        if (nameMatch) {
          const funcName = nameMatch[1];
          const recursionPattern = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
          const occurrences = (code.match(recursionPattern) || []).length;
          if (occurrences > 1) {
            loops.push({
              type: 'recursion',
              lineStart: 1,
              nested: false,
            });
            break;
          }
        }
      }
    }

    return loops;
  }

  private countConditionals(code: string, _language: ProgrammingLanguage): number {
    const conditionalPatterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bswitch\s*\(/g,
      /\?\s*[^:]+\s*:/g, // Ternary
    ];

    let count = 0;
    for (const pattern of conditionalPatterns) {
      const matches = code.match(pattern);
      if (matches) count += matches.length;
    }

    return count;
  }

  private countComments(code: string, language: ProgrammingLanguage): number {
    let count = 0;
    const lines = code.split('\n');

    const singleLineComment = language === 'python' ? /^\s*#/ : /^\s*\/\//;
    
    for (const line of lines) {
      if (singleLineComment.test(line)) {
        count++;
      }
    }

    // Count multi-line comments
    const multiLineMatches = code.match(/\/\*[\s\S]*?\*\//g);
    if (multiLineMatches) {
      for (const match of multiLineMatches) {
        count += match.split('\n').length;
      }
    }

    // Python docstrings
    if (language === 'python') {
      const docstrings = code.match(/"""[\s\S]*?"""|'''[\s\S]*?'''/g);
      if (docstrings) {
        for (const ds of docstrings) {
          count += ds.split('\n').length;
        }
      }
    }

    return count;
  }

  private generateSummary(structure: z.infer<typeof CodeStructureSchema>): string {
    const parts: string[] = [];
    
    if (structure.classes.length > 0) {
      parts.push(`${structure.classes.length} class(es)`);
    }
    if (structure.functions.length > 0) {
      parts.push(`${structure.functions.length} function(s)`);
    }
    if (structure.loops.length > 0) {
      parts.push(`${structure.loops.length} loop(s)`);
    }
    if (structure.conditionals > 0) {
      parts.push(`${structure.conditionals} conditional(s)`);
    }
    
    const hasRecursion = structure.loops.some(l => l.type === 'recursion');
    if (hasRecursion) {
      parts.push('uses recursion');
    }
    
    parts.push(`${structure.linesOfCode} LOC`);
    
    return parts.join(', ');
  }
}
