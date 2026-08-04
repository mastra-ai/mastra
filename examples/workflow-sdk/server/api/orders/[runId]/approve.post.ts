import { defineEventHandler, getRouterParam, readBody } from 'nitro/h3';

import { mastra } from '../../../../src/mastra';

/**
 * Resume a suspended run — works from any request because the run snapshot
 * (including the Workflow SDK run id) is persisted in Mastra storage.
 *
 * POST /api/orders/:runId/approve  { "approved": true }
 */
export default defineEventHandler(async event => {
  const runId = getRouterParam(event, 'runId')!;
  const body = (await readBody(event).catch(() => null)) as { approved?: boolean } | null;

  const run = await mastra.getWorkflow('orderApprovalWorkflow').createRun({ runId });
  const result = await run.resume({
    step: 'approve-order',
    resumeData: { approved: body?.approved ?? true },
  });

  return {
    runId,
    status: result.status,
    result: result.status === 'success' ? result.result : undefined,
  };
});
