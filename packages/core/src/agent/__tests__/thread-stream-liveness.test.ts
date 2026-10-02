import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentThreadLeaseLostError } from '../thread-stream-runtime';
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
    expect(collected[2].payload.error).toEqual(new AgentThreadLeaseLostError(harness.runId));

    subscription.unsubscribe();
    await consumed;
  });

  it('does not report a replayed suspended stream as lease loss', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-suspended');
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);
    pubsub.retain = true;
    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({
      type: 'tool-call-suspended',
      payload: { toolCallId: 'call-1', toolName: 'ask_user', args: {} },
    });

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();
    await flush();

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);

    expect(collected.map(part => part.type)).toEqual(['tool-call-suspended']);
    expect(collected.some(part => part.type === 'error')).toBe(false);

    subscription.unsubscribe();
    await consumed;
  });

  it('resolves a legacy suspension boundary without stopping a newer resumed stream', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-legacy-suspended');
    const { runtime, pubsub, emit } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const resumedStreamId = `${harness.streamId}-resumed`;
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
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: harness.streamId,
      sourceId: 'origin',
      part: { type: 'start', payload: {} },
    });
    await emit({ type: 'run-registered', runId: harness.runId, streamId: resumedStreamId, streamSeq: 2 });
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: resumedStreamId,
      sourceId: 'origin',
      part: { type: 'start', payload: {} },
    });
    await emit({ type: 'run-suspended', runId: harness.runId });
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: resumedStreamId,
      sourceId: 'origin',
      part: { type: 'text-delta', payload: { text: 'resumed' } },
    });
    await flush();

    expect(collected.map(part => part.type)).toEqual(['start', 'start', 'text-delta']);

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['start', 'start', 'text-delta', 'error']);
    expect(collected[3].payload.error).toEqual(new AgentThreadLeaseLostError(harness.runId));

    subscription.unsubscribe();
    await consumed;
  });

  it('does not let a delayed legacy suspension boundary stop a resumed stream lease watch', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-delayed-legacy-suspended');
    const { runtime, pubsub, emit } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const resumedStreamId = `${harness.streamId}-resumed`;
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
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: harness.streamId,
      sourceId: 'origin',
      part: {
        type: 'tool-call-suspended',
        payload: { toolCallId: 'call-1', toolName: 'ask_user', args: {} },
      },
    });
    await flush();

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    expect(collected.map(part => part.type)).toEqual(['tool-call-suspended']);

    pubsub.owners.set(key, harness.runId);
    await emit({ type: 'run-registered', runId: harness.runId, streamId: resumedStreamId, streamSeq: 2 });
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: resumedStreamId,
      sourceId: 'origin',
      part: { type: 'start', payload: {} },
    });
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: resumedStreamId,
      sourceId: 'origin',
      part: { type: 'text-delta', payload: { text: 'resumed' } },
    });
    await emit({ type: 'run-suspended', runId: harness.runId });
    await flush();

    expect(collected.map(part => part.type)).toEqual(['tool-call-suspended', 'start', 'text-delta']);

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['tool-call-suspended', 'start', 'text-delta', 'error']);
    expect(collected[3].payload.error).toEqual(new AgentThreadLeaseLostError(harness.runId));

    subscription.unsubscribe();
    await consumed;
  });

  it.each([
    { terminalType: 'run-completed' as const, expectedErrors: [] },
    { terminalType: 'run-aborted' as const, expectedErrors: [] },
    { terminalType: 'run-failed' as const, expectedErrors: ['legacy terminal failure'] },
  ])('applies a legacy $terminalType event to the resumed stream', async ({ terminalType, expectedErrors }) => {
    vi.useFakeTimers();
    const harness = createHarness(`liveness-legacy-${terminalType}`);
    const { runtime, pubsub, emit } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const resumedStreamId = `${harness.streamId}-resumed`;
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
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: harness.streamId,
      sourceId: 'origin',
      part: {
        type: 'tool-call-suspended',
        payload: { toolCallId: 'call-1', toolName: 'ask_user', args: {} },
      },
    });
    await flush();

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    expect(collected.map(part => part.type)).toEqual(['tool-call-suspended']);

    pubsub.owners.set(key, harness.runId);
    await emit({ type: 'run-registered', runId: harness.runId, streamId: resumedStreamId, streamSeq: 2 });
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: resumedStreamId,
      sourceId: 'origin',
      part: { type: 'start', payload: {} },
    });
    await emit({
      type: 'stream-part',
      runId: harness.runId,
      streamId: resumedStreamId,
      sourceId: 'origin',
      part: { type: 'text-delta', payload: { text: 'resumed' } },
    });
    if (terminalType === 'run-completed') {
      await emit({ type: terminalType, runId: harness.runId, status: 'success', persisted: true });
    } else if (terminalType === 'run-failed') {
      await emit({ type: terminalType, runId: harness.runId, error: 'legacy terminal failure' });
    } else {
      await emit({ type: terminalType, runId: harness.runId });
    }
    await flush();

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.filter(part => part.type === 'error').map(part => part.payload.error.message)).toEqual(
      expectedErrors,
    );

    subscription.unsubscribe();
    await consumed;
  });

  it('reports lease loss when a prompt-bearing stream continues before losing its owner', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-prompt-continued');
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
    await streamPart({
      type: 'tool-call-suspended',
      payload: { toolCallId: 'call-1', toolName: 'ask_user', args: {} },
    });
    await streamPart({ type: 'text-delta', payload: { text: 'continued' } });
    await flush();

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['tool-call-suspended', 'text-delta', 'error']);
    expect(collected[2].payload.error).toEqual(new AgentThreadLeaseLostError(harness.runId));

    subscription.unsubscribe();
    await consumed;
  });

  it('does not emit lease loss when a suspension stops an in-flight lease probe', async () => {
    vi.useFakeTimers();
    const harness = createHarness('liveness-suspend-race');
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);
    let resolveOwner!: (owner: string | undefined) => void;
    const ownerProbe = new Promise<string | undefined>(resolve => {
      resolveOwner = resolve;
    });

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

    const getLeaseOwner = vi.spyOn(pubsub, 'getLeaseOwner').mockImplementationOnce(() => ownerProbe);
    const probe = vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    await vi.waitFor(() => expect(getLeaseOwner).toHaveBeenCalled());
    await emit({ type: 'run-suspended', runId: harness.runId, streamId: harness.streamId });
    resolveOwner(undefined);
    await probe;

    expect(collected.map(part => part.type)).toEqual(['start']);
    expect(collected.some(part => part.type === 'error')).toBe(false);

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
