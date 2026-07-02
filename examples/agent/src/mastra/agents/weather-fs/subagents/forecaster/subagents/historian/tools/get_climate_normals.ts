import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * File-based tool for the nested `historian` subagent — discovered exactly the
 * same way as at any other depth, keyed by filename -> `get_climate_normals`.
 */
export default createTool({
  id: 'get-climate-normals',
  description: 'Fetches historical climate normals for a city and month',
  inputSchema: z.object({
    city: z.string().describe('The city to look up'),
    month: z.number().int().min(1).max(12).describe('Month as a number, 1-12'),
  }),
  outputSchema: z.object({
    city: z.string(),
    month: z.number(),
    avgHighCelsius: z.number(),
    avgLowCelsius: z.number(),
    rainyDays: z.number(),
  }),
  execute: async ({ city, month }) => {
    // Stubbed response — swap in a real climate API for production use.
    const seasonal = Math.round(10 * Math.sin(((month - 1) / 12) * 2 * Math.PI - Math.PI / 2) + 15);
    return {
      city,
      month,
      avgHighCelsius: seasonal + 6,
      avgLowCelsius: seasonal - 4,
      rainyDays: ((month * 3) % 10) + 4,
    };
  },
});
