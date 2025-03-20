import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';

import { noteTakerAgent } from './agents';

export const mastra = new Mastra({
  agents: { noteTakerAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
