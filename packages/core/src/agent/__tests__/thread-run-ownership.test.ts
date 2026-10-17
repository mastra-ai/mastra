/**
 * The thread stream runtime decides run ownership from the thread lease and run
 * state from storage (#27364): a lost lease is judged by the stored run status,
 * a stale replayed `run-suspended` does not block the thread, a run whose lease
 * key disappears re-acquires it, and shutdown releases held thread leases.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryStore } from '../../storage';
import type { WorkflowRunState } from '../../workflows/types';
import { leaseOwnerRunId } from '../run-ownership';
import { AgentThreadLeaseLostError, AgentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  AGENT_THREAD_KEY_SEPARATOR,
  LeasePubSub,
  collectThread,
  createHarness,
  setupRuntime,
} from './thread-stream-test-utils';

const LEASE_TTL_MS = 15_000;
const LEASE_RENEW_INTERVAL_MS = 5_000;

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

async function storeWithRun(runId: string, status: WorkflowRunState['status']) {
  const storage = new InMemoryStore();
  const workflowsStore = await storage.getStore('workflows');
  await workflowsStore!.persistWorkflowSnapshot({
    workflowName: 'agentic-loop',
    runId,
    snapshot: {
      runId,
      status,
      value: {},
      context: {},
      activePaths: [],
      serializedStepGraph: [],
      timestamp: Date.now(),
    } as any,
  });
  return storage;
}

function withStorage(harness: ReturnType<typeof createHarness>, storage: InMemoryStore | undefined) {
  (harness.agent as any).getMastraInstance = () => (storage ? { getStorage: () => storage } : undefined);
}

async function setRunStatus(storage: InMemoryStore, runId: string, status: WorkflowRunState['status']) {
  const workflowsStore = await storage.getStore('workflows');
  await workflowsStore!.persistWorkflowSnapshot({
    workflowName: 'agentic-loop',
    runId,
    snapshot: {
      runId,
      status,
      value: {},
      context: {},
      activePaths: [],
      serializedStepGraph: [],
      timestamp: Date.now(),
    } as any,
  });
}

/** Subscribe to a remote run that is streaming, then drop its lease. */
async function followRemoteRunThenDropLease(prefix: string, status: WorkflowRunState['status'] | undefined) {
  const harness = createHarness(prefix);
  const storage = status ? await storeWithRun(harness.runId, status) : undefined;
  withStorage(harness, storage);
  const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
  const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
  pubsub.owners.set(key, `origin/${harness.runId}`);

  const thread = await collectThread(harness, runtime, pubsub);
  await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
  await streamPart({ type: 'start', payload: {} });
  await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
  await flush();
  expect(thread.collected.map(part => part.type)).toEqual(['start', 'text-delta']);

  pubsub.owners.delete(key);
  return { harness, runtime, pubsub, storage, key, ...thread };
}

function fakeRun(runId: string) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  let controller!: ReadableStreamDefaultController;
  const fullStream = new ReadableStream({
    start(c) {
      controller = c;
      c.enqueue({ type: 'start', runId });
    },
  });
  return {
    output: { runId, status: 'running', fullStream, _waitUntilFinished: () => finished } as any,
    park: () =>
      controller.enqueue({
        type: 'tool-call-approval',
        runId,
        payload: { toolCallId: 'approve-1', toolName: 'dangerous', args: {} },
      }),
    finish: () => {
      controller.close();
      finish();
    },
  };
}

