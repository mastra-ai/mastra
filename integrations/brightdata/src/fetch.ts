import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getBrightDataClient } from './client.js';
import type { BrightDataClient, BrightDataClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().url().describe('The URL to fetch'),
});

const outputSchema = z.object({
  url: z.string(),
  content: z.string().describe('Page content as markdown'),
});

export function createBrightDataFetchTool(config?: BrightDataClientOptions) {
  let client: BrightDataClient | null = null;

  function getClient(): BrightDataClient {
    if (!client) {
      client = getBrightDataClient(config);
    }
    return client;
  }

  return createTool({
    id: 'web-fetch',
    description:
      "Fetch a webpage and return its content as markdown. Uses Bright Data's Web Unlocker which bypasses bot detection and CAPTCHAs. Pass any URL, including pages that block normal scrapers.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const brightDataClient = getClient();

      const content = (await brightDataClient.scrapeUrl(input.url, {
        dataFormat: 'markdown',
      })) as string;

      return {
        url: input.url,
        content,
      };
    },
  });
}
