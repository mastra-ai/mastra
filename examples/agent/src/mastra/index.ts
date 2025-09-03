import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { agentThatHarassesYou, chefAgent, chefAgentResponses, dynamicAgent, evalAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { myWorkflow } from './workflows';
import { chefModelV2Agent } from './agents/model-v2-agent';
import { createScorer } from '@mastra/core/scores';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

const testScorer = createScorer({
  name: 'scorer1',
  description: 'Scorer 1',
}).generateScore(() => {
  return 1;
});

export const mastra = new Mastra({
  agents: {
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
  workflows: { myWorkflow },
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
  // telemetry: {
  //   enabled: false,
  // }
});
