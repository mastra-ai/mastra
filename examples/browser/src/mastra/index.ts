import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { scrapingAgent } from './agents';

export const mastra = new Mastra({
  agents: { scrapingAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
