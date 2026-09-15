/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/21223
 *
 * On a retained pubsub backend (Redis Streams), a fresh `subscribeToThread`
 * replays the topic backlog. A run that failed mid-stream (or whose process
 * died) published its partial chunks but never persisted a message, so
 * replaying it surfaces a phantom partial assistant message that hydrated
 * history can never reconcile. Replayed runs whose origin no longer holds the
 * thread lease must be buffered and only released to the subscriber when
 * their backlog proves they finished cleanly.
 */
import { describe, expect, it } from 'vitest';

import type { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import type { LeasePubSub } from './thread-stream-test-utils';
import {
  AGENT_THREAD_KEY_SEPARATOR,
  collectThread,
  createHarness,
  nextTicks,
  setupRuntime,
} from './thread-stream-test-utils';

const harness = createHarness('phantom');
const { runId, streamId, resourceId, threadId } = harness;
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);

const setup = () => setupRuntime(harness);
const collect = (runtime: AgentThreadStreamRuntime, pubsub: LeasePubSub) => collectThread(harness, runtime, pubsub);

describe('phantom replay of unpersisted runs', () => {
  it('does not replay a run that failed mid-stream and terminated with run-completed', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // Replayed backlog of a dead run (no lease owner): partial content, an
    // in-band error, then the plain-stream() error path's `run-completed`.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'Your refund has been approved.' } });
    await streamPart({ type: 'error', payload: { error: 'connection dropped' } });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
    expect(collected).toEqual([]);
  });

  it('does not replay a run whose process crashed mid-stream (no terminal event)', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
    expect(collected).toEqual([]);
  });

  it('does not replay a run whose backlog terminates with run-failed', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await emit({ type: 'run-failed', runId, streamId, error: 'boom' });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
  });

  it('still replays a run that completed cleanly', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'hello' } });
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });

  it('trusts persisted: false over a clean-finish backlog', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // Backlog looks clean, but the origin knows the storage flush failed.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'never stored' } });
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId, persisted: false });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
  });

  it('trusts persisted: true even when the backlog is missing its finish chunk', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // A subscriber can attach mid-topic-retention and miss trailing chunks;
    // the origin's verdict still marks the run as backed by storage.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'stored' } });
    await emit({ type: 'run-completed', runId, streamId, persisted: true });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    subscription.unsubscribe();
    await consumed;
  });

  it('defers a dead run discovered via stream-part without run-registered', async () => {
    const { runtime, pubsub, streamPart, emit } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // No run-registered in the retained window — first evidence of the run is
    // a replayed chunk. Dead origin (no lease), no terminal event: phantom.
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await nextTicks();

    expect(collected).toEqual([]);

    // A later clean terminal event still releases it.
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId, persisted: true });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });

  it('does not replay a deferred run terminated by run-aborted, even with a clean-finish backlog', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // Aborted runs never persist their messages: the backlog must be dropped
    // even if a finish chunk made it onto the wire before the abort.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'about to abort' } });
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-aborted', runId, streamId });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
    expect(collected).toEqual([]);
  });

  it('flushes a deferred run when it suspends (suspends persist a snapshot)', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'thinking' } });
    await emit({ type: 'run-suspended', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    subscription.unsubscribe();
    await consumed;
  });

  it('still streams a live run whose origin holds the thread lease', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    pubsub.owners.set(key, runId);
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'live' } });
    await nextTicks();

    // Live parts stream through immediately, before any terminal event.
    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });
});
