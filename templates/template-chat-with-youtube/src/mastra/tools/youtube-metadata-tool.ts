import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractVideoId, formatTimestamp } from './youtube-utils';

export const youtubeMetadataTool = createTool({
  id: 'fetch-youtube-metadata',
  description:
    'Fetches metadata (title, author/channel, description, duration) for a YouTube video. Use this to understand the video context before or instead of fetching the full transcript.',
  inputSchema: z.object({
    url: z.string().describe('YouTube video URL or video ID'),
  }),
  outputSchema: z.object({
    success: z.boolean().describe('Whether the metadata fetch was successful'),
    videoId: z.string().optional().describe('The 11-character YouTube video ID'),
    title: z.string().optional().describe('The video title'),
    author: z.string().optional().describe('The channel/author name'),
    description: z.string().optional().describe('The video description'),
    durationSeconds: z.number().optional().describe('Video duration in seconds'),
    durationFormatted: z.string().optional().describe('Video duration in MM:SS or HH:MM:SS format'),
    error: z.string().optional().describe('Error message if the fetch failed'),
  }),
  execute: async ({ url }) => {
    const videoId = extractVideoId(url);

    if (!videoId) {
      return {
        success: false,
        error: 'Invalid YouTube URL or video ID.',
      };
    }

    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          videoId,
          error: 'Could not fetch video page. The video may be private or unavailable.',
        };
      }

      const html = await response.text();

      // Extract ytInitialPlayerResponse which contains video details
      const playerMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/s);

      if (!playerMatch) {
        return {
          success: false,
          videoId,
          error: 'Could not parse video metadata from page.',
        };
      }

      const playerData = JSON.parse(playerMatch[1]);
      const videoDetails = playerData?.videoDetails;

      if (!videoDetails) {
        return {
          success: false,
          videoId,
          error: 'Video details not found. The video may be unavailable.',
        };
      }

      const durationSeconds = parseInt(videoDetails.lengthSeconds, 10) || 0;

      return {
        success: true,
        videoId,
        title: videoDetails.title || '',
        author: videoDetails.author || '',
        description: videoDetails.shortDescription || '',
        durationSeconds,
        durationFormatted: formatTimestamp(durationSeconds),
      };
    } catch (error) {
      return {
        success: false,
        videoId,
        error: `Failed to fetch metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
