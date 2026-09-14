import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient } from '../tool.interface';

const DataStructureSuggestionInputSchema = z.object({
  problemDescription: z.string().describe('The problem statement/description'),
  operations: z.array(z.string()).optional().describe('Required operations (insert, delete, search, etc.)'),
  constraints: z.string().optional().describe('Input constraints (size, performance requirements)'),
  currentApproach: z.string().optional().describe('User current approach for context'),
});

type DataStructureSuggestionInput = z.infer<typeof DataStructureSuggestionInputSchema>;

interface DataStructureSuggestion {
  name: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  operationComplexities: Record<string, string>;
  spaceComplexity: string;
  useCases: string[];
  reasoning: string;
  implementation: string;
}

/**
 * Data Structure Suggestion Tool
 * Recommends optimal data structures based on problem requirements.
 */
export class DataStructureSuggestionTool extends BaseTool {
  readonly name = 'suggest_data_structure';
  readonly description = `Recommends optimal data structures based on problem requirements.
Analyzes:
- Required operations and their frequency
- Performance requirements
- Space constraints
- Problem patterns

Suggests structures like: Array, HashMap, Set, Stack, Queue, Heap, Tree, Graph, Trie, etc.`;

  readonly parameters = DataStructureSuggestionInputSchema;

  protected async run(args: DataStructureSuggestionInput, _client: IApiClient): Promise<unknown> {
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
        error: error.message || 'Failed to suggest data structure',
      };
    }
  }

  private analyzeAndSuggest(args: DataStructureSuggestionInput): DataStructureSuggestion[] {
    const { problemDescription, operations, constraints } = args;
    const text = `${problemDescription} ${(operations || []).join(' ')} ${constraints || ''}`.toLowerCase();
    const suggestions: DataStructureSuggestion[] = [];

    // Detect required operations
    const detectedOps = this.detectOperations(text);
    
    // Analyze and suggest based on operations and patterns
    if (this.needsFastLookup(text, detectedOps)) {
      suggestions.push(this.createHashMapSuggestion(detectedOps));
    }
    
    if (this.needsOrdering(text, detectedOps)) {
      suggestions.push(this.createTreeMapSuggestion(detectedOps));
    }
    
    if (this.needsMinMax(text, detectedOps)) {
      suggestions.push(this.createHeapSuggestion(detectedOps));
    }
    
    if (this.needsLIFO(text)) {
      suggestions.push(this.createStackSuggestion());
    }
    
    if (this.needsFIFO(text)) {
      suggestions.push(this.createQueueSuggestion());
    }
    
    if (this.needsPrefix(text)) {
      suggestions.push(this.createTrieSuggestion());
    }
    
    if (this.needsUnionFind(text)) {
      suggestions.push(this.createUnionFindSuggestion());
    }
    
    if (this.needsGraph(text)) {
      suggestions.push(this.createGraphSuggestion());
    }

    // Default to array if nothing specific detected
    if (suggestions.length === 0) {
      suggestions.push(this.createArraySuggestion(detectedOps));
    }

    // Sort by confidence and return top 3
    return suggestions
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.confidence] - order[b.confidence];
      })
      .slice(0, 3);
  }

  private detectOperations(text: string): string[] {
    const ops: string[] = [];
    
    const opPatterns: Record<string, string[]> = {
      insert: ['insert', 'add', 'push', 'put', 'thêm'],
      delete: ['delete', 'remove', 'pop', 'erase', 'xóa'],
      search: ['search', 'find', 'lookup', 'get', 'contains', 'tìm', 'kiểm tra'],
      update: ['update', 'modify', 'change', 'set', 'cập nhật'],
      min: ['minimum', 'min', 'smallest', 'nhỏ nhất'],
      max: ['maximum', 'max', 'largest', 'lớn nhất'],
      sort: ['sort', 'order', 'rank', 'sắp xếp'],
      iterate: ['iterate', 'traverse', 'all', 'each', 'duyệt'],
    };

    for (const [op, keywords] of Object.entries(opPatterns)) {
      if (keywords.some(kw => text.includes(kw))) {
        ops.push(op);
      }
    }

    return ops;
  }

  private needsFastLookup(text: string, ops: string[]): boolean {
    return ops.includes('search') || 
           text.includes('o(1)') || 
           text.includes('constant time') ||
           text.includes('frequency') ||
           text.includes('count') ||
           text.includes('duplicate');
  }

  private needsOrdering(text: string, ops: string[]): boolean {
    return ops.includes('sort') || 
           text.includes('sorted') || 
           text.includes('order') ||
           text.includes('range') ||
           text.includes('kth');
  }

  private needsMinMax(text: string, ops: string[]): boolean {
    return (ops.includes('min') || ops.includes('max')) &&
           (text.includes('repeatedly') || text.includes('k ') || text.includes('top'));
  }

  private needsLIFO(text: string): boolean {
    return text.includes('stack') ||
           text.includes('lifo') ||
           text.includes('parentheses') ||
           text.includes('bracket') ||
           text.includes('nested') ||
           text.includes('undo');
  }

  private needsFIFO(text: string): boolean {
    return text.includes('queue') ||
           text.includes('fifo') ||
           text.includes('bfs') ||
           text.includes('level order') ||
           text.includes('first come');
  }

  private needsPrefix(text: string): boolean {
    return text.includes('prefix') ||
           text.includes('autocomplete') ||
           text.includes('dictionary') ||
           text.includes('word search');
  }

  private needsUnionFind(text: string): boolean {
    return text.includes('connected components') ||
           text.includes('union') ||
           text.includes('groups') ||
           text.includes('cycle detection');
  }

  private needsGraph(text: string): boolean {
    return text.includes('graph') ||
           text.includes('network') ||
           text.includes('path') ||
           text.includes('node') && text.includes('edge');
  }

  private createHashMapSuggestion(ops: string[]): DataStructureSuggestion {
    return {
      name: 'HashMap / HashSet',
      category: 'Hash Table',
      confidence: ops.includes('search') ? 'high' : 'medium',
      operationComplexities: {
        insert: 'O(1) average',
        delete: 'O(1) average',
        search: 'O(1) average',
        update: 'O(1) average',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'Fast lookups by key',
        'Counting frequency of elements',
        'Checking for duplicates',
        'Two Sum type problems',
      ],
      reasoning: 'Hash-based structures provide O(1) average case for basic operations.',
      implementation: 'Use Map/Object in JS, dict in Python, HashMap in Java',
    };
  }

  private createTreeMapSuggestion(ops: string[]): DataStructureSuggestion {
    return {
      name: 'TreeMap / TreeSet (Balanced BST)',
      category: 'Tree',
      confidence: ops.includes('sort') ? 'high' : 'medium',
      operationComplexities: {
        insert: 'O(log n)',
        delete: 'O(log n)',
        search: 'O(log n)',
        min: 'O(log n)',
        max: 'O(log n)',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'Maintaining sorted order',
        'Range queries',
        'Finding kth element',
        'Floor/ceiling operations',
      ],
      reasoning: 'Tree-based structures maintain order while providing efficient operations.',
      implementation: 'Use TreeMap/TreeSet in Java, sorted containers in Python, or implement BST',
    };
  }

  private createHeapSuggestion(ops: string[]): DataStructureSuggestion {
    return {
      name: 'Heap / Priority Queue',
      category: 'Heap',
      confidence: 'high',
      operationComplexities: {
        insert: 'O(log n)',
        'extract min/max': 'O(log n)',
        'peek min/max': 'O(1)',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'Finding k largest/smallest elements',
        'Merge k sorted lists',
        'Task scheduling',
        'Dijkstra algorithm',
      ],
      reasoning: 'Heaps efficiently maintain min/max element with fast extraction.',
      implementation: 'Use heapq in Python, PriorityQueue in Java, implement in JS',
    };
  }

  private createStackSuggestion(): DataStructureSuggestion {
    return {
      name: 'Stack',
      category: 'Linear',
      confidence: 'high',
      operationComplexities: {
        push: 'O(1)',
        pop: 'O(1)',
        peek: 'O(1)',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'Parentheses matching',
        'Expression evaluation',
        'DFS traversal',
        'Undo operations',
        'Monotonic stack problems',
      ],
      reasoning: 'LIFO structure perfect for nested/recursive problems.',
      implementation: 'Use array with push/pop or dedicated Stack class',
    };
  }

  private createQueueSuggestion(): DataStructureSuggestion {
    return {
      name: 'Queue / Deque',
      category: 'Linear',
      confidence: 'high',
      operationComplexities: {
        enqueue: 'O(1)',
        dequeue: 'O(1)',
        peek: 'O(1)',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'BFS traversal',
        'Level order traversal',
        'Sliding window maximum',
        'Task scheduling (FIFO)',
      ],
      reasoning: 'FIFO structure ideal for level-by-level processing.',
      implementation: 'Use deque in Python, LinkedList in Java, array in JS',
    };
  }

  private createTrieSuggestion(): DataStructureSuggestion {
    return {
      name: 'Trie (Prefix Tree)',
      category: 'Tree',
      confidence: 'high',
      operationComplexities: {
        insert: 'O(m) where m is word length',
        search: 'O(m)',
        'prefix search': 'O(m)',
      },
      spaceComplexity: 'O(n * m)',
      useCases: [
        'Autocomplete',
        'Spell checker',
        'Word search',
        'IP routing',
      ],
      reasoning: 'Trie excels at prefix-based operations on strings.',
      implementation: 'Implement as nested objects/maps or use dedicated Trie class',
    };
  }

  private createUnionFindSuggestion(): DataStructureSuggestion {
    return {
      name: 'Union-Find (Disjoint Set)',
      category: 'Set',
      confidence: 'high',
      operationComplexities: {
        union: 'O(α(n)) ≈ O(1)',
        find: 'O(α(n)) ≈ O(1)',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'Connected components',
        'Cycle detection',
        'Kruskal MST',
        'Dynamic connectivity',
      ],
      reasoning: 'Nearly constant time for union and find with path compression.',
      implementation: 'Implement with parent array + path compression + rank',
    };
  }

  private createGraphSuggestion(): DataStructureSuggestion {
    return {
      name: 'Graph (Adjacency List)',
      category: 'Graph',
      confidence: 'medium',
      operationComplexities: {
        'add vertex': 'O(1)',
        'add edge': 'O(1)',
        'get neighbors': 'O(1)',
        'check edge': 'O(degree)',
      },
      spaceComplexity: 'O(V + E)',
      useCases: [
        'Network problems',
        'Path finding',
        'Social networks',
        'Dependencies',
      ],
      reasoning: 'Adjacency list is space-efficient for sparse graphs.',
      implementation: 'Use Map<node, List<neighbor>> or array of arrays',
    };
  }

  private createArraySuggestion(ops: string[]): DataStructureSuggestion {
    return {
      name: 'Array / List',
      category: 'Linear',
      confidence: 'low',
      operationComplexities: {
        'access by index': 'O(1)',
        insert: 'O(n)',
        delete: 'O(n)',
        search: 'O(n) or O(log n) if sorted',
      },
      spaceComplexity: 'O(n)',
      useCases: [
        'Sequential access',
        'Simple iteration',
        'Index-based access',
        'Building other structures',
      ],
      reasoning: 'Start with array and optimize if needed.',
      implementation: 'Built-in array in all languages',
    };
  }

  private generateSummary(suggestions: DataStructureSuggestion[]): string {
    if (suggestions.length === 0) {
      return 'Unable to determine optimal data structure. Consider starting with an array.';
    }

    const primary = suggestions[0];
    return `Recommended: ${primary.name}. Space: ${primary.spaceComplexity}. Best for: ${primary.useCases[0]}.`;
  }
}
