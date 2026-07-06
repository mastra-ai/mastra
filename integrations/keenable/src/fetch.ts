import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getKeenableClient } from './client.js';
import type { KeenableClient, KeenableClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.url().describe('The URL of the page to fetch and extract as markdown'),
});

const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
});

export function createKeenableFetchTool(config?: KeenableClientOptions) {
  let client: KeenableClient | null = null;

  function getClient(): KeenableClient {
    if (!client) {
      client = getKeenableClient(config);
    }
    return client;
  }

  return createTool({
    id: 'keenable-fetch',
    description:
      'Fetch a web page via Keenable and return its main content as markdown, along with title, description, author, and publication date. Use this to read a page found via search. Keyless by default.',
    inputSchema,
    outputSchema,
    execute: async input => {
      return getClient().fetch(input.url);
    },
  });
}
