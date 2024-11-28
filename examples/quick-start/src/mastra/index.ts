import { Mastra, createLogger } from '@mastra/core';

import { agentOne, agentTwo } from './agents/agent';

export const mastra = new Mastra({
  agents: [agentOne, agentTwo],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
