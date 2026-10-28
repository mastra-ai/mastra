import type { StepResult, WorkflowRunState } from '../workflows';

export type WorkflowStepStartGuard = {
  eventId: string;
  expectedStartedBy?: string;
  /** Prune the predecessor only after this delivery has durably claimed its input. */
  previousStep?: { stepId: string; eventId: string; result: StepResult<any, any, any, any> };
};
export type WorkflowStepCompletionGuard = {
  eventId: string;
  /** The continuation event durably holds the full input; only prune its predecessor. */
  pruneOnly?: boolean;
};

export class WorkflowStepConflictError extends Error {
  readonly code = 'WORKFLOW_STEP_CONFLICT';

  constructor(
    readonly reason: 'stale' | 'completed' | 'missing',
    readonly storedResult?: StepResult<any, any, any, any>,
    readonly storedRequestContext?: Record<string, any>,
    readonly storedSnapshot?: WorkflowRunState,
  ) {
    super(`Workflow step delivery rejected (${reason}).`);
  }
}

export function isWorkflowStepConflictError(error: unknown): error is WorkflowStepConflictError {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'WORKFLOW_STEP_CONFLICT';
}

/** Call inside the adapter's snapshot lock, before mutating results, state, or request context. */
export function assertWorkflowStepGuard({
  snapshot,
  stepId,
  startGuard,
  completionGuard,
}: {
  snapshot: WorkflowRunState | null;
  stepId: string;
  startGuard?: WorkflowStepStartGuard;
  completionGuard?: WorkflowStepCompletionGuard;
}): void {
  if (!startGuard && !completionGuard) return;
  if (!snapshot) throw new WorkflowStepConflictError('missing');
  const stored = snapshot.context[stepId];
  const startedBy = stored?.metadata?.startedBy;
  // Older workers do not stamp occurrences, so their rows retain unguarded behavior.
  if (stored && !startedBy) return;
  const eventId = (startGuard ?? completionGuard)!.eventId;
  if (startedBy === eventId) {
    if (completionGuard?.pruneOnly) {
      if (stored?.status === 'success') return;
      throw new WorkflowStepConflictError('stale', stored);
    }
    if (stored?.status === 'running') return;
    if (stored?.metadata?.__continuationStarted) throw new WorkflowStepConflictError('stale', stored);
    throw new WorkflowStepConflictError('completed', stored, snapshot.requestContext, snapshot);
  }
  if (startGuard) {
    if (!stored && startGuard.expectedStartedBy === undefined) return;
    if (
      stored &&
      (stored.status !== 'running' || stored.metadata?.__restartPending === true) &&
      startedBy === startGuard.expectedStartedBy
    ) {
      return;
    }
  }
  throw new WorkflowStepConflictError('stale', stored);
}
