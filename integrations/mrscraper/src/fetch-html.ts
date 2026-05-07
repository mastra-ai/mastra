import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MrScraperClientOptions } from './config.js';
import { resolveAppToken } from './config.js';
import { FETCH_HTML_API_BASE } from './constants.js';
import { mrScraperGet } from './http.js';
import { mrScraperApiResultSchema } from './schemas.js';

const inputSchema = z.object({
  url: z.string().url().describe('Target URL to fetch rendered HTML for'),
  timeout: z
    .number()
    .int()
    .min(1)
    .max(600)
    .optional()
    .default(120)
    .describe('Seconds to wait for the page to load'),
  geoCode: z
    .string()
    .optional()
    .default('US')
    .describe('ISO country code for geolocation-based scraping (e.g. US, GB)'),
  blockResources: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, block images, CSS, fonts, and other resources for faster loads'),
});

export function createMrscraperFetchHtmlTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-fetch-html',
    description:
      'Fetch page HTML via MrScraper unblocker (stealth, rendering, geo, optional resource blocking). Responses can be very large—summarize or store externally instead of pasting full HTML into context.',
    inputSchema,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const timeoutSec = input.timeout ?? 120;
      const params = new URLSearchParams();
      params.set('token', token);
      params.set('timeout', String(timeoutSec));
      params.set('geoCode', input.geoCode ?? 'US');
      params.set('url', input.url);
      params.set('blockResources', String(input.blockResources ?? false).toLowerCase());
      const fullUrl = `${FETCH_HTML_API_BASE}?${params.toString()}`;
      return mrScraperGet(fullUrl, { timeoutMs: (timeoutSec + 30) * 1000 });
    },
  });
}
