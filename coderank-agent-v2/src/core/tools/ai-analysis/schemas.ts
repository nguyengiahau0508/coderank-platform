import { z } from 'zod';

/**
 * Shared schemas for AI analysis tools
 */

export const ProgrammingLanguageSchema = z.enum([
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust'
]);

export const CodeAnalysisInputSchema = z.object({
  code: z.string().describe('The source code to analyze'),
  language: ProgrammingLanguageSchema.describe('Programming language of the code'),
});

export const ComplexityLevelSchema = z.enum([
  'O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2^n)', 'O(n!)', 'Unknown'
]);

export const CodeQualityDimensionSchema = z.object({
  score: z.number().min(0).max(100).describe('Score from 0-100'),
  feedback: z.string().describe('Specific feedback for this dimension'),
  suggestions: z.array(z.string()).describe('List of improvement suggestions'),
});

export const CodeStructureSchema = z.object({
  functions: z.array(z.object({
    name: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
    parameters: z.array(z.string()),
    isAsync: z.boolean().optional(),
  })),
  classes: z.array(z.object({
    name: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
    methods: z.array(z.string()),
    properties: z.array(z.string()),
  })),
  imports: z.array(z.object({
    module: z.string(),
    items: z.array(z.string()).optional(),
    isDefault: z.boolean().optional(),
  })),
  variables: z.array(z.object({
    name: z.string(),
    type: z.string().optional(),
    scope: z.enum(['global', 'local', 'class']),
  })),
  loops: z.array(z.object({
    type: z.enum(['for', 'while', 'forEach', 'map', 'recursion']),
    lineStart: z.number(),
    nested: z.boolean(),
  })),
  conditionals: z.number().describe('Number of conditional statements'),
  linesOfCode: z.number(),
  commentLines: z.number(),
});

export type ProgrammingLanguage = z.infer<typeof ProgrammingLanguageSchema>;
export type ComplexityLevel = z.infer<typeof ComplexityLevelSchema>;
export type CodeQualityDimension = z.infer<typeof CodeQualityDimensionSchema>;
export type CodeStructure = z.infer<typeof CodeStructureSchema>;
