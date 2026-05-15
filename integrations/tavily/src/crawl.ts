import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getTavilyClient } from './client.js';
import type { TavilyClient, TavilyClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().describe('The root URL to begin the crawl'),
  maxDepth: z.number().optional().describe('Max depth of the crawl from the base URL'),
  maxBreadth: z.number().optional().describe('Max number of links to follow per page'),
  limit: z.number().optional().describe('Total number of pages the crawler will process before stopping'),
  instructions: z.string().optional().describe('Natural language instructions for the crawler'),
  selectPaths: z.array(z.string()).optional().describe('Regex patterns to select specific URL paths'),
  selectDomains: z.array(z.string()).optional().describe('Regex patterns to restrict to specific domains'),
  excludePaths: z.array(z.string()).optional().describe('Regex patterns to exclude specific URL paths'),
  excludeDomains: z.array(z.string()).optional().describe('Regex patterns to exclude specific domains'),
  allowExternal: z.boolean().optional().describe('Whether to follow links to external domains'),
  extractDepth: z
    .enum(['basic', 'advanced'])
    .optional()
    .describe("Extraction depth — 'advanced' retrieves more data including tables and embedded content"),
  includeImages: z.boolean().optional().describe('Include images from crawled pages'),
  format: z
    .enum(['markdown', 'text'])
    .optional()
    .describe("Output format for extracted content — 'markdown' (default) or 'text'"),
});

const outputSchema = z.object({
  baseUrl: z.string(),
  results: z.array(
    z.object({
      url: z.string(),
      rawContent: z.string(),
      images: z.array(z.string()).optional(),
    }),
  ),
  responseTime: z.number(),
});

export function createTavilyCrawlTool(config?: TavilyClientOptions) {
  let client: TavilyClient | null = null;

  function getClient(): TavilyClient {
    if (!client) {
      client = getTavilyClient(config);
    }
    return client;
  }

  return createTool({
    id: 'tavily-crawl',
    description:
      'Crawl a website starting from a URL using Tavily. Extracts content from discovered pages with configurable depth, breadth, and domain constraints. Returns structured content from each crawled page.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const tavilyClient = getClient();

      const response = await tavilyClient.crawl(input.url, {
        maxDepth: input.maxDepth,
        maxBreadth: input.maxBreadth,
        limit: input.limit,
        instructions: input.instructions,
        selectPaths: input.selectPaths,
        selectDomains: input.selectDomains,
        excludePaths: input.excludePaths,
        excludeDomains: input.excludeDomains,
        allowExternal: input.allowExternal,
        extractDepth: input.extractDepth,
        includeImages: input.includeImages,
        format: input.format,
      });

      return {
        baseUrl: response.baseUrl,
        results: ((response.results || []) as any[]).map(r => ({
          url: r.url,
          rawContent: r.rawContent,
          images: r.images || undefined,
        })),
        responseTime: response.responseTime,
      };
    },
  });
}
