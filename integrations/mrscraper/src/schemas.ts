import { z } from 'zod';

/** Standard envelope returned by MrScraper HTTP APIs (matches mrscraper-mcp tool outputs). */
export const mrScraperApiResultSchema = z.object({
  status_code: z.number().optional(),
  data: z.any().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  error: z.string().optional(),
});
