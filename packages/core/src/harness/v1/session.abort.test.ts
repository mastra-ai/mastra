/**
 * Harness v1 — Session.abort() / isRunning() coverage.
 *
 * `session.abort()` is a separate primitive from messaging (§4.2). It cancels
 * the in-flight turn — whether that turn was started by `message()`, drained
 * from `queue()`, or kicked off via a `respondTo*` resume call — by signaling
 * the per-turn AbortController the session minted at turn start.
 *
 * `session.isRunning()` reports whether such a turn is currently in flight.
 *
 * These tests pin:
 *   - isRunning lifecycle (false → true → false) across message, queue, resume
 *   - session.abort() cancels each kind of in-flight turn
 *   - abort propagates the abort reason to the agent's AbortSignal
 *   - abort is a no-op when the session is idle
 *   - the per-turn signal is cleared after completion / abort
 */

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__';

/** Deferred lets a test gate the mock agent on a promise it controls. */
function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Pump microtasks until `predicate()` is true (or `attempts` runs out). */
async function waitFor(predicate: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('waitFor: predicate never became true');
}

describe('Session.isRunning()', () => {
  it('is false on a brand new session', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(session.isRunning()).toBe(false);
  });

  it('flips to true mid-message() and back to false on completion', async () => {
    const { harness, agent } = setupHarness();
    const hold = deferred();
    agent.enqueueRun({ finishReason: 'stop', text: 'done', holdUntil: hold.promise });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const inflight = session.message({ content: 'go' });

    await waitFor(() => session.isRunning());
    expect(session.isRunning()).toBe(true);
    hold.resolve();
    await inflight;
    expect(session.isRunning()).toBe(false);
  });

  it('flips to false after a suspension capture', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-A',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell' },
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    // Once suspended the per-turn AbortController is released; the session is
    // idle from the harness's perspective even though a pending interrupt is
    // parked. `respondTo*` will start a fresh turn.
    expect(session.isRunning()).toBe(false);
  });
});

describe('Session.abort()', () => {
  it('is a no-op when no turn is in flight', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(() => session.abort()).not.toThrow();
    expect(session.isRunning()).toBe(false);
  });

  it('cancels an in-flight message() turn and propagates the reason', async () => {
    const { harness, agent } = setupHarness();
    const hold = deferred();
    let abortReason: unknown;
    agent.enqueueRun({
      finishReason: 'stop',
      text: 'done',
      holdUntil: hold.promise,
      onAbort: reason => {
        abortReason = reason;
      },
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const inflight = session.message({ content: 'go' });

    await waitFor(() => session.isRunning());
    expect(session.isRunning()).toBe(true);

    session.abort({ reason: 'user-cancelled' });

    // The hold loses to abort — mock agent surfaces finishReason='aborted'
    // and Session unwinds cleanly.
    await inflight;
    expect(abortReason).toBe('user-cancelled');
    expect(session.isRunning()).toBe(false);

    // Per-turn signal handed to the agent must have aborted with the same
    // reason that `session.abort()` supplied.
    const turnSignal = agent.streamCalls[0]!.options.abortSignal as AbortSignal;
    expect(turnSignal.aborted).toBe(true);
    expect((turnSignal as { reason?: unknown }).reason).toBe('user-cancelled');
  });

  it('uses a default reason when none is supplied', async () => {
    const { harness, agent } = setupHarness();
    const hold = deferred();
    agent.enqueueRun({ finishReason: 'stop', holdUntil: hold.promise });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const inflight = session.message({ content: 'go' });

    await waitFor(() => session.isRunning());
    session.abort();
    await inflight;

    const turnSignal = agent.streamCalls[0]!.options.abortSignal as AbortSignal;
    expect(turnSignal.aborted).toBe(true);
    expect((turnSignal as { reason?: unknown }).reason).toBe('session_aborted');
  });

  it('cancels an in-flight queued turn', async () => {
    const { harness, agent } = setupHarness();
    const hold = deferred();
    let abortReason: unknown;
    agent.enqueueRun({
      finishReason: 'stop',
      text: 'queued-done',
      holdUntil: hold.promise,
      onAbort: reason => {
        abortReason = reason;
      },
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const queued = session.queue({ content: 'work' });

    // Wait for the drain to pick the item up.
    await waitFor(() => session.isRunning());
    expect(session.isRunning()).toBe(true);

    session.abort({ reason: 'queue-cancel' });
    await queued;

    expect(abortReason).toBe('queue-cancel');
    expect(session.isRunning()).toBe(false);
  });

  it('cancels an in-flight respondToToolApproval (resume) turn', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-R',
      suspendPayload: { toolCallId: 'tc-R', toolName: 'shell' },
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    // Now the next run (the resume) is held — abort it.
    const hold = deferred();
    let abortReason: unknown;
    agent.enqueueRun({
      finishReason: 'stop',
      text: 'resumed',
      runId: 'run-R',
      holdUntil: hold.promise,
      onAbort: reason => {
        abortReason = reason;
      },
    });

    const inflight = session.respondToToolApproval({ approved: true });

    await waitFor(() => session.isRunning());
    expect(session.isRunning()).toBe(true);

    session.abort({ reason: 'resume-cancel' });
    await inflight;

    expect(abortReason).toBe('resume-cancel');
    expect(session.isRunning()).toBe(false);

    // The resume call's abortSignal got the abort.
    const resumeSignal = agent.resumeCalls[0]!.options.abortSignal!;
    expect(resumeSignal.aborted).toBe(true);
    expect((resumeSignal as { reason?: unknown }).reason).toBe('resume-cancel');
  });

  it('second abort() after the turn ended is a no-op', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'done' });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'go' });
    expect(session.isRunning()).toBe(false);

    // No turn → no-op, no throw, no state change.
    expect(() => session.abort({ reason: 'late' })).not.toThrow();
    expect(session.isRunning()).toBe(false);
  });
});
