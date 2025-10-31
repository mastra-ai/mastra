import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';

import { noteTakerAgent } from './agents';

export const mastra = new Mastra({
  agents: { noteTakerAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
