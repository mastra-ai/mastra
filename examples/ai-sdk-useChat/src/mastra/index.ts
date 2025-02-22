import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
