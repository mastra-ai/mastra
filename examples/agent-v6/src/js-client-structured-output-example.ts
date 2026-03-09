import z from 'zod';
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

const agent = client.getAgent('weather-agent');

const result = await agent.generate('weather in new york', {
  structuredOutput: {
    schema: z.object({
      weather: z.string(),
      temperature: z.number(),
      humidity: z.number(),
    }),
  },
});

console.log(result.object);
