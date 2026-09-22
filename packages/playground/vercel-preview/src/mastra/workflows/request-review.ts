import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

const requestSchema = z.object({
  title: z.string().trim().min(1).max(120).default('Team workshop'),
  amount: z.number().positive().max(100000).default(2400),
});
const approvalSchema = requestSchema.extend({ approvedBy: z.string() });

const automaticApproval = createStep({
  id: 'automatic-approval',
  description: 'Approve requests up to 1,000 automatically.',
  inputSchema: requestSchema,
  outputSchema: approvalSchema,
  execute: async ({ inputData }) => ({ ...inputData, approvedBy: 'Automatic approval' }),
});

const reviewRequest = createStep({
  id: 'review-request',
  description: 'Pause for approval. Resume with approved: true to continue, or false to see a failed run.',
  inputSchema: requestSchema,
  outputSchema: approvalSchema,
  suspendSchema: requestSchema,
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) return suspend(inputData);
    if (!resumeData.approved) throw new Error('The reviewer declined this request.');
    return { ...inputData, approvedBy: 'Reviewer' };
  },
});

export const requestReview = createWorkflow({
  id: 'request-review',
  description: 'Purchase approval with automatic and manual branches. Requests above 1,000 pause for review.',
  inputSchema: requestSchema,
  outputSchema: approvalSchema,
})
  .branch([
    [async ({ inputData }) => inputData.amount <= 1000, automaticApproval],
    [async ({ inputData }) => inputData.amount > 1000, reviewRequest],
  ])
  .map(async ({ inputData }) => {
    const approval = inputData['automatic-approval'] ?? inputData['review-request'];
    if (!approval) throw new Error('The request did not receive an approval decision.');
    return approval;
  })
  .commit();
