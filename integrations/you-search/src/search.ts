import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { youSearchRequest } from './client.js';
import type { YouClientOptions } from './client.js';

const inputSchema = z
  .object({
    query: z.string().describe('The search query.'),
    count: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum number of results to return per section (web, news). Defaults to the API default of 10.'),
    freshness: z
      .string()
      .optional()
      .describe(
        'Only return results from within the given window: `day`, `week`, `month`, `year`, or a date range in the format `YYYY-MM-DDtoYYYY-MM-DD`.',
      ),
    country: z
      .string()
      .optional()
      .describe('Two-letter country code determining the geographical focus of web results (e.g. `US`, `DE`, `JP`).'),
    language: z
      .string()
      .optional()
      .describe('Language of the returned web results in BCP 47 format (e.g. `EN`, `FR`, `PT-BR`). Defaults to `EN`.'),
    safesearch: z
      .enum(['off', 'moderate', 'strict'])
      .optional()
      .describe('Content moderation level for the results.'),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe(
        'Restrict results to these domains only (strict allowlist, e.g. `["nytimes.com", "bbc.com"]`). Cannot be combined with excludeDomains.',
      ),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe('Exclude results from these domains. Cannot be combined with includeDomains.'),
  })
  .refine(input => !(input.includeDomains?.length && input.excludeDomains?.length), {
    message: 'includeDomains and excludeDomains cannot be combined in the same call.',
  });

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
      snippets: z.array(z.string()).optional(),
      publishedDate: z.string().optional(),
      source: z.enum(['web', 'news']),
    }),
  ),
});

/**
 * Creates a tool that searches the web using the You.com Search API.
 *
 * Returns LLM-ready web and news results with titles, URLs, descriptions, and
 * text snippets. Supports filtering by freshness, country, language, safesearch
 * level, and domain allow/deny lists.
 *
 * Works with zero configuration: without an API key, requests use the keyless
 * You.com free tier (rate limited per IP). Set the `YDC_API_KEY` environment
 * variable or pass `{ apiKey }` for higher limits.
 *
 * @see https://you.com/docs/api-reference/search/v1-search
 */
export function createYouSearchTool(config?: YouClientOptions) {
  return createTool({
    id: 'you-search',
    description:
      'Search the web for up-to-date information using the You.com Search API. Returns ranked web and news results with titles, URLs, descriptions, and text snippets. Supports filtering by freshness, country, language, and domain allow/deny lists.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await youSearchRequest(
        {
          query: input.query,
          count: input.count,
          freshness: input.freshness,
          country: input.country,
          language: input.language,
          safesearch: input.safesearch,
          include_domains: input.includeDomains,
          exclude_domains: input.excludeDomains,
        },
        config,
      );

      return {
        query: input.query,
        results: [
          ...response.results.web.map(r => ({
            title: r.title ?? '',
            url: r.url ?? '',
            description: r.description ?? '',
            snippets: r.snippets,
            publishedDate: r.page_age,
            source: 'web' as const,
          })),
          ...response.results.news.map(r => ({
            title: r.title ?? '',
            url: r.url ?? '',
            description: r.description ?? '',
            publishedDate: r.page_age,
            source: 'news' as const,
          })),
        ],
      };
    },
  });
}
