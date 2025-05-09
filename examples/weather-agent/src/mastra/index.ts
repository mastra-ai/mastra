import { Mastra } from '@mastra/core';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
});
