import { defineEventHandler, getRouterParam } from 'nitro/h3';

import { mastra } from '../../../src/mastra';

/**
 * Inspect a run's status and step results.
 *
 * GET /api/orders/:runId
 */
export default defineEventHandler(async event => {
  const runId = getRouterParam(event, 'runId')!;

  const state = await mastra.getWorkflow('orderApprovalWorkflow').getWorkflowRunById(runId);
  if (!state) {
    return { runId, status: 'not-found' };
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
