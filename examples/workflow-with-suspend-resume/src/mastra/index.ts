import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { myWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: {
    myWorkflow,
  },
  storage: new LibSQLStore({
    id: 'workflow-snapshots-storage',
    url: 'file:./workflow-snapshots.db',
  }),
});
