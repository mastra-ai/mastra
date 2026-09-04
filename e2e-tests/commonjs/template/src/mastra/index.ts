import { Mastra } from '@mastra/core/mastra';

import { weatherAgent } from './agents';

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: false,
});
