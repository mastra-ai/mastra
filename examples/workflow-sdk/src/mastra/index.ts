import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';

import { approvalWorkflow } from './workflows/approval';
import { incrementWorkflow } from './workflows/increment';

/**
 * Storage holds Mastra's run snapshots so a suspended run can be resumed by a
 * later HTTP request. Durable step execution itself is handled by the Workflow
 * SDK, which keeps its own event log (in `.workflow-data` during local dev).
 *
 * The local file default is only right while one process serves every request.
 * On serverless, each invocation would get its own empty copy of it and a
 * resume could not find the run it is resuming, so point `DATABASE_URL` at a
 * hosted libsql database when deploying.
 */
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: process.env.DATABASE_URL ?? 'file:./mastra.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
    approvalWorkflow,
  },
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
