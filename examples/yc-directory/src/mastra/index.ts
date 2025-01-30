import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { ycAgent } from './agents';

export const mastra = new Mastra({
  agents: { ycAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
