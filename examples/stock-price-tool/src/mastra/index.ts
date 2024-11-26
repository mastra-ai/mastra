import { Mastra } from '@mastra/core';

import { stockAgent } from '../agents';
import * as tools from '../tools';

export const mastra = new Mastra({
  tools,
  agents: [stockAgent],
});
