import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
