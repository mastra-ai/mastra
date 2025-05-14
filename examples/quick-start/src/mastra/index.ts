import { createLogger, Mastra } from '@mastra/core';

import { catOne } from './agents/agent';
import { logCatWorkflow } from './workflow';
import { logCatWorkflow as vnext_logCatWorkflow } from './vnext-workflows';

export const mastra = new Mastra({
  agents: { catOne },
  workflows: {
    logCatWorkflow,
  },
  vnext_workflows: {
    vnext_logCatWorkflow,
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
