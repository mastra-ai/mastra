import { chatRoute } from '@mastra/ai-sdk';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { memoryProcessorAgent, progressAgent, weatherAgent } from './agents/weather';

export const mastra = new Mastra({
  agents: {
    test: weatherAgent,
    testProcessor: memoryProcessorAgent,
    progress: progressAgent,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:mastra.db',
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
