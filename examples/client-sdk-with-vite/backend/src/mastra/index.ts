import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

const memory = new Memory();

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  memory,
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
