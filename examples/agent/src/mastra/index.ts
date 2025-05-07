import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { chefAgent, chefAgentResponses, dynamicAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';

export const mastra = new Mastra({
  agents: { chefAgent, chefAgentResponses, dynamicAgent },
  logger: createLogger({ name: 'Chef', level: 'debug' }),
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  serverMiddleware: [
    {
      handler: (c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
});
