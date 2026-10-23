import { z } from 'zod';

const positiveInteger = z.number().finite().int().positive().max(Number.MAX_SAFE_INTEGER);
export const inputLimitsSchema = z
  .object({
    maxDocumentsPerCase: positiveInteger.min(2),
    pdf: z
      .object({
        maxBytesPerFile: positiveInteger,
        maxPagesPerFile: positiveInteger,
        maxPagesPerCase: positiveInteger,
      })
      .strict(),
  })
  .strict();
export type InputLimits = z.infer<typeof inputLimitsSchema>;

// Change these capacities here, then restart. This does not authorize model spending.
export const inputLimits: InputLimits = {
  maxDocumentsPerCase: 4,
  pdf: { maxBytesPerFile: 10 * 1024 * 1024, maxPagesPerFile: 50, maxPagesPerCase: 100 },
};
