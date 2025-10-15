import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';
import { scorers } from './scorers';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: {
    default: {
      enabled: true,
    },
  },
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  scorers,
});
