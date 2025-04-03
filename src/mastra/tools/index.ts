import { z } from 'zod';
import { createTool } from '@mastra/core/tools';

// Weather Tool
export const weatherTool = createTool({
  id: 'weatherTool',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name, e.g. "Tokyo, Japan"'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
    windSpeed: z.number(),
    forecast: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    // ダミーの天気データを返す
    return {
      location: context.location,
      temperature: 72,
      condition: 'Sunny',
      humidity: 65,
      windSpeed: 5,
      forecast: 'Clear skies for the next 24 hours.',
    };
  },
}); 