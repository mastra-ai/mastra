import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'error',
  }),
});
