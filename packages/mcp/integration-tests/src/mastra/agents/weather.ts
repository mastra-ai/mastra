import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { weatherTool } from '../tools/weather';

export const weatherAgent = new Agent({
  name: 'test',
  instructions:
    'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. When asked for clipboard contents you also get that.',
  model: openai('gpt-4o'),
  tools: {
    get_weather: weatherTool,
    clipboard: createTool({
      id: 'clipboard',
      description: 'Returns the contents of the users clipboard',
      inputSchema: z.object({}),
    }),
  },
});
