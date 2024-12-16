import { createLogger, Mastra } from '@mastra/core';
import { UpstashKVMemory } from '@mastra/memory';

import { dane } from './agents';
import { browserBreakdown, messageWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: {
    dane,
  },
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
});
