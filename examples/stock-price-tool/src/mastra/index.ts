import { createLogger, Mastra } from '@mastra/core';

import { stockAgent } from '../agents';
import * as tools from '../tools';

console.log(tools);

export const mastra = new Mastra({
  tools,
  agents: [stockAgent],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'DEBUG',
  }),
});
