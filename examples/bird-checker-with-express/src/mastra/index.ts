import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { birdCheckerAgent } from './agents/agent';

export const mastra = new Mastra({
  agents: { birdCheckerAgent },
  logger: createLogger({
    name: 'CONSOLE',
    level: 'info',
  }),
});
