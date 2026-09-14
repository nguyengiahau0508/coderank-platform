import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient } from '../tool.interface';

const ProblemGeneratorInputSchema = z.object({
  topic: z.string().min(2).describe('Primary topic of the generated problem'),
  difficulty: z
    .enum(['easy', 'medium', 'hard'])
    .default('medium')
    .describe('Target difficulty'),
  constraints: z
    .string()
    .optional()
    .describe('Optional constraints such as n <= 1e5'),
  language: z
    .enum(['vi', 'en'])
    .default('vi')
    .describe('Language for generated statement'),
});

type ProblemGeneratorInput = z.infer<typeof ProblemGeneratorInputSchema>;

interface GeneratedProblem {
  title: string;
  description: string;
  inputDescription: string;
  outputDescription: string;
  constraints: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  hints: string[];
  tags: string[];
}

export class ProblemGeneratorTool extends BaseTool {
  readonly name = 'generate_problem';
  readonly description = `Generates a programming problem skeleton for instructors.
Returns: title, statement, input/output descriptions, constraints, examples, hints, and tags.
The output is intended as a high-quality draft for instructor review before publishing.`;

  readonly parameters = ProblemGeneratorInputSchema;

  protected async run(
    args: ProblemGeneratorInput,
    _client: IApiClient,
  ): Promise<unknown> {
    try {
      const problem = this.generateProblem(args);
      return {
        success: true,
        problem,
        message:
          args.language === 'vi'
            ? 'Đã tạo bản nháp bài toán.'
            : 'Generated a draft problem statement.',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to generate problem draft',
      };
    }
  }

  private generateProblem(args: ProblemGeneratorInput): GeneratedProblem {
    const topic = args.topic.trim();
    const isVi = args.language === 'vi';
    const difficulty = args.difficulty;
    const constraints = args.constraints
      ? [args.constraints]
      : this.defaultConstraints(difficulty);

    const title = isVi
      ? this.toVietnameseTitle(topic, difficulty)
      : this.toEnglishTitle(topic, difficulty);

    const templates = isVi
      ? this.viTemplate(topic, difficulty)
      : this.enTemplate(topic, difficulty);

    return {
      title,
      description: templates.description,
      inputDescription: templates.inputDescription,
      outputDescription: templates.outputDescription,
      constraints,
      examples: templates.examples,
      hints: templates.hints,
      tags: this.buildTags(topic, difficulty),
    };
  }

  private defaultConstraints(difficulty: 'easy' | 'medium' | 'hard'): string[] {
    if (difficulty === 'easy') {
      return ['1 <= n <= 10^3', 'Giới hạn thời gian: 1 giây'];
    }
    if (difficulty === 'medium') {
      return ['1 <= n <= 10^5', 'Giới hạn thời gian: 1 giây'];
    }
    return ['1 <= n <= 2*10^5', 'Giới hạn thời gian: 2 giây'];
  }

  private toVietnameseTitle(
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard',
  ): string {
    const level =
      difficulty === 'easy'
        ? 'Cơ bản'
        : difficulty === 'medium'
          ? 'Nâng cao'
          : 'Thử thách';
    return `${topic} - Bài toán ${level}`;
  }

  private toEnglishTitle(
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard',
  ): string {
    const level =
      difficulty === 'easy'
        ? 'Fundamentals'
        : difficulty === 'medium'
          ? 'Intermediate'
          : 'Challenge';
    return `${topic} ${level} Problem`;
  }

  private viTemplate(topic: string, difficulty: 'easy' | 'medium' | 'hard') {
    const examples =
      difficulty === 'hard'
        ? [
            {
              input: '6\n3 1 4 1 5 9',
              output: '2',
              explanation:
                'Áp dụng kỹ thuật theo chủ đề để tìm giá trị tối ưu theo yêu cầu bài.',
            },
            {
              input: '5\n10 20 30 40 50',
              output: '3',
            },
          ]
        : [
            {
              input: '5\n1 2 3 4 5',
              output: '9',
              explanation: 'Kết quả được tính theo quy tắc của đề bài.',
            },
            {
              input: '4\n2 2 2 2',
              output: '4',
            },
          ];

    return {
      description: `Cho một bài toán thuộc chủ đề "${topic}". Hãy xử lý dữ liệu đầu vào và trả về kết quả theo yêu cầu.

Mục tiêu:
1) Hiểu mô hình dữ liệu đầu vào.
2) Thiết kế thuật toán phù hợp với độ khó ${difficulty}.
3) Trả về kết quả đúng với mọi trường hợp biên.`,
      inputDescription:
        'Dòng 1 chứa số nguyên n.\nDòng 2 chứa n phần tử mô tả dữ liệu của bài toán.',
      outputDescription: 'In ra một giá trị nguyên duy nhất theo yêu cầu đề bài.',
      examples,
      hints: [
        `Xác định pattern phổ biến của chủ đề ${topic}.`,
        'Bắt đầu với lời giải đơn giản rồi tối ưu dần.',
        'Kiểm tra kỹ các trường hợp biên trước khi nộp.',
      ],
    };
  }

  private enTemplate(topic: string, difficulty: 'easy' | 'medium' | 'hard') {
    const examples =
      difficulty === 'hard'
        ? [
            {
              input: '6\n3 1 4 1 5 9',
              output: '2',
              explanation:
                'Use topic-driven optimization strategy to compute the required value.',
            },
            {
              input: '5\n10 20 30 40 50',
              output: '3',
            },
          ]
        : [
            {
              input: '5\n1 2 3 4 5',
              output: '9',
              explanation: 'The result follows the problem rule.',
            },
            {
              input: '4\n2 2 2 2',
              output: '4',
            },
          ];

    return {
      description: `Design a solution for a "${topic}" programming task. Process input data and return the required result.

Goals:
1) Understand the input model.
2) Design an algorithm suitable for ${difficulty} difficulty.
3) Handle edge cases correctly.`,
      inputDescription:
        'Line 1 contains an integer n.\nLine 2 contains n values describing the problem data.',
      outputDescription:
        'Print a single integer result that satisfies the problem requirements.',
      examples,
      hints: [
        `Identify key ${topic} patterns first.`,
        'Start with a correct baseline, then optimize.',
        'Validate edge cases before final submission.',
      ],
    };
  }

  private buildTags(topic: string, difficulty: 'easy' | 'medium' | 'hard'): string[] {
    const baseTags = [
      topic.toLowerCase(),
      difficulty,
      'problem-generation',
      'ai-draft',
    ];
    return Array.from(new Set(baseTags));
  }
}
