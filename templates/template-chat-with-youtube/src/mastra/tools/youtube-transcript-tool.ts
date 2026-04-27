import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { YoutubeTranscript } from 'youtube-transcript-scraper';
import { extractVideoId, formatTimestamp } from './youtube-utils';

export const youtubeTranscriptTool = createTool({
  id: 'fetch-youtube-transcript',
  description:
    'Fetches the transcript/captions from a YouTube video. Each line includes a timestamp. Use fetch-youtube-metadata first to get the video title and context.',
  inputSchema: z.object({
    url: z.string().describe('YouTube video URL or video ID'),
  }),
  outputSchema: z.object({
    success: z.boolean().describe('Whether the transcript fetch was successful'),
    videoId: z.string().optional().describe('The 11-character YouTube video ID'),
    transcript: z.string().optional().describe('The full transcript with timestamps in [MM:SS] format'),
    segmentCount: z.number().optional().describe('Number of transcript segments/captions'),
    durationFormatted: z.string().optional().describe('Estimated video duration in MM:SS or HH:MM:SS format'),
    error: z.string().optional().describe('Error message if the fetch failed'),
  }),
  execute: async ({ url }) => {
    const videoId = extractVideoId(url);

    if (!videoId) {
      return {
        success: false,
        error:
          'Invalid YouTube URL or video ID. Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID) or an 11-character video ID.',
      };
    }

    try {
      const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const transcriptSegments = await YoutubeTranscript.fetchTranscript(fullUrl);

      if (!transcriptSegments || transcriptSegments.length === 0) {
        return {
          success: false,
          videoId,
          error: 'No transcript available for this video. The video may not have captions enabled.',
        };
      }

      // Combine segments with timestamps for attribution
      const transcript = transcriptSegments
        .map(segment => `[${formatTimestamp(segment.start)}] ${segment.text}`)
        .join('\n');

      // Calculate video duration from last segment
      const lastSegment = transcriptSegments[transcriptSegments.length - 1];
      const totalDuration = lastSegment.start + lastSegment.duration;
      const durationFormatted = formatTimestamp(totalDuration);

      return {
        success: true,
        videoId,
        transcript,
        segmentCount: transcriptSegments.length,
        durationFormatted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('Could not find captions')) {
        return {
          success: false,
          videoId,
          error: 'No captions/transcript available for this video.',
        };
      }

      if (errorMessage.includes('Video unavailable')) {
        return {
          success: false,
          videoId,
          error: 'Video is unavailable. It may be private, deleted, or region-restricted.',
        };
      }

      return {
        success: false,
        videoId,
        error: `Failed to fetch transcript: ${errorMessage}`,
      };
    }
  },
});
