import { z } from 'zod';

/**
 * The server tool apps read Mastra data through. Apps run in a sandboxed iframe that hosts may
 * forbid from reaching the server, so their requests travel as tool calls over the host's
 * existing MCP connection instead.
 */
export const MASTRA_API_TOOL = 'mastraApi';

export const mastraApiRequestSchema = z.object({
  method: z.enum(['GET', 'POST']),
  /** Route under the server's API prefix, with its query string, e.g. `/observability/scores?page=0`. */
  path: z.string().startsWith('/'),
  body: z.unknown().optional(),
});

export const mastraApiResponseSchema = z.object({
  status: z.number().int(),
  body: z.unknown(),
});

export type MastraApiRequest = z.output<typeof mastraApiRequestSchema>;
export type MastraApiResponse = z.output<typeof mastraApiResponseSchema>;
