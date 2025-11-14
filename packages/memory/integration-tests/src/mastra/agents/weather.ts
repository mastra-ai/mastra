import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { ToolCallFilter } from '@mastra/memory/processors';
import { z } from 'zod';
import { weatherTool } from '../tools/weather';

export const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
    },
    lastMessages: 10,
    semanticRecall: true,
  },
  storage: new LibSQLStore({
    id: 'weather-storage',
    url: 'file:mastra.db', // relative path from bundled .mastra/output dir
  }),
  vector: new LibSQLVector({
    connectionUrl: 'file:mastra.db', // relative path from bundled .mastra/output dir
    id: 'weather-vector',
  }),
  embedder: openai.embedding('text-embedding-3-small'),
});

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'test',
  instructions:
    'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. When asked for clipboard contents use the clipboard tool to get the clipboard contents.',
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

const memoryWithProcessor = new Memory({
  embedder: openai.embedding('text-embedding-3-small'),
  storage: new LibSQLStore({
    id: 'processor-storage',
    url: 'file:mastra.db',
  }),
  vector: new LibSQLVector({
    connectionUrl: 'file:mastra.db',
    id: 'weather-vector',
  }),
  options: {
    semanticRecall: {
      topK: 20,
      messageRange: {
        before: 10,
        after: 10,
      },
    },
    lastMessages: 20,
    generateTitle: true,
  },
  processors: [new ToolCallFilter()],
});

export const memoryProcessorAgent = new Agent({
  id: 'test-processor',
  name: 'test-processor',
  instructions: 'You are a test agent that uses a memory processor to filter out tool call messages.',
  model: openai('gpt-4o'),
  memory: memoryWithProcessor,
  tools: {
    get_weather: weatherTool,
  },
});
