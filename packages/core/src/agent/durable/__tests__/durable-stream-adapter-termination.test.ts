import { describe, it, expect, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createDurableAgentStream, emitFinishEvent, type DurableAgentStreamResult } from '../stream-adapter';

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/25974
 * ("Durable agent: thread stays busy forever when the run's stream never
 * gets a terminal event").
 *
 * Root cause #1: `cleanup()` unsubscribed from pubsub and nulled the stream
 * controller WITHOUT ever closing the underlying ReadableStream. A `cleanup()`
 * called before any terminal (FINISH/ERROR/ABORT) event arrived — e.g. the
 * auto-cleanup timer, or an explicit early `cleanup()` — left the stream open
 * forever. Any consumer still reading it (most notably the thread-stream
 * runtime's completion watcher, which calls `output._waitUntilFinished()` to
 * decide when the owning thread is no longer "busy") then waited forever.
 *
 * Root cause #2: nothing recovered a stream whose driving workflow settled
 * without ever delivering a terminal event (a dropped/failed publish, or an
 * event lost in transit). `forceError` + `isTerminal` close that gap: callers
 * can verify termination actually happened and, if not, force the stream into
 * the same end-state a genuine ERROR event would produce.
 *
 * Every assertion is bounded by `settleWithin` so a regression that
 * reintroduces the hang fails the test instead of hanging the test runner.
 */

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function readFullStream(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  let closed = false;
  const done = (async () => {
    try {
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    } finally {
      closed = true;
    }
  })();
  return { chunks, isClosed: () => closed, done };
}

function settleWithin(done: Promise<unknown>, ms: number): Promise<'done' | 'timeout'> {
  return Promise.race([done.then(() => 'done' as const), delay(ms).then(() => 'timeout' as const)]);
}

const finishData = {
  output: { text: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
  stepResult: { reason: 'stop' as const, warnings: [], isContinued: false },
};

describe('createDurableAgentStream termination safety net', () => {
  const makeStream = (runId: string, pubsub: CachingPubSub, extra: Partial<Parameters<typeof createDurableAgentStream>[0]> = {}) =>
    createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      ...extra,
    }) as DurableAgentStreamResult<any>;

  it('cleanup() before any terminal event closes the stream instead of hanging forever', async () => {
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const runId = 'cleanup-before-terminal';
    const { output, cleanup, ready, isTerminal } = makeStream(runId, pubsub);
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);
    const waitUntilFinished = output._waitUntilFinished();

    expect(isTerminal()).toBe(false);

    // No FINISH/ERROR/ABORT ever arrives — the driving process is gone. Only
    // the owning agent's own cleanup (auto-cleanup timer, or an explicit
    // early call) runs.
    cleanup();

    expect(isTerminal()).toBe(true);
    expect(await settleWithin(reader.done, 1000)).toBe('done');
    expect(reader.isClosed()).toBe(true);
    // The watcher that gates the owning thread's "busy" state must resolve.
    expect(await settleWithin(waitUntilFinished, 1000)).toBe('done');

    // Idempotent: a second cleanup() must not throw or double-close.
    expect(() => cleanup()).not.toThrow();
  });

  it('forceError terminates a stream whose driving workflow settled without a terminal event', async () => {
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const runId = 'force-error-missing-finish';
    const onError = vi.fn();
    const { output, cleanup, ready, isTerminal, forceError } = makeStream(runId, pubsub, { onError });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    expect(isTerminal()).toBe(false);

    // Simulates executeWorkflow() resolving/rejecting while the FINISH/ERROR
    // publish it depended on never reached this adapter (thrown and
    // swallowed upstream, or dropped in transit).
    const error = new Error('Durable agent run finished without emitting a terminal stream event');
    await forceError(error);

    expect(isTerminal()).toBe(true);
    expect(await settleWithin(reader.done, 1000)).toBe('done');
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].error).toBe(error);

    // Already terminal: a second forceError is a no-op (never double-fires
    // onError or re-closes an already-closed stream).
    await forceError(new Error('should be ignored'));
    expect(onError).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('forceError is a no-op once a genuine terminal event already closed the stream', async () => {
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const runId = 'force-error-after-real-finish';
    const onError = vi.fn();
    const { output, cleanup, ready, isTerminal, forceError } = makeStream(runId, pubsub, { onError });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    await emitFinishEvent(pubsub, runId, finishData);
    expect(await settleWithin(reader.done, 1000)).toBe('done');
    expect(isTerminal()).toBe(true);

    // The safety net must never clobber a run that actually finished cleanly.
    await forceError(new Error('should never surface'));
    expect(onError).not.toHaveBeenCalled();
    expect(reader.chunks.some(c => c.type === 'finish')).toBe(true);
    expect(reader.chunks.some(c => c.type === 'error')).toBe(false);

    cleanup();
  });
});
