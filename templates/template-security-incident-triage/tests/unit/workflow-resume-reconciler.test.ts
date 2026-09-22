import { expect, it, vi } from 'vitest';
import { createApprovalRunReconciler } from '../../src/approval/workflow-resume-reconciler.js';

const input = {
  workflowRunId: 'run_1',
  resumeReceiptId: 'receipt_1',
  expectedResultStatuses: ['contained', 'failed'],
};
it('acknowledges a delivered receipt after containment fails without resuming again', async () => {
  const resume = vi.fn();
  const reconcile = createApprovalRunReconciler({
    read: async () => ({
      status: 'failed',
      steps: {
        'await-approval': {
          status: 'success',
          resumePayload: { resumeReceiptId: 'receipt_1' },
        },
        'execute-containment': { status: 'failed' },
      },
    }),
    resume,
  });
  await expect(reconcile(input)).resolves.toBe('completed');
  expect(resume).not.toHaveBeenCalled();
});
it.each([
  { status: 'failed', receipt: 'receipt_1' },
  { status: 'success', receipt: 'other_receipt' },
  { status: 'success', receipt: undefined },
])('does not acknowledge an unverified approval step: %j', async ({ status, receipt }) => {
  const resume = vi.fn();
  const reconcile = createApprovalRunReconciler({
    read: async () => ({
      status: 'failed',
      steps: {
        'await-approval': {
          status,
          resumePayload: { resumeReceiptId: receipt },
        },
      },
    }),
    resume,
  });
  await expect(reconcile(input)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(resume).not.toHaveBeenCalled();
});
