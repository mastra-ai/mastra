import { Mastra, createLogger } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';

import { agents } from './agents/test';
import { integrations } from './integrations';
import * as syncs from './syncs';
import * as tools from './tools';

export const mastra = new Mastra<typeof integrations, typeof tools, typeof syncs>({
  tools,
  syncs,
  engine: new PostgresEngine({
    url: process.env.DB_URL!,
  }),
  agents,
  integrations,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
