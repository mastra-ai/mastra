import { createLogger, Mastra } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';
import { FirecrawlIntegration } from '@mastra/firecrawl';
import { UpstashKVMemory } from '@mastra/memory';
import { url } from 'inspector';

import { dane } from './agents';
import { browserBreakdown, messageWorkflow } from './workflows';

const firecrawl = new FirecrawlIntegration({
  config: {
    API_KEY: process.env.FIRECRAWL_API_KEY!,
  },
});

const engine = new PostgresEngine({
  url: 'postgres://postgres:postgres@localhost:5433/mastra',
});

export const mastra = new Mastra({
  agents: {
    dane,
  },
  engine,
  memory: new UpstashKVMemory({
    url: 'http://localhost:8079',
    token: `example_token`,
  }),
  workflows: {
    message: messageWorkflow,
    browserBreakdown,
  },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'NONE',
  }),
  syncs: {
    ...firecrawl.getSyncs(),
  },
});
