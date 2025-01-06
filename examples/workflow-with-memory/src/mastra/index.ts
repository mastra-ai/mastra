import { Mastra, createLogger } from '@mastra/core';
import { PgMemory } from '@mastra/memory';

import { catOne } from './agents/index';
import { sequentialWorkflow, parallelWorkflow, branchedWorkflow, cyclicalWorkflow } from './workflows';

const connectionString = process.env.POSTGRES_URL!;
const pgMemory = new PgMemory({ connectionString });

export const mastra = new Mastra({
  memory: pgMemory,
  agents: { catOne },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'DEBUG',
  }),
  workflows: {
    sequentialWorkflow,
    parallelWorkflow,
    branchedWorkflow,
    cyclicalWorkflow,
  },
});
