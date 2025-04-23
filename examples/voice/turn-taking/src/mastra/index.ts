import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';

import { optimistAgent, skepticAgent } from './agents';

export const mastra = new Mastra({
  agents: { optimistAgent, skepticAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
