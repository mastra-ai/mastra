import { Mastra } from '@mastra/core';

import { memoryAgent } from './agents';

export const mastra = new Mastra({
  agents: { memoryAgent },
});
