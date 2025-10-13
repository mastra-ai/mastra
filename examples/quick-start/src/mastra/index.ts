import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { catOne } from './agents/agent';
import { logCatWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { catOne },
  workflows: {
    logCatWorkflow,
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
