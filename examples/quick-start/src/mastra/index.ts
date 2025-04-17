import { createLogger, Mastra } from '@mastra/core';

import { catOne, catTwo } from './agents/agent';
import { logCatWorkflow } from './workflow';

export const mastra = new Mastra({
  agents: { catOne, catTwo },
  workflows: {
    logCatWorkflow,
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
