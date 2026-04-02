import { Mastra } from '@mastra/core/mastra';

import { economicMemoryAgent } from './agents';

export const mastra = new Mastra({
  agents: { economicMemoryAgent },
});
