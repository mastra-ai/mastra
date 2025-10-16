import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { weatherAgent } from './agents';
import { complexWorkflow } from './workflows/complex-workflow';

export const mastra = new Mastra({
  workflows: { complexWorkflow },
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'error',
  }),
  storage: new LibSQLStore({
    url: ':memory:',
  }),
});
