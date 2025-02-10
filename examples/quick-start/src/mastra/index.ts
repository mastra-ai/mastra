import { Mastra } from '@mastra/core';

import { catOne, agentTwo } from './agents/agent';
import { logCatWorkflow } from './workflow';

export const mastra = new Mastra({
  agents: { catOne, agentTwo },
  logger: false,
  workflows: { logCatWorkflow },
});
