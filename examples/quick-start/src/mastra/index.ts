import { createLogger, Mastra } from '@mastra/core';
import { DefaultStorage } from '@mastra/core/storage/libsql';

import { catOne } from './agents/agent';
import { logCatWorkflow } from './workflow';

export const storage = new DefaultStorage({
  config: {
    url: ':memory:',
  },
});

export const mastra = new Mastra({
  agents: { catOne },
  workflows: { logCatWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
  storage,
});
