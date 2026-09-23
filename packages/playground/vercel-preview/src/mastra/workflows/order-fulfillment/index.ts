import { setTimeout as delay } from 'node:timers/promises';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { approveAutomatically, requestApproval } from './approval';
import { assessRisk, checkInventory, prepareOrder } from './checks';
import { packOrder } from './packing';
import { dispatchedOrderSchema, orderInputSchema, packedOrderSchema } from './schemas';

const dispatchOrder = createStep({
  id: 'dispatch-order',
  description: 'Finish the local simulation, or fail here when Fail dispatch is enabled. Nothing is shipped.',
  inputSchema: packedOrderSchema,
  outputSchema: dispatchedOrderSchema,
  execute: async ({ inputData, abortSignal, runId }) => {
    await delay(1500, undefined, { signal: abortSignal });
    if (inputData.failDispatch) throw new Error('Dispatch failed as requested. Disable Fail dispatch and run again.');
    return { ...inputData, tracking: `DEMO-${runId.slice(0, 8)}` };
  },
});

export const orderFulfillment = createWorkflow({
  id: 'order-fulfillment',
  description:
    'Test parallel checks, approval branches, nested workflows, foreach, waiting, cancellation, and failure. No external services.',
  inputSchema: orderInputSchema,
  outputSchema: dispatchedOrderSchema,
})
  .then(prepareOrder)
  .parallel([checkInventory, assessRisk])
  .map(async ({ inputData }) => ({ ...inputData['check-inventory'], ...inputData['assess-risk'] }))
  .branch([
    [async ({ inputData }) => inputData.approval === 'automatic', approveAutomatically],
    [async ({ inputData }) => inputData.approval === 'manual', requestApproval],
  ])
  .map(async ({ inputData }) => {
    const approvedOrder = inputData['approve-automatically'] ?? inputData['request-approval'];
    if (!approvedOrder) throw new Error('The order did not reach an approval branch.');
    return approvedOrder;
  })
  .then(packOrder)
  .sleep(2000, { id: 'wait-for-dispatch', description: 'Wait two seconds before the local dispatch simulation.' })
  .then(dispatchOrder)
  .commit();
