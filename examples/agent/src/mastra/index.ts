import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { agentThatHarassesYou, chefAgent, chefAgentResponses, dynamicAgent, evalAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { lessComplexWorkflow, myWorkflow } from './workflows';
import { chefModelV2Agent, errorAgent, networkAgent } from './agents/model-v2-agent';
import { createScorer } from '@mastra/core/evals';
import { myWorkflowX, nestedWorkflow } from './workflows/other';

const storage = new LibSQLStore({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const testScorer = createScorer({
  id: 'scorer1',
  name: 'My Scorer',
  description: 'Scorer 1',
}).generateScore(() => {
  return 1;
});

export const mastra = new Mastra({
  agents: {
    errorAgent,
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    agentThatHarassesYou,
    evalAgent,
    chefModelV2Agent,
    networkAgent,
  },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: { myWorkflow, myWorkflowX, lessComplexWorkflow, nestedWorkflow },
  bundler: {
    sourcemap: true,
  },
  serverMiddleware: [
    {
      handler: (c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
  scorers: {
    testScorer,
  },
  observability: {
    default: {
      enabled: true,
    },
  },
});
