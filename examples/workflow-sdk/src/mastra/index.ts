import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { orderApprovalWorkflow } from './workflows';

export const mastra = new Mastra({
  // Storage is required to resume, watch, or cancel a run from a request
  // other than the one that started it: the Mastra runId → Workflow SDK
  // run id mapping lives on the run snapshot.
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  workflows: { orderApprovalWorkflow },
});
