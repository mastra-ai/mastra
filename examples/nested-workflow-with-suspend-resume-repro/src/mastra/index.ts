import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

import { buggyWorkflow, workaroundWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: {
    buggyWorkflow, // The workflow that reproduces the bug
    workaroundWorkflow, // The workflow with the workaround
  },
  storage: new LibSQLStore({
    url: 'file:./workflow-snapshots.db',
  }),
});
