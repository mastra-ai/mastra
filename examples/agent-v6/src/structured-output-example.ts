import z from 'zod';
import { weatherAgent } from './mastra/agents';

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
