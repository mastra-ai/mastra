import { createTool } from '@mastra/core/tools';
import type Ceramic from 'ceramic-ai';
import { z } from 'zod';

import { createLazyCeramicClient } from './client.js';
import type { CeramicClientOptions } from './client.js';

const MAX_QUERY_WORDS = 50;

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, { message: 'query must contain at least one word.' })
    .refine(value => countWords(value) <= MAX_QUERY_WORDS, {
      message: `query must contain at most ${MAX_QUERY_WORDS} words.`,
    })
    .refine(value => !value.includes('/'), {
      message: 'query cannot contain slashes. Search for the words in a URL or path instead.',
    })
    .refine(value => !/\d,\d/.test(value), {
      message: 'query cannot contain numbers with commas. Write 101342 instead of 101,342.',
    })
    .refine(value => !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(value), {
      message: 'query cannot contain non-Latin characters.',
    })
    .describe(
      'Keyword search query (1-50 words). Ceramic matches the exact words in your query, so use specific terms likely to appear in the target pages, such as names, identifiers, and technical terms, instead of a conversational question. Supports site:domain, OR with parentheses, and "exact phrase" operators.',
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Number of results to return (1-20). Defaults to 10.'),
  maxDescriptionLength: z
    .number()
    .int()
    .min(1000)
    .max(8000)
    .optional()
    .describe(
      'Maximum characters per result description (1000-8000). Defaults to 3000. Lower it to save context, or raise it for deeper reading.',
    ),
});

const outputSchema = z.object({
  requestId: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    }),
  ),
  totalResults: z.number(),
  executionTime: z.number().describe('Search execution time in seconds.'),
});

type SearchInput = z.infer<typeof inputSchema>;

function toSearchParams(input: SearchInput): Ceramic.SearchParams {
  // The API rejects unknown properties, so only send fields that were set.
  const params: Ceramic.SearchParams = { query: input.query };

  if (input.maxResults !== undefined) params.maxResults = input.maxResults;
  if (input.maxDescriptionLength !== undefined) params.maxDescriptionLength = input.maxDescriptionLength;

  return params;
}

/**
 * Creates a tool that searches the web using the Ceramic Search API.
 *
 * Ceramic is a fast lexical search engine: it matches query keywords rather than
 * inferring intent, so the tool description steers agents toward keyword queries.
 *
 * @see https://docs.ceramic.ai/api/search/quickstart
 */
export function createCeramicSearchTool(config?: CeramicClientOptions) {
  const getClient = createLazyCeramicClient(config);

  return createTool({
    id: 'ceramic-search',
    description:
      'Search the web with Ceramic, a fast keyword search engine. Returns ranked results with titles, URLs, and page content. Rewrite questions into specific keywords (for example "California rental laws" instead of "what are the rental laws in California?"). Searches are fast and cheap, so run several keyword variations and combine the results.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().search(toSearchParams(input));

      return {
        requestId: response.requestId,
        results: response.result.results.map(result => ({
          title: result.title,
          url: result.url,
          description: result.description,
        })),
        totalResults: response.result.totalResults,
        executionTime: response.result.searchMetadata.executionTime,
      };
    },
  });
}
