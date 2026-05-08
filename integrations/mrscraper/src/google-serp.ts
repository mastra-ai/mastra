import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MrScraperClientOptions } from './config.js';
import { resolveSyncAccessToken } from './config.js';
import { GOOGLE_SERP_SYNC } from './constants.js';
import { mrScraperPostJson } from './http.js';
import { mrScraperApiResultSchema } from './schemas.js';

const inputSchema = z.object({
  url: z
    .string()
    .describe('Full Google search URL (for example https://www.google.com/search?q=example)'),
  raw: z.boolean().optional().default(true).describe('When true, request raw API output'),
  sessionCookie: z
    .string()
    .optional()
    .default('')
    .describe('Optional Cookie header value if your deployment requires it'),
  timeoutSeconds: z
    .number()
    .positive()
    .max(900)
    .optional()
    .default(600)
    .describe('HTTP timeout in seconds'),
});

export function createMrscraperGoogleSerpSyncTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-google-serp-sync',
    description:
      'Run a synchronous Google SERP scrape via the MrScraper sync API. Uses a dedicated sync bearer token (not the app API token). Payloads can be large—avoid loading full HTML or JSON into the model context.',
    inputSchema,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const bearer = resolveSyncAccessToken(config);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      };
      const cookie = input.sessionCookie?.trim() ?? '';
      if (cookie) {
        headers.Cookie = cookie;
      }
      const timeoutSeconds = input.timeoutSeconds ?? 600;
      return mrScraperPostJson(
        GOOGLE_SERP_SYNC,
        { url: input.url, raw: input.raw ?? true },
        { headers, timeoutMs: timeoutSeconds * 1000 },
      );
    },
  });
}
