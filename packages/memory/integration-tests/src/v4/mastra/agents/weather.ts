import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { ToolCallFilter } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { weatherTool } from '../tools/weather';

const defaultDbPath = process.env.MEMORY_TEST_DB_PATH ?? 'mastra.db';

export function createWeatherMemory({
  dbPath = defaultDbPath,
  semanticRecall = true,
  workingMemory = true,
}: {
  dbPath?: string;
  semanticRecall?: boolean;
  workingMemory?: boolean;
} = {}) {
  const dbFile = `file:${dbPath}`;

  return new Memory({
    options: {
      ...(workingMemory
        ? {
            workingMemory: {
              enabled: true,
            },
          }
        : {}),
      lastMessages: 10,
      semanticRecall,
    },
    storage: new LibSQLStore({
      id: 'weather-storage',
      url: dbFile,
    }),
    vector: new LibSQLVector({
      url: dbFile,
      id: 'weather-vector',
    }),
    embedder: openai.embedding('text-embedding-3-small'),
  });
}

export function createWeatherAgent({
  memory,
  dbPath = defaultDbPath,
  semanticRecall = true,
  workingMemory = true,
}: {
  memory?: MastraMemory;
  dbPath?: string;
  semanticRecall?: boolean;
  workingMemory?: boolean;
} = {}) {
  return new Agent({
    id: 'weather-agent',
    name: 'test',
    instructions:
      'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. When asked for clipboard contents use the clipboard tool to get the clipboard contents.',
    model: openai('gpt-4o'),
    memory: memory ?? createWeatherMemory({ dbPath, semanticRecall, workingMemory }),
    tools: {
      get_weather: weatherTool,
      clipboard: createTool({
        id: 'clipboard',
        description: 'Returns the contents of the users clipboard',
        inputSchema: z.object({}),
      }),
    },
  });
}

function createMemoryWithProcessor({ dbPath = defaultDbPath }: { dbPath?: string } = {}) {
  const dbFile = `file:${dbPath}`;

  return new Memory({
    embedder: openai.embedding('text-embedding-3-small'),
    storage: new LibSQLStore({
      id: 'processor-storage',
      url: dbFile,
    }),
    vector: new LibSQLVector({
      url: dbFile,
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
  });
}

export function createMemoryProcessorAgent({ dbPath = defaultDbPath }: { dbPath?: string } = {}) {
  return new Agent({
    id: 'test-processor',
    name: 'test-processor',
    instructions: 'You are a test agent that uses a memory processor to filter out tool call messages.',
    model: openai('gpt-4o'),
    memory: createMemoryWithProcessor({ dbPath }),
    inputProcessors: [new ToolCallFilter()],
    tools: {
      get_weather: weatherTool,
    },
  });
}
