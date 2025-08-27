import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import {
  // agentBuilder,
  agentThatHarassesYou,
  chefAgent,
  chefAgentResponses,
  dynamicAgent,
  evalAgent,
  workflowBuilderAgent,
} from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { myWorkflow, workflowBuilderWorkflow } from './workflows';
import { chefModelV2Agent } from './agents/model-v2-agent';

const storage = new LibSQLStore({
  url: 'file:../../mastra.db',
});

export const mastra = new Mastra({
  agents: {
    // agentBuilder,
    workflowBuilderAgent,
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    agentThatHarassesYou,
    evalAgent,
    chefModelV2Agent,
  },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: { myWorkflow, workflowBuilderWorkflow },
  bundler: {
    sourcemap: true,
  },
  serverMiddleware: [
    {
      handler: (_c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
});
