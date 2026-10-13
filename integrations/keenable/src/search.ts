import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { keenableSearchRequest, toIsoDate } from './client.js';
import type { KeenableClientOptions, KeenableSearchResultItem } from './client.js';

// Keenable returns page text as the snippet. This keeps each result short enough
// for an agent's context; the API treats it as a target, not a hard cap.
const SNIPPET_MAX_LENGTH = 500;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.');

const inputSchema = z.object({
  query: z.string().describe('The search query.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of results to return (1-50). Defaults to 10.'),
  site: z.string().optional().describe('Restrict results to a single domain, for example `github.com`.'),
  publishedAfter: isoDate
    .optional()
    .describe('Exclude pages published before this date. Format: YYYY-MM-DD. Pages without a known date are kept.'),
  publishedBefore: isoDate
    .optional()
    .describe('Exclude pages published after this date. Format: YYYY-MM-DD. Pages without a known date are kept.'),
});

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      publishedAt: z.string().optional(),
    }),
  ),
});

/**
 * The text Keenable returns for a result, with whitespace collapsed.
 *
 * `snippet` holds the page text and `description` is usually empty, so the
 * fallback is picked on emptiness. Snippets keep the page's line breaks.
 */
function snippetText(result: KeenableSearchResultItem): string {
  return (result.snippet || result.description || '').split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Creates a tool that searches the web using the Keenable Search API.
 *
 * Returns ranked web results with titles, URLs, page text snippets, and
 * publication dates when known. Works without an API key.
 *
 * @see https://docs.keenable.ai/api-reference
 */
export function createKeenableSearchTool(config?: KeenableClientOptions) {
  return createTool({
    id: 'keenable-search',
    description:
      'Search the web using the Keenable Search API. Returns ranked results with titles, URLs, page text snippets, and publication dates when known. Supports restricting results to one site and filtering by publication date.',
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const response = await keenableSearchRequest(
        {
          query: input.query,
          max_results: input.maxResults,
          site: input.site,
          published_after: input.publishedAfter,
          published_before: input.publishedBefore,
          snippet_max_length: SNIPPET_MAX_LENGTH,
        },
        config,
        { signal: context?.abortSignal },
      );

      return {
        query: input.query,
        results: response.results
          .filter(r => r.url)
          .map(r => ({
            title: r.title ?? '',
            url: r.url,
            snippet: snippetText(r),
            publishedAt: toIsoDate(r.published_at),
          })),
      };
    },
  });
}
