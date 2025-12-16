import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ToolCallFilter } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { weatherTool } from '../tools/weather';

const cwd = process.cwd();
let dbPath = cwd.endsWith('.mastra/output') ? '../../mastra.db' : './mastra.db';

export const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
    },
    lastMessages: 10,
    semanticRecall: true,
  },
  storage: new LibSQLStore({
    id: 'weather-memory-storage',
    url: `file:${dbPath}`, // relative path from bundled .mastra/output dir
  }),
  vector: new LibSQLVector({
    id: 'weather-memory-vector',
    connectionUrl: 'file:mastra.db', // relative path from bundled .mastra/output dir
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
    id: 'processor-memory-storage',
    url: 'file:mastra.db',
  }),
  vector: new LibSQLVector({
    id: 'processor-memory-vector',
    connectionUrl: 'file:mastra.db',
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

export const memoryProcessorAgent = new Agent({
  id: 'test-processor',
  name: 'test-processor',
  instructions: 'You are a test agent that uses a memory processor to filter out tool call messages.',
  model: openai('gpt-4o'),
  memory: memoryWithProcessor,
  inputProcessors: [new ToolCallFilter()],
  tools: {
    get_weather: weatherTool,
  },
});

// Progress tool that emits data-* parts for testing issue #11091
export const progressTool = createTool({
  id: 'progress-task',
  description: 'Runs a task and reports progress updates. Use this when the user asks to run a task with progress.',
  inputSchema: z.object({
    taskName: z.string().describe('Name of the task to run'),
  }),
  execute: async (input, context) => {
    // Emit progress updates as data-* parts
    for (let i = 1; i <= 3; i++) {
      await context?.writer?.custom({
        type: 'data-progress',
        data: {
          taskName: input.taskName,
          step: i,
          progress: i * 33,
          status: i < 3 ? 'in-progress' : 'complete',
        },
      });
    }
    return { success: true, taskName: input.taskName, totalSteps: 3 };
  },
});

const progressMemory = new Memory({
  options: {
    lastMessages: 10,
  },
  storage: new LibSQLStore({
    id: 'progress-memory-storage',
    url: `file:${dbPath}`,
  }),
  embedder: openai.embedding('text-embedding-3-small'),
});

export const progressAgent = new Agent({
  id: 'progress-agent',
  name: 'progress-agent',
  instructions:
    'You are a task runner that can run tasks with progress updates. When asked to run a task, use the progress-task tool.',
  model: anthropic('claude-sonnet-4-20250514'),
  memory: progressMemory,
  tools: {
    'progress-task': progressTool,
  },
});
