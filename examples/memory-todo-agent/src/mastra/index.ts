import { Mastra } from '@mastra/core';

import { todoAgent } from './agents';

export const mastra = new Mastra({
  agents: { todoAgent },
  logger: false,
});
