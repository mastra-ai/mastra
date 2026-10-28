import { describe, expect, it } from 'vitest';
import { agentLoopTermination } from './execution-outcome';

describe('agent termination meaning', () => {
  it.each(['stop_condition', 'iteration_hook', 'feedback_complete', 'delegation'] as const)(
    'records intentional %s completion as success',
    stopCause => {
      expect(agentLoopTermination({ stopCause, finishReason: 'tool-calls' }).outcome).toBe('success');
    },
  );
  it('attributes provider finish errors to the model', () => {
    expect(agentLoopTermination({ finishReason: 'error' })).toMatchObject({
      outcome: 'error',
      stopReason: 'model_error',
    });
  });
  it('records a failed delegation bail as an interruption with its cause', () => {
    const cause = { outcome: 'error', stopReason: 'model_error' } as const;
    expect(agentLoopTermination({ stopCause: 'delegation', delegationFailure: cause })).toMatchObject({
      outcome: 'interrupted',
      stopReason: 'delegation_bail',
      stopReasonContext: { cause },
    });
  });
  it('retains explicit caller cancellation', () => {
    expect(agentLoopTermination({ finishReason: 'abort' })).toMatchObject({
      outcome: 'abort',
      stopReason: 'caller_cancelled',
    });
  });
});
