import { Mastra, createLogger } from '@mastra/core';

import { ycAgent } from './agents';

export const mastra = new Mastra({
  agents: { ycAgent },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
