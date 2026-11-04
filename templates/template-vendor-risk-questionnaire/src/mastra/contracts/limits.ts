import { z } from 'zod';

export const limitsSchema = z
  .object({
    maxBytes: z
      .int()
      .positive()
      .default(10 * 1024 * 1024),
    maxAggregateBytes: z
      .int()
      .positive()
      .default(100 * 1024 * 1024),
    maxExpandedBytes: z
      .int()
      .positive()
      .default(100 * 1024 * 1024),
    maxEntries: z.int().positive().default(2000),
    maxTextChars: z.int().positive().default(2_000_000),
    maxQuestions: z.int().positive().default(100),
    maxQuestionChars: z.int().positive().default(4000),
    timeoutMs: z.int().positive().default(30_000),
    maxEvidenceDocuments: z.int().positive().default(50),
    maxPdfPages: z.int().positive().max(100).default(100),
  })
  .strict();
export type InputLimits = z.infer<typeof limitsSchema>;
export const defaultLimits = limitsSchema.parse({});
