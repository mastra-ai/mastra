import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';

import { ycAgent } from './agents';

export const mastra = new Mastra({
  agents: { ycAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
