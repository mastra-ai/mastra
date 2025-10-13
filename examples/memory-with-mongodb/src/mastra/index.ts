import { Mastra } from '@mastra/core/mastra';

import 'dotenv/config';

import { chefAgent, memoryAgent } from './agents';

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
});
