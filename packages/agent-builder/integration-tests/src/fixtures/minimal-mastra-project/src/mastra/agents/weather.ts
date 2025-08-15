import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { z } from 'zod';
import { weatherTool } from '../tools/weather';

const client = new MCPClient({
  id: 'weather-server',
  servers: {
    weather: {
      url: new URL(`http://localhost:4199/api/mcp/myMcpServer/mcp`),
    },
  },
});

export const weatherAgent = new Agent({
  name: 'test',
  instructions:
    'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. When asked for clipboard contents you also get that.',
  model: openai('gpt-4o'),
  tools: async () => {
    const tools = await client.getTools();
    return {
      get_weather: weatherTool,
      clipboard: createTool({
        id: 'clipboard',
        description: 'Returns the contents of the users clipboard',
        inputSchema: z.object({}),
      }),
      ...tools,
    };
  },
});
