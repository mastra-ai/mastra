import { createStep } from '@mastra/core/workflows';
import { z } from 'zod/v4';
import { approvedOrderSchema, checkedOrderSchema } from './schemas';

export const approveAutomatically = createStep({
  id: 'approve-automatically',
  description: 'Take this branch when Approval is automatic.',
  inputSchema: checkedOrderSchema,
  outputSchema: approvedOrderSchema,
  execute: async ({ inputData }) => ({ ...inputData, approvedBy: 'Automatic approval' }),
});

export const requestApproval = createStep({
  id: 'request-approval',
  description: 'Pause for review. Resume with approved true to pack, or false to reject the order.',
  inputSchema: checkedOrderSchema,
  outputSchema: approvedOrderSchema,
  suspendSchema: z.object({ customer: z.string(), totalUnits: z.number(), message: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend({
        customer: inputData.customer,
        totalUnits: inputData.totalUnits,
        message: 'Review the order, then approve it to start packing.',
      });
    }
    if (!resumeData.approved) throw new Error('The reviewer rejected this order. Packing was not started.');
    return { ...inputData, approvedBy: 'Reviewer' };
  },
});
