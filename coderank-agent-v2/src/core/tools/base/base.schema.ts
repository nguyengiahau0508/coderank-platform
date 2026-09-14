import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.number().int().min(1).default(1).describe('Page number (1-indexed)'),
  limit: z.number().int().min(1).max(1000).default(10).describe('Number of items per page'),
  sortBy: z
    .enum(['createdAt'])
    .optional()
    .describe('Field to sort by'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC').describe('Sort direction'),
  search: z.string().optional().describe('Search keyword'),
});