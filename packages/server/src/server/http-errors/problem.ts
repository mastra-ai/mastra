import { z } from 'zod/v4';

/**
 * RFC 9457 "Problem Details" object, exposed in the optional `problem` field of
 * Mastra error responses. `code` is a business code from `MASTRA_ERROR_CODES`
 * (kept as a string so clients tolerate codes added by newer servers).
 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  issues: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
