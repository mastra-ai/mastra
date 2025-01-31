import { Mastra } from '@mastra/core/mastra';

import { stockAgent } from './agents';

export const mastra = new Mastra({
  agents: { stockAgent },
});
