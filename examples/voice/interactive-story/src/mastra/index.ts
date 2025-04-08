import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';

import { storyTellerAgent } from './agents';

export const mastra = new Mastra({
  agents: { storyTellerAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
