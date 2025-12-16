import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { weatherInfo } from './mastra/tools';
import z from 'zod';

const agent = new Agent({
  id: 'example-agent',
  name: 'Example Agent',
  instructions: 'You are a helpful assistant',
  model: openai('gpt-4o'),
  tools: {
    weatherInfo,
  },
});

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
