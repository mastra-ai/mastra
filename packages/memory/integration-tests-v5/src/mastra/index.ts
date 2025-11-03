import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';
import { LibSQLStore } from '@mastra/libsql';
import { memoryProcessorAgent, weatherAgent } from './agents/weather';

export const mastra = new Mastra({
  agents: {
    test: weatherAgent,
    testProcessor: memoryProcessorAgent,
  },
  storage: new LibSQLStore({
    url: 'file:mastra.db',
  }),
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat',
        agent: 'test',
      }),
    ],
  },
});
