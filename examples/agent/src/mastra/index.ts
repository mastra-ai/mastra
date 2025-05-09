import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { chefAgent, chefAgentResponses, dynamicAgent } from './agents/index';
import { myWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { chefAgent, chefAgentResponses, dynamicAgent },
  logger: createLogger({ name: 'Chef', level: 'debug' }),
  // vnext_workflows: {
  //   myWorkflow,
  // },
});
