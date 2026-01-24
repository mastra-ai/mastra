import { z } from 'zod';
import { paginationQuerySchema } from './common';

/**
 * Project source response schema.
 */
export const projectSourceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['local', 'github']),
  path: z.string(),
  defaultBranch: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ProjectSourceResponse = z.infer<typeof projectSourceResponseSchema>;

/**
 * Validate source response schema.
 */
export const validateSourceResponseSchema = z.object({
  valid: z.boolean(),
  error: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ValidateSourceResponse = z.infer<typeof validateSourceResponseSchema>;

/**
 * List sources query params.
 */
export const listSourcesQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['local', 'github']).optional(),
});

export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;