describe('lease loss is judged by stored run status', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes the run without an error when storage says it finished', async () => {
    vi.useFakeTimers();
    const { runtime, pubsub, harness, collected, subscription, consumed } = await followRemoteRunThenDropLease(
      'ownership-terminal',
      'running',
    );
    const storage = (harness.agent as any).getMastraInstance().getStorage();
    await setRunStatus(storage, harness.runId, 'success');

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);
    expect(runtime.isRunParked(harness.runId, pubsub)).toBe(false);
    expect(
      runtime.getActiveThreadRunId({ threadId: harness.threadId, resourceId: harness.resourceId }, pubsub),
    ).toBeUndefined();
    subscription.unsubscribe();
    await consumed;
  });

  it('parks the run instead of erroring when storage says it is suspended', async () => {
    vi.useFakeTimers();
    const { harness, runtime, pubsub, collected, subscription, consumed } = await followRemoteRunThenDropLease(
      'ownership-suspended',
      'suspended',
    );

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);
    expect(runtime.isRunParked(harness.runId, pubsub)).toBe(true);
    subscription.unsubscribe();
    await consumed;
  });

  it('gives a still-running run one more lease TTL to be recovered before reporting it lost', async () => {
    vi.useFakeTimers();
    const { harness, collected, subscription, consumed } = await followRemoteRunThenDropLease(
      'ownership-running',
      'running',
    );

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'error']);
    expect((collected[2] as any).payload.error).toEqual(new AgentThreadLeaseLostError(harness.runId));
    subscription.unsubscribe();
    await consumed;
  });

  it('keeps following a run that recovery took over within the grace TTL', async () => {
    vi.useFakeTimers();
    const { harness, pubsub, key, collected, subscription, consumed } = await followRemoteRunThenDropLease(
      'ownership-recovered',
      'running',
    );

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);
    pubsub.owners.set(key, `recovery/${harness.runId}`);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 3);

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);
    subscription.unsubscribe();
    await consumed;
  });

  it('falls back to reporting lease loss when storage cannot answer', async () => {
    vi.useFakeTimers();
    const { harness, collected, subscription, consumed } = await followRemoteRunThenDropLease(
      'ownership-no-storage',
      undefined,
    );

    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS);

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'error']);
    expect((collected[2] as any).payload.error).toEqual(new AgentThreadLeaseLostError(harness.runId));
    subscription.unsubscribe();
    await consumed;
  });
});

describe('replayed run-suspended', () => {
  async function replaySuspendedRun(
    prefix: string,
    status: WorkflowRunState['status'] | 'missing',
    { leaseHeld = false }: { leaseHeld?: boolean } = {},
  ) {
    const harness = createHarness(prefix);
    withStorage(harness, status === 'missing' ? new InMemoryStore() : await storeWithRun(harness.runId, status));
    const { runtime, pubsub, emit } = setupRuntime(harness);
    if (leaseHeld) {
      pubsub.owners.set(
        [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR),
        `origin/${harness.runId}`,
      );
    }
    pubsub.retain = true;
    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await emit({ type: 'run-suspended', runId: harness.runId, streamId: harness.streamId });
    await new Promise(resolve => setTimeout(resolve, 2));

    const thread = await collectThread(harness, runtime, pubsub);
    await new Promise(resolve => setTimeout(resolve, 10));
    const parked = runtime.isRunParked(harness.runId, pubsub);
    thread.subscription.unsubscribe();
    await thread.consumed;
    return parked;
  }

  it('does not block the thread when storage says the run already finished', async () => {
    expect(await replaySuspendedRun('replay-finished', 'success')).toBe(false);
  });

  it('still blocks the thread when storage agrees the run is suspended', async () => {
    expect(await replaySuspendedRun('replay-suspended', 'suspended')).toBe(true);
  });

  it('does not block the thread when the run has no stored row and no live owner', async () => {
    // A finished DurableAgent run deletes its rows, so it reads as missing.
    expect(await replaySuspendedRun('replay-deleted', 'missing')).toBe(false);
  });

  it('keeps a missing-row run parked while its owner still holds the thread lease', async () => {
    // The live owner may not have persisted the suspension yet.
    expect(await replaySuspendedRun('replay-unpersisted', 'missing', { leaseHeld: true })).toBe(true);
  });
});

