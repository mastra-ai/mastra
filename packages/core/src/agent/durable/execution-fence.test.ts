import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { NoopLeaseProvider } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import { RequestContext } from '../../request-context';
import { isRunFenceConflictError } from '../../storage';
import type { MemoryStorage, WorkflowsStorage } from '../../storage';
import { InMemoryStore } from '../../storage/mock';
import {
  __resetExecutionFencesForTests,
  assertExecutionOwned,
  DurableExecutionFenceError,
  EXECUTION_CONFLICT_ERROR_ID,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_LEASE_TTL_MS,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  executionLeaseKey,
  getExecutionClaim,
  getRunFence,
  isExecutionFenceError,
  setExecutionClaim,
  withExecutionFence,
} from './execution-fence';

const agentId = 'agent-1';
const key = (runId: string) => executionLeaseKey(agentId, runId);

function claim(leaseProvider: LeaseProvider, runId: string, mode: 'acquire' | 'takeover' = 'acquire') {
  return ExecutionFence.claim({ leaseProvider, agentId, runId, mode });
}

afterEach(() => {
  __resetExecutionFencesForTests();
  vi.useRealTimers();
});

describe('ExecutionFence.claim', () => {
  it('acquire conflicts while another execution holds the lease', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    await pubsub.acquireLease(key('run-1'), 'foreign', EXECUTION_LEASE_TTL_MS);

    const claiming = claim(pubsub, 'run-1').catch(error => error);
    // The claim waits out a short grace period for a settling owner first.
    await vi.advanceTimersByTimeAsync(6_000);
    const error = await claiming;

    expect(error.id).toBe(EXECUTION_CONFLICT_ERROR_ID);
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe('foreign');
  });

  it('acquire waits for a local execution of the same run to settle', async () => {
    const pubsub = new EventEmitterPubSub();
    const first = await claim(pubsub, 'run-1');

    const second = claim(pubsub, 'run-1');
    await first.settle(async () => {});

    const fence = await second;
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe(fence.executionId);
  });

  it('takeover transfers the lease from a foreign owner, whose renewals then fail', async () => {
    const pubsub = new EventEmitterPubSub();
    await pubsub.acquireLease(key('run-1'), 'foreign', EXECUTION_LEASE_TTL_MS);

    const fence = await claim(pubsub, 'run-1', 'takeover');

    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe(fence.executionId);
    expect(await pubsub.renewLease(key('run-1'), 'foreign', EXECUTION_LEASE_TTL_MS)).toBe(false);
  });

  it('takeover acquires a free lease', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1', 'takeover');
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe(fence.executionId);
  });

  it('a local takeover supersedes the local execution it replaces', async () => {
    const pubsub = new EventEmitterPubSub();
    const original = await claim(pubsub, 'run-1');
    const recovered = await claim(pubsub, 'run-1', 'takeover');

    await expect(original.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    await expect(recovered.verify()).resolves.toBeUndefined();
    expect(ExecutionFence.getLocalActive('run-1')).toBe(recovered);
  });
});

describe('ExecutionFence.verify', () => {
  it('throws SUPERSEDED when the lease belongs to someone else, and stays lost', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);

    await expect(fence.verify()).rejects.toBeInstanceOf(DurableExecutionFenceError);
    expect(fence.isLost()).toBe(true);

    // Getting the lease back does not revive a lost fence.
    await pubsub.transferLease(key('run-1'), 'foreign', fence.executionId, EXECUTION_LEASE_TTL_MS);
    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });

  it('retries a backend error once before reporting UNVERIFIED', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const renew = vi.spyOn(pubsub, 'renewLease').mockRejectedValue(new Error('redis down'));

    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    expect(renew).toHaveBeenCalledTimes(2);
  });

  it('passes when the backend error is transient', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    vi.spyOn(pubsub, 'renewLease').mockRejectedValueOnce(new Error('blip'));

    await expect(fence.verify()).resolves.toBeUndefined();
    expect(fence.isLost()).toBe(false);
  });
});

