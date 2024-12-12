import { Mastra, createLogger } from '@mastra/core';

import { birdCheckerAgent } from './agents/agent';

export const mastra = new Mastra({
  agents: { birdCheckerAgent },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
