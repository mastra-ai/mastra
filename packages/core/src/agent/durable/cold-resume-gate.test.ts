import { getEventListeners } from 'node:events';
import { describe, expect, it } from 'vitest';
import { ColdResumeAttempt, undecidedColdResume } from './cold-resume-gate';
import type { ColdResumeGate } from './cold-resume-gate';

function heldGate(runtime: object, runId: string): ColdResumeGate {
  const gate = undecidedColdResume(runtime, runId);
  if (!gate) throw new Error(`No cold resume holds ${runId}`);
  return gate;
}

// #28229: resumes of a run that another cold resume is rebuilding wait on that resume's decision. The
// end-to-end cases live in __tests__/resume-api.test.ts; these cover the gate's own bookkeeping, which
// no public API exposes.
describe('cold resume gate', () => {
  // Technical: each waiter was attached to the held gate with `pending.then`, which stays attached until the
  // gate opens. A caller retrying with short deadlines against a stalled resume piled up reactions.
  it('a waiter that gives up is detached at once, however often callers retry against a held gate', async () => {
    const runtime = {};
    const holder = new ColdResumeAttempt({ runtime, runId: 'run-held' });
    holder.begin();
    const gate = heldGate(runtime, 'run-held');

    const signals: AbortSignal[] = [];
    for (let retry = 0; retry < 25; retry++) {
      const controller = new AbortController();
      signals.push(controller.signal);
      const waiting = gate.wait(controller.signal);
      controller.abort(new Error(`retry ${retry} gave up`));
      await expect(waiting).rejects.toThrow(`retry ${retry} gave up`);
    }
    const deadline = AbortSignal.timeout(10);
    signals.push(deadline);
    await expect(gate.wait(deadline)).rejects.toBeDefined();

    expect(gate.waiting).toBe(0);
    for (const signal of signals) expect(getEventListeners(signal, 'abort')).toHaveLength(0);
    holder.abandon();
  });

  it.each(['accept', 'abandon'] as const)(
    'waiters still waiting are let in when the holder decides (%s)',
    async decision => {
      const runtime = {};
      const holder = new ColdResumeAttempt({ runtime, runId: 'run-decides' });
      holder.begin();
      const gate = heldGate(runtime, 'run-decides');

      const gaveUp = new AbortController();
      const canceled = gate.wait(gaveUp.signal);
      const patient = new AbortController();
      const waiters = [gate.wait(patient.signal), gate.wait(undefined)];
      gaveUp.abort(new Error('gave up'));
      await expect(canceled).rejects.toThrow('gave up');
      expect(gate.waiting).toBe(2);

      if (decision === 'accept') holder.accept();
      else holder.abandon();

      await expect(Promise.all(waiters)).resolves.toEqual([undefined, undefined]);
      expect(gate.waiting).toBe(0);
      expect(getEventListeners(patient.signal, 'abort')).toHaveLength(0);
      expect(undecidedColdResume(runtime, 'run-decides')).toBeUndefined();
      // A late waiter on the opened gate does not wait.
      await expect(gate.wait(undefined)).resolves.toBeUndefined();
    },
  );

  it('separate runtimes do not share a gate for the same run ID', () => {
    const first = new ColdResumeAttempt({ runtime: {}, runId: 'shared-id' });
    const secondRuntime = {};
    first.begin();
    expect(undecidedColdResume(secondRuntime, 'shared-id')).toBeUndefined();

    const second = new ColdResumeAttempt({ runtime: secondRuntime, runId: 'shared-id' });
    second.begin();
    const secondGate = undecidedColdResume(secondRuntime, 'shared-id');
    first.abandon();
    expect(undecidedColdResume(secondRuntime, 'shared-id')).toBe(secondGate);
    second.abandon();
    expect(undecidedColdResume(secondRuntime, 'shared-id')).toBeUndefined();
  });
});
