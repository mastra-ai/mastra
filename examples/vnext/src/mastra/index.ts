import { Mastra, createLogger } from '@mastra/core';
import { agentOne } from './agents/test';
import { integrations } from './integrations';
import * as tools from './tools';
import * as syncs from './syncs';


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

