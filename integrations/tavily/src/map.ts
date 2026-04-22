import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getTavilyClient } from './client.js';
import type { TavilyClient, TavilyClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().describe('The root URL to begin mapping'),
  maxDepth: z.number().optional().describe('Max depth of the mapping from the base URL'),
  maxBreadth: z.number().optional().describe('Max number of links to follow per page'),
  limit: z.number().optional().describe('Total number of links the mapper will process before stopping'),
  instructions: z.string().optional().describe('Natural language instructions for the mapper'),
  selectPaths: z.array(z.string()).optional().describe('Regex patterns to select specific URL paths'),
  selectDomains: z.array(z.string()).optional().describe('Regex patterns to restrict to specific domains'),
  excludePaths: z.array(z.string()).optional().describe('Regex patterns to exclude specific URL paths'),
  excludeDomains: z.array(z.string()).optional().describe('Regex patterns to exclude specific domains'),
  allowExternal: z.boolean().optional().describe('Whether to include external domain links'),
});

const outputSchema = z.object({
  baseUrl: z.string(),
  results: z.array(z.string()).describe('Discovered URLs'),
  responseTime: z.number(),
});

export function createTavilyMapTool(config?: TavilyClientOptions) {
  let client: TavilyClient | null = null;

  function getClient(): TavilyClient {
    if (!client) {
      client = getTavilyClient(config);
    }
    return client;
  }

  return createTool({
    id: 'tavily-map',
    description:
      "Map a website's structure starting from a URL using Tavily. Discovers and returns a list of URLs found on the site without extracting page content. Useful for understanding site structure before targeted extraction.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const tavilyClient = getClient();

      const response = await tavilyClient.map(input.url, {
        maxDepth: input.maxDepth,
        maxBreadth: input.maxBreadth,
        limit: input.limit,
        instructions: input.instructions,
        selectPaths: input.selectPaths,
        selectDomains: input.selectDomains,
        excludePaths: input.excludePaths,
        excludeDomains: input.excludeDomains,
        allowExternal: input.allowExternal,
      });

      return {
        baseUrl: response.baseUrl,
        results: response.results || [],
        responseTime: response.responseTime,
      };
    },
  });
}
