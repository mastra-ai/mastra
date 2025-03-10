import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { agent } from './agents';

export const mastra = new Mastra({
  agents: { agent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
