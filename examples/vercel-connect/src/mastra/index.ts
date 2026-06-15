import { Mastra } from '@mastra/core/mastra';

import { connectAgent } from './agents';

export const mastra = new Mastra({
  agents: { connectAgent },
});
