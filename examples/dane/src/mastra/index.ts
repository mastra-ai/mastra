import { createLogger, Mastra } from '@mastra/core';

import { browserAgent, dane } from './agents';
import { browserBreakdown, messageWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: {
    dane,
    browserAgent,
  },
  workflows: {
    message: messageWorkflow,
    browserBreakdown,
  },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'NONE',
  }),
});
