import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { NoopLeaseProvider } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import { RequestContext } from '../../request-context';
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
  getExecutionId,
  isExecutionFenceError,
  setExecutionId,
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
    setExecutionId(requestContext, 'parent-run', 'exec-parent');
    setExecutionId(requestContext, 'child-run', 'exec-child');

    expect(getExecutionId(requestContext, 'parent-run')).toBe('exec-parent');
    expect(getExecutionId(requestContext, 'child-run')).toBe('exec-child');
    expect(getExecutionId(requestContext, 'other-run')).toBeUndefined();
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
    setExecutionId(requestContext, 'run-1', fence.executionId);

    await expect(assertExecutionOwned({ runId: 'run-1', agentId, requestContext, mastra: undefined })).resolves.toBe(
      undefined,
    );
  });

  it('verifies the local fence when this process drives the run', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const requestContext = new RequestContext();
    setExecutionId(requestContext, 'run-1', fence.executionId);

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
    setExecutionId(requestContext, 'run-1', 'remote-exec');

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
    setExecutionId(requestContext, 'run-1', fence.executionId);
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
