import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import {
  createDurableAgentStream,
  emitChunkEvent,
  emitFinishEvent,
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
});
