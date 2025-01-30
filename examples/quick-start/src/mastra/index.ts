import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { catOne, agentTwo } from './agents/agent';
import { logCatWorkflow } from './workflow';

export const mastra = new Mastra({
  agents: { catOne, agentTwo },
  logger: false,
  workflows: { logCatWorkflow },
});