describe('thread lease ownership', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function registerLongRun(prefix: string) {
    const harness = createHarness(prefix);
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const run = fakeRun(harness.runId);
    await runtime.registerRun(
      harness.agent,
      run.output,
      { memory: { thread: harness.threadId, resource: harness.resourceId } } as any,
      pubsub,
    );
    return { harness, runtime, pubsub, key, run };
  }

  it('owns the lease under a per-process token, not the bare run id', async () => {
    const { harness, pubsub, key, run } = await registerLongRun('ownership-token');
    const owner = pubsub.owners.get(key)!;
    expect(owner).not.toBe(harness.runId);
    expect(leaseOwnerRunId(owner)).toBe(harness.runId);
    run.finish();
  });

  it('re-acquires its lease when the key disappears while the run is still executing', async () => {
    vi.useFakeTimers();
    const { pubsub, key, run } = await registerLongRun('ownership-reacquire');
    const owner = pubsub.owners.get(key)!;

    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_RENEW_INTERVAL_MS);

    expect(pubsub.owners.get(key)).toBe(owner);
    run.finish();
  });

  it('stops renewing once another owner holds the key', async () => {
    vi.useFakeTimers();
    const { pubsub, key, run } = await registerLongRun('ownership-taken');
    pubsub.owners.set(key, 'elsewhere/other-run');
    const renew = vi.spyOn(pubsub, 'renewLease');

    await vi.advanceTimersByTimeAsync(LEASE_RENEW_INTERVAL_MS);
    renew.mockClear();
    await vi.advanceTimersByTimeAsync(LEASE_RENEW_INTERVAL_MS * 4);

    expect(renew).not.toHaveBeenCalled();
    expect(pubsub.owners.get(key)).toBe('elsewhere/other-run');
    run.finish();
  });

  it('does not re-acquire a lease the run released while a renewal was in flight', async () => {
    vi.useFakeTimers();
    const { pubsub, key, run } = await registerLongRun('ownership-release-race');
    let answerRenewal!: (renewed: boolean) => void;
    const renew = vi
      .spyOn(pubsub, 'renewLease')
      .mockImplementationOnce(() => new Promise<boolean>(resolve => (answerRenewal = resolve)));

    await vi.advanceTimersByTimeAsync(LEASE_RENEW_INTERVAL_MS);
    expect(renew).toHaveBeenCalledTimes(1);
    run.finish();
    await vi.waitFor(() => expect(pubsub.owners.has(key)).toBe(false));

    answerRenewal(false);
    await flush();
    await vi.advanceTimersByTimeAsync(LEASE_RENEW_INTERVAL_MS * 4);

    expect(pubsub.owners.has(key)).toBe(false);
  });

  it('releases held thread leases on shutdown', async () => {
    vi.useFakeTimers();
    const { runtime, pubsub, key, run, harness } = await registerLongRun('ownership-shutdown');
    const mastra = {};
    (harness.agent as any).getMastraInstance = () => mastra;
    expect(pubsub.owners.has(key)).toBe(true);
    const renew = vi.spyOn(pubsub, 'renewLease');

    await runtime.releaseHeldThreadLeases(mastra as any);

    expect(pubsub.owners.has(key)).toBe(false);
    renew.mockClear();
    await vi.advanceTimersByTimeAsync(LEASE_RENEW_INTERVAL_MS * 4);
    expect(renew).not.toHaveBeenCalled();
    run.finish();
  });

  it('announces run-suspended for a run parked on approval before releasing its lease', async () => {
    const harness = createHarness('ownership-shutdown-parked');
    const mastra = {};
    (harness.agent as any).getMastraInstance = () => mastra;
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const run = fakeRun(harness.runId);
    await runtime.registerRun(
      harness.agent,
      run.output,
      { memory: { thread: harness.threadId, resource: harness.resourceId } } as any,
      pubsub,
    );
    const thread = await collectThread(harness, runtime, pubsub);
    run.park();
    await vi.waitFor(() => expect(runtime.isRunParked(harness.runId, pubsub)).toBe(true));
    const publish = vi.spyOn(pubsub, 'publish');

    await runtime.releaseHeldThreadLeases(mastra as any);

    expect(publish.mock.calls.some(([, event]) => event.data?.type === 'run-suspended')).toBe(true);
    expect(pubsub.owners.has(key)).toBe(false);
    thread.subscription.unsubscribe();
    run.finish();
  });

  it("leaves another Mastra instance's thread leases alone on shutdown", async () => {
    vi.useFakeTimers();
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const register = async (prefix: string, mastra: object) => {
      const harness = createHarness(prefix);
      (harness.agent as any).getMastraInstance = () => mastra;
      const run = fakeRun(harness.runId);
      await runtime.registerRun(
        harness.agent,
        run.output,
        { memory: { thread: harness.threadId, resource: harness.resourceId } } as any,
        pubsub,
      );
      return { key: [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR), run };
    };
    const shuttingDown = {};
    const stillRunning = {};
    const mine = await register('ownership-shutdown-mine', shuttingDown);
    const theirs = await register('ownership-shutdown-theirs', stillRunning);
    const theirOwner = pubsub.owners.get(theirs.key)!;

    await runtime.releaseHeldThreadLeases(shuttingDown as any);

    expect(pubsub.owners.has(mine.key)).toBe(false);
    expect(pubsub.owners.get(theirs.key)).toBe(theirOwner);
    // Still renewed: the key survives well past its TTL.
    const renew = vi.spyOn(pubsub, 'renewLease');
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);
    expect(renew).toHaveBeenCalledWith(theirs.key, theirOwner, LEASE_TTL_MS);
    expect(pubsub.owners.get(theirs.key)).toBe(theirOwner);
    mine.run.finish();
    theirs.run.finish();
  });
});
