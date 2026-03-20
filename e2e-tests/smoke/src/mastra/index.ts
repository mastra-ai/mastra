import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { sequentialSteps, schemaValidation, mapBetweenSteps } from './workflows/basic.js';

export const mastra = new Mastra({
  workflows: {
    'sequential-steps': sequentialSteps,
    'schema-validation': schemaValidation,
    'map-between-steps': mapBetweenSteps,
  },
  storage: new LibSQLStore({
    id: 'smoke-test',
    url: 'file:test.db',
  }),
});
