import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioGoogleSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-google-search',
    description:
      'Search Google in real time via Scavio. Returns organic results, knowledge graph, related questions, news, and more as structured JSON.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      country_code: z.string().optional().describe('Two-letter country code, e.g. "us"'),
      language: z.string().optional().describe('Two-letter language code, e.g. "en"'),
      page: z.number().optional().describe('Result page number (1-based)'),
      search_type: z
        .enum(['classic', 'news', 'maps', 'images', 'lens'])
        .optional()
        .describe('The Google vertical to search'),
      light_request: z
        .boolean()
        .optional()
        .describe('Use the cheaper, lighter response (1 credit instead of 2)'),
    }),
    outputSchema,
    execute: async input => getClient().google.search(input),
  });
}
