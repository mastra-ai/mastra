import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { chefAgent, chefAgentResponses, mcpRegistryAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent, chefAgentResponses, mcpRegistryAgent },
  logger: createLogger({ name: 'Chef', level: 'info' }),
  serverMiddleware: [
    {
      handler: (c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
});
