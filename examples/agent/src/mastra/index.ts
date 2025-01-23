import { Mastra } from '@mastra/core';

import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent },
});
