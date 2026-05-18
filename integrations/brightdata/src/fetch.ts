import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { closeClient, getBrightDataClient } from './client.js';
import type { BrightDataClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().url().describe('The URL to fetch'),
});

const outputSchema = z.object({
  url: z.string(),
  content: z.string().describe('Page content as Markdown'),
});

export function createBrightDataFetchTool(config?: BrightDataClientOptions) {
  return createTool({
    id: 'brightdata-fetch',
    description:
      "Fetch a webpage and return its content as Markdown. Uses Bright Data's Web Unlocker which bypasses bot detection and CAPTCHAs. Pass any URL, including pages that block normal scrapers.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const client = getBrightDataClient(config);
      try {
        const content = await client.scrapeUrl(input.url, {
          dataFormat: 'markdown',
        });

        return {
          url: input.url,
          content,
        };
      } finally {
        await closeClient(client);
      }
    },
  });
}
