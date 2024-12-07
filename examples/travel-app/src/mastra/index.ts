import { Mastra, createLogger } from '@mastra/core';

import { travelAgent, travelAgent2 } from './agents';
import * as tools from './tools';

export const mastra = new Mastra({
  tools,
  agents: [travelAgent, travelAgent2],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