describe('ExecutionFence heartbeat', () => {
  it('renews the lease while the execution runs', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');

    // Well past one TTL: only heartbeats keep the lease alive.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);

    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe(fence.executionId);
    await expect(fence.verify()).resolves.toBeUndefined();
    await fence.settle(async () => {});
  });

  it('marks the fence lost when a renewal fails, without re-acquiring the lease', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    const acquire = vi.spyOn(pubsub, 'acquireLease');

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

    expect(fence.isLost()).toBe(true);
    expect(acquire).not.toHaveBeenCalled();
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe('foreign');
  });
});

describe('ExecutionFence.settle', () => {
  it('owned: runs the terminal writes and releases the lease', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const writes = vi.fn(async () => {});

    expect(await fence.settle(writes)).toBe('owned');
    expect(writes).toHaveBeenCalledOnce();
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();
    expect(ExecutionFence.getLocalActive('run-1')).toBeUndefined();
  });

  it('superseded: skips the writes and leaves the new owner holding the lease', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    const writes = vi.fn(async () => {});

    expect(await fence.settle(writes)).toBe('superseded');
    expect(writes).not.toHaveBeenCalled();
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe('foreign');
  });

  it('orphaned: skips the writes when the lease is gone but nobody replaced it', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.releaseLease(key('run-1'), fence.executionId);
    const writes = vi.fn(async () => {});

    expect(await fence.settle(writes)).toBe('orphaned');
    expect(writes).not.toHaveBeenCalled();
  });

  it('superseded: stays silent when the new owner already finished (seen by a check)', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    // The new owner completes and releases before this execution settles.
    await pubsub.releaseLease(key('run-1'), 'foreign');
    const writes = vi.fn(async () => {});

    expect(await fence.settle(writes)).toBe('superseded');
    expect(writes).not.toHaveBeenCalled();
  });

  it('superseded: stays silent when the new owner already finished (seen by the heartbeat)', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(fence.isLost()).toBe(true);
    await pubsub.releaseLease(key('run-1'), 'foreign');

    expect(await fence.settle(async () => {})).toBe('superseded');
  });

  it('settles once: later calls return the first outcome without writing again', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const first = vi.fn(async () => {
      throw new Error('write failed');
    });
    const second = vi.fn(async () => {});

    await expect(fence.settle(first)).rejects.toThrow('write failed');
    expect(await fence.settle(second)).toBe('owned');
    expect(second).not.toHaveBeenCalled();
    // The lease is released even though the writes threw.
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();
  });

  it('release does not take the lease from a new holder', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    // Force the release path: pretend the classification could not see the holder.
    vi.spyOn(pubsub, 'getLeaseOwner').mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    expect(await fence.settle(async () => {})).toBe('orphaned');
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe('foreign');
  });
});

describe('execution id carrier', () => {
  it('keeps the execution ids of different runs independent', () => {
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'parent-run', { executionId: 'exec-parent' });
    setExecutionClaim(requestContext, 'child-run', { executionId: 'exec-child' });

    expect(getExecutionClaim(requestContext, 'parent-run')?.executionId).toBe('exec-parent');
    expect(getExecutionClaim(requestContext, 'child-run')?.executionId).toBe('exec-child');
    expect(getExecutionClaim(requestContext, 'other-run')?.executionId).toBeUndefined();
  });
});

describe('assertExecutionOwned', () => {
  it('is a no-op for a run without an execution id', async () => {
    await expect(
      assertExecutionOwned({ runId: 'run-1', agentId, requestContext: new RequestContext(), mastra: undefined }),
    ).resolves.toBeUndefined();
  });

  it('always passes under NoopLeaseProvider', async () => {
    const fence = await claim(NoopLeaseProvider, 'run-1');
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: fence.executionId });

    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra: undefined })).resolves.toBe(
      undefined,
    );
  });

  it('verifies the local fence when this process drives the run', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: fence.executionId });

    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra: undefined })).resolves.toBe(
      undefined,
    );
    await pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    await expect(
      assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra: undefined }),
    ).rejects.toSatisfy(isExecutionFenceError);
  });

  it("renews through the agent's pubsub on a remote worker", async () => {
    const pubsub = new EventEmitterPubSub();
    await pubsub.acquireLease(key('run-1'), 'remote-exec', EXECUTION_LEASE_TTL_MS);
    const mastra = { getAgentById: () => ({ pubsub }), pubsub: undefined } as any;
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: 'remote-exec' });

    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra })).resolves.toBeUndefined();
    await pubsub.transferLease(key('run-1'), 'remote-exec', 'foreign', EXECUTION_LEASE_TTL_MS);
    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra })).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
  });
});

