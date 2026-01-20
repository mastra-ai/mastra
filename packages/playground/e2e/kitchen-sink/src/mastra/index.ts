import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { storage } from './storage';

import { weatherAgent } from './agents';
import { complexWorkflow, lessComplexWorkflow } from './workflows/complex-workflow';
import { simpleMcpServer } from './mcps';
import { registerApiRoute } from '@mastra/core/server';

export const mastra = new Mastra({
  workflows: { complexWorkflow, lessComplexWorkflow },
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'error',
  }),
  storage,
  mcpServers: {
    simpleMcpServer,
  },
  server: {
    apiRoutes: [
      registerApiRoute('/e2e/reset-storage', {
        method: 'POST',
        handler: async c => {
          const clearTasks: Promise<void>[] = [];

          const workflowStore = await storage.getStore('workflows');
          if (workflowStore) {
            clearTasks.push(workflowStore.dangerouslyClearAll());
          }

          const memoryStore = await storage.getStore('memory');
          if (memoryStore) {
            clearTasks.push(memoryStore.dangerouslyClearAll());
          }

          const scoresStore = await storage.getStore('scores');
          if (scoresStore) {
            clearTasks.push(scoresStore.dangerouslyClearAll());
          }

          const observabilityStore = await storage.getStore('observability');
          if (observabilityStore) {
            clearTasks.push(observabilityStore.dangerouslyClearAll());
          }

          const agentsStore = await storage.getStore('agents');
          if (agentsStore) {
            clearTasks.push(agentsStore.dangerouslyClearAll());
          }

          await Promise.all(clearTasks);

          return c.json({ message: 'Custom route' }, 201);
        },
      }),
    ],
  },
});
