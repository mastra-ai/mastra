import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';

import { storyTellerAgent } from './agents';

export const mastra = new Mastra({
  agents: { storyTellerAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
