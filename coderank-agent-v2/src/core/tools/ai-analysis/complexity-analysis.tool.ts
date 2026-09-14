import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient } from '../tool.interface';
import { CodeAnalysisInputSchema, ComplexityLevelSchema, ProgrammingLanguage } from './schemas';

const ComplexityInputSchema = CodeAnalysisInputSchema;

type ComplexityInput = z.infer<typeof ComplexityInputSchema>;

interface ComplexityResult {
  timeComplexity: z.infer<typeof ComplexityLevelSchema>;
  spaceComplexity: z.infer<typeof ComplexityLevelSchema>;
  confidence: 'high' | 'medium' | 'low';
  analysis: string;
  factors: {
    loops: number;
    nestedLoops: number;
    recursion: boolean;
    dataStructures: string[];
  };
}

/**
 * Complexity Analysis Tool
 * Analyzes code to estimate time and space complexity (Big-O notation).
 */
export class ComplexityAnalysisTool extends BaseTool {
  readonly name = 'analyze_complexity';
  readonly description = `Analyzes source code to estimate time and space complexity in Big-O notation.
Examines:
- Loop structures and nesting depth
- Recursive calls and their patterns
- Data structure usage
- Algorithm patterns

Returns complexity estimates with confidence levels and detailed analysis.`;

  readonly parameters = ComplexityInputSchema;

