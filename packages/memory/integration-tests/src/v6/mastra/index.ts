import { chatRoute } from '@mastra/ai-sdk';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { createMemoryProcessorAgent, createProgressAgent, createWeatherAgent } from './agents/weather';

const dbPath = process.env.MEMORY_TEST_DB_PATH ?? 'mastra.db';

export const mastra = new Mastra({
  agents: {
    test: createWeatherAgent({ dbPath }),
    testProcessor: createMemoryProcessorAgent({ dbPath }),
    progress: createProgressAgent({ dbPath }),
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: `file:${dbPath}`,
  }),
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat',
        agent: 'test',
      }),
      chatRoute({
        path: '/chat/progress',
        agent: 'progress',
      }),
    ],
  },
});
