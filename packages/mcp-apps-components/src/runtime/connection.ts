import { z } from 'zod';

/** The fields every app that reads from a Mastra server expects in `structuredContent`. */
export const mastraConnectionSchema = z.object({
  baseUrl: z.url(),
  apiPrefix: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
