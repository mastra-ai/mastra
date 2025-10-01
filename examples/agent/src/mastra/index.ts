import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { agentThatHarassesYou, chefAgent, chefAgentResponses, dynamicAgent, evalAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { myWorkflow } from './workflows';
import { chefModelV2Agent, networkAgent } from './agents/model-v2-agent';
import { createScorer } from '@mastra/core/scores';
import { myWorkflowX } from './workflows/other';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

const myFirstTestScorer = createScorer({
  name: 'My First Test Scorer',
  description: 'This is my first test scorer, it always returns 1, not very useful.',
}).generateScore(() => {
  return 1;
});

const mySecondTestScorer = createScorer({
  name: 'My Second Scorer',
  description: 'This is my second test scorer, it always returns 0.5, no matter what.',
}).generateScore(() => {
  return 0.5;
});

export const mastra = new Mastra({
  agents: {
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
  workflows: { myWorkflow, myWorkflowX },
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
    myFirstTestScorer: myFirstTestScorer,
    mySecondTestScorer: mySecondTestScorer,
  },
  observability: {
    default: { enabled: true },
  },
  // telemetry: {
  //   enabled: false,
  // }
});
