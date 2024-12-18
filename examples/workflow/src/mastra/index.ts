import { Mastra, createLogger } from '@mastra/core';

import { catOne } from './agents/index';
import { testWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { catOne },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'DEBUG',
  }),
  workflows: {
    testWorkflow,
  },
});
