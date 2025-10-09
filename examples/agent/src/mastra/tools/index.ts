import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  execute: async ({ context }, options) => {
    console.log('My cooking tool is running!', context.ingredient);
    if (options?.toolCallId) {
      console.log('Cooking tool call ID:', options.toolCallId);
    }
    return 'My tool result';
  },
});

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      city: context.city,
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    };
  },
});
