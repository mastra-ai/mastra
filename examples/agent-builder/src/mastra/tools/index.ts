import { createTool } from '@mastra/core/tools';
import { tool } from 'ai';
import { z } from 'zod';

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  inputSchema: z.object({
    city: z.string(),
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

// Create a tool using AI SDK's tool() helper
export const weatherTool = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  outputSchema: z.object({
    city: z.string(),
    weather: z.string(),
    temperature: z.number(),
    unit: z.string(),
  }),
  execute: async ({ city }) => {
    // Simulated weather data
    return {
      city,
      weather: 'sunny',
      temperature: 72,
      unit: 'fahrenheit',
    };
  },
});
