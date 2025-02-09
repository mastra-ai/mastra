import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

import { catOne } from './agents/index';
import { sequentialWorkflow, parallelWorkflow, branchedWorkflow, cyclicalWorkflow } from './workflows';

const connectionString = process.env.POSTGRES_URL!;
const memory = new Memory({
  storage: new PostgresStore({ connectionString }),
});

export const mastra = new Mastra({
  memory: memory,
  agents: { catOne },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
  workflows: {
    sequentialWorkflow,
    parallelWorkflow,
    branchedWorkflow,
    cyclicalWorkflow,
  },
});
