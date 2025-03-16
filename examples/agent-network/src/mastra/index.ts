import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { researchNetwork } from './network';

export const mastra = new Mastra({
  networks: {
    researchNetwork,
  },
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
