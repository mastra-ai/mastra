import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { weatherTool } from '../tools/weather';

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      use: 'tool-call',
    },
  },
});

export const weatherAgent = new Agent({
  name: 'test',
  instructions: 'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code.',
  model: openai('gpt-4'),
  memory,
  tools: { get_weather: weatherTool },
});
    