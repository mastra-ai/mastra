import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioTiktokSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-tiktok-search',
    description: 'Search TikTok videos by keyword via Scavio.',
    inputSchema: z.object({
      keyword: z.string().describe('Search keyword'),
      count: z.number().optional().describe('Number of videos to return'),
      sort_type: z.string().optional().describe('Sort order for results'),
    }),
    outputSchema,
    execute: async input => getClient().tiktok.searchVideos(input),
  });
}

export function createScavioTiktokProfileTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-tiktok-profile',
    description: 'Fetch a TikTok user profile by username via Scavio.',
    inputSchema: z.object({
      username: z.string().optional().describe('TikTok username (without @)'),
      sec_user_id: z.string().optional().describe('TikTok secUid'),
    }),
    outputSchema,
    execute: async input => getClient().tiktok.profile(input),
  });
}
