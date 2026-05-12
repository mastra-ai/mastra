import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { closeClient, getBrightDataClient } from './client.js';
import type { BrightDataClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  country: z
    .string()
    .length(2)
    .optional()
    .describe('2-letter country code for geo-targeted results (e.g., "us", "gb")'),
  start: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Result offset for pagination (e.g. 10 to get the second page of 10 results)'),
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
  return createTool({
    id: 'brightdata-search',
    description:
      "Search Google and get back parsed organic results (link, title, description). Uses Bright Data's SERP API which bypasses bot detection. Supports country targeting and pagination via result offset.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const client = getBrightDataClient(config);
      try {
        const rawResponse = await client.search.google(input.query, {
          country: input.country,
          start: input.start,
        });

        const response: { organic?: unknown; current_page?: unknown } =
          typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;

        const organic = Array.isArray(response.organic) ? response.organic : [];
        const results = organic
          .map((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return null;
            const e = entry as Record<string, unknown>;
            const link = typeof e.link === 'string' ? e.link.trim() : '';
            const title = typeof e.title === 'string' ? e.title.trim() : '';
            const description = typeof e.description === 'string' ? e.description.trim() : '';
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
      } finally {
        await closeClient(client);
      }
    },
  });
}
