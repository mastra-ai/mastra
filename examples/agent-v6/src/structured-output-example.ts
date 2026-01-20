import z from 'zod';
import { mastra } from './mastra/index';
// import { weatherAgent } from './mastra/agents';

const weatherAgent = mastra.getAgent('weatherAgent');

const result = await weatherAgent.generate('weather in new york', {
  structuredOutput: {
    schema: z.object({
      weather: z.string(),
      temperature: z.number(),
      humidity: z.number(),
    }),
  },
});

console.log(result.object);
