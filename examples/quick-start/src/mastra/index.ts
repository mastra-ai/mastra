import { createLogger, Mastra } from '@mastra/core';

import { catOne } from './agents/agent';
import { logCatWorkflow as legacy_catWorkflow } from './legacy-workflows';
import { logCatWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { catOne },
  legacy_workflows: {
    legacy_catWorkflow,
  },
  workflows: {
    logCatWorkflow,
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
