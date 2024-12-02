import { Mastra, createLogger } from '@mastra/core';

import { travelAgent } from './agents';
import * as tools from './tools';

export const mastra = new Mastra({
  tools,
  agents: [travelAgent],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
