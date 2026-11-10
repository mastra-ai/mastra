import { z } from 'zod';

const positiveInteger = z.number().finite().int().positive().max(Number.MAX_SAFE_INTEGER);
export const inputLimitsSchema = z
  .object({
    maxDocumentsPerCase: positiveInteger
      .min(2)
      .describe('Maximum distinct documents retained in a case; at least two must be allowed.'),
    pdf: z
      .object({
        maxBytesPerFile: positiveInteger.describe('Maximum original PDF bytes accepted per document.'),
        maxPagesPerFile: positiveInteger.describe('Maximum physical PDF pages accepted per document.'),
        maxPagesPerCase: positiveInteger.describe('Maximum physical PDF pages across all documents in a case.'),
      })
      .strict()
      .describe('PDF-specific upload capacities; changing them does not authorize model spending.'),
  })
  .strict();
export type InputLimits = z.infer<typeof inputLimitsSchema>;

// Change these capacities here, then restart. This does not authorize model spending.
export const inputLimits: InputLimits = {
  maxDocumentsPerCase: 4,
  pdf: { maxBytesPerFile: 10 * 1024 * 1024, maxPagesPerFile: 50, maxPagesPerCase: 100 },
};
