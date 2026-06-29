import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioYoutubeSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-youtube-search',
    description: 'Search YouTube for videos, channels, or playlists via Scavio.',
    inputSchema: z.object({
      query: z.string().describe('The video search query'),
      upload_date: z.string().optional().describe('Upload date filter, e.g. "today", "week", "month"'),
      type: z.string().optional().describe('Result type, e.g. "video", "channel", "playlist"'),
      sort_by: z.string().optional().describe('Sort order for results'),
    }),
    outputSchema,
    execute: async input => getClient().youtube.search(input),
  });
}

export function createScavioYoutubeMetadataTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-youtube-metadata',
    description: 'Fetch metadata for a YouTube video by id via Scavio.',
    inputSchema: z.object({
      video_id: z.string().describe('YouTube video id'),
    }),
    outputSchema,
    execute: async input => getClient().youtube.metadata(input),
  });
}
