import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getSofyaClient } from './client.js';
import type { SofyaClient, SofyaClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().describe('The URL to extract information from'),
  prompt: z.string().describe('What information to extract, for example "list all pricing tiers and their prices"'),
});

const outputSchema = z.object({
  url: z.string(),
  content: z.string(),
  creditsUsed: z.number(),
  creditsRemaining: z.number(),
});

export function createSofyaExtractTool(config?: SofyaClientOptions) {
  let client: SofyaClient | null = null;

  function getClient(): SofyaClient {
    if (!client) {
      client = getSofyaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'sofya-extract',
    description:
      'Extract specific information from a URL using Sofya. Fetches the page and uses AI to pull out exactly what the prompt asks for, such as pricing tables, contact details, or specifications. Returns the extracted content as text.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().extract({
        url: input.url,
        prompt: input.prompt,
      });

      return {
        url: response.url,
        content: response.content,
        creditsUsed: response.credits_used,
        creditsRemaining: response.credits_remaining,
      };
    },
  });
}
