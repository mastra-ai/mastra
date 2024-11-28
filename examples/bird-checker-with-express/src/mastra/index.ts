import { Mastra, createLogger } from '@mastra/core';

import { birdCheckerAgent } from './agents/agent';
import { getRandomImageTool } from './tools/index';

export const mastra = new Mastra({
  tools: {
    getRandomImageTool,
  },
  agents: [birdCheckerAgent],
  integrations: [],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
