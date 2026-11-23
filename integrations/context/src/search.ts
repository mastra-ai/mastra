import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getContextClient } from './client.js';
import type { ContextClient, ContextClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().min(1).describe('Search query, including optional site: or other search operators'),
  numResults: z.number().int().min(1).max(100).optional().describe('Maximum results to return (default: 10)'),
  includeDomains: z.array(z.string()).max(100).optional().describe('Only return results from these domains'),
  excludeDomains: z.array(z.string()).max(100).optional().describe('Exclude results from these domains'),
  freshness: z
    .enum(['last_24_hours', 'last_week', 'last_month', 'last_year'])
    .optional()
    .describe('Restrict results by publication date'),
});

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
      relevance: z.enum(['high', 'medium', 'low']),
    }),
  ),
  requestId: z.string(),
  cacheMetadata: z.object({ status: z.enum(['hit', 'miss', 'zdr']), ageMs: z.number() }),
  partial: z.boolean().optional(),
});

export function createContextSearchTool(config?: ContextClientOptions) {
  let client: ContextClient | undefined;

  return createTool({
    id: 'context-search',
    description:
      'Search the web using Context.dev. Returns titles, URLs, descriptions, and relevance labels. Supports domain filters and publication-date freshness.',
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      client ??= getContextClient(config);
      const response = await client.web.search(input, { signal: context?.abortSignal });
      return {
        query: response.query,
        results: response.results.map(result => ({
          title: result.title,
          url: result.url,
          description: result.description,
          relevance: result.relevance,
        })),
        requestId: response.request_id,
        cacheMetadata: { status: response.cache_metadata.status, ageMs: response.cache_metadata.age_ms },
        partial: response.partial,
      };
    },
  });
}
