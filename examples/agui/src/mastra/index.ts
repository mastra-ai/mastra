import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { getAGUI } from '@mastra/agui';
import { weatherAgent } from './agents';
import { registerApiRoute } from '@mastra/core/server';
import { CopilotRuntime, copilotRuntimeNodeHttpEndpoint, ExperimentalEmptyAdapter } from '@copilotkit/runtime';

const serviceAdapter = new ExperimentalEmptyAdapter();

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    cors: {
      origin: '*',
      allowMethods: ['POST'],
      allowHeaders: ['*'],
    },
    apiRoutes: [
      registerApiRoute('/copilotkit', {
        method: `POST`,
        handler: async c => {
          const mastra = c.get('mastra');

          const agents = getAGUI({
            resourceId: 'weatherAgent',
            mastra,
          });

          const runtime = new CopilotRuntime({
            agents,
          });

          const handler = copilotRuntimeNodeHttpEndpoint({
            endpoint: '/copilotkit',
            runtime,
            serviceAdapter,
          });

          return handler.handle(c.req.raw, {});
        },
      }),
    ],
  },
});
