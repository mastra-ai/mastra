import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get the weather for a given location',
  inputSchema: z.object({
    postalCode: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ context: { postalCode } }) => {
    return `The weather in ${postalCode} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
  },
});
