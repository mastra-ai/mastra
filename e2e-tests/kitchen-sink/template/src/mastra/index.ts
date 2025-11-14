import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { weatherAgent } from './agents';
import { complexWorkflow, lessComplexWorkflow } from './workflows/complex-workflow';
import { simpleMcpServer } from './mcps';

export const mastra = new Mastra({
  workflows: { complexWorkflow, lessComplexWorkflow },
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'error',
  }),
  storage: new LibSQLStore({
    id: 'e2e-test-storage',
    url: ':memory:',
  }),
  mcpServers: {
    simpleMcpServer,
  },
});
