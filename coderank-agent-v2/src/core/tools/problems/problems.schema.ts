import { z } from 'zod';
import { PaginationQuerySchema } from '../base/base.schema';

// ===== PAGINATION =====

export const PaginationQueryProblemsSchema = PaginationQuerySchema.extend({
  difficulty: z
    .enum(['easy', 'medium', 'hard'])
    .optional()
    .describe('Filter by difficulty'),
  tagIds: z
    .array(z.string())
    .optional()
    .describe('Filter by tag IDs'),
  isPublished: z.boolean().optional().describe('Only published problems'),
  minPoints: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe('Filter by minimum points'),
  maxPoints: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe('Filter by maximum points'),
});

// ===== PROBLEM =====

export const CreateProblemSchema = z.object({
  title: z.string().max(255).describe('Problem title (required)'),
  slug: z.string().max(255).describe('URL-friendly slug (auto-generated from title if omitted)'),
  description: z
    .string()
    .optional()
    .describe('Full problem statement in html (required)'),
  inputDescription: z.string().optional().describe('Input format description (required)'),
  outputDescription: z.string().optional().describe('Output format description (required)'),
  timeLimitMs: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Time limit in milliseconds, e.g. 1000 (required)'),
  memoryLimitMb: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Memory limit in MB, e.g. 256 (required)'),
  difficulty: z
    .enum(['easy', 'medium', 'hard'])
    .optional()
    .describe('Difficulty level: must be exactly one of "easy", "medium", or "hard" (lowercase only, required)'),
  isPublished: z
    .boolean()
    .optional()
    .describe('Whether the problem is published, true or false (required)'),
  points: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Points awarded for full solve, e.g. 100 (required)'),
});

export const UpdateProblemSchema = CreateProblemSchema.partial();

// ===== HINT =====

export const CreateHintSchema = z.object({
  content: z.string().describe('Content of the hint'),
  hintOrder: z
    .number()
    .int()
    .describe('Order of the hint (lower numbers appear first)'),
  isPublic: z
    .boolean()
    .describe('Whether this hint is publicly visible'),
});

export const UpdateHintSchema = CreateHintSchema.partial();

// ===== SOLUTION =====

export const CreateSolutionSchema = z.object({
  title: z.string().describe('Solution title'),
  description: z.string().describe('Solution description/explanation'),
  code: z.string().describe('Source code of the solution'),
  language: z
    .enum([
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'go',
      'rust',
    ])
    .describe('Programming language'),
});

export const UpdateSolutionSchema = CreateSolutionSchema.partial();

// ===== SUBMISSION =====

export const CreateSubmissionSchema = z.object({
  code: z.string().min(1).describe('Code solution'),
  language: z
    .enum([
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'go',
      'rust',
    ])
    .describe('Programming language'),
});

export const UpdateSubmissionSchema = z.object({
  code: z.string().describe('Code solution'),
  language: z
    .enum([
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'go',
      'rust',
    ])
    .describe('Programming language'),
  status: z
    .enum([
      'pending',
      'running',
      'accepted',
      'wrong_answer',
      'time_limit_exceeded',
      'memory_limit_exceeded',
      'runtime_error',
      'compilation_error',
      'system_error',
    ])
    .describe('Submission status'),
  score: z.number().int().min(0).describe('Score achieved'),
  executionTimeMs: z
    .number()
    .int()
    .min(0)
    .describe('Execution time in milliseconds'),
  memoryUsedMb: z
    .number()
    .int()
    .min(0)
    .describe('Memory used in MB'),
  passedTestcases: z
    .number()
    .int()
    .min(0)
    .describe('Number of testcases passed'),
  totalTestcases: z
    .number()
    .int()
    .min(0)
    .describe('Total number of testcases'),
  errorMessage: z.string().describe('Error message if any'),
  output: z.string().describe('Output of the submission'),
});

export const SubmissionResponseSchema = z.object({
  id: z.string().uuid().describe('Submission ID'),
  problemId: z.string().uuid().describe('Problem ID'),
  code: z.string().describe('Code solution'),
  language: z
    .enum([
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'go',
      'rust',
    ])
    .describe('Programming language'),
  status: z
    .enum([
      'pending',
      'running',
      'accepted',
      'wrong_answer',
      'time_limit_exceeded',
      'memory_limit_exceeded',
      'runtime_error',
      'compilation_error',
      'system_error',
    ])
    .describe('Submission status'),
  score: z.number().describe('Score achieved'),
  executionTimeMs: z
    .number()
    .describe('Execution time in milliseconds'),
  memoryUsedMb: z.number().describe('Memory used in MB'),
  passedTestcases: z.number().describe('Number of testcases passed'),
  totalTestcases: z.number().describe('Total number of testcases'),
  errorMessage: z.string().describe('Error message if any'),
  output: z.string().describe('Output of the submission'),
  authorId: z.string().uuid().describe('Author ID'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

// ===== TAG =====

export const CreateTagSchema = z.object({
  name: z.string().max(100).min(1).describe('Tag name'),
  slug: z.string().max(100).min(1).describe('URL-friendly slug'),
  description: z.string().max(255).describe('Short tag description'),
});

export const UpdateTagSchema = CreateTagSchema.partial();

// ===== TESTCASE =====

export const CreateTestcaseSchema = z.object({
  input: z.string().describe('Input content for testcase'),
  expectedOutput: z
    .string()
    .describe('Expected output for testcase'),
  isSample: z
    .boolean()
    .default(false)
    .describe('Whether this testcase is shown as sample (defaults to false)'),
  compareType: z
    .enum(['exact', 'trim_whitespace', 'tokenize'])
    .default('exact')
    .describe('Compare type used to validate output (defaults to "exact")'),
});

export const UpdateTestcaseSchema = CreateTestcaseSchema.partial();
