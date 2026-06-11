import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherInfo = createTool({
  id: 'weatherInfo',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async input => {
    return await getWeather(input.location);
  },
});

const getWeather = async (location: string) => {
  return {
    temperature: 19,
    feelsLike: 18,
    humidity: 50,
    windSpeed: 10,
    windGust: 14,
    conditions: 'Clear sky',
    location,
  };
};

export const simpleMcpTool = createTool({
  id: 'simpleMcpTool',
  description: 'A simple MCP tool',
  inputSchema: z.object({
    name: z.string().describe('The name of the person'),
  }),
  execute: async () => {
    return {
      hello: 'world',
      thisIsA: 'fixture',
    };
  },
});
