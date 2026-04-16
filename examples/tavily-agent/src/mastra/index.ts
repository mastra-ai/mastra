import { Mastra } from '@mastra/core/mastra';

import { webSearchAgent } from './agents/index.js';

export const mastra = new Mastra({
  agents: {
    webSearchAgent,
  },
});
