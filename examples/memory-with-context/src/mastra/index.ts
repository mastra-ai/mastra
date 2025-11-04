import { Mastra } from '@mastra/core/mastra';

import { memoryAgent } from './agents';

export const mastra = new Mastra({
  agents: { memoryAgent },
});
