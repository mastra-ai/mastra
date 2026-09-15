import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import {
  createDurableAgentStream,
  emitChunkEvent,
  emitFinishEvent,
  emitSuspendedEvent,
  emitAbortEvent,
  type DurableAgentStreamResult,
} from '../stream-adapter';

/**
 * Idle / liveness timeout for `createDurableAgentStream` (and therefore
 * `DurableAgent.observe()`).
 *
 * A durable run whose driving process crashed stops emitting chunks but never
 * publishes a terminal FINISH/ERROR/ABORT event, so a reconnecting consumer
 * would hang forever on a producerless pubsub topic. These tests exercise the
 * `idleTimeoutMs` + `isAlive` watchdog directly against the stream adapter,
 * publishing raw CHUNK/FINISH events (the harness used by resumable-streams and
 * the other stream-adapter unit tests). Every case is deterministic and
 * bounded — a Promise.race safety timeout turns any regression that reintroduces
 * the hang into a hard failure rather than a stuck test.
 */

const IDLE = 60; // ms — small real timer; each `await` below waits real time.

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Consume `fullStream` in the background so the test can inspect what has been
 * delivered mid-flight (still-open vs closed, error chunk seen yet) while real
 * timers advance.
 */
function readFullStream(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  let closed = false;
  let threw: unknown;
  const done = (async () => {
    try {
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    } catch (err) {
      threw = err;
    } finally {
      closed = true;
    }
  })();
  return {
    chunks,
    isClosed: () => closed,
    getThrown: () => threw,
    done,
  };
}

/**
 * Resolve to `'done'` if the reader finished, or `'timeout'` if it did not
 * within `ms`. A `'timeout'` result means the stream hung — the anti-hang guard.
 */
function settleWithin(done: Promise<unknown>, ms: number): Promise<'done' | 'timeout'> {
  return Promise.race([done.then(() => 'done' as const), delay(ms).then(() => 'timeout' as const)]);
}

const textChunk = (text: string) => ({ type: 'text-delta', payload: { id: 'text-1', text } }) as any;

