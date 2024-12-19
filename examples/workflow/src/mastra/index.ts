import { Mastra, createLogger } from '@mastra/core';

import { catOne } from './agents/index';
import { sequentialWorkflow, parallelWorkflow, branchedWorkflow, cyclicalWorkflow } from './workflows';

export const mastra = new Mastra({
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
