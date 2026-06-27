import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getSofyaClient } from './client.js';
import type { SofyaClient, SofyaClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  searchDepth: z
    .enum(['snippets', 'basic'])
    .optional()
    .describe("Search depth. 'snippets' is cheaper and returns short excerpts, 'basic' returns full page content"),
  maxResults: z.number().int().min(1).max(20).optional().describe('Maximum number of results to return (1-20)'),
  includeAnswer: z.boolean().optional().describe('Include an AI-synthesized answer generated from the results'),
  includeDomains: z.array(z.string()).max(10).optional().describe('Only include results from these domains (max 10)'),
  excludeDomains: z.array(z.string()).max(10).optional().describe('Exclude results from these domains (max 10)'),
  topic: z.enum(['general', 'news']).optional().describe("Search topic. 'general' for web search, 'news' for news articles"),
  freshness: z
    .string()
    .optional()
    .describe("Filter results by recency. One of 'day', 'week', 'month', 'year', or a 'YYYY-MM-DD' date"),
});

const outputSchema = z.object({
  query: z.string(),
  answer: z.string().optional(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      description: z.string().optional(),
      fetched: z.boolean().optional(),
      publishedDate: z.string().optional(),
    }),
  ),
  creditsUsed: z.number(),
  creditsRemaining: z.number(),
});

export function createSofyaSearchTool(config?: SofyaClientOptions) {
  let client: SofyaClient | null = null;

  function getClient(): SofyaClient {
    if (!client) {
      client = getSofyaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'sofya-search',
    description:
      'Search the web using Sofya. Returns relevant results with full page content rather than snippets, plus an optional AI-synthesized answer. Supports filtering by domain, topic, and recency.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().search({
        query: input.query,
        searchDepth: input.searchDepth,
        maxResults: input.maxResults,
        includeAnswer: input.includeAnswer,
        includeDomains: input.includeDomains,
        excludeDomains: input.excludeDomains,
        topic: input.topic,
        freshness: input.freshness,
      });

      return {
        query: response.query,
        answer: response.answer || undefined,
        results: (response.results ?? []).map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          description: r.description || undefined,
          fetched: r.fetched,
          publishedDate: r.published_date || undefined,
        })),
        creditsUsed: response.credits_used,
        creditsRemaining: response.credits_remaining,
      };
    },
  });
}
