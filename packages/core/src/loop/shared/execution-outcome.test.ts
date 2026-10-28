import { describe, expect, it } from 'vitest';
import { agentLoopTermination } from './execution-outcome';

describe('agent termination meaning', () => {
  it.each(['stop_condition', 'iteration_hook', 'feedback_complete', 'delegation'] as const)('records intentional %s completion as success', stopCause => {
    expect(agentLoopTermination({ stopCause, finishReason: 'tool-calls' }).outcome).toBe('success');
  });
  it('retains explicit caller cancellation', () => {
    expect(agentLoopTermination({ finishReason: 'abort' })).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
  });
});
