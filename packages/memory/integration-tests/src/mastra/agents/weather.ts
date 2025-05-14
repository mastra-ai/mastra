import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { weatherTool } from '../tools/weather';

export const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      use: 'tool-call',
    },
    lastMessages: 10,
    threads: {
      generateTitle: false,
    },
    semanticRecall: true,
  },
  storage: new LibSQLStore({
    url: 'file:mastra.db', // relative path from bundled .mastra/output dir
  }),
  vector: new LibSQLVector({
    connectionUrl: 'file:mastra.db', // relative path from bundled .mastra/output dir
  }),
  embedder: openai.embedding('text-embedding-3-small'),
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
