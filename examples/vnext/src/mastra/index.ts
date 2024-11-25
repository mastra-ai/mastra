import { Mastra, createLogger } from '@mastra/core';

import { agentFour, agenThree, agentOne, agentTwo } from './agents/test';
import { integrations } from './integrations';
import * as syncs from './syncs';
import * as tools from './tools';

export const mastra = new Mastra<typeof integrations, typeof tools, typeof syncs>({
  tools,
  syncs,
  engine: {} as any,
  agents: [agentTwo, agentOne, agentFour, agenThree],
  integrations,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});

const testTool = mastra.getTool('testTool');
const testTool2 = mastra.getTool('testTool2');

testTool.execute({
  message: 'Hello',
  name: 'World',
});

testTool2.execute({
  balance: 100,
});
