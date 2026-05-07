import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MrScraperClientOptions } from './config.js';
import { resolveAppToken } from './config.js';
import { SCRAPERS_MANUAL_RERUN, SCRAPERS_MANUAL_RERUN_BULK } from './constants.js';
import { mrScraperPostJson } from './http.js';
import { mrScraperApiResultSchema } from './schemas.js';

function appJsonHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    accept: 'application/json',
    'x-api-token': token,
  };
}

const rerunManualInput = z.object({
  scraperId: z.string().min(1).describe('Manual scraper id from the MrScraper dashboard'),
  url: z.string().url().describe('Target URL compatible with the manual scraper rules'),
});

export function createMrscraperRerunManualScraperTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-rerun-manual-scraper',
    description:
      'Rerun a manual (selector-based) MrScraper scraper from the dashboard on a new URL. Not for AI scrapers—use rerun AI tools instead.',
    inputSchema: rerunManualInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const body = { scraperId: input.scraperId, url: input.url };
      return mrScraperPostJson(SCRAPERS_MANUAL_RERUN, body, { headers: appJsonHeaders(token) });
    },
  });
}

const bulkManualInput = z.object({
  scraperId: z.string().min(1),
  urls: z.array(z.string().url()).min(1),
});

export function createMrscraperBulkRerunManualScraperTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-bulk-rerun-manual-scraper',
    description: 'Rerun a manual scraper on multiple URLs in one batch request.',
    inputSchema: bulkManualInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const body = { scraperId: input.scraperId, urls: input.urls };
      return mrScraperPostJson(SCRAPERS_MANUAL_RERUN_BULK, body, { headers: appJsonHeaders(token) });
    },
  });
}
