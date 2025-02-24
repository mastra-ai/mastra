import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { catOne } from './agents/agent';
import { logCatWorkflow } from './workflow';

export const mastra = new Mastra({
  agents: { catOne },
  workflows: { logCatWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
