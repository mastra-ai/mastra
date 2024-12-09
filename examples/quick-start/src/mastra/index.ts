import { Mastra, createLogger } from '@mastra/core';

import { catOne, agentTwo } from './agents/agent';

export const mastra = new Mastra({
  agents: [catOne, agentTwo],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
