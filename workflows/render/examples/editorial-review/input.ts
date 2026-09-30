import { z } from 'zod';

// Match JavaScript string.length and HTML maxlength (UTF-16 code units).
export const inputLimits = { draft: 100_000, criteria: 2_000 } as const;

export const inputSchema = z.object({
  draft: z.string().trim().min(1).max(inputLimits.draft),
  criteria: z.string().max(inputLimits.criteria).default('Make this clear, coherent and easy to read.'),
  demoFailure: z.boolean().default(false),
});

// Every UTF-16 unit can use six ASCII bytes as a JSON \uXXXX escape. Reserve
// 4 KiB for keys, the optional run ID, booleans and formatting. Unknown fields
// and excessive whitespace remain subject to this independent transport cap.
export const maxReviewBodyBytes = 6 * (inputLimits.draft + inputLimits.criteria) + 4 * 1024;
