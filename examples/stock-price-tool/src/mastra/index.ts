import * as tools from '../tools';
import { stockAgent } from '../agents';
import { createLogger, Mastra } from '@mastra/core';
 

console.log(tools);

export const mastra = new Mastra({
  tools,
  agents: [stockAgent],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'DEBUG',
  }),
});