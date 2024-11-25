import { Mastra, createLogger } from '@mastra/core';

import { agentFour, agenThree, agentOne, agentTwo } from './agents/test';
import { integrations } from './integrations';
import * as syncs from './syncs';
import * as tools from './tools';

export const mastra = new Mastra({
  // tools,
  // syncs,
  engine: {} as any,
  agents: [agentTwo, agentOne, agentFour, agenThree],
  integrations,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});