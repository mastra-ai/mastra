import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { perplexitySearchRequest } from './client.js';
import type { PerplexityClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Maximum number of results to return (1-20). Defaults to the API default.'),
  searchDomainFilter: z
    .array(z.string())
    .optional()
    .refine(
      domains => {
        if (!domains || domains.length === 0) return true;
        const hasAllow = domains.some(d => !d.startsWith('-'));
        const hasDeny = domains.some(d => d.startsWith('-'));
        return !(hasAllow && hasDeny);
      },
      { message: 'searchDomainFilter cannot mix allow and deny domain entries in the same call.' },
    )
    .describe(
      'Restrict (or exclude) results by domain. Prefix a domain with `-` to exclude it (e.g. `-pinterest.com`). Do not mix allow and deny entries in the same call.',
    ),
  searchRecencyFilter: z
    .enum(['hour', 'day', 'week', 'month', 'year'])
    .optional()
    .describe('Only return results from within the given recency window.'),
  searchAfterDateFilter: z
    .string()
    .optional()
    .describe('Only return results published on or after this date. Format: m/d/yyyy (e.g. 1/1/2025).'),
  searchBeforeDateFilter: z
    .string()
    .optional()
    .describe('Only return results published on or before this date. Format: m/d/yyyy (e.g. 12/31/2025).'),
});

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      date: z.string().optional(),
    }),
  ),
});

/**
 * Creates a tool that searches the web using the Perplexity Search API.
 *
 * Returns ranked web results with titles, URLs, snippets, and optional
 * publication dates. Supports filtering by domain (allow- or deny-list),
 * recency, and explicit date ranges.
 *
 * @see https://docs.perplexity.ai/docs/search/quickstart
 */
export function createPerplexitySearchTool(config?: PerplexityClientOptions) {
  return createTool({
    id: 'perplexity-search',
    description:
      'Search the web for up-to-date information using the Perplexity Search API. Returns ranked results with titles, URLs, snippets, and optional publication dates. Supports filtering by domain, recency, and date range.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await perplexitySearchRequest(
        {
          query: input.query,
          max_results: input.maxResults,
          search_domain_filter: input.searchDomainFilter,
          search_recency_filter: input.searchRecencyFilter,
          search_after_date_filter: input.searchAfterDateFilter,
          search_before_date_filter: input.searchBeforeDateFilter,
        },
        config,
      );

      return {
        query: input.query,
        results: response.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          date: r.date,
        })),
      };
    },
  });
}
