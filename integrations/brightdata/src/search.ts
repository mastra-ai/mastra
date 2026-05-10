import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getBrightDataClient } from './client.js';
import type { BrightDataClient, BrightDataClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  country: z
    .string()
    .length(2)
    .optional()
    .describe('2-letter country code for geo-targeted results (e.g., "us", "gb")'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for the next page of results'),
});

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      link: z.string(),
      title: z.string(),
      description: z.string(),
    }),
  ),
  currentPage: z.number(),
});

export function createBrightDataSearchTool(config?: BrightDataClientOptions) {
  let client: BrightDataClient | null = null;

  function getClient(): BrightDataClient {
    if (!client) {
      client = getBrightDataClient(config);
    }
    return client;
  }

  return createTool({
    id: 'web-search',
    description:
      "Search Google and get back parsed organic results (link, title, description). Uses Bright Data's SERP API which bypasses bot detection. Supports country targeting and pagination.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const brightDataClient = getClient();

      const response = (await brightDataClient.search.google(input.query, {
        country: input.country,
        cursor: input.cursor,
      })) as { organic?: unknown; current_page?: unknown };

      const organic = Array.isArray(response.organic) ? response.organic : [];
      const results = organic
        .map((entry: any) => {
          if (!entry || typeof entry !== 'object') return null;
          const link = typeof entry.link === 'string' ? entry.link.trim() : '';
          const title = typeof entry.title === 'string' ? entry.title.trim() : '';
          const description = typeof entry.description === 'string' ? entry.description.trim() : '';
          if (!link || !title) return null;
          return { link, title, description };
        })
        .filter((r): r is { link: string; title: string; description: string } => r !== null);

      const parsedPage = Number(response.current_page);
      const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

      return {
        query: input.query,
        results,
        currentPage,
      };
    },
  });
}
