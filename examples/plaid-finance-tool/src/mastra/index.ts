import { Mastra } from '@mastra/core/mastra';

import { financeAgent } from './agents';

export const mastra = new Mastra({
  agents: { financeAgent },
});
