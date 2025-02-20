import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { catOne } from './agents/index';
import { sequentialWorkflow, parallelWorkflow, branchedWorkflow, cyclicalWorkflow } from './workflows';

export const mastra = new Mastra({
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
