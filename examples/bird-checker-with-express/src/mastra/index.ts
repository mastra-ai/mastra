import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core';

import { birdCheckerAgent } from './agents/agent';

export const mastra = new Mastra({
  agents: { birdCheckerAgent },
  logger: new PinoLogger({
    name: 'CONSOLE',
    level: 'info',
  }),
});
