import { executionFailureTermination } from '../observability/execution-outcome';
import type { SpanTermination } from '../observability/types';
import { WORKFLOW_CANCELLED_SYMBOL } from './constants';
import type { StepTripwireInfo, WorkflowRunStatus } from './types';

/** Classify the runtime's settled workflow result, after cancellation reconciliation. */
export function workflowTermination(
  result: { status: WorkflowRunStatus; error?: unknown; tripwire?: StepTripwireInfo },
  abortSignal?: AbortSignal,
): SpanTermination {
  switch (result.status) {
    case 'success':
    case 'bailed': // A workflow bail returns its explicitly supplied successful result.
      return { outcome: 'success', stopReason: null, stopReasonContext: null };
    case 'canceled':
      // Internal control-flow results use canceled for both executor stop and caller cancellation.
      // Preserve that public status while recording the authoritative signal's distinct cause.
      if (abortSignal?.aborted && abortSignal.reason !== WORKFLOW_CANCELLED_SYMBOL)
        return { outcome: 'interrupted', stopReason: null, stopReasonContext: null };
      return { outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null };
    case 'suspended':
    case 'paused':
    case 'waiting':
      // Generic suspension does not establish that human approval was requested.
      return { outcome: 'suspend', stopReason: null, stopReasonContext: null };
    case 'tripwire':
      return {
        outcome: 'blocked',
        stopReason: 'guardrail',
        stopReasonContext: {
          reason: 'guardrail',
          message: result.tripwire?.reason,
          processorId: result.tripwire?.processorId,
        },
      };
    case 'failed':
      return executionFailureTermination(result.error);
    default:
      // Pending/running/skipped is not evidence of a completed execution.
      return { outcome: 'unknown', stopReason: null, stopReasonContext: null };
  }
}
