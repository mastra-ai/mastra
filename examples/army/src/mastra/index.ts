import { createLogger, Mastra } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';

import { attackWorkflow } from './workflows/attack.js';

const engine = new PostgresEngine({
  url: 'postgres://postgres:postgres@localhost:5433/mastra',
});

export const mastra = new Mastra({
  engine,
  workflows: {
    attack: attackWorkflow,
  },
  logger: createLogger({
    type: 'CONSOLE',
  }),
});
