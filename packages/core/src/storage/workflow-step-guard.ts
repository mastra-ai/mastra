import type { StepResult, WorkflowRunState } from '../workflows';

export type WorkflowStepStartGuard = { eventId: string; expectedStartedBy?: string };
export type WorkflowStepCompletionGuard = { eventId: string };

export class WorkflowStepConflictError extends Error {
  readonly code = 'WORKFLOW_STEP_CONFLICT';

  constructor(
    readonly reason: 'stale' | 'completed' | 'legacy' | 'missing',
    readonly storedResult?: StepResult<any, any, any, any>,
    readonly storedRequestContext?: Record<string, any>,
  ) {
    super(
      `Workflow step delivery rejected (${reason}).${reason === 'legacy' ? ' Legacy runs must be drained with their original core/store versions.' : ''}`,
    );
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
  if (stored && !startedBy) throw new WorkflowStepConflictError('legacy', stored);
  const eventId = (startGuard ?? completionGuard)!.eventId;
  if (startedBy === eventId) {
    if (stored?.status === 'running') return;
    throw new WorkflowStepConflictError('completed', stored, snapshot.requestContext);
  }
  if (startGuard) {
    if (!stored && startGuard.expectedStartedBy === undefined) return;
    if (stored && stored.status !== 'running' && startedBy === startGuard.expectedStartedBy) return;
  }
  throw new WorkflowStepConflictError('stale', stored);
}