  protected async run(args: ComplexityInput, _client: IApiClient): Promise<unknown> {
    const { code, language } = args;
    
    try {
      const result = this.analyzeComplexity(code, language);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to analyze complexity',
      };
    }
  }

  private analyzeComplexity(code: string, language: ProgrammingLanguage): ComplexityResult {
    const factors = this.extractComplexityFactors(code, language);
    const timeComplexity = this.estimateTimeComplexity(factors);
    const spaceComplexity = this.estimateSpaceComplexity(code, factors);
    const confidence = this.determineConfidence(factors);
    const analysis = this.generateAnalysis(factors, timeComplexity, spaceComplexity);

    return {
      timeComplexity,
      spaceComplexity,
      confidence,
      analysis,
      factors,
    };
  }

  private extractComplexityFactors(code: string, _language: ProgrammingLanguage) {
    // Count loops
    const forLoops = (code.match(/\bfor\s*\(/g) || []).length;
    const whileLoops = (code.match(/\bwhile\s*\(/g) || []).length;
    const loops = forLoops + whileLoops;

    // Detect nested loops (simplified heuristic)
    const nestedLoops = this.countNestedLoops(code);

    // Detect recursion
    const recursion = this.detectRecursion(code);

    // Detect data structures
    const dataStructures = this.detectDataStructures(code);

    return {
      loops,
      nestedLoops,
      recursion,
      dataStructures,
    };
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
      
      // Count closing braces to track nesting
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      if (closeBraces > openBraces) {
        currentDepth = Math.max(0, currentDepth - (closeBraces - openBraces));
      }
    }

    return maxDepth > 1 ? maxDepth : 0;
  }

  private detectRecursion(code: string): boolean {
    // Extract function names
    const funcMatches = code.matchAll(/function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>|def\s+(\w+)/g);
    
    for (const match of funcMatches) {
      const funcName = match[1] || match[2] || match[3];
      if (funcName) {
        // Check if function calls itself
        const bodyPattern = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
        const occurrences = (code.match(bodyPattern) || []).length;
        if (occurrences > 1) {
          return true;
        }
      }
    }

    return false;
  }

  private detectDataStructures(code: string): string[] {
    const structures: string[] = [];

    const patterns: [string, RegExp][] = [
      ['Array', /\[\s*\]|new\s+Array|\.push\(|\.pop\(|\.shift\(/i],
      ['HashMap/Object', /new\s+Map|new\s+Set|\{\s*\}|\.get\(|\.set\(/i],
      ['Stack', /\.push\([\s\S]*?\.pop\(/i],
      ['Queue', /\.push\([\s\S]*?\.shift\(/i],
      ['LinkedList', /\.next\s*=|head\s*=|node\.next/i],
      ['Tree', /\.left\s*=|\.right\s*=|root\./i],
      ['Graph', /adjacency|neighbors|edges|vertices/i],
      ['Heap', /heapify|heap\[|MinHeap|MaxHeap/i],
    ];

    for (const [name, pattern] of patterns) {
      if (pattern.test(code)) {
        structures.push(name);
      }
    }

    return structures;
  }

  private estimateTimeComplexity(factors: ComplexityResult['factors']): z.infer<typeof ComplexityLevelSchema> {
    const { loops, nestedLoops, recursion, dataStructures } = factors;

    // Recursion patterns
    if (recursion) {
      // Check for divide and conquer patterns
      if (/mid|half|\/\s*2/.test(dataStructures.join(''))) {
        return 'O(n log n)';
      }
      // Check for tree/graph traversal
      if (dataStructures.includes('Tree') || dataStructures.includes('Graph')) {
        return 'O(n)';
      }
      // Fibonacci-like recursion
      if (loops === 0 && nestedLoops === 0) {
        return 'O(2^n)';
      }
    }

    // Loop-based complexity
    if (nestedLoops >= 3) {
      return 'O(n³)';
    }
    if (nestedLoops >= 2) {
      return 'O(n²)';
    }
    if (loops > 0 && nestedLoops === 0) {
      // Check for log patterns
      if (dataStructures.includes('Heap') || /binary|bisect|log/i.test(dataStructures.join(''))) {
        return 'O(n log n)';
      }
      return 'O(n)';
    }

    // No loops, no recursion
    if (loops === 0 && !recursion) {
      return 'O(1)';
    }

    return 'Unknown';
  }

  private estimateSpaceComplexity(code: string, factors: ComplexityResult['factors']): z.infer<typeof ComplexityLevelSchema> {
    const { recursion, dataStructures } = factors;

    // Recursion uses stack space
    if (recursion) {
      // Tail recursion optimization possible
      if (/return\s+\w+\s*\([^)]*\)\s*;?\s*$/.test(code)) {
        return 'O(1)';
      }
      return 'O(n)';
    }

    // Check for dynamic arrays/matrices
    if (/\[\s*n\s*\]|\[\s*\w+\.length\s*\]|Array\(n\)|Array\(\w+\)/.test(code)) {
      return 'O(n)';
    }

    // Check for 2D arrays
    if (/\[\s*\]\s*\[\s*\]|\[\s*n\s*\]\s*\[\s*n\s*\]/.test(code)) {
      return 'O(n²)';
    }

    // HashMap/Set typically O(n)
    if (dataStructures.includes('HashMap/Object')) {
      return 'O(n)';
    }

    // Graph adjacency list
    if (dataStructures.includes('Graph')) {
      return 'O(n)';
    }

    // Simple variables only
    return 'O(1)';
  }

  private determineConfidence(factors: ComplexityResult['factors']): 'high' | 'medium' | 'low' {
    const { loops, nestedLoops, recursion, dataStructures } = factors;

    // High confidence: simple patterns
    if (loops === 0 && !recursion) {
      return 'high';
    }
    if (loops === 1 && nestedLoops === 0 && !recursion) {
      return 'high';
    }
    if (nestedLoops === 2 && !recursion) {
      return 'medium';
    }

    // Complex patterns reduce confidence
    if (recursion && loops > 0) {
      return 'low';
    }
    if (dataStructures.length > 3) {
      return 'low';
    }

    return 'medium';
  }

  private generateAnalysis(
    factors: ComplexityResult['factors'],
    timeComplexity: string,
    spaceComplexity: string
  ): string {
    const parts: string[] = [];

    parts.push(`Time complexity estimated as ${timeComplexity}.`);
    parts.push(`Space complexity estimated as ${spaceComplexity}.`);

    if (factors.loops > 0) {
      parts.push(`Found ${factors.loops} loop(s).`);
    }
    if (factors.nestedLoops > 0) {
      parts.push(`Nested loops depth: ${factors.nestedLoops}.`);
    }
    if (factors.recursion) {
      parts.push('Recursion detected.');
    }
    if (factors.dataStructures.length > 0) {
      parts.push(`Data structures: ${factors.dataStructures.join(', ')}.`);
    }

    return parts.join(' ');
  }
}
