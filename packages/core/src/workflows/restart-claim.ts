import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { WorkflowExecutionGeneration, WorkflowStepLifecycleStateMap } from './lifecycle-events';
import type { WorkflowRunState } from './types';

/**
 * Atomically adopts a new lifecycle generation for a restart or time-travel
 * execution on stores that fence the row's lifetime discriminator.
 *
 * The claim names the generation it succeeds: a write carrying a fresh
 * generation without one is indistinguishable from a delayed dead-lifetime
 * write on fenced storage, and a rejected claim means another lifetime owns
 * the run — the caller must stand down rather than execute unowned work the
 * step-persist fences would drop as `stale_execution`.
 *
 * Throws `WORKFLOW_RESTART_NOT_CLAIMED` when the compare-and-set loses, so a
 * stranded-run recovery sweep or a racing restart never enters the execution
 * engine for a lifetime it does not own.
 */
export async function claimWorkflowRestart({
  workflowsStore,
  snapshot,
  lifecycleExecution,
  workflowId,
  runId,
}: {
  workflowsStore: WorkflowsStorage | undefined;
  snapshot: WorkflowRunState;
  lifecycleExecution: {
    executionGeneration: WorkflowExecutionGeneration;
    lifecycleResumeAttempt: number;
    lifecycleStepStates: WorkflowStepLifecycleStateMap;
  };
  workflowId: string;
  runId: string;
}): Promise<void> {
  if (!workflowsStore) return;

  const concurrentCas = workflowsStore.supportsConcurrentUpdates();
  const claimed = await workflowsStore.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: 'running',
      executionGeneration: lifecycleExecution.executionGeneration,
      lifecycleResumeAttempt: lifecycleExecution.lifecycleResumeAttempt,
      lifecycleStepStates: lifecycleExecution.lifecycleStepStates,
      ...(concurrentCas
        ? {
            expectedStatus: snapshot.status,
            expectedExecutionGeneration: snapshot.executionGeneration,
            expectedLifecycleResumeAttempt: snapshot.lifecycleResumeAttempt,
          }
        : {}),
    },
  });
  if (!concurrentCas || claimed) return;

  const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  throw new MastraError({
    id: 'WORKFLOW_RESTART_NOT_CLAIMED',
    domain: ErrorDomain.MASTRA_WORKFLOW,
    category: ErrorCategory.USER,
    text:
      `This workflow run could not be claimed for a new lifecycle execution. Workflow "${workflowId}" run "${runId}" ` +
      `changed before the claim was adopted, so another generation owns it now. ` +
      `Only one restart() or timeTravel() may adopt a given run state; re-read the run state before trying again.`,
    details: {
      workflowId,
      runId,
      expectedStatus: snapshot.status ?? 'unknown',
      actualStatus: current?.status ?? 'missing',
      expectedExecutionGeneration: snapshot.executionGeneration ?? 'unknown',
      actualExecutionGeneration: current?.executionGeneration ?? 'missing',
      expectedLifecycleResumeAttempt: snapshot.lifecycleResumeAttempt ?? 'unknown',
      actualLifecycleResumeAttempt: current?.lifecycleResumeAttempt ?? 'missing',
    },
  });
}
