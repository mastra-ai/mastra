import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather information for'),
  }),
  execute: async ({ city }) => {
    return {
      city,
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    };
  },
});

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  execute: async (inputData, context) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('My cooking tool is running!', inputData.ingredient);
    if (context?.agent?.toolCallId) {
      console.log('Cooking tool call ID:', context.agent.toolCallId);
    }
    return 'My tool result';
  },
});
