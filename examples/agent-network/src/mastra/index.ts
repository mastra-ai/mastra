import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
// import { researchNetwork } from './network';
import { webSearchAgent } from './agents';
// import { agentWorkflow } from './workflows';
import { v_nextNetwork } from './network/v-next';
import { LibSQLStore } from '@mastra/libsql';
import { workflow1 } from './network/v-next';

export const mastra = new Mastra({
  agents: {
    webSearchAgent,
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
