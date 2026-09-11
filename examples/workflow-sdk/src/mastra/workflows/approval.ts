import { z } from 'zod';
import { createStep, createWorkflow } from '../workflow-sdk';

const expenseSchema = z.object({
  amount: z.number(),
  requestedBy: z.string(),
});

const decisionSchema = z.object({
  approved: z.boolean(),
  approver: z.string(),
});

/**
 * The resume endpoint builds its hook token from this id, so it lives next to
 * the step rather than being repeated as a string literal in the route.
 */
export const APPROVAL_STEP_ID = 'request-approval';

/**
 * Suspends until a human decides. `suspend()` returns control to the caller
 * and the run stays parked in durable storage — no timer, no polling, no
 * process held open. It resumes when a decision arrives as `resumeData`.
 */
const requestApprovalStep = createStep({
  id: APPROVAL_STEP_ID,
  description: 'Waits for a human to approve or reject the expense',
  inputSchema: expenseSchema,
  suspendSchema: z.object({
    reason: z.string(),
    amount: z.number(),
    requestedBy: z.string(),
  }),
  resumeSchema: decisionSchema,
  outputSchema: expenseSchema.merge(decisionSchema),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      console.log(`[request-approval] suspending for $${inputData.amount}`);
      return await suspend({
        reason: 'Expenses over $0 need a human decision in this example',
        amount: inputData.amount,
        requestedBy: inputData.requestedBy,
      });
    }

    return { ...inputData, ...resumeData };
  },
});

const notifyStep = createStep({
  id: 'notify',
  description: 'Tells the requester what was decided',
  inputSchema: expenseSchema.merge(decisionSchema),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const verdict = inputData.approved ? 'approved' : 'rejected';
    const summary = `$${inputData.amount} from ${inputData.requestedBy} was ${verdict} by ${inputData.approver}`;
    console.log(`[notify] ${summary}`);
    return { summary };
  },
});

export const approvalWorkflow = createWorkflow({
  id: 'approval-workflow',
  inputSchema: expenseSchema,
  outputSchema: z.object({
    summary: z.string(),
  }),
})
  .then(requestApprovalStep)
  .then(notifyStep)
  .commit();
