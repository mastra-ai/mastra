import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { chefAgent, chefAgentResponses, dynamicAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { myWorkflow } from './workflows';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  agents: { chefAgent, chefAgentResponses, dynamicAgent },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: { myWorkflow },
  serverMiddleware: [
    {
      handler: (c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
});
