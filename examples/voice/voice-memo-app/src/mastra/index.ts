import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core';

import { noteTakerAgent } from './agents';

export const mastra = new Mastra({
  agents: { noteTakerAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
