import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { agent } from './agents';

export const mastra = new Mastra({
  agents: { agent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
