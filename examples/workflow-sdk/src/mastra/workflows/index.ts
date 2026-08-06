import { init } from '@mastra/workflow-sdk';
import { mastraRunner } from '@mastra/workflow-sdk/workflows';
import { z } from 'zod';

// Same authoring API as @mastra/core, bound to the Workflow SDK runner.
const { createWorkflow, createStep } = init({ runner: mastraRunner });

const validateOrder = createStep({
  id: 'validate-order',
  inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  outputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    risk: z.enum(['low', 'high']),
  }),
  execute: async ({ inputData }) => ({
    ...inputData,
    risk: inputData.amount > 500 ? ('high' as const) : ('low' as const),
  }),
});

const approveOrder = createStep({
  id: 'approve-order',
  inputSchema: validateOrder.outputSchema,
  outputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    approved: z.boolean(),
  }),
  suspendSchema: z.object({ reason: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { orderId, amount, risk } = inputData;

    // Low-risk orders are approved automatically.
    if (risk === 'low') {
      return { orderId, amount, approved: true };
    }

    // High-risk orders park on a durable Workflow SDK hook until a human
    // resumes the run — no process is held open while we wait.
    if (!resumeData) {
      await suspend({ reason: `Order ${orderId} for $${amount} needs manual approval` });
      return { orderId, amount, approved: false };
    }

    return { orderId, amount, approved: resumeData.approved };
  },
});

const fulfillOrder = createStep({
  id: 'fulfill-order',
  inputSchema: approveOrder.outputSchema,
  outputSchema: z.object({
    orderId: z.string(),
    status: z.enum(['fulfilled', 'rejected']),
  }),
  execute: async ({ inputData }) => ({
    orderId: inputData.orderId,
    status: inputData.approved ? ('fulfilled' as const) : ('rejected' as const),
  }),
});

export const orderApprovalWorkflow = createWorkflow({
  id: 'order-approval',
  inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  outputSchema: z.object({
    orderId: z.string(),
    status: z.enum(['fulfilled', 'rejected']),
  }),
})
  .then(validateOrder)
  .then(approveOrder)
  .then(fulfillOrder)
  .commit();
