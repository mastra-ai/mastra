import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * File-based tool for the `forecaster` subagent. Discovered the same way as a
 * top-level agent's tools — keyed by filename -> `get_forecast`.
 */
export default createTool({
  id: 'get-forecast',
  description: 'Fetches a multi-day weather forecast for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to forecast'),
    days: z.number().int().min(1).max(7).default(3).describe('Number of days'),
  }),
  outputSchema: z.object({
    city: z.string(),
    days: z.array(
      z.object({
        day: z.number(),
        conditions: z.string(),
        highCelsius: z.number(),
        lowCelsius: z.number(),
      }),
    ),
  }),
  execute: async ({ city, days }) => {
    // Stubbed response — swap in a real API for production use.
    const conditions = ['sunny', 'partly cloudy', 'rain', 'clear'];
    return {
      city,
      days: Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        conditions: conditions[i % conditions.length]!,
        highCelsius: 22 - i,
        lowCelsius: 14 - i,
      })),
    };
  },
});
