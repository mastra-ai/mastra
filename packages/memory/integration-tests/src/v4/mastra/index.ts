import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { createMemoryProcessorAgent, createWeatherAgent } from './agents/weather';

const dbPath = process.env.MEMORY_TEST_DB_PATH ?? 'mastra.db';

export const mastra = new Mastra({
  agents: {
    test: createWeatherAgent({ dbPath }),
    testProcessor: createMemoryProcessorAgent({ dbPath }),
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: `file:${dbPath}`,
  }),
});
