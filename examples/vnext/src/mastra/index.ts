import { Mastra, createLogger } from '@mastra/core';

import { agentOne } from './agents/test';
import { integrations } from './integrations';
import * as syncs from './syncs';
import * as tools from './tools';

export const mastra = new Mastra<typeof integrations, typeof tools, typeof syncs>({
  tools,
  syncs,
  engine: {} as any,
  agents: [agentOne],
  integrations,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});