describe('withExecutionFence', () => {
  async function fencedParams() {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: fence.executionId });
    const params = {
      runId: 'nested-run',
      requestContext,
      mastra: undefined,
      getInitData: () => ({ runId: 'run-1', agentId }),
    };
    const supersede = () => pubsub.transferLease(key('run-1'), fence.executionId, 'foreign', EXECUTION_LEASE_TTL_MS);
    return { params, supersede };
  }

  it('skips the step when the execution was already superseded', async () => {
    const { params, supersede } = await fencedParams();
    const execute = vi.fn(async (_params: unknown) => 'output');
    const step = withExecutionFence({ id: 'llm', execute });

    await supersede();

    await expect(step.execute(params)).rejects.toSatisfy(isExecutionFenceError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails the step when the execution is superseded while it runs', async () => {
    const { params, supersede } = await fencedParams();
    const step = withExecutionFence({
      id: 'llm',
      execute: async (_params: unknown) => {
        await supersede();
        return 'output';
      },
    });

    await expect(step.execute(params)).rejects.toSatisfy(isExecutionFenceError);
  });

  it('returns the output and keeps the step shape while the execution owns the run', async () => {
    const { params } = await fencedParams();
    const step = withExecutionFence({
      id: 'llm',
      description: 'model call',
      execute: async (_params: unknown) => 'output',
    });

    expect(step.id).toBe('llm');
    expect(step.description).toBe('model call');
    await expect(step.execute(params)).resolves.toBe('output');
  });
});

