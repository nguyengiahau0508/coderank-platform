import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient } from '../tool.interface';
import { ProgrammingLanguage } from './schemas';

const AlgorithmSuggestionInputSchema = z.object({
  problemDescription: z.string().describe('The problem statement/description'),
  constraints: z.string().optional().describe('Input constraints (size limits, etc.)'),
  examples: z.string().optional().describe('Example inputs and outputs'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Problem difficulty'),
  userCode: z.string().optional().describe('User current code attempt for context'),
  language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust']).optional(),
});

type AlgorithmSuggestionInput = z.infer<typeof AlgorithmSuggestionInputSchema>;

interface AlgorithmSuggestion {
  name: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  timeComplexity: string;
  spaceComplexity: string;
  reasoning: string;
  hints: string[];
  relatedPatterns: string[];
}

/**
 * Algorithm Suggestion Tool
 * Analyzes problem descriptions and suggests appropriate algorithms.
 */
export class AlgorithmSuggestionTool extends BaseTool {
  readonly name = 'suggest_algorithm';
  readonly description = `Analyzes a programming problem and suggests appropriate algorithms.
Based on problem description, constraints, and examples, identifies:
- Best-fit algorithms (DP, Greedy, BFS, DFS, Binary Search, etc.)
- Expected time/space complexity
- Key patterns to recognize
- Step-by-step approach hints

Does NOT provide complete solutions - only algorithmic guidance.`;

  readonly parameters = AlgorithmSuggestionInputSchema;

  protected async run(args: AlgorithmSuggestionInput, _client: IApiClient): Promise<unknown> {
    try {
      const suggestions = this.analyzeAndSuggest(args);
      return {
        success: true,
        suggestions,
        summary: this.generateSummary(suggestions),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to analyze problem',
      };
    }
  }

  private analyzeAndSuggest(args: AlgorithmSuggestionInput): AlgorithmSuggestion[] {
    const { problemDescription, constraints, difficulty } = args;
    const text = `${problemDescription} ${constraints || ''}`.toLowerCase();
    const suggestions: AlgorithmSuggestion[] = [];

    // Pattern matching for algorithm detection
    const patterns = this.detectPatterns(text);

    // Suggest algorithms based on detected patterns
    if (patterns.includes('shortest_path') || patterns.includes('graph_traversal')) {
      suggestions.push(this.createSuggestion('BFS/DFS', 'Graph', patterns, difficulty));
    }
    
    if (patterns.includes('optimal_substructure') || patterns.includes('overlapping_subproblems')) {
      suggestions.push(this.createSuggestion('Dynamic Programming', 'Optimization', patterns, difficulty));
    }
    
    if (patterns.includes('sorted_array') || patterns.includes('search_target')) {
      suggestions.push(this.createSuggestion('Binary Search', 'Search', patterns, difficulty));
    }
    
    if (patterns.includes('greedy_choice') || patterns.includes('local_optimal')) {
      suggestions.push(this.createSuggestion('Greedy', 'Optimization', patterns, difficulty));
    }
    
    if (patterns.includes('sliding_window') || patterns.includes('subarray')) {
      suggestions.push(this.createSuggestion('Sliding Window', 'Array', patterns, difficulty));
    }
    
    if (patterns.includes('two_pointers')) {
      suggestions.push(this.createSuggestion('Two Pointers', 'Array', patterns, difficulty));
    }
    
    if (patterns.includes('string_matching') || patterns.includes('pattern')) {
      suggestions.push(this.createSuggestion('String Algorithms', 'String', patterns, difficulty));
    }
    
    if (patterns.includes('tree_structure')) {
      suggestions.push(this.createSuggestion('Tree Traversal', 'Tree', patterns, difficulty));
    }
    
    if (patterns.includes('backtracking') || patterns.includes('permutation') || patterns.includes('combination')) {
      suggestions.push(this.createSuggestion('Backtracking', 'Recursion', patterns, difficulty));
    }
    
    if (patterns.includes('divide_conquer')) {
      suggestions.push(this.createSuggestion('Divide and Conquer', 'Recursion', patterns, difficulty));
    }

    // Default suggestion if no patterns match
    if (suggestions.length === 0) {
      suggestions.push({
        name: 'Brute Force',
        category: 'Basic',
        confidence: 'low',
        timeComplexity: 'Varies',
        spaceComplexity: 'O(1) to O(n)',
        reasoning: 'No specific pattern detected. Start with brute force and optimize.',
        hints: [
          'Think about the simplest solution first',
          'Consider all possible inputs',
          'Look for patterns that could optimize',
        ],
        relatedPatterns: [],
      });
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  private detectPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    const patternKeywords: Record<string, string[]> = {
      shortest_path: ['shortest', 'minimum path', 'minimum distance', 'shortest path', 'đường đi ngắn nhất'],
      graph_traversal: ['graph', 'node', 'edge', 'connected', 'adjacent', 'đồ thị', 'đỉnh', 'cạnh'],
      optimal_substructure: ['maximum', 'minimum', 'longest', 'optimize', 'tối ưu', 'lớn nhất', 'nhỏ nhất'],
      overlapping_subproblems: ['fibonacci', 'subset', 'partition', 'coin', 'knapsack', 'sequence'],
      sorted_array: ['sorted', 'ascending', 'descending', 'đã sắp xếp', 'tăng dần'],
      search_target: ['find', 'search', 'locate', 'target', 'tìm', 'tìm kiếm'],
      greedy_choice: ['activity', 'schedule', 'interval', 'job', 'lịch', 'công việc'],
      local_optimal: ['greedy', 'select', 'pick', 'chọn'],
      sliding_window: ['window', 'consecutive', 'contiguous', 'subarray', 'liên tiếp', 'cửa sổ'],
      subarray: ['subarray', 'substring', 'subsequence', 'mảng con', 'chuỗi con'],
      two_pointers: ['pair', 'two sum', 'triplet', 'cặp', 'tổng hai'],
      string_matching: ['pattern', 'match', 'string', 'text', 'chuỗi', 'mẫu'],
      tree_structure: ['tree', 'binary', 'root', 'leaf', 'parent', 'child', 'cây', 'nút', 'lá'],
      backtracking: ['all possible', 'generate', 'enumerate', 'tất cả', 'liệt kê'],
      permutation: ['permutation', 'arrangement', 'hoán vị', 'sắp xếp'],
      combination: ['combination', 'choose', 'select k', 'tổ hợp', 'chọn'],
      divide_conquer: ['divide', 'merge', 'split', 'chia', 'hợp nhất'],
    };

    for (const [pattern, keywords] of Object.entries(patternKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private createSuggestion(
    name: string,
    category: string,
    detectedPatterns: string[],
    difficulty?: string,
  ): AlgorithmSuggestion {
    const algorithmDetails: Record<string, Partial<AlgorithmSuggestion>> = {
      'BFS/DFS': {
        timeComplexity: 'O(V + E)',
        spaceComplexity: 'O(V)',
        hints: [
          'Use a queue for BFS (level-order), stack for DFS (depth-first)',
          'Track visited nodes to avoid cycles',
          'BFS finds shortest path in unweighted graphs',
        ],
        relatedPatterns: ['Graph', 'Tree Traversal', 'Shortest Path'],
      },
      'Dynamic Programming': {
        timeComplexity: 'O(n²) or O(n*m)',
        spaceComplexity: 'O(n) to O(n²)',
        hints: [
          'Define the state: what information do you need?',
          'Find the recurrence relation between states',
          'Consider bottom-up (tabulation) vs top-down (memoization)',
          'Can you optimize space by only keeping necessary states?',
        ],
        relatedPatterns: ['Memoization', 'Tabulation', 'Optimal Substructure'],
      },
      'Binary Search': {
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        hints: [
          'Array must be sorted (or have monotonic property)',
          'Define search space clearly (what are you searching for?)',
          'Handle boundary conditions carefully',
          'Consider: search for exact value vs search for boundary',
        ],
        relatedPatterns: ['Sorted Array', 'Search Space Reduction'],
      },
      'Greedy': {
        timeComplexity: 'O(n log n) typically',
        spaceComplexity: 'O(1) to O(n)',
        hints: [
          'Local optimal choice should lead to global optimal',
          'Usually involves sorting first',
          'Prove greedy choice is safe before implementing',
        ],
        relatedPatterns: ['Sorting', 'Interval Scheduling', 'Activity Selection'],
      },
      'Sliding Window': {
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1) to O(k)',
        hints: [
          'Define what information the window needs to track',
          'Decide: fixed-size or variable-size window?',
          'Update window state incrementally as you slide',
        ],
        relatedPatterns: ['Two Pointers', 'Hash Map', 'Monotonic Queue'],
      },
      'Two Pointers': {
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        hints: [
          'Usually works on sorted arrays',
          'Start pointers at opposite ends or both at start',
          'Move pointers based on comparison with target',
        ],
        relatedPatterns: ['Sorted Array', 'Binary Search', 'Sliding Window'],
      },
      'String Algorithms': {
        timeComplexity: 'O(n) to O(n*m)',
        spaceComplexity: 'O(n) typically',
        hints: [
          'Consider: KMP, Rabin-Karp, or Z-algorithm for pattern matching',
          'Trie for prefix-based problems',
          'Hash tables for substring problems',
        ],
        relatedPatterns: ['Pattern Matching', 'Trie', 'Hash'],
      },
      'Tree Traversal': {
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(h) where h is height',
        hints: [
          'Choose traversal order: preorder, inorder, postorder, or level-order',
          'Recursive solutions are often simplest',
          'Consider iterative with explicit stack for space optimization',
        ],
        relatedPatterns: ['DFS', 'BFS', 'Recursion'],
      },
      'Backtracking': {
        timeComplexity: 'O(k^n) or O(n!)',
        spaceComplexity: 'O(n)',
        hints: [
          'Make a choice, explore, then undo (backtrack)',
          'Prune invalid branches early',
          'Track current state and decisions made',
        ],
        relatedPatterns: ['Recursion', 'DFS', 'Constraint Satisfaction'],
      },
      'Divide and Conquer': {
        timeComplexity: 'O(n log n) typically',
        spaceComplexity: 'O(log n) to O(n)',
        hints: [
          'Divide problem into smaller subproblems',
          'Solve subproblems independently',
          'Combine results to solve original problem',
        ],
        relatedPatterns: ['Recursion', 'Merge Sort', 'Quick Sort'],
      },
    };

    const details = algorithmDetails[name] || {};
    const matchedPatterns = detectedPatterns.filter(p => 
      (details.relatedPatterns || []).some(rp => rp.toLowerCase().includes(p.replace('_', ' ')))
    );

    return {
      name,
      category,
      confidence: matchedPatterns.length >= 2 ? 'high' : matchedPatterns.length === 1 ? 'medium' : 'low',
      timeComplexity: details.timeComplexity || 'Varies',
      spaceComplexity: details.spaceComplexity || 'Varies',
      reasoning: `Detected patterns: ${detectedPatterns.join(', ')}. ${name} is commonly used for these types of problems.`,
      hints: details.hints || [],
      relatedPatterns: details.relatedPatterns || [],
    };
  }

  private generateSummary(suggestions: AlgorithmSuggestion[]): string {
    if (suggestions.length === 0) {
      return 'Unable to determine appropriate algorithm. Consider starting with a brute force approach.';
    }

    const primary = suggestions[0];
    return `Recommended: ${primary.name} (${primary.category}). Expected complexity: Time ${primary.timeComplexity}, Space ${primary.spaceComplexity}. Confidence: ${primary.confidence}.`;
  }
}
