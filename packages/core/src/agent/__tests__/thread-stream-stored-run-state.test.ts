import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryStore } from '../../storage/mock';
import type { WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import type { Agent } from '../agent';
import { AGENT_THREAD_KEY_SEPARATOR, createHarness, setupRuntime } from './thread-stream-test-utils';

// These tests drive the thread-stream runtime directly with pubsub events, as the
// other thread-stream liveness tests do; no model is involved, so neither aimock
// nor MockLanguageModel is needed. Storage is a real InMemoryStore.

const LEASE_TTL_MS = 15_000;

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

async function storeWithRun(runId: string, status: WorkflowRunStatus) {
  const storage = new InMemoryStore();
  const workflows = await storage.getStore('workflows');
  await workflows!.persistWorkflowSnapshot({
    workflowName: 'agentic-loop',
    runId,
    snapshot: {
      runId,
      status,
      value: {},
      context: {},
      serializedStepGraph: [],
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState,
  });
  return storage;
}

function withStorage(harness: ReturnType<typeof createHarness>, storage: InMemoryStore) {
  harness.agent = {
    id: harness.agent.id,
    getMastraInstance: () => ({ getStorage: () => storage }),
  } as unknown as Agent<any, any, any, any>;
}

describe('thread stream runtime reads stored run state', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parks a remote run whose lease lapsed when storage says the run is suspended', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-lease-suspended');
    withStorage(harness, await storeWithRun(harness.runId, 'suspended'));
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
    await streamPart({ type: 'text-delta', payload: { text: 'waiting on approval' } });
    await flush();

    // The producer parked the run (storage says suspended) and released the lease, but
    // the suspension prompt never reached this subscriber.
    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    subscription.unsubscribe();
    await consumed;
  });

  it('does not block the thread on a replayed run-suspended when storage says the run finished', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-replay-finished');
    withStorage(harness, await storeWithRun(harness.runId, 'success'));
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    // The resumed segment still holds the lease when this subscriber attaches.
    pubsub.owners.set(key, harness.runId);
    pubsub.retain = true;

    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({
      type: 'tool-call-suspended',
      payload: { toolCallId: 'call-1', toolName: 'ask_user', args: {} },
    });
    // The run was later resumed and finished, but only the suspension is replayed
    // (e.g. the backlog was trimmed or the resume ran on a new stream that is gone).
    await emit({ type: 'run-suspended', runId: harness.runId, streamId: harness.streamId });

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const consumed = (async () => {
      for await (const _part of subscription.stream);
    })();
    await flush();
    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);

    expect(runtime.getThreadState({ threadId: harness.threadId, resourceId: harness.resourceId }, pubsub)).toBe('idle');

    subscription.unsubscribe();
    await consumed;
  });
});