describe('storage-backed ExecutionFence', () => {
  async function stores() {
    const storage = new InMemoryStore();
    const workflowsStore = (await storage.getStore('workflows')) as WorkflowsStorage;
    const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
    return { storage, workflowsStore, memoryStore };
  }

  function storageClaim(
    workflowsStore: WorkflowsStorage,
    runId: string,
    mode: 'acquire' | 'takeover' = 'acquire',
    leaseProvider: LeaseProvider = NoopLeaseProvider,
  ) {
    return ExecutionFence.claim({ leaseProvider, workflowsStore, agentId, runId, mode });
  }

  it('records ownership in the workflows store instead of the pubsub lease', async () => {
    const { workflowsStore } = await stores();
    const pubsub = new EventEmitterPubSub();
    const fence = await storageClaim(workflowsStore, 'run-1', 'acquire', pubsub);

    expect(fence.generation).toBe(1);
    expect(fence.claim).toEqual({ executionId: fence.executionId, generation: 1 });
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: 1,
      ownerId: fence.executionId,
      live: true,
    });
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();
    await fence.settle(async () => {});
  });

  it('acquire conflicts while another execution holds a live claim', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'foreign', leaseMs: EXECUTION_LEASE_TTL_MS });

    const claiming = storageClaim(workflowsStore, 'run-1').catch(error => error);
    await vi.advanceTimersByTimeAsync(6_000);
    const error = await claiming;

    expect(error.id).toBe(EXECUTION_CONFLICT_ERROR_ID);
    expect(error.details).toMatchObject({ holder: 'foreign' });
    expect((await workflowsStore.getRunOwnership({ runId: 'run-1' }))?.ownerId).toBe('foreign');
  });

  it('a released claim can be acquired again under the next generation', async () => {
    const { workflowsStore } = await stores();
    const first = await storageClaim(workflowsStore, 'run-1');
    // Suspended: the run is not finished, so its record is kept.
    await first.settle(async () => {});
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ generation: 1, ownerId: null });

    const second = await storageClaim(workflowsStore, 'run-1');
    expect(second.generation).toBe(2);
    await second.settle(async () => {});
  });

  it('takeover supersedes the current owner, whose checks and settlement then fail', async () => {
    const { workflowsStore } = await stores();
    const original = await storageClaim(workflowsStore, 'run-1');
    const recovered = await storageClaim(workflowsStore, 'run-1', 'takeover');

    expect(recovered.generation).toBe(2);
    await expect(original.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    await expect(recovered.verify()).resolves.toBeUndefined();

    const writes = vi.fn(async () => {});
    expect(await original.settle(writes, { finished: true })).toBe('superseded');
    expect(writes).not.toHaveBeenCalled();
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: 2,
      ownerId: recovered.executionId,
    });
    await recovered.settle(async () => {});
  });

  it('racing takeovers: one wins, the others get a typed conflict', async () => {
    const { workflowsStore } = await stores();
    const original = await storageClaim(workflowsStore, 'run-1');
    // Every takeover reads the current generation before any of them claims.
    const racers = 3;
    let reads = 0;
    let allRead!: () => void;
    const barrier = new Promise<void>(resolve => (allRead = resolve));
    const read = workflowsStore.getRunOwnership.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementation(async args => {
      const record = await read(args);
      if (++reads === racers) allRead();
      await barrier;
      return record;
    });

    const results = await Promise.allSettled(
      Array.from({ length: racers }, () => storageClaim(workflowsStore, 'run-1', 'takeover')),
    );
    vi.mocked(workflowsStore.getRunOwnership).mockRestore();

    const winners = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
    const losers = results.flatMap(result => (result.status === 'rejected' ? [result.reason] : []));
    expect(winners).toHaveLength(1);
    expect(winners[0]!.generation).toBe(2);
    expect(losers).toHaveLength(racers - 1);
    for (const error of losers) expect(error.id).toBe(EXECUTION_CONFLICT_ERROR_ID);
    await expect(winners[0]!.verify()).resolves.toBeUndefined();
    await expect(original.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    await winners[0]!.settle(async () => {});
  });

  it('orphaned: the claim was cleared but nobody claimed the run', async () => {
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    await workflowsStore.releaseRunOwnership({ runId: 'run-1', generation: 1, ownerId: fence.executionId });
    const writes = vi.fn(async () => {});

    expect(await fence.settle(writes)).toBe('orphaned');
    expect(writes).not.toHaveBeenCalled();
  });

  it('settling a finished run removes its owner records; a suspended run keeps them', async () => {
    const { workflowsStore, memoryStore } = await stores();
    const suspended = await storageClaim(workflowsStore, 'run-1');
    await suspended.coverMemory(memoryStore);
    expect(await suspended.settle(async () => {})).toBe('owned');
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ generation: 1, ownerId: null });
    // The kept memory record still rejects the settled claim's writes.
    await expect(
      memoryStore.saveThread({
        thread: { id: 't-1', resourceId: 'r-1', title: '', createdAt: new Date(), updatedAt: new Date() },
        fence: { runId: 'run-1', generation: 1, ownerId: suspended.executionId },
      }),
    ).rejects.toSatisfy(isRunFenceConflictError);

    const finished = await storageClaim(workflowsStore, 'run-1');
    await finished.coverMemory(memoryStore);
    expect(await finished.settle(async () => {}, { finished: true })).toBe('owned');
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toBeNull();
    expect(await memoryStore.raiseRunFence({ runId: 'run-1', generation: 1, ownerId: 'next' })).toBe(true);
  });

  it('coverMemory fences memory writes to the claim that raised it', async () => {
    const { workflowsStore, memoryStore } = await stores();
    const requestContext = new RequestContext();
    const original = await storageClaim(workflowsStore, 'run-1');
    await original.coverMemory(memoryStore);
    expect(original.claim).toEqual({ executionId: original.executionId, generation: 1, memoryFenced: true });
    setExecutionClaim(requestContext, 'run-1', original.claim);
    const staleFence = getRunFence(requestContext, 'run-1', 'memory');
    expect(staleFence).toEqual({ runId: 'run-1', generation: 1, ownerId: original.executionId });

    const recovered = await storageClaim(workflowsStore, 'run-1', 'takeover');
    await recovered.coverMemory(memoryStore);
    const thread = { id: 't-1', resourceId: 'r-1', title: '', createdAt: new Date(), updatedAt: new Date() };

    await expect(memoryStore.saveThread({ thread, fence: staleFence })).rejects.toSatisfy(isRunFenceConflictError);
    await expect(
      memoryStore.saveThread({
        thread,
        fence: { runId: 'run-1', generation: recovered.generation!, ownerId: recovered.executionId },
      }),
    ).resolves.toMatchObject({ id: 't-1' });
    await recovered.settle(async () => {});
  });

  it('coverMemory fails when a newer claim already raised memory', async () => {
    const { workflowsStore, memoryStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    await memoryStore.raiseRunFence({ runId: 'run-1', generation: 5, ownerId: 'newer' });

    await expect(fence.coverMemory(memoryStore)).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(fence.isLost()).toBe(true);
    expect(fence.claim.memoryFenced).toBeUndefined();
  });

  it('coverMemory is a no-op for a lease-backed claim', async () => {
    const { memoryStore } = await stores();
    const fence = await claim(new EventEmitterPubSub(), 'run-1');
    const raise = vi.spyOn(memoryStore, 'raiseRunFence');

    await fence.coverMemory(memoryStore);
    expect(raise).not.toHaveBeenCalled();
    expect(fence.claim).toEqual({ executionId: fence.executionId });
    expect(getRunFence(new RequestContext(), 'run-1', 'workflows')).toBeUndefined();
  });

  it('the heartbeat renews the claim in storage', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);

    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: fence.executionId,
      live: true,
    });
    expect(fence.isLost()).toBe(false);
    await fence.settle(async () => {});
  });

  it('the heartbeat marks the fence lost once another execution claims the run', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    await workflowsStore.claimRunOwnership({
      runId: 'run-1',
      ownerId: 'foreign',
      leaseMs: EXECUTION_LEASE_TTL_MS,
      force: true,
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

    expect(fence.isLost()).toBe(true);
    expect(await fence.settle(async () => {})).toBe('superseded');
    expect((await workflowsStore.getRunOwnership({ runId: 'run-1' }))?.ownerId).toBe('foreign');
  });

  it('a remote worker checks the claim against the workflows store', async () => {
    const { storage, workflowsStore } = await stores();
    const claimed = await workflowsStore.claimRunOwnership({
      runId: 'run-1',
      ownerId: 'remote-exec',
      leaseMs: EXECUTION_LEASE_TTL_MS,
    });
    const mastra = { getStorage: () => storage, getAgentById: () => undefined, pubsub: undefined } as any;
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: 'remote-exec', generation: claimed.record.generation });

    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra })).resolves.toBeUndefined();
    await workflowsStore.claimRunOwnership({
      runId: 'run-1',
      ownerId: 'foreign',
      leaseMs: EXECUTION_LEASE_TTL_MS,
      force: true,
    });
    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra })).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
  });
});

