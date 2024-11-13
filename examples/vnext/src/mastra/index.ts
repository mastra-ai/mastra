import { Mastra } from '@mastra/core';

import { agentOne } from './agents/test';
import { integrations } from './integrations';
import { testTool } from './tools';

export const mastra = new Mastra({
  tools: {
    testTool,
  },
  agents: [agentOne],
  integrations,
});
