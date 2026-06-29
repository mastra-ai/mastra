import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioRedditSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-reddit-search',
    description: 'Search Reddit posts, subreddits, or users via Scavio.',
    inputSchema: z.object({
      query: z.string().describe('The Reddit search query'),
      type: z.string().optional().describe('Search type, e.g. "posts", "subreddits", "users"'),
      sort: z.string().optional().describe('Sort order, e.g. "relevance", "new", "top"'),
    }),
    outputSchema,
    execute: async input => getClient().reddit.search(input),
  });
}

export function createScavioRedditPostTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-reddit-post',
    description: 'Fetch a Reddit post and its comment thread by URL via Scavio.',
    inputSchema: z.object({
      url: z.string().describe('Full URL of the Reddit post'),
    }),
    outputSchema,
    execute: async input => getClient().reddit.post(input),
  });
}
