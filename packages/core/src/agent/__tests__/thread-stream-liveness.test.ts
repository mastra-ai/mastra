import { afterEach, describe, expect, it, vi } from 'vitest';

import { AGENT_THREAD_KEY_SEPARATOR, createHarness, setupRuntime } from './thread-stream-test-utils';

const LEASE_TTL_MS = 15_000;

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('thread stream remote-run liveness', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('terminates a live remote stream when its producer loses the thread lease', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-lost');
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();

    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await flush();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'error']);
    expect(collected[2].payload.error).toEqual(
      new Error(`Thread run ${harness.runId} lost its lease before publishing a terminal event`),
    );

    subscription.unsubscribe();
    await consumed;
  });

  it('keeps a quiet remote stream open while its producer still owns the lease', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-renewed');
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();

    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await flush();

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 3);
    expect(collected.map(part => part.type)).toEqual(['start']);
    expect(subscription.activeRunId()).toBe(harness.runId);

    await streamPart({ type: 'finish', payload: { stepResult: { reason: 'stop' } } });
    await emit({ type: 'run-completed', runId: harness.runId, streamId: harness.streamId, persisted: true });
    await flush();

    expect(collected.map(part => part.type)).toEqual(['start', 'finish']);
    expect(collected.some(part => part.type === 'error')).toBe(false);

    subscription.unsubscribe();
    await consumed;
  });

  it('keeps a remote stream open when a lease probe fails transiently', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-probe-error');
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();

    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await flush();
    vi.spyOn(pubsub, 'getLeaseOwner').mockRejectedValueOnce(new Error('lease store unavailable'));

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    expect(collected.map(part => part.type)).toEqual(['start']);
    expect(subscription.activeRunId()).toBe(harness.runId);

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    expect(collected.map(part => part.type)).toEqual(['start', 'error']);

    subscription.unsubscribe();
    await consumed;
  });

  it('does not let a completed run watchdog terminate a follow-up run', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-follow-up');
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();

    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({ type: 'finish', payload: { stepResult: { reason: 'stop' } } });
    await emit({ type: 'run-completed', runId: harness.runId, streamId: harness.streamId, persisted: true });
    await flush();

    const nextRunId = `${harness.runId}-next`;
    const nextStreamId = `${harness.streamId}-next`;
    pubsub.owners.set(key, nextRunId);
    await emit({ type: 'run-registered', runId: nextRunId, streamId: nextStreamId, streamSeq: 2 });
    await emit({
      type: 'stream-part',
      runId: nextRunId,
      streamId: nextStreamId,
      sourceId: 'origin',
      part: { type: 'start', payload: {} },
    });
    await flush();

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);

    expect(collected.map(part => part.type)).toEqual(['finish', 'start']);
    expect(subscription.activeRunId()).toBe(nextRunId);

    subscription.unsubscribe();
    await consumed;
  });
});
