import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
// import { researchNetwork } from './network';
import { webSearchAgent, synthesizeAgent } from './agents';
import { planningAgent } from './agents/planning';
import { travelAgent, summaryAgent } from './agents/travelAgent';
// import { agentWorkflow } from './workflows';
import { v_nextNetwork } from './network/v-next';
import { LibSQLStore } from '@mastra/libsql';
import { workflow1 } from './network/v-next';
import { travelAgentWorkflow } from './workflows/step4';
import { incrementWorkflow } from './workflows/step5';
import { weatherWorkflow } from './workflows/step3';

export const mastra = new Mastra({
  agents: {
    webSearchAgent,
    planningAgent,
    travelAgent,
    summaryTravelAgent: summaryAgent,
    synthesizeAgent,
  },
  // networks: {
  //   researchNetwork,
  // },
  vnext_networks: {
    v_nextNetwork,
  },
  storage: new LibSQLStore({
    url: 'file:../mastra.db', // Or your database URL
  }),
  workflows: {
    workflow1,
    travelAgentWorkflow,
    incrementWorkflow,
    weatherWorkflow,
  },
  logger: new PinoLogger({ name: 'Chef', level: 'info' }),
  serverMiddleware: [
    {
      handler: (c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
});
