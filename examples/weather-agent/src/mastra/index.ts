import { Mastra } from '@mastra/core';

import { weatherAgent } from './agents';
import { weatherWorkflow, logCatWorkflow } from './workflows';
import { myWorkflow } from './workflows/test';

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow, logCatWorkflow, myWorkflow },
});
