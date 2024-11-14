import { Mastra, createLogger } from '@mastra/core';

import { agentOne } from './agents/test';
import { integrations } from './integrations';
import { testTool } from './tools';

export const mastra = new Mastra<typeof integrations>({
  tools: {
    testTool,
  },
  syncs: {},
  agents: [agentOne],
  integrations,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
