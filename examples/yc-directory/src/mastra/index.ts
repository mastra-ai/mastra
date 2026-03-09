import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';

import { ycAgent } from './agents';

export const mastra = new Mastra({
  agents: { ycAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
