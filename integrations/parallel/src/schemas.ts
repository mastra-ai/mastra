import { z } from 'zod';

export const usageItemSchema = z.object({
  name: z.string(),
  count: z.number(),
});

export const warningSchema = z.object({
  type: z.string(),
  message: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export const searchResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  publishDate: z.string().optional(),
  excerpts: z.array(z.string()),
});

export const fetchPolicySchema = z.object({
  maxAgeSeconds: z
    .number()
    .int()
    .min(600)
    .optional()
    .describe('Maximum cached-content age in seconds before Parallel attempts a live fetch (minimum 600).'),
  timeoutSeconds: z.number().int().positive().optional().describe('Timeout in seconds for a live fetch.'),
  disableCacheFallback: z
    .boolean()
    .optional()
    .describe('Return an error instead of older cached content when a live fetch fails or times out.'),
});

export type FetchPolicyInput = z.infer<typeof fetchPolicySchema>;
