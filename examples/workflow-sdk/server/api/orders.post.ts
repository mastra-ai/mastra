import { defineEventHandler, readBody } from 'nitro/h3';

import { mastra } from '../../src/mastra';

/**
 * Start an order-approval run.
 *
 * POST /api/orders  { "amount": 700, "orderId": "order-1" }
 *
 * Orders over $500 suspend at the `approve-order` step and wait on a durable
 * hook; resume them via POST /api/orders/:runId/approve.
 */
export default defineEventHandler(async event => {
  const body = (await readBody(event).catch(() => null)) as { orderId?: string; amount?: number } | null;

  const inputData = {
    orderId: body?.orderId ?? `order-${Date.now()}`,
    amount: body?.amount ?? 100,
  };

  const run = await mastra.getWorkflow('orderApprovalWorkflow').createRun();
  const result = await run.start({ inputData });

  if (result.status === 'suspended') {
    const approval = result.steps['approve-order'];
    return {
      runId: run.runId,
      status: result.status,
      suspended: approval?.status === 'suspended' ? approval.suspendPayload : undefined,
      resumeWith: `POST /api/orders/${run.runId}/approve`,
    };
  }

  return {
    runId: run.runId,
    status: result.status,
    result: result.status === 'success' ? result.result : undefined,
  };
});
