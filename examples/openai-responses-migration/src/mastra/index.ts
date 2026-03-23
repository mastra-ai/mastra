import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { supportAgent, toolAgent } from './agents';

const storage = new LibSQLStore({
  id: 'openai-responses-migration-storage',
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  storage,
  agents: {
    supportAgent,
    toolAgent,
  },
  server: {
    build: {
      swaggerUI: true,
      openAPIDocs: true,
    }
  }
});
