import { Mastra } from '@mastra/core';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';
import { myWorkflow } from './workflows/test';

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow, myWorkflow },
});
