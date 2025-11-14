import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

import { catOne } from './agents/index';
import { sequentialWorkflow, parallelWorkflow, branchedWorkflow, cyclicalWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { catOne },
  logger: new PinoLogger({
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
