import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getTavilyClient } from './client.js';
import type { TavilyClient, TavilyClientOptions } from './client.js';

const inputSchema = z.object({
  urls: z.array(z.string()).min(1).max(20).describe('URLs to extract content from (1-20)'),
  extractDepth: z
    .enum(['basic', 'advanced'])
    .optional()
    .describe("Extraction depth — 'advanced' retrieves more data including tables and embedded content"),
  query: z.string().optional().describe('User intent for reranking extracted content chunks. When provided, chunks are reranked based on relevance to this query.'),
  includeImages: z.boolean().optional().describe('Include images extracted from the pages'),
  format: z
    .enum(['markdown', 'text'])
    .optional()
    .describe("Output format for extracted content — 'markdown' (default) or 'text'"),
});

const outputSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      rawContent: z.string(),
      images: z.array(z.string()).optional(),
    }),
  ),
  failedResults: z.array(
    z.object({
      url: z.string(),
      error: z.string(),
    }),
  ),
  responseTime: z.number(),
});

export function createTavilyExtractTool(config?: TavilyClientOptions) {
  let client: TavilyClient | null = null;

  function getClient(): TavilyClient {
    if (!client) {
      client = getTavilyClient(config);
    }
    return client;
  }

  return createTool({
    id: 'tavily-extract',
    description:
      'Extract content from one or more URLs using Tavily. Returns raw page content in markdown or text format. Supports up to 20 URLs per request with basic or advanced extraction depth.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const tavilyClient = getClient();

      const response = await tavilyClient.extract(input.urls, {
        extractDepth: input.extractDepth,
        query: input.query,
        includeImages: input.includeImages,
        format: input.format,
      });

      return {
        results: ((response.results || []) as any[]).map(r => ({
          url: r.url,
          rawContent: r.rawContent,
          images: r.images || undefined,
        })),
        failedResults: ((response.failedResults || []) as any[]).map(r => ({
          url: r.url,
          error: r.error,
        })),
        responseTime: response.responseTime,
      };
    },
  });
}
