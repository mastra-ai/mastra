import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { researchNetwork } from './network';
import { webSearchAgent } from './agents';
import { agentWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: {
    webSearchAgent,
  },
  networks: {
    researchNetwork,
  },
  workflows: {
    agentWorkflow,
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
