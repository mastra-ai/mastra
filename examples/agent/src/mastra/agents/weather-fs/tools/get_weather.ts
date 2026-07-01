import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * File-based tool: the default export is registered on the agent with the tool
 * key `get_weather` (the filename). No manual wiring needed.
 */
export default createTool({
  id: 'get-weather',
  description: 'Fetches the current weather for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  outputSchema: z.object({
    city: z.string(),
    conditions: z.string(),
    temperatureCelsius: z.number(),
  }),
  execute: async ({ city }) => {
    // Stubbed response — swap in a real API for production use.
    return {
      city,
      conditions: 'sunny',
      temperatureCelsius: 21,
    };
  },
});
