import { Mastra } from '@mastra/core/mastra';

import { assistantAgent } from './agents/assistant';

export const mastra = new Mastra({
  agents: { assistantAgent },
});
