import { describe, expect, it } from 'vitest';
import { ThreadStreamToolGates } from '../thread-stream-tool-gates';

describe('thread stream tool gates', () => {
  it('keeps unresolved siblings pending across a resume and an older stream terminal event', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerStream('run', 'original');
    gates.registerStream('run', 'resumed', 'answered');
    gates.finishRun('run', 'original');

    expect(gates.isToolCallUnanswered('run', 'original', 'answered')).toBe(false);
    expect(gates.isToolCallUnanswered('run', 'original', 'sibling')).toBe(true);
    expect(gates.isToolCallUnanswered('run', 'resumed', 'new-question')).toBe(true);

    gates.finishRun('run', 'resumed');
    expect(gates.isToolCallUnanswered('run', 'original', 'sibling')).toBe(false);
    expect(gates.isToolCallUnanswered('run', 'resumed', 'new-question')).toBe(false);
  });

  it('does not infer an answer from missing registration history', () => {
    const gates = new ThreadStreamToolGates();
    expect(gates.isToolCallUnanswered('run', 'stream', 'pending')).toBe(true);
    gates.registerStream('run', 'previous-stream');
    expect(gates.isToolCallUnanswered('run', 'stream', 'pending')).toBe(true);
    gates.registerStream('run', 'stream');
    expect(gates.isToolCallUnanswered('run', 'stream', 'pending')).toBe(true);
  });

  it('keeps an earlier answer when an unrelated tool resumes later', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerStream('run', 'original');
    gates.registerStream('run', 'first-resume', 'first-call');
    gates.registerStream('run', 'second-resume', 'second-call');

    expect(gates.isToolCallUnanswered('run', 'original', 'first-call')).toBe(false);
    expect(gates.isToolCallUnanswered('run', 'original', 'second-call')).toBe(false);
    expect(gates.isToolCallUnanswered('run', 'original', 'sibling')).toBe(true);
    expect(gates.isToolCallUnanswered('run', 'first-resume', 'first-call')).toBe(true);
    expect(gates.isToolCallUnanswered('run', 'second-resume', 'second-call')).toBe(true);
  });

  it('resolves all older calls when resuming the whole run', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerStream('run', 'original');
    gates.registerStream('run', 'resumed');

    expect(gates.isToolCallUnanswered('run', 'original', 'late-call')).toBe(false);
    expect(gates.isToolCallUnanswered('run', 'resumed', 'late-call')).toBe(true);
  });

  it('does not rewind ownership when an older registration is redelivered', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerStream('run', 'original');
    gates.registerStream('run', 'resumed', 'answered');
    gates.registerStream('run', 'original');
    gates.finishRun('run', 'original');

    expect(gates.isToolCallUnanswered('run', 'original', 'answered')).toBe(false);
    expect(gates.isToolCallUnanswered('run', 'resumed', 'answered')).toBe(true);
  });

  it('keeps late gates retired after completion while allowing a new resume', () => {
    const gates = new ThreadStreamToolGates();
    gates.finishRun('run', 'finished-stream');
    expect(gates.isToolCallUnanswered('run', 'unknown-old-stream', 'late-call')).toBe(false);

    gates.registerStream('run', 'recovered-stream', 'late-call');
    expect(gates.isToolCallUnanswered('run', 'recovered-stream', 'late-call')).toBe(true);
  });

  it('does not reopen a completed run when an old registration is redelivered', () => {
    const gates = new ThreadStreamToolGates();
    gates.registerStream('run', 'original');
    gates.registerStream('run', 'resumed', 'answered');
    gates.finishRun('run', 'resumed');
    gates.registerStream('run', 'original');

    expect(gates.isToolCallUnanswered('run', 'original', 'answered')).toBe(false);
  });
});