describe('execution claim carrier', () => {
  it('round-trips the claim and drops malformed entries', () => {
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: 'exec-1', generation: 3, memoryFenced: true });

    expect(getExecutionClaim(requestContext, 'run-1')).toEqual({
      executionId: 'exec-1',
      generation: 3,
      memoryFenced: true,
    });
    expect(getRunFence(requestContext, 'run-1', 'workflows')).toEqual({
      runId: 'run-1',
      generation: 3,
      ownerId: 'exec-1',
    });
    // Survives the JSON round trip an evented engine puts it through.
    const restored = new RequestContext(Object.entries(JSON.parse(JSON.stringify(requestContext.toJSON()))));
    expect(getRunFence(restored, 'run-1', 'memory')).toEqual({ runId: 'run-1', generation: 3, ownerId: 'exec-1' });

    requestContext.setRaw('mastra__durableExecutions', { 'run-2': 'legacy-string' });
    expect(getExecutionClaim(requestContext, 'run-2')).toBeUndefined();
  });
});

describe('isExecutionFenceError', () => {
  it('matches through the cause chain and serialized errors', () => {
    const fenceError = new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, {
      agentId,
      runId: 'run-1',
      executionId: 'exec',
    });
    expect(isExecutionFenceError(new Error('wrapped', { cause: fenceError }))).toBe(true);
    expect(isExecutionFenceError({ message: 'x', id: EXECUTION_UNVERIFIED_ERROR_ID })).toBe(true);
    // What a JSON pubsub transport delivers to a remote engine.
    expect(isExecutionFenceError(JSON.parse(JSON.stringify(fenceError)))).toBe(true);
    expect(isExecutionFenceError(new Error('other'))).toBe(false);
  });
});
