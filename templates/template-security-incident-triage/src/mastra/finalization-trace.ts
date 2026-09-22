import type { OperationalStore } from '../db/operational-store.js';
import { startWorkflowBoundary } from './observability.js';
import { advanceWorkflowTrace, readWorkflowTrace } from './workflow-trace.js';

type FinalizationScope = Readonly<{
  tenantId: string;
  incidentId: string;
  workflowRunId: string;
  correlationId: string;
}>;

/** Keeps terminal spans in order: previous boundary → cleanup → completion.
 * The caller performs domain finalization before finishing the completion span. */
export async function beginFinalizationTrace(store: OperationalStore, scope: FinalizationScope) {
  let context = await readWorkflowTrace(store, scope);
  if (context) {
    const cleanup = startWorkflowBoundary({
      boundary: 'workflow.cleanup',
      ...scope,
      runId: scope.workflowRunId,
      requestId: context.requestId,
      context,
      identifiers: { stepId: 'finalize-incident' },
    });
    endBoundary(cleanup, true);
    await advanceWorkflowTrace(store, {
      ...scope,
      previous: context,
      next: {
        ...cleanup.context,
        runId: scope.workflowRunId,
        requestId: context.requestId,
      },
    });
    // Reload after compare-and-swap so a concurrent advance cannot regress the parent.
    context = await readWorkflowTrace(store, scope);
  }
  const completion = startWorkflowBoundary({
    boundary: 'triage.completed',
    ...scope,
    runId: scope.workflowRunId,
    requestId: context?.requestId ?? scope.workflowRunId,
    ...(context ? { context } : {}),
  });
  return {
    async finish(success: boolean): Promise<void> {
      endBoundary(completion, success);
      if (context)
        await advanceWorkflowTrace(store, {
          ...scope,
          previous: context,
          next: {
            ...completion.context,
            runId: scope.workflowRunId,
            requestId: context.requestId,
          },
        });
    },
  };
}

function endBoundary(boundary: ReturnType<typeof startWorkflowBoundary>, success: boolean): void {
  // Mastra's generic attribute type omits our categorical success field.
  // Keep the existing exporter contract and its SDK cast at this boundary.
  boundary.span.end({ attributes: { success } as never });
}
