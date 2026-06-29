import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioInstagramSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-instagram-search',
    description: 'Search Instagram users by keyword via Scavio.',
    inputSchema: z.object({
      keyword: z.string().describe('Search keyword'),
    }),
    outputSchema,
    execute: async input => getClient().instagram.searchUsers(input),
  });
}

export function createScavioInstagramProfileTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-instagram-profile',
    description: 'Fetch an Instagram profile by username via Scavio.',
    inputSchema: z.object({
      username: z.string().optional().describe('Instagram username'),
      user_id: z.string().optional().describe('Instagram user id'),
    }),
    outputSchema,
    execute: async input => getClient().instagram.profile(input),
  });
}
