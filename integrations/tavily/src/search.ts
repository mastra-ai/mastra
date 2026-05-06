import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getTavilyClient } from './client.js';
import type { TavilyClient, TavilyClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  searchDepth: z
    .enum(['basic', 'advanced', 'fast', 'ultra-fast'])
    .optional()
    .describe("Search depth — 'basic' for standard, 'advanced' for thorough, 'fast'/'ultra-fast' for low latency"),
  maxResults: z.number().min(1).max(20).optional().describe('Maximum number of results to return (1-20)'),
  includeAnswer: z
    .union([z.boolean(), z.enum(['basic', 'advanced'])])
    .optional()
    .describe('Include an AI-generated answer summary. Pass true, "basic", or "advanced"'),
  includeImages: z.boolean().optional().describe('Include query-related images in the response'),
  includeImageDescriptions: z.boolean().optional().describe('Include descriptions for returned images'),
  includeRawContent: z
    .union([z.literal(false), z.enum(['markdown', 'text'])])
    .optional()
    .describe('Include cleaned HTML content of each result. Pass false to disable, or "markdown"/"text" for format'),
  includeDomains: z.array(z.string()).optional().describe('Restrict results to these domains'),
  excludeDomains: z.array(z.string()).optional().describe('Exclude results from these domains'),
  timeRange: z
    .enum(['day', 'week', 'month', 'year'])
    .optional()
    .describe('Time range to filter results by recency'),
});

const outputSchema = z.object({
  query: z.string(),
  answer: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number(),
      rawContent: z.string().optional(),
    }),
  ),
  responseTime: z.number(),
});

export function createTavilySearchTool(config?: TavilyClientOptions) {
  let client: TavilyClient | null = null;

  function getClient(): TavilyClient {
    if (!client) {
      client = getTavilyClient(config);
    }
    return client;
  }

  return createTool({
    id: 'tavily-search',
    description:
      'Search the web using Tavily. Returns relevant results with content snippets, optional AI-generated answers, and images. Supports filtering by domain, time range, and search depth.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const tavilyClient = getClient();

      const response = await tavilyClient.search(input.query, {
        searchDepth: input.searchDepth,
        maxResults: input.maxResults,
        includeAnswer: input.includeAnswer,
        includeImages: input.includeImages,
        includeImageDescriptions: input.includeImageDescriptions,
        includeRawContent: input.includeRawContent,
        includeDomains: input.includeDomains,
        excludeDomains: input.excludeDomains,
        timeRange: input.timeRange,
      });

      return {
        query: response.query,
        answer: response.answer || undefined,
        images: response.images?.map((img: any) => ({
          url: typeof img === 'string' ? img : img.url,
          description: typeof img === 'string' ? undefined : img.description,
        })),
        results: (response.results ?? []).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score ?? 0,
          rawContent: r.rawContent || undefined,
        })),
        responseTime: response.responseTime,
      };
    },
  });
}
