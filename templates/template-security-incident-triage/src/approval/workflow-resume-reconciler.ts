import { DomainError } from '../domain/errors.js';

export type ApprovalWorkflowState = Readonly<{
  status: string;
  result?: Readonly<Record<string, unknown>>;
  steps?: Readonly<Record<string, unknown>>;
}>;

export type ApprovalRunAccessor = Readonly<{
  read(workflowRunId: string): Promise<ApprovalWorkflowState | null>;
  resume(
    input: Readonly<{
      workflowRunId: string;
      resumeReceiptId: string;
    }>,
  ): Promise<unknown>;
}>;

export type ApprovalWorkflow = Readonly<{
  getWorkflowRunById(
    runId: string,
    options?: Readonly<{ fields?: readonly string[] }>,
  ): Promise<ApprovalWorkflowState | null>;
  createRun(options: Readonly<{ runId: string }>): Promise<{
    resume(
      options: Readonly<{
        step: string;
        resumeData: Readonly<{ resumeReceiptId: string }>;
      }>,
    ): Promise<unknown>;
  }>;
}>;

export type ReconcileApprovalRun = (
  input: Readonly<{
    workflowRunId: string;
    resumeReceiptId: string;
    expectedResultStatuses: readonly string[];
  }>,
) => Promise<'completed' | 'in_progress'>;

export function createApprovalRunReconciler(accessor: ApprovalRunAccessor): ReconcileApprovalRun {
  return async input => {
    const before = await accessor.read(input.workflowRunId);
    const reconciled = reconcileState(before, input);
    if (reconciled) return reconciled;
    if (before?.status !== 'suspended') throw new DomainError('CONFLICT');
    try {
      await accessor.resume(input);
    } catch (error) {
      const afterFailure = await accessor.read(input.workflowRunId);
      const recovered = reconcileState(afterFailure, input);
      if (recovered) return recovered;
      throw error;
    }
    const after = await accessor.read(input.workflowRunId);
    const completed = reconcileState(after, input);
    if (completed) return completed;
    throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
  };
}

export function createWorkflowApprovalRunReconciler(workflow: ApprovalWorkflow): ReconcileApprovalRun {
  return createApprovalRunReconciler({
    read: workflowRunId =>
      workflow.getWorkflowRunById(workflowRunId, {
        fields: ['steps', 'result'],
      }),
    resume: async ({ workflowRunId, resumeReceiptId }) => {
      const run = await workflow.createRun({ runId: workflowRunId });
      return run.resume({
        step: 'await-approval',
        resumeData: { resumeReceiptId },
      });
    },
  });
}

function reconcileState(
  state: ApprovalWorkflowState | null,
  input: Parameters<ReconcileApprovalRun>[0],
): 'completed' | 'in_progress' | undefined {
  if (!state) return undefined;
  const receiptRecorded = hasExpectedReceipt(state, input.resumeReceiptId);
  if (isActive(state.status)) {
    return receiptRecorded && state.status !== 'suspended' ? 'in_progress' : undefined;
  }
  // A successful approval step already consumed this exact receipt. A later
  // failed step may leave no workflow result, but must not cause recovery to
  // resume the terminal run forever. This acknowledges delivery only; action
  // retries remain fenced by their ledger and the original approval expiry.
  const approvalStep = state.steps?.['await-approval'];
  const approvalResults = Array.isArray(approvalStep) ? approvalStep : [approvalStep];
  if (
    state.status === 'failed' &&
    input.expectedResultStatuses.includes('failed') &&
    approvalResults.some(
      step =>
        typeof step === 'object' &&
        step !== null &&
        (step as Record<string, unknown>).status === 'success' &&
        hasExpectedReceipt({ status: state.status, steps: { 'await-approval': step } }, input.resumeReceiptId),
    )
  )
    return 'completed';
  if (receiptRecorded && input.expectedResultStatuses.includes(String(state.result?.status))) {
    return 'completed';
  }
  return undefined;
}

function hasExpectedReceipt(state: ApprovalWorkflowState, resumeReceiptId: string): boolean {
  const step = state.steps?.['await-approval'];
  const results = Array.isArray(step) ? step : [step];
  return results.some(result => {
    if (typeof result !== 'object' || result === null) return false;
    const payload = (result as Record<string, unknown>).resumePayload;
    return (
      typeof payload === 'object' &&
      payload !== null &&
      (payload as Record<string, unknown>).resumeReceiptId === resumeReceiptId
    );
  });
}

function isActive(status: string): boolean {
  return ['pending', 'running', 'suspended', 'waiting', 'paused'].includes(status);
}
