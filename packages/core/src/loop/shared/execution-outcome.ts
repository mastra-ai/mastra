import type { ObserverFailureMetadata, SpanTermination } from '../../observability/types/outcome';
import type { ContinuationStopCause } from './continuation-core';

export { executionFailureTermination } from '../../observability/execution-outcome';

/**
 * Classify a settled agent loop using its runtime stop boundary. A provider
 * finish reason refines the result; it cannot establish successful execution
 * without a continuation decision. Call only after finish-time work succeeds.
 */
export function agentLoopTermination(input: {
  stopCause?: ContinuationStopCause;
  finishReason?: string;
  maxSteps?: number;
  suspension?: { approvalRequired: boolean; toolCallId?: string; toolName?: string };
  tripwire?: { reason?: string; processorId?: string; metadata?: unknown };
}): SpanTermination {
  const { stopCause, finishReason, maxSteps, tripwire } = input;
  if (tripwire || finishReason === 'tripwire') {
    const metadata = tripwire?.metadata as Partial<ObserverFailureMetadata> | undefined;
    const cause = metadata?.observerFailure?.cause;
    // Only OM's typed failure marker changes a tripwire's execution meaning.
    // Ordinary guardrail metadata continues to report a policy block.
    if (cause && ['error', 'abort', 'interrupted', 'limit', 'blocked', 'unknown'].includes(cause.outcome)) {
      return {
        outcome: 'interrupted',
        stopReason: 'observer_failed',
        stopReasonContext: {
          reason: 'observer_failed',
          observerSpanId:
            typeof metadata?.observerFailure?.observerSpanId === 'string'
              ? metadata.observerFailure.observerSpanId
              : undefined,
          cause,
        },
      };
    }
    return {
      outcome: 'blocked',
      stopReason: 'guardrail',
      stopReasonContext: {
        reason: 'guardrail',
        processorId: tripwire?.processorId,
        message: tripwire?.reason,
      },
    };
  }
  if (finishReason === 'suspended') {
    const suspension = input.suspension;
    return {
      outcome: 'suspend',
      stopReason: suspension?.approvalRequired ? 'approval_required' : null,
      stopReasonContext: suspension?.approvalRequired
        ? { reason: 'approval_required', toolCallId: suspension.toolCallId, toolName: suspension.toolName }
        : null,
    };
  }
  if (finishReason === 'length') return { outcome: 'limit', stopReason: 'max_tokens' };
  if (finishReason === 'content-filter') return { outcome: 'blocked', stopReason: 'content_filter' };
  if (finishReason === 'abort' || finishReason === 'aborted')
    return { outcome: 'abort', stopReason: 'caller_cancelled' };
  if (finishReason === 'error') return { outcome: 'error', stopReason: 'runtime_error' };
  switch (stopCause) {
    case 'max_steps':
      return { outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { reason: 'max_steps', maxSteps } };
    case 'stop_condition':
      return { outcome: 'abort', stopReason: 'stop_condition' };
    case 'iteration_hook':
    case 'feedback_complete':
      return {
        outcome: 'abort',
        stopReason: 'iteration_hook',
        stopReasonContext: {
          reason: 'iteration_hook',
          feedbackCompleted: stopCause === 'feedback_complete',
        },
      };
    case 'delegation':
      return { outcome: 'abort', stopReason: 'delegation_bail' };
    case 'model_finished':
      // Unknown/unrecognized provider endings do not prove normal completion.
      if (finishReason === 'stop' || finishReason === 'tool-calls') {
        return { outcome: 'success', stopReason: null, stopReasonContext: null };
      }
  }
  return { outcome: 'unknown', stopReason: null, stopReasonContext: null };
}
