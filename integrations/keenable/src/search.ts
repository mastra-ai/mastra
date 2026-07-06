import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getKeenableClient } from './client.js';
import type { KeenableClient, KeenableClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  site: z.string().optional().describe("Restrict results to a single domain, e.g. 'techcrunch.com'"),
  publishedAfter: z.string().optional().describe('Only pages published on or after this date (YYYY-MM-DD)'),
  publishedBefore: z.string().optional().describe('Only pages published on or before this date (YYYY-MM-DD)'),
  acquiredAfter: z.string().optional().describe('Only pages indexed on or after this date (YYYY-MM-DD)'),
  acquiredBefore: z.string().optional().describe('Only pages indexed on or before this date (YYYY-MM-DD)'),
  maxResults: z.number().min(1).max(20).optional().describe('Maximum number of results to return (1-20)'),
});

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      description: z.string().optional(),
      publishedAt: z.string().optional(),
      acquiredAt: z.string().optional(),
    }),
  ),
});

export function createKeenableSearchTool(config?: KeenableClientOptions) {
  let client: KeenableClient | null = null;

  function getClient(): KeenableClient {
    if (!client) {
      client = getKeenableClient(config);
    }
    return client;
  }

  return createTool({
    id: 'keenable-search',
    description:
      'Search the web using Keenable, a search index built for AI agents. Returns relevant results with title, URL, and snippet. Supports filtering by site and publication/index date. Keyless by default.',
    inputSchema,
    outputSchema,
    execute: async input => {
      return getClient().search(input.query, {
        site: input.site,
        publishedAfter: input.publishedAfter,
        publishedBefore: input.publishedBefore,
        acquiredAfter: input.acquiredAfter,
        acquiredBefore: input.acquiredBefore,
        maxResults: input.maxResults,
      });
    },
  });
}
