import { Mastra } from '@mastra/core';

import { chefAgent } from './agents/chefAgent';

export const mastra = new Mastra({
  agents: { chefAgent },
});
