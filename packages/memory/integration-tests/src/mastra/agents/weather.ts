import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
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
  instructions:
    'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. When asked for clipboard contents you also get that.',
  model: openai('gpt-4o'),
  memory,
  tools: {
    get_weather: weatherTool,
    clipboard: createTool({
      id: 'clipboard',
      description: 'Returns the contents of the users clipboard',
      inputSchema: z.object({}),
    }),
  },
});
