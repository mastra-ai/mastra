import { createError, defineEventHandler, getRouterParam, readBody } from 'nitro/h3';

import { mastra } from '../../../../src/mastra';
import { requireApiToken } from '../../../utils/require-api-token';

/**
 * Resume a suspended run — works from any request because the run snapshot
 * (including the Workflow SDK run id) is persisted in Mastra storage.
 *
 * POST /api/orders/:runId/approve  { "approved": true }
 */
export default defineEventHandler(async event => {
  requireApiToken(event);

  const runId = getRouterParam(event, 'runId')!;
  const body = (await readBody(event).catch(() => null)) as { approved?: unknown } | null;
  if (typeof body?.approved !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Body must include an explicit boolean "approved"' });
  }

  const workflow = mastra.getWorkflow('orderApprovalWorkflow');
  const state = await workflow.getWorkflowRunById(runId);
  if (!state) {
    throw createError({ statusCode: 404, statusMessage: `No run found for id "${runId}"` });
  }

  const run = await workflow.createRun({ runId });
  const result = await run.resume({
    step: 'approve-order',
    resumeData: { approved: body.approved },
  });

  return {
    runId,
    status: result.status,
    result: result.status === 'success' ? result.result : undefined,
  };
});
