import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { CafeAgent } from './agents';

export const mastra = new Mastra({
  agents: { CafeAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
