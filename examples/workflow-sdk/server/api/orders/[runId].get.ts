import { createError, defineEventHandler, getRouterParam } from 'nitro/h3';

import { mastra } from '../../../src/mastra';
import { requireApiToken } from '../../utils/require-api-token';

/**
 * Inspect a run's status and step results.
 *
 * GET /api/orders/:runId
 */
export default defineEventHandler(async event => {
  requireApiToken(event);

  const runId = getRouterParam(event, 'runId')!;

  const state = await mastra.getWorkflow('orderApprovalWorkflow').getWorkflowRunById(runId);
  if (!state) {
    throw createError({ statusCode: 404, statusMessage: `No run found for id "${runId}"` });
  }

  return {
    runId,
    status: state.status,
    result: state.result,
    steps: Object.fromEntries(
      Object.entries(state.steps ?? {})
        .filter(([id]) => id !== 'input')
        .map(([id, step]) => [id, Array.isArray(step) ? step.map(s => s?.status) : step?.status]),
    ),
  };
});
