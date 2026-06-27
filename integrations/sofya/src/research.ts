import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getSofyaClient } from './client.js';
import type { SofyaClient, SofyaClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The research question or topic'),
  topic: z.enum(['general', 'news']).optional().describe("Research topic. 'general' for web search, 'news' for news articles"),
  freshness: z
    .string()
    .optional()
    .describe("Filter sources by recency. One of 'day', 'week', 'month', 'year', or a 'YYYY-MM-DD' date"),
  maxSources: z.number().min(1).max(30).optional().describe('Maximum number of sources to use (1-30)'),
});

const outputSchema = z.object({
  query: z.string(),
  report: z.string(),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      fetched: z.boolean().optional(),
    }),
  ),
  subQueries: z.array(z.string()).optional(),
  creditsUsed: z.number(),
  creditsRemaining: z.number(),
});

export function createSofyaResearchTool(config?: SofyaClientOptions) {
  let client: SofyaClient | null = null;

  function getClient(): SofyaClient {
    if (!client) {
      client = getSofyaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'sofya-research',
    description:
      'Run deep research on a question using Sofya. Breaks the question into sub-queries, searches multiple sources, and synthesizes a cited report. Returns the report text along with the list of sources used.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().research({
        query: input.query,
        topic: input.topic,
        freshness: input.freshness,
        maxSources: input.maxSources,
      });

      return {
        query: response.query,
        report: response.report,
        sources: (response.sources ?? []).map(s => ({
          title: s.title,
          url: s.url,
          fetched: s.fetched,
        })),
        subQueries: response.sub_queries || undefined,
        creditsUsed: response.credits_used,
        creditsRemaining: response.credits_remaining,
      };
    },
  });
}
