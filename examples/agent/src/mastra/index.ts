import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent },
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
