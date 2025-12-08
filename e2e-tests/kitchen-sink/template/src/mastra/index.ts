import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_TRACES,
  TABLE_SPANS,
  TABLE_AGENTS,
} from '@mastra/core/storage';
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
          await Promise.all([
            storage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT }),
            storage.clearTable({ tableName: TABLE_MESSAGES }),
            storage.clearTable({ tableName: TABLE_THREADS }),
            storage.clearTable({ tableName: TABLE_RESOURCES }),
            storage.clearTable({ tableName: TABLE_SCORERS }),
            storage.clearTable({ tableName: TABLE_TRACES }),
            storage.supports.observabilityInstance && storage.clearTable({ tableName: TABLE_SPANS }),
            storage.supports.agents && storage.clearTable({ tableName: TABLE_AGENTS }),
          ]);

          return c.json({ message: 'Custom route' }, 201);
        },
      }),
    ],
  },
});
