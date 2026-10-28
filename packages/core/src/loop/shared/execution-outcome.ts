import { tripwireTermination } from '../../observability/execution-outcome';
import type { SpanTermination, SpanTripwireContext } from '../../observability/types/outcome';
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
  tripwire?: SpanTripwireContext;
}): SpanTermination {
  const { stopCause, finishReason, maxSteps, tripwire } = input;
  if (tripwire || finishReason === 'tripwire') return tripwireTermination(tripwire);
  if (finishReason === 'suspended') {
    const suspension = input.suspension;
    if (suspension?.approvalRequired)
      return {
        outcome: 'suspend',
        stopReason: 'approval_required',
        stopReasonContext: { toolCallId: suspension.toolCallId, toolName: suspension.toolName },
      };
    return { outcome: 'suspend', stopReason: null, stopReasonContext: null };
  }
  if (finishReason === 'length') return { outcome: 'limit', stopReason: 'max_tokens' };
  if (finishReason === 'content-filter') return { outcome: 'blocked', stopReason: 'content_filter' };
  if (finishReason === 'abort' || finishReason === 'aborted')
    return { outcome: 'abort', stopReason: 'caller_cancelled' };
  if (finishReason === 'error') return { outcome: 'error', stopReason: 'runtime_error' };
  switch (stopCause) {
    case 'max_steps':
      return { outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { maxSteps } };
    case 'stop_condition':
      return { outcome: 'success', stopReason: 'stop_condition' };
    case 'iteration_hook':
    case 'feedback_complete':
      return {
        outcome: 'success',
        stopReason: 'iteration_hook',
        stopReasonContext: {
          feedbackCompleted: stopCause === 'feedback_complete',
        },
      };
    case 'delegation':
      return { outcome: 'success', stopReason: 'delegation_bail' };
    case 'model_finished':
      // Unknown/unrecognized provider endings do not prove normal completion.
      if (finishReason === 'stop' || finishReason === 'tool-calls') {
        return { outcome: 'success', stopReason: null, stopReasonContext: null };
      }
  }
  return { outcome: 'unknown', stopReason: null, stopReasonContext: null };
}
