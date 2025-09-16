import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { testAgent } from './agent/testAgent';

export const mastra = new Mastra({
  agents: { testAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
