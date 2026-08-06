import { createError, defineEventHandler, readBody } from 'nitro/h3';

import { mastra } from '../../src/mastra';
import { requireApiToken } from '../utils/require-api-token';

/**
 * Start an order-approval run.
 *
 * POST /api/orders  { "amount": 700, "orderId": "order-1" }
 *
 * Orders over $500 suspend at the `approve-order` step and wait on a durable
 * hook; resume them via POST /api/orders/:runId/approve.
 */
export default defineEventHandler(async event => {
  requireApiToken(event);

  let body: unknown;
  try {
    // An empty body is allowed (defaults below); malformed JSON is a 400.
    body = await readBody(event);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be valid JSON' });
  }

  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be a JSON object' });
  }

  const { orderId, amount } = (body ?? {}) as { orderId?: unknown; amount?: unknown };
  if (orderId !== undefined && typeof orderId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '"orderId" must be a string' });
  }
  if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
    throw createError({ statusCode: 400, statusMessage: '"amount" must be a non-negative number' });
  }

  const inputData = {
    orderId: orderId ?? `order-${Date.now()}`,
    amount: amount ?? 100,
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
