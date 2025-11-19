import { Observability } from '@mastra/observability';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { sqlAgent } from './agents/sql-agent';
import { databaseQueryWorkflow } from './workflows/database-query-workflow';
import { sqlGenerationAgent } from './agents/sql-generation-agent';

export const mastra = new Mastra({
  agents: { sqlAgent, sqlGenerationAgent },
  workflows: {
    databaseQueryWorkflow,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    // stores observability, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    default: {
      enabled: true,
    },
  }),
});
