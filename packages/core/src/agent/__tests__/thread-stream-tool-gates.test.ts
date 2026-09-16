import { describe, expect, it } from 'vitest';
import { ThreadStreamToolGates } from '../thread-stream-tool-gates';

const approval = (toolCallId: string) => ({ type: 'tool-call-approval', payload: { toolCallId } });

describe('thread stream tool gates', () => {
  it('keeps unresolved siblings pending across a resume and an older stream terminal event', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerStream('run', 'original');
    gates.registerGate('run', 'original', approval('answered'));
    gates.registerGate('run', 'original', approval('sibling'));

    gates.registerStream('run', 'resumed', 'answered');
    gates.registerGate('run', 'resumed', {
      type: 'tool-call-suspended',
      payload: { toolCallId: 'new-question' },
    });
    gates.finishRun('run', 'original');

    expect(gates.hasPendingGate('run', 'original', 'answered')).toBe(false);
    expect(gates.hasPendingGate('run', 'original', 'sibling')).toBe(true);
    expect(gates.hasPendingGate('run', 'resumed', 'new-question')).toBe(true);

    gates.finishRun('run', 'resumed');
    expect(gates.hasPendingGate('run', 'original', 'sibling')).toBe(false);
    expect(gates.hasPendingGate('run', 'resumed', 'new-question')).toBe(false);
  });

  it('keeps a gate that arrives before its stream registration', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerGate('run', 'stream', approval('pending'));
    gates.registerStream('run', 'stream');

    expect(gates.hasPendingGate('run', 'stream', 'pending')).toBe(true);
    expect(gates.hasPendingGate('other-run', 'stream', 'pending')).toBe(false);
    expect(gates.hasPendingGate('run', 'other-stream', 'pending')).toBe(false);
  });
});
