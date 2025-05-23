import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { registerCopilotKit } from '@mastra/agui';
import { weatherAgent } from './agents';
import { myNetwork } from './network';

export const mastra = new Mastra({
  agents: { weatherAgent },
  networks: {
    myNetwork,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    cors: {
      origin: '*',
      allowMethods: ['*'],
      allowHeaders: ['*'],
    },
    apiRoutes: [
      registerCopilotKit({
        path: '/copilotkit',
        resourceId: 'weatherAgent',
      }),
    ],
  },
});