const finishData = {
  output: { text: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
  stepResult: { reason: 'stop' as const, warnings: [], isContinued: false },
};

describe('createDurableAgentStream idle/liveness timeout', () => {
  let pubsub: CachingPubSub;

  beforeEach(() => {
    // InMemoryServerCache + EventEmitterPubSub + CachingPubSub: the same
    // resumable-stream harness the sibling tests use.
    pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
  });

  const makeStream = (runId: string, extra: Partial<Parameters<typeof createDurableAgentStream>[0]>) =>
    createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      ...extra,
    }) as DurableAgentStreamResult<any>;

  it('terminates on silence when isAlive returns false', async () => {
    // Locks in: a producerless topic (no terminal event) does NOT hang — after
    // `idleTimeoutMs` of silence with a dead producer, the stream emits an error
    // chunk and closes. This is the core crashed-pod fix.
    const runId = 'idle-dead';
    const { output, cleanup, ready } = makeStream(runId, { idleTimeoutMs: IDLE, isAlive: () => false });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    // A couple of live chunks arrive, then the producer goes silent (crashes).
    await emitChunkEvent(pubsub, runId, textChunk('a'));
    await emitChunkEvent(pubsub, runId, textChunk('b'));

    // Must terminate well within any reasonable bound (expected ~1×IDLE after
    // the last chunk); the generous ceiling only guards against a hang.
    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);

    // Both chunks were delivered first, then a single terminal error chunk.
    const textDeltas = reader.chunks.filter(c => c.type === 'text-delta');
    expect(textDeltas.map((c: any) => c.payload.text)).toEqual(['a', 'b']);
    const errorChunks = reader.chunks.filter(c => c.type === 'error');
    expect(errorChunks).toHaveLength(1);
    expect(String(errorChunks[0].payload.error.message)).toContain(`idle for ${IDLE}ms`);

    cleanup();
  });

  it('parks while isAlive returns true, then closes on FINISH', async () => {
    // Locks in: a legitimately-idle-but-live run (long tool call / suspended
    // HITL gate) is NOT killed. The watchdog fires repeatedly across several
    // idle windows, the probe re-arms each time, and only a real FINISH closes.
    const runId = 'idle-alive';
    const { output, cleanup, ready } = makeStream(runId, { idleTimeoutMs: IDLE, isAlive: () => true });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    await emitChunkEvent(pubsub, runId, textChunk('x'));

    // Stay silent across ~3 idle windows. isAlive → true must keep re-arming.
    await delay(IDLE * 3);
    expect(reader.isClosed()).toBe(false);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    // A real terminal event now closes the stream cleanly.
    await emitFinishEvent(pubsub, runId, finishData);

    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);
    expect(reader.chunks.some(c => c.type === 'finish')).toBe(true);

    cleanup();
  });

  it('resets the countdown on every event so steady activity never terminates', async () => {
    // Locks in: any event proves liveness — while chunks keep arriving faster
    // than `idleTimeoutMs`, the timer keeps resetting and never fires, even
    // though isAlive → false. Termination happens only once activity stops.
    const runId = 'idle-reset';
    const { output, cleanup, ready } = makeStream(runId, { idleTimeoutMs: IDLE, isAlive: () => false });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    // Publish faster than the idle window a handful of times.
    const n = 5;
    for (let i = 0; i < n; i++) {
      await emitChunkEvent(pubsub, runId, textChunk(`c${i}`));
      await delay(IDLE * 0.5); // 30ms < 60ms — each event re-arms the timer
    }

    // No error while chunks were still flowing; stream still open.
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);
    expect(reader.chunks.filter(c => c.type === 'text-delta')).toHaveLength(n);
    expect(reader.isClosed()).toBe(false);

    // Now go silent → the timer finally reaches the window → terminate.
    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(1);

    cleanup();
  });

  it('does not terminate on silence when idleTimeoutMs is unset (opt-in only)', async () => {
    // Control: without idleTimeoutMs the feature is fully off — the stream stays
    // open through arbitrary silence (today's behavior) and only a terminal
    // event closes it. Guards backward compatibility.
    const runId = 'idle-off';
    const { output, cleanup, ready } = makeStream(runId, {}); // no idleTimeoutMs / isAlive
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    await emitChunkEvent(pubsub, runId, textChunk('only'));

    // Silence across several idle windows must NOT close the stream.
    await delay(IDLE * 4);
    expect(reader.isClosed()).toBe(false);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    // A terminal FINISH still closes it normally.
    await emitFinishEvent(pubsub, runId, finishData);
    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    cleanup();
  });

  it('abandons a stale isAlive probe when activity resumes mid-probe', async () => {
    // Locks in the async-`isAlive` race guard: a probe that resolves `false`
    // AFTER a fresh chunk has re-armed the timer must NOT close the now-active
    // stream. Without the idle-generation check this stale `false` would.
    const runId = 'idle-race';
    let aliveResult = false; // the first probe (captured at call time) returns false
    // Signal the moment the FIRST probe starts, so the test can react to the real
    // event (probe in flight) rather than guessing the timing with a fixed delay.
    let markProbeStarted!: () => void;
    const firstProbeStarted = new Promise<void>(resolve => (markProbeStarted = resolve));
    let probeCount = 0;
    // Capture `aliveResult` at CALL time, not resolve time, so the in-flight
    // probe keeps its original verdict even after the flag is flipped below.
    const isAlive = () => {
      const captured = aliveResult;
      if (++probeCount === 1) markProbeStarted();
      return new Promise<boolean>(resolve => setTimeout(() => resolve(captured), IDLE));
    };
    const { output, cleanup, ready } = makeStream(runId, { idleTimeoutMs: IDLE, isAlive });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    await emitChunkEvent(pubsub, runId, textChunk('a')); // arms timer (generation G)
    await firstProbeStarted; // deterministic: the idle timer fired and probe #1 is in flight

    aliveResult = true; // later probes report alive
    await emitChunkEvent(pubsub, runId, textChunk('b')); // re-arms (generation G+1) mid-probe

    // The stale generation-G probe resolves `false` but must be abandoned; the
    // generation-G+1 timer's probe resolves `true` and re-arms. Stay open.
    await delay(IDLE * 4);
    expect(reader.isClosed()).toBe(false);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    // A real terminal event still closes cleanly.
    await emitFinishEvent(pubsub, runId, finishData);
    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    cleanup();
  });

  it('invokes onError when it terminates on idle', async () => {
    // Finding 2: idle termination must fire `onError` (not just enqueue an error
    // chunk), because `observe()` wires onError → scheduleAutoCleanup. Without it
    // a crashed-pod run's registry + topic are retained forever.
    const runId = 'idle-onerror';
    const onError = vi.fn();
    const { output, cleanup, ready } = makeStream(runId, {
      idleTimeoutMs: IDLE,
      isAlive: () => false,
      onError,
    });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);
    await emitChunkEvent(pubsub, runId, textChunk('a'));

    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0].error.message)).toContain(`idle for ${IDLE}ms`);

    cleanup();
  });

  it('never arms the watchdog when observing an already-finished run', async () => {
    // Finding 3: the ordinary reconnect-to-finished-run case. The replayed FINISH
    // closes the stream; the watchdog must NOT arm on the closed stream, or with
    // isAlive → true it would re-probe forever (a self-renewing timer + leak).
    // Assert the probe is NEVER consulted after close.
    const runId = 'idle-finished';
    // Publish a full run terminal BEFORE observing → subscribeWithReplay delivers it.
    await emitChunkEvent(pubsub, runId, textChunk('answer'));
    await emitFinishEvent(pubsub, runId, finishData);

    const isAlive = vi.fn(() => true);
    const { output, cleanup, ready } = makeStream(runId, { idleTimeoutMs: IDLE, isAlive });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    // The replayed FINISH closes the stream.
    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.chunks.some(c => c.type === 'finish')).toBe(true);

    // Across several idle windows the watchdog stays disarmed: probe never called,
    // no stray idle-error chunk.
    await delay(IDLE * 4);
    expect(isAlive).not.toHaveBeenCalled();
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    cleanup();
  });

  it('does not emit a spurious idle error when a slow onSuspended closes the stream', async () => {
    // Terminal state must be marked BEFORE awaiting a terminal callback. handleEvent
    // re-arms the watchdog on every event; with closeOnSuspend + an onSuspended that
    // runs longer than idleTimeoutMs, marking terminal only AFTER the await would let
    // the re-armed timer fire against an already-closing run and emit a bogus idle error.
    const runId = 'idle-suspend-slow';
    const { output, cleanup, ready } = makeStream(runId, {
      idleTimeoutMs: IDLE,
      isAlive: () => false,
      closeOnSuspend: true,
      onSuspended: () => delay(IDLE * 3), // slower than the idle window
    });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);
    await emitSuspendedEvent(pubsub, runId, { type: 'suspension' });

    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    cleanup();
  });

  it('does not emit a spurious idle error when a slow onAbort ends the stream', async () => {
    // Same invariant on the ABORT path: mark terminal before awaiting onAbort.
    const runId = 'idle-abort-slow';
    const { output, cleanup, ready } = makeStream(runId, {
      idleTimeoutMs: IDLE,
      isAlive: () => false,
      onAbort: () => delay(IDLE * 3),
    });
    await ready;

    const reader = readFullStream(output.fullStream as ReadableStream<any>);
    await emitAbortEvent(pubsub, runId, { steps: [] });

    const result = await settleWithin(reader.done, IDLE * 20);
    expect(result).toBe('done');
    expect(reader.isClosed()).toBe(true);
    expect(reader.chunks.filter(c => c.type === 'error')).toHaveLength(0);

    cleanup();
  });
});
