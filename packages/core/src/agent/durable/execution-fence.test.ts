import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { NoopLeaseProvider } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import { MastraTimeoutError } from '../../loop/timeout';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { isRunFenceConflictError } from '../../storage';
import type { MemoryStorage, WorkflowsStorage } from '../../storage';
import { InMemoryStore } from '../../storage/mock';
import { PUBSUB_SYMBOL } from '../../workflows/constants';
import { Agent } from '../agent';
import { AGENT_STREAM_TOPIC } from '../streams/constants';
import { ensureRemoteAbortListener, publishAbortRequest } from './abort-transport';
import { createEventedAgent } from './create-evented-agent';
import {
  __resetExecutionFencesForTests,
  assertExecutionNotSuperseded,
  assertExecutionOwned,
  DURABLE_PARTICIPANT_FENCES,
  DurableExecutionFenceError,
  EXECUTION_ABANDONED_ERROR_ID,
  EXECUTION_CONFLICT_ERROR_ID,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_LEASE_TTL_MS,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  executionLeaseKey,
  fencePubSub,
  getExecutionClaim,
  getExecutionOwnershipGuard,
  getRunFence,
  isExecutionFenceError,
  setExecutionClaim,
  withExecutionFence,
} from './execution-fence';
import { ExecutionOwnershipGuard } from './execution-ownership-guard';
import {
  getExecutionStreamOwner,
  getExecutionStreamProducer,
  withExecutionStreamProducer,
} from './execution-stream-publisher';
import { deleteRunRegistryEntry, setRunRegistryEntry } from './run-registry';
import { getRunStreamPublisher } from './run-stream-publisher';
import type { RunRegistryEntry } from './types';

const agentId = 'agent-1';
const key = (runId: string) => executionLeaseKey(agentId, runId);

function claim(leaseProvider: LeaseProvider, runId: string, mode: 'acquire' | 'takeover' = 'acquire') {
  return ExecutionFence.claim({ leaseProvider, agentId, runId, mode });
}

afterEach(() => {
  __resetExecutionFencesForTests();
  vi.useRealTimers();
});

describe('execution publisher transport boundaries (COR-1560)', () => {
  it.each([false, true])(
    'resolves worker publishers without touching the native bus (inner registered=%s)',
    async registerInner => {
      const nativePubsub = new EventEmitterPubSub();
      const sharedPubsub = new EventEmitterPubSub();
      const inner = new Agent({
        id: agentId,
        name: agentId,
        instructions: 'Answer.',
        model: 'openai/gpt-4o-mini',
        durable: { pubsub: nativePubsub },
      });
      const agent = createEventedAgent({ agent: inner });
      const storage = new InMemoryStore();
      const mastra = new Mastra({
        agents: registerInner ? { inner, agent } : { agent },
        pubsub: sharedPubsub,
        storage,
        logger: false,
      });
      await storage.init();
      const runId = crypto.randomUUID();
      const fence = await ExecutionFence.claim({
        leaseProvider: sharedPubsub,
        workflowsStore: await storage.getStore('workflows'),
        agentId,
        runId,
        mode: 'acquire',
      });
      const nativeEvents: string[] = [];
      const sharedEvents: string[] = [];
      await nativePubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        nativeEvents.push(event.type);
      });
      await sharedPubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        sharedEvents.push(event.type);
      });
      const options = { runId, agentId, mastra, claim: fence.claim };
      const lifecycle = getExecutionStreamOwner({
        ...options,
        ...(registerInner ? { agent } : {}),
      })!;
      const producer = getExecutionStreamProducer(options)!;
      try {
        await lifecycle.ready;
        await producer.publishEvent({ type: 'iteration-start', runId, data: {} });
        expect(sharedEvents).toEqual(['iteration-start']);
        expect(nativeEvents).toEqual([]);
        expect(await agent.__getRunRecord(runId)).toMatchObject({ status: 'running', publisherId: fence.executionId });
        expect(await inner.__getRunRecord(runId)).toBeUndefined();
        await lifecycle.settle('finished');
        expect(await agent.__getRunRecord(runId)).toMatchObject({ status: 'finished', publisherId: fence.executionId });
        await lifecycle.cleanup();
        expect(await agent.__getRunRecord(runId)).toBeUndefined();
      } finally {
        await producer.detach();
        await lifecycle.detach();
        deleteRunRegistryEntry(runId, mastra);
      }
    },
  );

  it.each([false, true])('keeps the same step guard across publisher nesting (lost=%s)', async lost => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const runId = crypto.randomUUID();
    const fence = await claim(pubsub, runId);
    const agent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'Answer.',
      model: 'openai/gpt-4o-mini',
      durable: true,
    });
    const mastra = new Mastra({ agents: { agent }, pubsub, logger: false });
    const options = { runId, agentId, mastra, claim: fence.claim };
    const publisher = getExecutionStreamProducer(options)!;
    let reportLoss!: (error: DurableExecutionFenceError) => void;
    const guard = new ExecutionOwnershipGuard({
      observe: async () => {},
      details: { runId, agentId, executionId: fence.executionId },
      subscribe: listener => {
        reportLoss = listener;
        return () => {};
      },
    });
    const received: string[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event.type);
    });
    await pubsub.subscribe('other-topic', event => {
      received.push(event.type);
    });
    const step = fencePubSub(withExecutionStreamProducer(pubsub, options), guard);
    const nested = withExecutionStreamProducer(step, options);
    const checks = vi.spyOn(guard, 'isLost');
    const publications = vi.spyOn(publisher, 'publishEvent');
    try {
      if (lost) {
        reportLoss(
          new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, {
            runId,
            agentId,
            executionId: fence.executionId,
          }),
        );
      }
      expect(guard.isLost()).toBe(lost);
      expect(fence.isLost()).toBe(false);
      expect(await pubsub.getLeaseOwner(key(runId))).toBe(fence.executionId);
      checks.mockClear();
      await nested.publish(AGENT_STREAM_TOPIC(runId), { type: 'iteration-start', runId, data: {} });
      expect(received).toEqual(lost ? [] : ['iteration-start']);
      expect(publications).toHaveBeenCalledTimes(1);
      expect(checks).toHaveBeenCalledTimes(1);
      await nested.publish('other-topic', { type: 'other', runId, data: {} });
      expect(received).toEqual(lost ? [] : ['iteration-start', 'other']);
      // The fallback path must still delegate through the original fence.
      const fallback = withExecutionStreamProducer(step, { runId: `${runId}-fallback`, agentId });
      await pubsub.subscribe(AGENT_STREAM_TOPIC(`${runId}-fallback`), event => {
        received.push(event.type);
      });
      await fallback.publish(AGENT_STREAM_TOPIC(`${runId}-fallback`), { type: 'fallback', runId, data: {} });
      expect(received).toEqual(lost ? [] : ['iteration-start', 'other', 'fallback']);
      expect(checks).toHaveBeenCalledTimes(3);
    } finally {
      guard.dispose();
      await publisher.detach();
      deleteRunRegistryEntry(runId, mastra);
    }
  });

  it('handles publisher detachment failure during registry cleanup', async () => {
    const runId = crypto.randomUUID();
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({ pubsub, logger: false });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const entry = { isPlaceholder: true } as RunRegistryEntry;
    setRunRegistryEntry(runId, entry, mastra);
    const coordinator = getRunStreamPublisher(runId, entry, mastra);
    const error = new Error('Execution superseded');
    const owner = coordinator.attachOwner({
      pubsub,
      cleanupTimeoutMs: 0,
      listenForAbort: false,
      record: { cache: new InMemoryServerCache(), agentId },
      assertOwnership: async () => {
        throw error;
      },
    });
    await expect(owner.ready).rejects.toBe(error);
    deleteRunRegistryEntry(runId, mastra);
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(`[AgentStream:${runId}] failed to detach publisher`, { error });
    });
    warn.mockRestore();
    await pubsub.close();
  });

  it('drops queued direct-step events after their step guard is lost', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = crypto.randomUUID();
    const fence = await claim(pubsub, runId);
    const agent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'Answer.',
      model: 'openai/gpt-4o-mini',
      durable: true,
    });
    const mastra = new Mastra({ agents: { agent }, pubsub, logger: false });
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, runId, fence.claim);
    const received: string[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event.type);
    });
    const blocked = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const transport = new Proxy(pubsub, {
      get(target, property) {
        if (property === 'publish')
          return async (...args: Parameters<EventEmitterPubSub['publish']>) => {
            if (args[1].type === 'blocker') {
              entered.resolve();
              await blocked.promise;
            }
            return target.publish(...args);
          };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const step = withExecutionFence({
      id: 'queued-publication',
      execute: async (params: object & { [PUBSUB_SYMBOL]: EventEmitterPubSub }) => {
        const bus = params[PUBSUB_SYMBOL];
        const first = bus.publish(AGENT_STREAM_TOPIC(runId), { type: 'blocker', runId, data: {} });
        await entered.promise;
        const stale = bus.publish(AGENT_STREAM_TOPIC(runId), { type: 'stale-step', runId, data: {} });
        // Isolate step-observer loss from generation loss: the driver's claim remains current.
        vi.spyOn(getExecutionOwnershipGuard(params)!, 'isLost').mockReturnValue(true);
        blocked.resolve();
        await Promise.all([first, stale]);
      },
    });
    try {
      await step.execute({
        requestContext,
        mastra,
        getInitData: () => ({ runId, agentId }),
        [PUBSUB_SYMBOL]: transport,
      });
      await pubsub.flush();
      expect(received).toEqual(['blocker']);
    } finally {
      blocked.resolve();
      deleteRunRegistryEntry(runId, mastra);
    }
  });

  it('keeps local-only step events out of replay while recording ordinary events', async () => {
    const source = new EventEmitterPubSub();
    const pubsub = new CachingPubSub(source, new InMemoryServerCache());
    const runId = crypto.randomUUID();
    const fence = await claim(source, runId);
    const agent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'Answer.',
      model: 'openai/gpt-4o-mini',
      durable: true,
    });
    const mastra = new Mastra({ agents: { agent }, pubsub: source, logger: false });
    const bus = withExecutionStreamProducer(pubsub, { runId, agentId, mastra, claim: fence.claim });
    try {
      await bus.publish(AGENT_STREAM_TOPIC(runId), { type: 'local', runId, data: {} }, { localOnly: true });
      await bus.publish(AGENT_STREAM_TOPIC(runId), { type: 'shared', runId, data: {} });
      const history = await pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
      expect(history.map(event => event.type)).toEqual(['shared']);
    } finally {
      deleteRunRegistryEntry(runId, mastra);
      await source.close();
    }
  });

  it('keeps one ordered queue when a step wrapper appears after producer creation', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = crypto.randomUUID();
    const fence = await claim(pubsub, runId);
    const agent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'Answer.',
      model: 'openai/gpt-4o-mini',
      durable: true,
    });
    const mastra = new Mastra({ agents: { agent }, pubsub, logger: false });
    const options = { runId, agentId, mastra, claim: fence.claim };
    const publisher = getExecutionStreamProducer(options)!;
    const received: string[] = [];
    const ownerEvents: string[] = [];
    const stepEvents: string[] = [];
    const stepTransport = new EventEmitterPubSub();
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      ownerEvents.push(event.type);
      received.push(event.type);
    });
    await stepTransport.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      stepEvents.push(event.type);
      received.push(event.type);
    });
    const guard = new ExecutionOwnershipGuard({
      observe: async () => {},
      details: { runId, agentId, executionId: fence.executionId },
      subscribe: () => () => {},
    });
    try {
      const before = publisher.publishEvent({ type: 'before-wrapper', runId, data: {} }, pubsub);
      const step = withExecutionStreamProducer(
        fencePubSub(withExecutionStreamProducer(stepTransport, options), guard),
        options,
      );
      const after = step.publish(AGENT_STREAM_TOPIC(runId), { type: 'after-wrapper', runId, data: {} });
      const finish = step.publish(AGENT_STREAM_TOPIC(runId), { type: 'finish', runId, data: {} });
      await Promise.all([before, after, finish]);
      await publisher.detach();
      expect(received).toEqual(['before-wrapper', 'after-wrapper', 'finish']);
      expect(ownerEvents).toEqual(['before-wrapper']);
      expect(stepEvents).toEqual(['after-wrapper', 'finish']);
    } finally {
      guard.dispose();
      await publisher.detach();
      deleteRunRegistryEntry(runId, mastra);
    }
  });
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

  it('stops an execution after an event-loop pause outlives its lease without renewing or reacquiring it', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const renew = vi.spyOn(pubsub, 'renewLease');
    const acquire = vi.spyOn(pubsub, 'acquireLease');

    // Move wall time without running timers, as happens while the event loop is blocked.
    vi.setSystemTime(Date.now() + EXECUTION_LEASE_TTL_MS + 1);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

    expect(fence.isLost()).toBe(true);
    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    expect(renew).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
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

  // A released lease is gone, so a renewal that reaches the provider after settle() released it can't tell the
  // release from a takeover and still counts as a loss. Only storage run fencing can confirm the release. (#30206)
  it('still marks a lease-backed execution lost when a renewal returns false after it settled (#30206)', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const renew = pubsub.renewLease.bind(pubsub);
    let unblock!: () => void;
    const blocked = new Promise<void>(resolve => (unblock = resolve));
    let renewed: boolean | undefined;
    vi.spyOn(pubsub, 'renewLease').mockImplementationOnce(async (...args) => {
      await blocked;
      renewed = await renew(...args);
      return renewed;
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(await fence.settle(async () => {})).toBe('owned');
    const lost = vi.fn();
    fence.onLost(lost);
    unblock();
    await vi.advanceTimersByTimeAsync(0);

    expect(renewed).toBe(false);
    expect(fence.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledTimes(1);
    await pubsub.close();
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

describe('ExecutionFence.abandon', () => {
  it('stops the execution, releases the lease, and settles silently', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    const lost = vi.fn();
    fence.onLost(lost);

    await fence.abandon();

    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_ABANDONED_ERROR_ID }));
    expect(fence.isLost()).toBe(true);
    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_ABANDONED_ERROR_ID });
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();
    expect(ExecutionFence.getLocalActive('run-1')).toBeUndefined();
    const writes = vi.fn(async () => {});
    expect(await fence.settle(writes)).toBe('superseded');
    expect(writes).not.toHaveBeenCalled();
  });

  it('is a no-op once the execution settled', async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    expect(await fence.settle(async () => {})).toBe('owned');
    const next = await claim(pubsub, 'run-1');

    await fence.abandon();

    expect(fence.isLost()).toBe(false);
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBe(next.executionId);
    await next.settle(async () => {});
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

  describe('a run without an execution claim', () => {
    const runId = 'claimless-run';
    const withAbortReason = (reason: unknown) => {
      const controller = new AbortController();
      controller.abort(reason);
      setRunRegistryEntry(runId, { abortSignal: controller.signal } as unknown as RunRegistryEntry, undefined);
    };
    const assertOwned = () =>
      assertExecutionOwned({ runId, agentId, requestContext: new RequestContext(), mastra: undefined });

    afterEach(() => deleteRunRegistryEntry(runId, undefined));

    // The memory owner decided a run saves everything it did, even past its deadline.
    it('keeps ownership after its total timeout fires', async () => {
      withAbortReason(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 1_000 }));
      await expect(assertOwned()).resolves.toBeUndefined();
    });

    it('keeps ownership after an abort that is not a timeout', async () => {
      withAbortReason(new Error('user stopped the run'));
      await expect(assertOwned()).resolves.toBeUndefined();
    });

    it('keeps ownership without a registry entry', async () => {
      await expect(assertOwned()).resolves.toBeUndefined();
    });
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
    const mastra = new Mastra({ pubsub, logger: false });
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

  it('bounds worker admission when the first renewal never returns', async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore } = await stores();
    const coordinator = await storageClaim(workflowsStore, 'run-1');
    coordinator.stopHeartbeat();
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(() => new Promise(() => {}));
    const mastra = new Mastra({ storage });
    const admitted = ExecutionFence.follow(mastra, 'run-1', coordinator.claim).catch(error => error);

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + 1);

    expect(await admitted).toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
  });

  it('refuses worker admission for a claim a takeover has superseded', async () => {
    const { storage, workflowsStore } = await stores();
    const coordinator = await storageClaim(workflowsStore, 'run-1');
    coordinator.stopHeartbeat();
    const successor = await storageClaim(workflowsStore, 'run-1', 'takeover');
    const mastra = new Mastra({ storage });

    await expect(ExecutionFence.follow(mastra, 'run-1', coordinator.claim)).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
    await successor.settle(async () => {});
  });

  it('records ownership in the workflows store instead of the pubsub lease', async () => {
    const { workflowsStore } = await stores();
    const pubsub = new EventEmitterPubSub();
    const fence = await storageClaim(workflowsStore, 'run-1', 'acquire', pubsub);

    const generation = fence.generation;
    expect(generation).toBeTypeOf('number');
    expect(fence.claim).toEqual({ executionId: fence.executionId, agentId, generation });
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation,
      ownerId: fence.executionId,
      live: true,
    });
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();
    await fence.settle(async () => {});
  });

  it("fails, instead of using the pubsub lease, while the store can't tell whether it fences", async () => {
    const { workflowsStore } = await stores();
    const pubsub = new EventEmitterPubSub();
    vi.spyOn(workflowsStore, 'supportsRunFencing').mockRejectedValueOnce(new Error('probe failed'));

    await expect(storageClaim(workflowsStore, 'run-1', 'acquire', pubsub)).rejects.toThrow('probe failed');
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();

    const fence = await storageClaim(workflowsStore, 'run-1', 'acquire', pubsub);
    expect(fence.generation).toBeTypeOf('number');
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

  it('keeps a storage-backed run alive when a queued renewal eventually confirms the same owner (#28879)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let unblock!: () => void;
    const blocked = new Promise<void>(resolve => (unblock = resolve));
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
      await blocked;
      return renew(args);
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(fence.isLost()).toBe(false);

    unblock();
    await vi.advanceTimersByTimeAsync(0);
    await expect(fence.verify()).resolves.toBeUndefined();

    // The confirmed renewal must move the local deadline far enough for the run to keep renewing.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS);
    expect(fence.isLost()).toBe(false);
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: fence.executionId,
      live: true,
    });
    expect(await fence.settle(async () => {})).toBe('owned');
  });

  it('finishes a step whose ownership read outlasts the lease TTL while the claim keeps renewing', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', fence.claim);
    const read = workflowsStore.getRunOwnership.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementationOnce(async args => {
      await new Promise(resolve => setTimeout(resolve, EXECUTION_LEASE_TTL_MS + 1_000));
      return read(args);
    });
    const step = withExecutionFence({ id: 'llm', execute: async (_params: unknown) => 'output' });

    const settled = step
      .execute({
        runId: 'nested-run',
        requestContext,
        mastra: undefined,
        getInitData: () => ({ runId: 'run-1', agentId }),
      })
      .catch(error => error);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + 1_000);

    expect(await settled).toBe('output');
    expect(fence.isLost()).toBe(false);
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: fence.executionId,
      generation: fence.generation,
      live: true,
    });
    expect(await fence.settle(async () => {})).toBe('owned');
  });

  it.each(['before', 'after'] as const)(
    'ends a cancelled step whose ownership read %s its work never returns',
    async boundary => {
      vi.useFakeTimers();
      const { workflowsStore } = await stores();
      const fence = await storageClaim(workflowsStore, 'run-1');
      const requestContext = new RequestContext();
      setExecutionClaim(requestContext, 'run-1', fence.claim);
      const run = new AbortController();
      setRunRegistryEntry(
        'run-1',
        { abortController: run, abortSignal: run.signal } as unknown as RunRegistryEntry,
        undefined,
      );
      onTestFinished(() => deleteRunRegistryEntry('run-1', undefined));
      const read = vi.spyOn(workflowsStore, 'getRunOwnership');
      const hang = () => read.mockImplementationOnce(() => new Promise(() => {}));
      if (boundary === 'before') hang();
      const step = withExecutionFence({
        id: 'llm',
        // Durable steps read the run's signal from the registry and return their own abort output.
        execute: async (_params: unknown) => {
          if (run.signal.aborted) return 'aborted';
          if (boundary === 'after') hang();
          return 'output';
        },
      });

      let outcome: unknown = 'pending';
      const settled = step
        .execute({
          runId: 'nested-run',
          requestContext,
          mastra: undefined,
          getInitData: () => ({ runId: 'run-1', agentId }),
        })
        .then(
          value => (outcome = value),
          error => (outcome = error),
        );
      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      expect(outcome).toBe('pending');

      run.abort();
      await vi.advanceTimersByTimeAsync(0);

      expect(outcome).toBe(boundary === 'before' ? 'aborted' : 'output');
      await settled;
      expect(fence.isLost()).toBe(false);
      expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
        ownerId: fence.executionId,
        generation: fence.generation,
        live: true,
      });
      expect(await fence.settle(async () => {})).toBe('owned');
    },
  );

  describe('a step of an already-cancelled run', () => {
    async function cancelledStep() {
      vi.useFakeTimers();
      const { workflowsStore } = await stores();
      const fence = await storageClaim(workflowsStore, 'run-1');
      const requestContext = new RequestContext();
      setExecutionClaim(requestContext, 'run-1', fence.claim);
      const run = new AbortController();
      run.abort();
      setRunRegistryEntry(
        'run-1',
        { abortController: run, abortSignal: run.signal } as unknown as RunRegistryEntry,
        undefined,
      );
      onTestFinished(() => deleteRunRegistryEntry('run-1', undefined));
      const step = withExecutionFence({ id: 'llm', execute: async (_params: unknown) => 'aborted' });
      const execute = () =>
        step.execute({
          runId: 'nested-run',
          requestContext,
          mastra: undefined,
          getInitData: () => ({ runId: 'run-1', agentId }),
        });
      return { workflowsStore, fence, execute };
    }

    it('returns its abort output without waiting for the ownership read it started', async () => {
      const { workflowsStore, fence, execute } = await cancelledStep();
      const read = vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementation(() => new Promise(() => {}));

      await expect(execute()).resolves.toBe('aborted');
      expect(read).toHaveBeenCalled();
      expect(fence.isLost()).toBe(false);
    });

    it('notices a takeover from that read, before the next heartbeat', async () => {
      const { workflowsStore, fence, execute } = await cancelledStep();
      await workflowsStore.claimRunOwnership({
        runId: 'run-1',
        ownerId: 'successor',
        leaseMs: EXECUTION_LEASE_TTL_MS,
        force: true,
        expectedGeneration: fence.generation,
      });

      await execute().catch(() => {});
      await vi.advanceTimersByTimeAsync(0);

      expect(fence.isLost()).toBe(true);
      await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    });
  });

  it('ends a cancelled post-check on a worker whose step created the run registry entry', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const pubsub = new EventEmitterPubSub();
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', fence.claim);
    onTestFinished(() => deleteRunRegistryEntry('run-1', undefined));
    const read = vi.spyOn(workflowsStore, 'getRunOwnership');
    const step = withExecutionFence({
      id: 'llm',
      execute: async (_params: unknown) => {
        // Durable steps give a worker without a registry entry its own run controller as they start.
        await ensureRemoteAbortListener(pubsub, 'run-1');
        read.mockImplementationOnce(() => new Promise(() => {}));
        return 'output';
      },
    });

    let outcome: unknown = 'pending';
    const settled = step
      .execute({
        runId: 'nested-run',
        requestContext,
        mastra: undefined,
        getInitData: () => ({ runId: 'run-1', agentId }),
      })
      .then(
        value => (outcome = value),
        error => (outcome = error),
      );
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(outcome).toBe('pending');

    await publishAbortRequest(pubsub, 'run-1');
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toBe('output');
    await settled;
    expect(fence.isLost()).toBe(false);
  });

  it('marks the fence lost when a storage renewal never returns, so a recovered execution is not split-brain', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const lost = vi.fn();
    fence.onLost(lost);
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(() => new Promise(() => {}));

    // A pending renewal holds off expiry for one TTL past the lease deadline...
    await vi.advanceTimersByTimeAsync(2 * EXECUTION_LEASE_TTL_MS - EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(fence.isLost()).toBe(false);

    // ...and no longer.
    await vi.advanceTimersByTimeAsync(2 * EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(fence.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_UNVERIFIED_ERROR_ID }));

    const successor = await ExecutionFence.claim({
      leaseProvider: NoopLeaseProvider,
      workflowsStore,
      agentId,
      runId: 'run-1',
      mode: 'recover',
    });
    expect(successor.generation).toBe(fence.generation! + 1);
    expect(fence.isLost()).toBe(true);
    await successor.settle(async () => {});
  });

  it('does not outlive the lease the store granted when a renewal response arrives late', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    // The store extends the lease when the renewal runs; the response reaches the fence later. Later renewals fail.
    vi.spyOn(workflowsStore, 'renewRunOwnership')
      .mockImplementationOnce(async args => {
        const result = await renew(args);
        await new Promise(resolve => setTimeout(resolve, EXECUTION_LEASE_RENEW_INTERVAL_MS / 2));
        return result;
      })
      .mockRejectedValue(new Error('store unavailable'));

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + EXECUTION_LEASE_TTL_MS);
    expect((await workflowsStore.getRunOwnership({ runId: 'run-1' }))?.live).toBe(false);
    expect(fence.isLost()).toBe(true);
  });

  it('rejects a delayed renewal after another execution takes over (#28879)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let unblock!: () => void;
    const blocked = new Promise<void>(resolve => (unblock = resolve));
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
      await blocked;
      return renew(args);
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    const successor = await storageClaim(workflowsStore, 'run-1', 'takeover');
    const lost = vi.fn();
    fence.onLost(lost);
    unblock();
    await vi.advanceTimersByTimeAsync(0);

    // The renewal's own `false` result marks the fence lost, before any verify() read.
    expect(fence.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(await fence.settle(async () => {})).toBe('superseded');
    await successor.settle(async () => {});
  });

  // The renewal was sent before settle() released the claim and reached the store after it, so it renews nothing.
  // Nobody took the run over: the execution must not be marked lost. (#30206)
  it('ignores a renewal that comes back false after the execution settled and released its claim (#30206)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let unblock!: () => void;
    const blocked = new Promise<void>(resolve => (unblock = resolve));
    let renewed: boolean | undefined;
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
      await blocked;
      const result = await renew(args);
      renewed = result.renewed;
      return result;
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(await fence.settle(async () => {})).toBe('owned');
    const lost = vi.fn();
    fence.onLost(lost);
    unblock();
    await vi.advanceTimersByTimeAsync(0);

    expect(renewed).toBe(false);
    expect(fence.isLost()).toBe(false);
    expect(lost).not.toHaveBeenCalled();
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: fence.executionId,
      generation: fence.generation,
      leaseExpiresAt: null,
    });
  });

  it('still marks an execution lost when a takeover rejects its renewal while it settles (#30206)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let unblock!: () => void;
    const blocked = new Promise<void>(resolve => (unblock = resolve));
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
      await blocked;
      return renew(args);
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    let successor: ExecutionFence | undefined;
    let lostDuringWrites: boolean | undefined;
    const settled = fence.settle(async () => {
      // A takeover lands while the terminal writes run, before the claim is released.
      successor = await storageClaim(workflowsStore, 'run-1', 'takeover');
      unblock();
      await vi.advanceTimersByTimeAsync(0);
      lostDuringWrites = fence.isLost();
    });
    await settled;

    expect(lostDuringWrites).toBe(true);
    expect(fence.isLost()).toBe(true);
    await successor!.settle(async () => {});
  });

  // A failed renewal that reports no record can't show the run was released by this execution, so it counts as a loss,
  // as every failed renewal did before #30206. (#30206)
  it('still marks an execution lost when a failed renewal reports no ownership record (#30206)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const lost = vi.fn();
    fence.onLost(lost);
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockResolvedValueOnce({ renewed: false, record: null });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

    expect(fence.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
    fence.stopHeartbeat();
  });

  // A successor that took the run over and then released it leaves a record with no lease, as the execution's own
  // release would, but under the successor's owner and generation. That record is still a takeover. (#30206)
  it('marks an execution lost when a takeover already finished and released the run (#30206)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const lost = vi.fn();
    fence.onLost(lost);
    const successor = await storageClaim(workflowsStore, 'run-1', 'takeover');
    expect(await successor.settle(async () => {})).toBe('owned');
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: successor.executionId,
      generation: successor.generation,
      leaseExpiresAt: null,
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

    expect(fence.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
    fence.stopHeartbeat();
  });

  // Whether a failed renewal came from the execution's own release is decided by what the backend said about the
  // claim as it was released, never by when the renewal's response arrives. (#30206)
  it.each(['storage', 'lease'] as const)(
    'marks an execution lost when its renewal was rejected for a successor but returns only after the release (#30206, %s)',
    async backend => {
      vi.useFakeTimers();
      const { workflowsStore } = await stores();
      const pubsub = new EventEmitterPubSub();
      const fence = backend === 'storage' ? await storageClaim(workflowsStore, 'run-1') : await claim(pubsub, 'run-1');
      let takenOver!: () => void;
      const afterTakeover = new Promise<void>(resolve => (takenOver = resolve));
      let deliver!: () => void;
      const delivery = new Promise<void>(resolve => (deliver = resolve));
      let rejected!: (renewed: boolean) => void;
      const renewedAtBackend = new Promise<boolean>(resolve => (rejected = resolve));
      // Only the heartbeat's renewal is held: it reaches the backend after the takeover, and its response is
      // delivered after the release.
      if (backend === 'storage') {
        const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
        vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
          await afterTakeover;
          const result = await renew(args);
          rejected(result.renewed);
          await delivery;
          return result;
        });
      } else {
        const renew = pubsub.renewLease.bind(pubsub);
        vi.spyOn(pubsub, 'renewLease').mockImplementationOnce(async (...args) => {
          await afterTakeover;
          const renewed = await renew(...args);
          rejected(renewed);
          await delivery;
          return renewed;
        });
      }

      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      let successor: ExecutionFence | undefined;
      expect(
        await fence.settle(async () => {
          // A takeover lands while the terminal writes run, and the backend rejects the held renewal for it.
          if (backend === 'storage') successor = await storageClaim(workflowsStore, 'run-1', 'takeover');
          else await pubsub.transferLease(key('run-1'), fence.executionId, 'successor', EXECUTION_LEASE_TTL_MS);
          takenOver();
          expect(await renewedAtBackend).toBe(false);
        }),
      ).toBe('owned');
      const lost = vi.fn();
      fence.onLost(lost);
      deliver();
      await vi.advanceTimersByTimeAsync(0);

      expect(fence.isLost()).toBe(true);
      expect(lost).toHaveBeenCalledTimes(1);
      const published = vi.fn();
      await pubsub.subscribe('run-1-stream', published);
      await fencePubSub(pubsub, fence).publish('run-1-stream', { type: 'stale', runId: 'run-1', data: {} });
      await vi.advanceTimersByTimeAsync(0);
      expect(published).not.toHaveBeenCalled();
      await successor?.settle(async () => {});
      await pubsub.close();
    },
  );

  it('ignores a renewal that returns after the release even once the next execution claimed the run (#30206)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let unblock!: () => void;
    const blocked = new Promise<void>(resolve => (unblock = resolve));
    let renewed: boolean | undefined;
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
      await blocked;
      const result = await renew(args);
      renewed = result.renewed;
      return result;
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(await fence.settle(async () => {})).toBe('owned');
    // A resume claims the released run before the renewal reaches the store, which then reports the resume's claim.
    const next = await storageClaim(workflowsStore, 'run-1');
    unblock();
    await vi.advanceTimersByTimeAsync(0);

    expect(renewed).toBe(false);
    expect(fence.isLost()).toBe(false);
    await next.settle(async () => {});
  });

  // Another release of the same claim in this process: `shared`, a worker's releaseSharedClaim of the run it settled;
  // `sibling`, the coordinator settling while a participant fence still renews. The next execution claims the run
  // before the held renewal reaches the store, which then reports that claim. The release, not a takeover, explains
  // the failure, so this fence gets one renewal of grace; it never settled, so its next renewal reports the loss.
  // (#30206)
  it.each(['shared', 'sibling'] as const)(
    'gives a fence one renewal of grace when a %s release in this process lands before the next claim (#30206)',
    async path => {
      vi.useFakeTimers();
      const { storage, workflowsStore } = await stores();
      const mastra = new Mastra({ storage, logger: false });
      const coordinator = await storageClaim(workflowsStore, 'run-1');
      if (path === 'sibling') coordinator.stopHeartbeat();
      const fence = path === 'sibling' ? await ExecutionFence.follow(mastra, 'run-1', coordinator.claim) : coordinator;
      if (!fence) throw new Error('expected a participant fence for the claim');
      const lost = vi.fn();
      fence.onLost(lost);
      const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
      let deliver!: () => void;
      const delivery = new Promise<void>(resolve => (deliver = resolve));
      let renewed: boolean | undefined;
      vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
        await delivery;
        const result = await renew(args);
        renewed = result.renewed;
        return result;
      });

      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      if (path === 'shared') await ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
      else expect(await coordinator.settle(async () => {})).toBe('owned');
      const next = await storageClaim(workflowsStore, 'run-1');
      deliver();
      await vi.advanceTimersByTimeAsync(0);

      expect(renewed).toBe(false);
      expect(fence.isLost()).toBe(false);
      expect(lost).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      expect(fence.isLost()).toBe(true);
      expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
      fence.stopHeartbeat();
      await next.settle(async () => {});
    },
  );

  // A release that failed leaves the claim with this execution, so a renewal that succeeded still extends its lease.
  // `shared`: a worker's releaseSharedClaim; `sibling`: another fence of the execution in this process settled. (#30206)
  it.each([
    ['shared', 'rejects'],
    ['shared', 'returns false'],
    ['sibling', 'rejects'],
    ['sibling', 'returns false'],
  ] as const)(
    'keeps a fence healthy when a %s release %s and a held renewal then succeeds (#30206)',
    async (path, failure) => {
      vi.useFakeTimers();
      const { storage, workflowsStore } = await stores();
      const mastra = new Mastra({ storage, logger: false });
      const coordinator = await storageClaim(workflowsStore, 'run-1');
      let fence = coordinator;
      if (path === 'sibling') {
        coordinator.stopHeartbeat();
        fence = await ExecutionFence.follow(mastra, 'run-1', coordinator.claim);
      }
      const lost = vi.fn();
      fence.onLost(lost);
      const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
      let deliver!: () => void;
      const delivery = new Promise<void>(resolve => (deliver = resolve));
      let renewed: boolean | undefined;
      vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
        await delivery;
        const result = await renew(args);
        renewed = result.renewed;
        return result;
      });
      const release = vi.spyOn(workflowsStore, 'releaseRunOwnership');
      if (failure === 'rejects') release.mockRejectedValueOnce(new Error('store unavailable'));
      else release.mockResolvedValueOnce(false);

      const startedAt = Date.now();
      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      if (path === 'shared') {
        const released = ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
        if (failure === 'rejects') await expect(released).rejects.toThrow('store unavailable');
        else await released;
      } else {
        expect(await coordinator.settle(async () => {})).toBe('owned');
      }
      expect(release).toHaveBeenCalledTimes(1);
      // The held renewal comes back renewed just before the lease this fence knew of would have run out.
      await vi.advanceTimersByTimeAsync(startedAt + EXECUTION_LEASE_TTL_MS - 1 - Date.now());
      deliver();
      await vi.advanceTimersByTimeAsync(0);
      expect(renewed).toBe(true);
      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);

      expect(fence.isLost()).toBe(false);
      expect(lost).not.toHaveBeenCalled();
      expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
        ownerId: coordinator.executionId,
        generation: coordinator.generation,
        live: true,
      });
      expect(await fence.settle(async () => {})).toBe('owned');
    },
  );

  // The failed shared release must not hide the later one that did confirm the claim. (#30206)
  it('ignores a renewal that returns after a failed shared release and then a confirmed one (#30206)', async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore } = await stores();
    const mastra = new Mastra({ storage, logger: false });
    const fence = await storageClaim(workflowsStore, 'run-1');
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let deliver!: () => void;
    const delivery = new Promise<void>(resolve => (deliver = resolve));
    let renewed: boolean | undefined;
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
      await delivery;
      const result = await renew(args);
      renewed = result.renewed;
      return result;
    });
    vi.spyOn(workflowsStore, 'releaseRunOwnership').mockRejectedValueOnce(new Error('store unavailable'));

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    await expect(ExecutionFence.releaseSharedClaim(mastra, 'run-1', fence.claim, 'settled')).rejects.toThrow(
      'store unavailable',
    );
    expect(await fence.settle(async () => {})).toBe('owned');
    // A resume claims the released run before the held renewal reaches the store, which then reports the resume's claim.
    const next = await storageClaim(workflowsStore, 'run-1');
    deliver();
    await vi.advanceTimersByTimeAsync(0);

    expect(renewed).toBe(false);
    expect(fence.isLost()).toBe(false);
    await next.settle(async () => {});
  });

  // A worker abandoning a delivery releases the claim; when that release fails, the delivery is retried and can later
  // suspend the run normally. The failed abandoned release released nothing, so it must not take the grace the
  // suspension's release gives a participant whose renewal was in flight. `none` is the control without it. (#30206)
  it.each(['none', 'rejects', 'returns false'] as const)(
    'gives a participant its grace when the run suspends after an earlier abandoned release of its claim (%s) (#30206)',
    async abandonedRelease => {
      vi.useFakeTimers();
      const { storage, workflowsStore } = await stores();
      const mastra = new Mastra({ storage, logger: false });
      const coordinator = await storageClaim(workflowsStore, 'run-1');
      coordinator.stopHeartbeat();
      const participant = await ExecutionFence.follow(mastra, 'run-1', coordinator.claim);
      if (!participant) throw new Error('expected a participant fence for the claim');
      const lost = vi.fn();
      participant.onLost(lost);
      const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
      let deliver!: () => void;
      const delivery = new Promise<void>(resolve => (deliver = resolve));
      let renewed: boolean | undefined;
      vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
        await delivery;
        const result = await renew(args);
        renewed = result.renewed;
        return result;
      });

      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      if (abandonedRelease !== 'none') {
        const release = vi.spyOn(workflowsStore, 'releaseRunOwnership');
        if (abandonedRelease === 'rejects') release.mockRejectedValueOnce(new Error('store unavailable'));
        else release.mockResolvedValueOnce(false);
        const released = ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'abandoned');
        if (abandonedRelease === 'rejects') await expect(released).rejects.toThrow('store unavailable');
        else await released;
      }
      expect(await coordinator.settle(async () => {})).toBe('owned');
      expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
        ownerId: coordinator.executionId,
        generation: coordinator.generation,
        leaseExpiresAt: null,
      });
      deliver();
      await vi.advanceTimersByTimeAsync(0);

      expect(renewed).toBe(false);
      expect(participant.isLost()).toBe(false);
      expect(lost).not.toHaveBeenCalled();

      // The participant never settled, so its next renewal still reports the loss.
      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
    },
  );

  // A confirmed abandoned release leaves nothing to settle the run, so a participant's failed renewal is the loss even
  // when its response arrives before the release's own. (#30206)
  it('marks a participant lost at once when an abandoned release answers after its failed renewal (#30206)', async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore } = await stores();
    const mastra = new Mastra({ storage, logger: false });
    const coordinator = await storageClaim(workflowsStore, 'run-1');
    coordinator.stopHeartbeat();
    const participant = await ExecutionFence.follow(mastra, 'run-1', coordinator.claim);
    if (!participant) throw new Error('expected a participant fence for the claim');
    const lost = vi.fn();
    participant.onLost(lost);
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let deliverRenewal!: () => void;
    const renewalDelivery = new Promise<void>(resolve => (deliverRenewal = resolve));
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
      await renewalDelivery;
      return renew(args);
    });
    const release = workflowsStore.releaseRunOwnership.bind(workflowsStore);
    let releasedAtStore!: () => void;
    const atStore = new Promise<void>(resolve => (releasedAtStore = resolve));
    let deliverRelease!: () => void;
    const releaseDelivery = new Promise<void>(resolve => (deliverRelease = resolve));
    vi.spyOn(workflowsStore, 'releaseRunOwnership').mockImplementationOnce(async fence => {
      const released = await release(fence);
      releasedAtStore();
      await releaseDelivery;
      return released;
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    const abandoned = ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'abandoned');
    await atStore;
    deliverRenewal();
    await vi.advanceTimersByTimeAsync(0);
    deliverRelease();
    await abandoned;
    await vi.advanceTimersByTimeAsync(0);

    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
  });

  // A sibling's release that never answers must not stall this fence's heartbeat: a renewal that came back renewed
  // shows the claim is still held, so the lease is extended at once and the fence keeps renewing. (#30206)
  it('keeps renewing a participant whose claim has a release in flight that never answers (#30206)', async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore } = await stores();
    const mastra = new Mastra({ storage, logger: false });
    const coordinator = await storageClaim(workflowsStore, 'run-1');
    coordinator.stopHeartbeat();
    const participant = await ExecutionFence.follow(mastra, 'run-1', coordinator.claim);
    if (!participant) throw new Error('expected a participant fence for the claim');
    const lost = vi.fn();
    participant.onLost(lost);
    const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
    let deliver!: () => void;
    const delivery = new Promise<void>(resolve => (deliver = resolve));
    let renewed: boolean | undefined;
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
      await delivery;
      const result = await renew(args);
      renewed = result.renewed;
      return result;
    });

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    vi.spyOn(workflowsStore, 'releaseRunOwnership').mockImplementationOnce(() => new Promise<boolean>(() => {}));
    void ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    deliver();
    await vi.advanceTimersByTimeAsync(0);
    expect(renewed).toBe(true);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);

    expect(participant.isLost()).toBe(false);
    expect(lost).not.toHaveBeenCalled();
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: coordinator.executionId,
      generation: coordinator.generation,
      live: true,
    });
    expect(await participant.settle(async () => {})).toBe('owned');
  });

  // The same hung release must not hide a takeover: the failed renewal waits at most one renewal interval for the
  // release to answer, then reports the loss as a takeover. (#30206)
  it('reports a takeover within a renewal interval while a release of the claim never answers (#30206)', async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore } = await stores();
    const mastra = new Mastra({ storage, logger: false });
    const coordinator = await storageClaim(workflowsStore, 'run-1');
    coordinator.stopHeartbeat();
    const participant = await ExecutionFence.follow(mastra, 'run-1', coordinator.claim);
    if (!participant) throw new Error('expected a participant fence for the claim');
    const lost = vi.fn();
    participant.onLost(lost);

    vi.spyOn(workflowsStore, 'releaseRunOwnership').mockImplementationOnce(() => new Promise<boolean>(() => {}));
    void ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    const successor = await storageClaim(workflowsStore, 'run-1', 'takeover');
    // One interval brings the failed renewal, the next one bounds the wait for the release.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS * 2);

    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
    await successor.settle(async () => {});
  });

  // The error path of the same late renewal: one sent before settle() released the claim that fails with a backend
  // error only past the lease deadline. Before #30206 it marked the settled fence lost. (#30206)
  it('ignores a renewal that throws past the lease deadline after the execution settled and released (#30206)', async () => {
    vi.useFakeTimers();
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    let fail!: (error: Error) => void;
    const blocked = new Promise<never>((_, reject) => (fail = reject));
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async () => blocked);

    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(await fence.settle(async () => {})).toBe('owned');
    const lost = vi.fn();
    fence.onLost(lost);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS);
    fail(new Error('connection terminated'));
    await vi.advanceTimersByTimeAsync(0);

    expect(fence.isLost()).toBe(false);
    expect(lost).not.toHaveBeenCalled();
  });

  it('a released claim can be acquired again under the next generation', async () => {
    const { workflowsStore } = await stores();
    const first = await storageClaim(workflowsStore, 'run-1');
    await first.settle(async () => {});
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: first.generation,
      ownerId: first.executionId,
      leaseExpiresAt: null,
      live: false,
    });

    const second = await storageClaim(workflowsStore, 'run-1');
    expect(second.generation).toBe(first.generation! + 1);
    await second.settle(async () => {});
  });

  it('takeover supersedes the current owner, whose checks and settlement then fail', async () => {
    const { workflowsStore } = await stores();
    const original = await storageClaim(workflowsStore, 'run-1');
    const recovered = await storageClaim(workflowsStore, 'run-1', 'takeover');

    expect(recovered.generation).toBe(original.generation! + 1);
    await expect(original.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    await expect(recovered.verify()).resolves.toBeUndefined();

    const writes = vi.fn(async () => {});
    expect(await original.settle(writes)).toBe('superseded');
    expect(original.ownsRunTopics()).toBe(false);
    expect(recovered.ownsRunTopics()).toBe(true);
    expect(writes).not.toHaveBeenCalled();
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: recovered.generation,
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
    expect(winners[0]!.generation).toBe(original.generation! + 1);
    expect(losers).toHaveLength(racers - 1);
    for (const error of losers) expect(error.id).toBe(EXECUTION_CONFLICT_ERROR_ID);
    await expect(winners[0]!.verify()).resolves.toBeUndefined();
    await expect(original.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    await winners[0]!.settle(async () => {});
  });

  it('orphaned: the claim was cleared but nobody claimed the run', async () => {
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    await workflowsStore.releaseRunOwnership({
      runId: 'run-1',
      generation: fence.generation!,
      ownerId: fence.executionId,
    });
    const writes = vi.fn(async () => {});

    expect(await fence.settle(writes)).toBe('orphaned');
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['owned', 'orphaned'])(
    'interrupted %s settlement rejects late tool writes before terminal cleanup',
    async state => {
      const { workflowsStore, memoryStore } = await stores();
      const fence = await storageClaim(workflowsStore, 'run-1');
      await fence.coverMemory(memoryStore);
      if (state === 'orphaned') {
        await workflowsStore.releaseRunOwnership({
          runId: 'run-1',
          generation: fence.generation!,
          ownerId: fence.executionId,
        });
      }
      const thread = { id: 't-1', resourceId: 'r-1', title: '', createdAt: new Date(), updatedAt: new Date() };
      const staleFence = { runId: 'run-1', generation: fence.generation!, ownerId: fence.executionId };
      const terminalWrite = vi.fn(async () => {
        expect(fence.isLost()).toBe(true);
        // The old tool is already fenced out while terminal cleanup is awaiting I/O.
        await expect(memoryStore.saveThread({ thread, fence: staleFence })).rejects.toSatisfy(isRunFenceConflictError);
        await memoryStore.saveThread({ thread });
        expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ live: true });
      });

      expect(await fence.settle(terminalWrite, true)).toBe('owned');
      await fence.whenSettled;
      expect(terminalWrite).toHaveBeenCalledTimes(1);
      expect(fence.isLost()).toBe(true);
      expect(fence.ownsRunTopics()).toBe(true);
      expect(ExecutionFence.getLocalActive('run-1')).toBeUndefined();
      await expect(memoryStore.saveThread({ thread, fence: staleFence })).rejects.toSatisfy(isRunFenceConflictError);
      expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ live: false });

      const next = await storageClaim(workflowsStore, 'run-1');
      await next.coverMemory(memoryStore);
      await fence.settle(terminalWrite, true);
      expect(terminalWrite).toHaveBeenCalledTimes(1);
      await expect(next.verify()).resolves.toBeUndefined();
      await next.settle(async () => {});
    },
  );

  it("settling keeps the owner records: the settled claim's late writes land until the run is claimed again", async () => {
    const { workflowsStore, memoryStore } = await stores();
    const settled = await storageClaim(workflowsStore, 'run-1');
    await settled.coverMemory(memoryStore);
    const retire = vi.spyOn(memoryStore, 'retireRunFence');
    expect(await settled.settle(async () => {})).toBe('owned');
    // Retired for retention, still the run's fence.
    expect(retire).toHaveBeenCalledWith({
      runId: 'run-1',
      generation: settled.generation,
      ownerId: settled.executionId,
    });
    await expect(retire.mock.results[0]!.value).resolves.toBe(true);
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: settled.generation,
      ownerId: settled.executionId,
      live: false,
    });
    const thread = { id: 't-1', resourceId: 'r-1', title: '', createdAt: new Date(), updatedAt: new Date() };
    const settledFence = { runId: 'run-1', generation: settled.generation!, ownerId: settled.executionId };
    await expect(memoryStore.saveThread({ thread, fence: settledFence })).resolves.toMatchObject({ id: 't-1' });

    const next = await storageClaim(workflowsStore, 'run-1');
    await next.coverMemory(memoryStore);
    await expect(memoryStore.saveThread({ thread, fence: settledFence })).rejects.toSatisfy(isRunFenceConflictError);
    expect(await next.settle(async () => {})).toBe('owned');
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: settled.generation! + 1,
      ownerId: next.executionId,
    });
  });

  it('coverMemory fences memory writes to the claim that raised it', async () => {
    const { workflowsStore, memoryStore } = await stores();
    const requestContext = new RequestContext();
    const original = await storageClaim(workflowsStore, 'run-1');
    await original.coverMemory(memoryStore);
    expect(original.claim).toEqual({
      executionId: original.executionId,
      agentId,
      generation: original.generation,
      memoryFenced: true,
    });
    setExecutionClaim(requestContext, 'run-1', original.claim);
    const staleFence = getRunFence(requestContext, 'run-1', 'memory');
    expect(staleFence).toEqual({ runId: 'run-1', generation: original.generation, ownerId: original.executionId });

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
    await memoryStore.raiseRunFence({ runId: 'run-1', generation: fence.generation! + 1, ownerId: 'newer' });

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
    expect(fence.claim).toEqual({ executionId: fence.executionId, agentId });
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
    const mastra = new Mastra({ storage, logger: false });
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', { executionId: 'remote-exec', generation: claimed.record!.generation });

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

  it("accepts a settled execution's late writes until another execution claims the run", async () => {
    const { storage, workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const mastra = new Mastra({ storage, logger: false });
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', fence.claim);
    const args = { runId: 'run-1', agentId, requestContext, mastra };

    expect(await fence.settle(async () => {})).toBe('owned');
    await expect(assertExecutionOwned(args)).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    await expect(assertExecutionNotSuperseded(args)).resolves.toBeUndefined();

    await storageClaim(workflowsStore, 'run-1');
    await expect(assertExecutionNotSuperseded(args)).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });

  it('covers the workflows rows of runs nested under the run, which storage checks against the run claim', async () => {
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    const runFence = { runId: 'run-1', generation: fence.generation, ownerId: fence.executionId };

    fence.coverNestedRun('run-1', 'child');
    fence.coverNestedRun('child', 'grandchild');
    fence.coverNestedRun('run-2', 'unrelated');

    expect(fence.fenceFor(workflowsStore, 'child')).toEqual(runFence);
    expect(fence.fenceFor(workflowsStore, 'grandchild')).toEqual(runFence);
    expect(fence.fenceFor(workflowsStore, 'unrelated')).toBeUndefined();

    await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'foreign', leaseMs: 60_000, force: true });
    await expect(
      fence.run(() =>
        workflowsStore.updateWorkflowState({ workflowName: 'nested', runId: 'grandchild', opts: { status: 'failed' } }),
      ),
    ).rejects.toSatisfy(isRunFenceConflictError);
    expect(await fence.settle(async () => {})).toBe('superseded');
  });

  it('abandon moves the run past the execution and releases it: stale writes fail, recovery claims it at once', async () => {
    const { workflowsStore, memoryStore } = await stores();
    const abandoned = await storageClaim(workflowsStore, 'run-1');
    await abandoned.coverMemory(memoryStore);
    const staleFence = { runId: 'run-1', generation: abandoned.generation!, ownerId: abandoned.executionId };
    const retire = vi.spyOn(memoryStore, 'retireRunFence');

    await abandoned.abandon();

    const record = await workflowsStore.getRunOwnership({ runId: 'run-1' });
    expect(record).toMatchObject({ generation: abandoned.generation! + 1, leaseExpiresAt: null, live: false });
    expect(record?.ownerId).not.toBe(abandoned.executionId);
    // Nothing runs under the successor fence, so it is retired right away.
    expect(retire).toHaveBeenCalledExactlyOnceWith({
      runId: 'run-1',
      generation: record!.generation,
      ownerId: record!.ownerId,
    });
    await expect(
      workflowsStore.updateWorkflowState({
        workflowName: 'wf',
        runId: 'run-1',
        opts: { status: 'failed' },
        fence: staleFence,
      }),
    ).rejects.toSatisfy(isRunFenceConflictError);
    const thread = { id: 't-1', resourceId: 'r-1', title: '', createdAt: new Date(), updatedAt: new Date() };
    await expect(memoryStore.saveThread({ thread, fence: staleFence })).rejects.toSatisfy(isRunFenceConflictError);
    expect(await abandoned.settle(async () => {})).toBe('superseded');

    // No untracked liveness check runs for a run with an owner record.
    const untrackedRun = { isLive: vi.fn(async () => true), ttlMs: 15_000 };
    const recovered = await ExecutionFence.claim({
      leaseProvider: NoopLeaseProvider,
      workflowsStore,
      agentId,
      runId: 'run-1',
      mode: 'recover',
      untrackedRun,
    });
    expect(recovered.generation).toBe(abandoned.generation! + 2);
    expect(untrackedRun.isLive).not.toHaveBeenCalled();
    await recovered.coverMemory(memoryStore);
    await recovered.settle(async () => {});
  });

  it('abandon leaves a run that was already taken over to its new owner', async () => {
    const { workflowsStore } = await stores();
    const original = await storageClaim(workflowsStore, 'run-1');
    const recovered = await storageClaim(workflowsStore, 'run-1', 'takeover');

    await original.abandon();

    expect(original.isLost()).toBe(true);
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: recovered.generation,
      ownerId: recovered.executionId,
      live: true,
    });
    await expect(recovered.verify()).resolves.toBeUndefined();
    await recovered.settle(async () => {});
  });

  it('abandon still stops and settles the execution when storage fails', async () => {
    const { workflowsStore } = await stores();
    const fence = await storageClaim(workflowsStore, 'run-1');
    vi.spyOn(workflowsStore, 'claimRunOwnership').mockRejectedValueOnce(new Error('connection closed'));

    await expect(fence.abandon()).resolves.toBeUndefined();

    expect(fence.isLost()).toBe(true);
    expect(ExecutionFence.getLocalActive('run-1')).toBeUndefined();
    expect(await fence.settle(async () => {})).toBe('superseded');
    // The claim stays until it expires.
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      generation: fence.generation,
      ownerId: fence.executionId,
      live: true,
    });
  });
});

/**
 * Make the next call of `method` on `target` apply (unless `apply` is false), then wait for `finish()`
 * before returning or, with `fail`, throwing: a release storage has applied but not yet confirmed, or
 * one whose confirmation is lost.
 */
function holdNextCall<T extends object, K extends keyof T & string>(
  target: T,
  method: K,
  { apply, fail }: { apply: boolean; fail: boolean },
) {
  const original = (target[method] as (...args: unknown[]) => Promise<unknown>).bind(target);
  let signalApplied!: () => void;
  const applied = new Promise<void>(resolve => (signalApplied = resolve));
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  vi.spyOn(target, method as never).mockImplementationOnce((async (...args: unknown[]) => {
    const result = apply ? await original(...args) : undefined;
    signalApplied();
    await finished;
    if (fail) throw new Error('backend down');
    return result;
  }) as never);
  return { applied, finish };
}

// A background task can write after its run settled: `verifyNotSuperseded` is the check for those
// writes. With ownership in storage it only refuses once another execution claimed the run, released
// or lapsed or not, and never waits for a release in flight. A lease keeps nothing once released, so it
// can't tell this claim's release from another execution that claimed and released the run since: a
// lease-backed claim always gets `verify`'s rule, as before this check existed (#30182).
describe.each([
  {
    backend: 'storage',
    async setup() {
      const storage = new InMemoryStore();
      const workflowsStore = (await storage.getStore('workflows')) as WorkflowsStorage;
      const fence = await ExecutionFence.claim({
        leaseProvider: NoopLeaseProvider,
        workflowsStore,
        agentId,
        runId: 'run-1',
        mode: 'acquire',
      });
      const own = { runId: 'run-1', generation: fence.generation!, ownerId: fence.executionId };
      return {
        fence,
        // Storage keeps the claim's generation: a lapse or a release it didn't see still accepts the write.
        storageBacked: true,
        dropClaim: async () => void (await workflowsStore.releaseRunOwnership(own)),
        // The store lost the claim's record: nobody can say who holds the run.
        loseClaim: () => workflowsStore.dangerouslyClearAll(),
        failRenewals: () =>
          vi.spyOn(workflowsStore, 'renewRunOwnership').mockRejectedValue(new Error('store unreachable')),
        claimSuccessor: async () =>
          void (await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'successor', leaseMs: 60_000 })),
        takeOver: async () =>
          void (await workflowsStore.claimRunOwnership({
            runId: 'run-1',
            ownerId: 'successor',
            leaseMs: 60_000,
            force: true,
          })),
        failNextRelease: () =>
          vi.spyOn(workflowsStore, 'releaseRunOwnership').mockRejectedValueOnce(new Error('store down')),
        holdNextRelease: ({ fail = false } = {}) =>
          holdNextCall(workflowsStore, 'releaseRunOwnership', { apply: !fail, fail }),
      };
    },
  },
  {
    backend: 'lease',
    async setup() {
      const pubsub = new EventEmitterPubSub();
      const fence = await claim(pubsub, 'run-1');
      return {
        fence,
        storageBacked: false,
        dropClaim: () => pubsub.releaseLease(key('run-1'), fence.executionId),
        loseClaim: () => pubsub.releaseLease(key('run-1'), fence.executionId),
        failRenewals: () => vi.spyOn(pubsub, 'renewLease').mockRejectedValue(new Error('redis unreachable')),
        claimSuccessor: async () => void (await pubsub.acquireLease(key('run-1'), 'successor', EXECUTION_LEASE_TTL_MS)),
        takeOver: async () =>
          void (await pubsub.transferLease(key('run-1'), fence.executionId, 'successor', EXECUTION_LEASE_TTL_MS)),
        failNextRelease: () => vi.spyOn(pubsub, 'releaseLease').mockRejectedValueOnce(new Error('redis down')),
        holdNextRelease: ({ fail = false } = {}) => holdNextCall(pubsub, 'releaseLease', { apply: !fail, fail }),
      };
    },
  },
])('ExecutionFence.verifyNotSuperseded ($backend)', ({ setup }) => {
  it('before settlement, passes while owned; after the claim expired, passes only when storage holds the claim', async () => {
    vi.useFakeTimers();
    const { fence, failRenewals, claimSuccessor, storageBacked } = await setup();
    await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();

    // Renewals can't reach the backend until the claim's lease runs out.
    failRenewals();
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(fence.isLost()).toBe(true);
    if (storageBacked) {
      // Nobody claimed the run, so storage would still accept the claim's write.
      await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();
      await claimSuccessor();
      await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    } else {
      // A missing lease may be one another execution claimed and released: verify's rule.
      await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    }
  });

  it('after settlement released the claim, passes only when storage holds the claim', async () => {
    const { fence, storageBacked } = await setup();
    expect(await fence.settle(async () => {})).toBe('owned');

    await expect(fence.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    if (storageBacked) {
      await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();
    } else {
      // The released lease looks like one another execution claimed and released since: verify's rule.
      await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    }
  });

  it('after settlement released the claim, refuses once another execution claimed the run', async () => {
    const { fence, claimSuccessor } = await setup();
    expect(await fence.settle(async () => {})).toBe('owned');

    await claimSuccessor();
    await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });

  it('stays strict when settlement failed to release the claim', async () => {
    const { fence, loseClaim, failNextRelease } = await setup();
    failNextRelease();
    expect(await fence.settle(async () => {})).toBe('owned');
    // The claim is still held, so the check passes as verify would.
    await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();

    // The unreleased claim is gone and nothing shows who holds the run now: storage lost the record,
    // and a lease without a release here gets verify's rule.
    await loseClaim();
    await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(fence.isLost()).toBe(true);
  });

  it("while settlement is releasing the claim, answers without waiting for the release's reply", async () => {
    const { fence, holdNextRelease, storageBacked } = await setup();
    const release = holdNextRelease();
    const settled = fence.settle(async () => {});
    await release.applied;

    // The backend already shows the claim released and its reply is still held, as on a stalled
    // connection: the check doesn't wait for the reply.
    if (storageBacked) {
      // No other execution claimed the run, so storage would still accept the write.
      await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();
      expect(fence.isLost()).toBe(false);
    } else {
      // The empty lease can't show whose release emptied it: verify's rule.
      await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    }
    release.finish();
    expect(await settled).toBe('owned');
  });

  it('while settlement is releasing the claim, refuses once another execution claimed the run', async () => {
    const { fence, holdNextRelease, claimSuccessor } = await setup();
    const release = holdNextRelease();
    const settled = fence.settle(async () => {});
    await release.applied;
    await claimSuccessor();

    await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    release.finish();
    await settled;
  });

  it('once the release in flight fails, passes only while storage holds the claim', async () => {
    const { fence, dropClaim, holdNextRelease, storageBacked } = await setup();
    // The claim was released already, as another worker would; settlement still tries to release it.
    await dropClaim();
    const release = holdNextRelease({ fail: true });
    const settled = fence.settle(async () => {});
    await release.applied;
    if (storageBacked) {
      // Storage still holds this claim's generation, released: no other execution took the run.
      await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();
    } else {
      // A missing lease may be one another execution claimed and released: verify's rule.
      await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
      expect(fence.isLost()).toBe(true);
    }
    release.finish();
    await settled;

    if (storageBacked) {
      await expect(fence.verifyNotSuperseded()).resolves.toBeUndefined();
    } else {
      await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    }
  });

  it('refuses after settling as superseded', async () => {
    const { fence, takeOver } = await setup();
    await takeOver();
    expect(await fence.settle(async () => {})).toBe('superseded');

    await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });
});

// A worker's participant fence on a lease gets `verify`'s rule too: its own shared release leaves the
// same empty lease another execution's claim and release would (#30182).
describe('ExecutionFence.verifyNotSuperseded on a lease-backed participant', () => {
  async function setup() {
    const pubsub = new EventEmitterPubSub();
    const coordinator = await claim(pubsub, 'run-1');
    coordinator.stopHeartbeat();
    const mastra = new Mastra({ pubsub, logger: false });
    const participant = (await ExecutionFence.follow(mastra, 'run-1', coordinator.claim))!;
    onTestFinished(() => participant.stopHeartbeat());
    mastra.__createRunScope('run-1').set(DURABLE_PARTICIPANT_FENCES, new Map([[coordinator.executionId, participant]]));
    return { pubsub, mastra, coordinator, participant };
  }

  it("refuses while this worker's shared release is in flight, without waiting for its reply", async () => {
    const { pubsub, mastra, coordinator, participant } = await setup();
    const release = holdNextCall(pubsub, 'releaseLease', { apply: true, fail: false });
    const releasing = ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    await release.applied;
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();

    await expect(participant.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    release.finish();
    await releasing;
  });

  it("refuses once another execution took the lease after this worker's shared release", async () => {
    const { pubsub, mastra, coordinator, participant } = await setup();
    await ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    await pubsub.acquireLease(key('run-1'), 'successor', EXECUTION_LEASE_TTL_MS);

    await expect(participant.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });
});

// A lease has no generation and no storage fence behind the check: once another execution claimed and
// released the run, the lease looks exactly as it would after this execution's own release. A late write
// that passed would land on the other execution's finished run unfenced (#30182).
describe('ExecutionFence.verifyNotSuperseded on a lease another execution claimed and released', () => {
  it('refuses a late write after a recovery claimed the lapsed lease and released it', async () => {
    vi.useFakeTimers();
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    // Renewals can't reach the lease provider until the lease runs out, as a dropped connection would.
    const renewals = vi.spyOn(pubsub, 'renewLease').mockRejectedValue(new Error('redis unreachable'));
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(fence.isLost()).toBe(true);
    renewals.mockRestore();

    // Another process recovers the run, finishes it and releases the lease.
    expect((await pubsub.acquireLease(key('run-1'), 'recovery', EXECUTION_LEASE_TTL_MS)).acquired).toBe(true);
    await pubsub.releaseLease(key('run-1'), 'recovery');
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();

    await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
  });

  it("refuses a late write after a recovery claimed and released the run while this execution's release reply was held", async () => {
    const pubsub = new EventEmitterPubSub();
    const fence = await claim(pubsub, 'run-1');
    // This execution's release reaches the provider, but its reply stalls, as on a slow connection.
    const release = holdNextCall(pubsub, 'releaseLease', { apply: true, fail: false });
    const settled = fence.settle(async () => {});
    await release.applied;

    // Meanwhile another process recovers the run, finishes it and releases the lease.
    expect((await pubsub.acquireLease(key('run-1'), 'recovery', EXECUTION_LEASE_TTL_MS)).acquired).toBe(true);
    await pubsub.releaseLease(key('run-1'), 'recovery');
    expect(await pubsub.getLeaseOwner(key('run-1'))).toBeUndefined();

    await expect(fence.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    release.finish();
    await settled;
  });
});

// Storage keeps a released or lapsed claim's record and generation, so a late write is checked against
// the store, not against what this fence saw: a release made by another process, one storage applied but
// whose response was lost, or a lapse. Only another execution's claim refuses it (#30182).
describe('ExecutionFence.verifyNotSuperseded with ownership in storage', () => {
  async function setup() {
    const storage = new InMemoryStore();
    const workflowsStore = (await storage.getStore('workflows')) as WorkflowsStorage;
    const coordinator = await ExecutionFence.claim({
      leaseProvider: NoopLeaseProvider,
      workflowsStore,
      agentId,
      runId: 'run-1',
      mode: 'acquire',
    });
    const own = { runId: 'run-1', generation: coordinator.generation!, ownerId: coordinator.executionId };
    const claimSuccessor = () =>
      workflowsStore.claimRunOwnership({
        runId: 'run-1',
        ownerId: 'successor',
        leaseMs: 60_000,
        expectedGeneration: own.generation,
      });
    return { storage, workflowsStore, coordinator, own, claimSuccessor };
  }

  it("passes on a worker's participant fence once another process released the shared claim", async () => {
    const { storage, workflowsStore, coordinator, own, claimSuccessor } = await setup();
    coordinator.stopHeartbeat();
    const mastra = new Mastra({ storage, logger: false });
    const participant = (await ExecutionFence.follow(mastra, 'run-1', coordinator.claim))!;
    onTestFinished(() => participant.stopHeartbeat());

    // Another worker settled the run and released the claim; this process never saw it.
    expect(await workflowsStore.releaseRunOwnership(own)).toBe(true);
    await expect(participant.verifyNotSuperseded()).resolves.toBeUndefined();
    expect(participant.isLost()).toBe(false);
    // Writes that need a live claim are still refused.
    await expect(participant.verify()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });

    // Once another execution claims the run, the late write is refused.
    expect((await claimSuccessor()).acquired).toBe(true);
    await expect(participant.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });

  it("passes on a participant fence whose heartbeat already saw another process's release", async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore, coordinator, own } = await setup();
    coordinator.stopHeartbeat();
    const mastra = new Mastra({ storage, logger: false });
    const participant = (await ExecutionFence.follow(mastra, 'run-1', coordinator.claim))!;
    onTestFinished(() => participant.stopHeartbeat());

    expect(await workflowsStore.releaseRunOwnership(own)).toBe(true);
    // The next renewal finds the claim released and gives the unsettled fence one renewal to settle (#30206);
    // the one after marks it lost.
    await vi.advanceTimersByTimeAsync(2 * EXECUTION_LEASE_RENEW_INTERVAL_MS + 1);
    expect(participant.isLost()).toBe(true);
    await expect(participant.verifyNotSuperseded()).resolves.toBeUndefined();
  });

  it('refuses on a participant fence when another execution claimed the run, not a release', async () => {
    const { storage, coordinator, workflowsStore } = await setup();
    coordinator.stopHeartbeat();
    const mastra = new Mastra({ storage, logger: false });
    const participant = (await ExecutionFence.follow(mastra, 'run-1', coordinator.claim))!;
    onTestFinished(() => participant.stopHeartbeat());

    await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'successor', leaseMs: 60_000, force: true });
    await expect(participant.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(participant.isLost()).toBe(true);
  });

  it("passes on a participant fence whose release failed and whose claim's lease lapsed, until another execution claims the run", async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore, coordinator } = await setup();
    coordinator.stopHeartbeat();
    const mastra = new Mastra({ storage, logger: false });
    const participant = (await ExecutionFence.follow(mastra, 'run-1', coordinator.claim))!;
    onTestFinished(() => participant.stopHeartbeat());
    mastra.__createRunScope('run-1').set(DURABLE_PARTICIPANT_FENCES, new Map([[coordinator.executionId, participant]]));

    // The release never reaches storage, and neither do renewals, until the claim's lease runs out.
    vi.spyOn(workflowsStore, 'releaseRunOwnership').mockRejectedValueOnce(new Error('store down'));
    vi.spyOn(workflowsStore, 'renewRunOwnership').mockRejectedValue(new Error('store down'));
    await expect(ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled')).rejects.toThrow(
      'store down',
    );
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + EXECUTION_LEASE_RENEW_INTERVAL_MS);
    const record = await workflowsStore.getRunOwnership({ runId: 'run-1' });
    expect(record).toMatchObject({ ownerId: coordinator.executionId, live: false });
    expect(record?.leaseExpiresAt).not.toBeNull();

    // Storage would still accept the expired claim's write: nobody claimed the run.
    vi.mocked(workflowsStore.renewRunOwnership).mockRestore();
    await expect(participant.verifyNotSuperseded()).resolves.toBeUndefined();
    const successor = await workflowsStore.claimRunOwnership({
      runId: 'run-1',
      ownerId: 'successor',
      leaseMs: 60_000,
      expectedGeneration: coordinator.generation,
    });
    expect(successor.acquired).toBe(true);
    await expect(participant.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });

  it('counts a release storage applied but whose response failed as released', async () => {
    const { workflowsStore, coordinator, claimSuccessor } = await setup();
    const release = holdNextCall(workflowsStore, 'releaseRunOwnership', { apply: true, fail: true });
    const settled = coordinator.settle(async () => {});
    await release.applied;
    release.finish();
    expect(await settled).toBe('owned');

    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ leaseExpiresAt: null });
    await expect(coordinator.verifyNotSuperseded()).resolves.toBeUndefined();
    expect(coordinator.isLost()).toBe(false);

    expect((await claimSuccessor()).acquired).toBe(true);
    await expect(coordinator.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  });

  // Reads of the claim during one check: the first fails as a dropped connection would, and the
  // check retries it. `before` and `after` run around the retried read.
  function failFirstRead(
    workflowsStore: WorkflowsStorage,
    { before, after }: { before?: () => Promise<unknown>; after?: () => Promise<unknown> },
  ) {
    const read = workflowsStore.getRunOwnership.bind(workflowsStore);
    let reads = 0;
    return vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementation(async args => {
      reads++;
      if (reads === 1) throw new Error('connection reset');
      if (reads === 2) await before?.();
      const record = await read(args);
      if (reads === 2) await after?.();
      return record;
    });
  }

  it('passes when another process releases the claim while one check reads it', async () => {
    const { workflowsStore, coordinator, own } = await setup();
    coordinator.stopHeartbeat();
    // The check's retried read still finds the claim live; another worker releases it just after.
    const reads = failFirstRead(workflowsStore, {
      after: async () => expect(await workflowsStore.releaseRunOwnership(own)).toBe(true),
    });

    await expect(coordinator.verifyNotSuperseded()).resolves.toBeUndefined();
    expect(coordinator.isLost()).toBe(false);
    reads.mockRestore();
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ ...own, leaseExpiresAt: null });
    await expect(coordinator.verifyNotSuperseded()).resolves.toBeUndefined();
    expect(coordinator.isLost()).toBe(false);
  });

  it("passes through assertExecutionNotSuperseded when the heartbeat sees another process's release while the check reads the claim as held", async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore, coordinator, own } = await setup();
    const mastra = new Mastra({ storage, logger: false });
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', coordinator.claim);
    const args = { runId: 'run-1', agentId, requestContext, mastra };

    // The check's next read finds the claim live. Before that read returns, another worker releases
    // the claim and this fence's heartbeat renewals find it released: the first gives the unsettled
    // fence one renewal to settle (#30206), the second marks it lost.
    let signalReleased!: () => void;
    const released = new Promise<void>(resolve => (signalReleased = resolve));
    let resumeRead!: () => void;
    const readResumed = new Promise<void>(resolve => (resumeRead = resolve));
    const reads = failFirstRead(workflowsStore, {
      after: async () => {
        expect(await workflowsStore.releaseRunOwnership(own)).toBe(true);
        signalReleased();
        await readResumed;
      },
    });

    const check = assertExecutionNotSuperseded(args);
    // Past the first read's retry delay.
    await vi.advanceTimersByTimeAsync(1_000);
    await released;
    await vi.advanceTimersByTimeAsync(2 * EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(coordinator.isLost()).toBe(true);
    resumeRead();

    await expect(check).resolves.toBeUndefined();
    reads.mockRestore();
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({ ...own, leaseExpiresAt: null });
    await expect(assertExecutionNotSuperseded(args)).resolves.toBeUndefined();
  });

  it('refuses through assertExecutionNotSuperseded when the heartbeat sees a successor while the check reads the claim as held', async () => {
    vi.useFakeTimers();
    const { storage, workflowsStore, coordinator } = await setup();
    const mastra = new Mastra({ storage, logger: false });
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run-1', coordinator.claim);
    const args = { runId: 'run-1', agentId, requestContext, mastra };

    // As above, but the claim is taken over, not released, before the heartbeat renews.
    let signalTakenOver!: () => void;
    const takenOver = new Promise<void>(resolve => (signalTakenOver = resolve));
    let resumeRead!: () => void;
    const readResumed = new Promise<void>(resolve => (resumeRead = resolve));
    failFirstRead(workflowsStore, {
      after: async () => {
        await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'successor', leaseMs: 60_000, force: true });
        signalTakenOver();
        await readResumed;
      },
    });

    const check = assertExecutionNotSuperseded(args);
    void check.catch(() => {});
    await vi.advanceTimersByTimeAsync(1_000);
    await takenOver;
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(coordinator.isLost()).toBe(true);
    resumeRead();

    await expect(check).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: 'successor',
      live: true,
    });
  });

  it('refuses when another execution claims the run while one check reads it', async () => {
    const { workflowsStore, coordinator, own } = await setup();
    coordinator.stopHeartbeat();
    // Another worker releases the claim and a successor claims the run before the check's retried read.
    failFirstRead(workflowsStore, {
      before: async () => {
        expect(await workflowsStore.releaseRunOwnership(own)).toBe(true);
        await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'successor', leaseMs: 60_000 });
      },
    });

    await expect(coordinator.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(coordinator.isLost()).toBe(true);
  });

  it("refuses, and marks the execution lost, when storage shows a successor's claim released", async () => {
    const { storage, workflowsStore, coordinator, own } = await setup();
    coordinator.stopHeartbeat();
    const mastra = new Mastra({ storage, logger: false });
    const participant = (await ExecutionFence.follow(mastra, 'run-1', coordinator.claim))!;
    onTestFinished(() => participant.stopHeartbeat());

    // A successor claimed the run and has already released it: the record's lease is cleared, but
    // it names the successor, not this claim.
    expect(await workflowsStore.releaseRunOwnership(own)).toBe(true);
    const successor = await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'successor', leaseMs: 60_000 });
    expect(await workflowsStore.releaseRunOwnership(successor.record)).toBe(true);

    await expect(participant.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(participant.isLost()).toBe(true);
  });

  it('marks the execution lost when its release found the claim already replaced', async () => {
    const { workflowsStore, coordinator } = await setup();
    const releaseRunOwnership = workflowsStore.releaseRunOwnership.bind(workflowsStore);
    // A successor takes the run just before settlement's release, which then releases nothing.
    vi.spyOn(workflowsStore, 'releaseRunOwnership').mockImplementationOnce(async fence => {
      await workflowsStore.claimRunOwnership({ runId: 'run-1', ownerId: 'successor', leaseMs: 60_000, force: true });
      const released = await releaseRunOwnership(fence);
      expect(released).toBe(false);
      return released;
    });
    expect(await coordinator.settle(async () => {})).toBe('owned');

    // Not a release: verify's rule applies, and a superseded execution is lost.
    await expect(coordinator.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(coordinator.isLost()).toBe(true);
    expect(await workflowsStore.getRunOwnership({ runId: 'run-1' })).toMatchObject({
      ownerId: 'successor',
      live: true,
    });
  });

  it('refuses after a failed release when storage shows another execution claimed the run', async () => {
    const { workflowsStore, coordinator, claimSuccessor } = await setup();
    // The release applies, a successor claims the run, and only then does the release's response fail.
    const release = holdNextCall(workflowsStore, 'releaseRunOwnership', { apply: true, fail: true });
    const settled = coordinator.settle(async () => {});
    await release.applied;
    expect((await claimSuccessor()).acquired).toBe(true);
    release.finish();
    await settled;

    await expect(coordinator.verifyNotSuperseded()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
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
    const restored = new RequestContext<unknown>(
      Object.entries(JSON.parse(JSON.stringify(requestContext.toJSON())) as Record<string, unknown>),
    );
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
    expect(isExecutionFenceError({ message: 'x', id: EXECUTION_ABANDONED_ERROR_ID })).toBe(true);
    // What a JSON pubsub transport delivers to a remote engine.
    expect(isExecutionFenceError(JSON.parse(JSON.stringify(fenceError)))).toBe(true);
    expect(isExecutionFenceError(new Error('other'))).toBe(false);
  });
});

describe('ExecutionFence release orderings with a hung release (#30206)', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => {
      resolve = yes;
    });
    return { promise, resolve };
  }

  async function sharedClaim() {
    vi.useFakeTimers();
    const storage = new InMemoryStore();
    const store = await storage.getStore('workflows');
    if (!store) throw new Error('workflows store missing');
    const mastra = new Mastra({ storage, logger: false });
    const claimRun = (mode: 'acquire' | 'takeover' = 'acquire') =>
      ExecutionFence.claim({ leaseProvider: NoopLeaseProvider, workflowsStore: store, agentId, runId: 'run-1', mode });
    const coordinator = await claimRun();
    coordinator.stopHeartbeat();
    const participant = await ExecutionFence.follow(mastra, 'run-1', coordinator.claim);
    if (!participant) throw new Error('participant missing');
    return { store, mastra, coordinator, participant, claimRun };
  }

  function hangNextRelease(store: WorkflowsStorage) {
    const entered = deferred<void>();
    vi.spyOn(store, 'releaseRunOwnership').mockImplementationOnce(async () => {
      entered.resolve();
      return new Promise<boolean>(() => {});
    });
    return entered.promise;
  }

  it('spends no grace once a later abandoned release confirms, even when an earlier one hangs (#30206)', async () => {
    const { store, mastra, coordinator, participant } = await sharedClaim();
    const entered = hangNextRelease(store);
    void ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'abandoned');
    await entered;
    await ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'abandoned');
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(participant.isLost()).toBe(true);
  });

  it('waits at most one renewal interval in total on overlapping settled and abandoned releases (#30206)', async () => {
    const { store, mastra, coordinator, participant, claimRun } = await sharedClaim();
    const entered = hangNextRelease(store);
    void ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'abandoned');
    await entered;
    const gate = deferred<void>();
    const settledAtStore = deferred<void>();
    const release = store.releaseRunOwnership.bind(store);
    vi.spyOn(store, 'releaseRunOwnership').mockImplementationOnce(async args => {
      const result = await release(args);
      settledAtStore.resolve();
      await gate.promise;
      return result;
    });
    const settled = ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    await settledAtStore.promise;
    await claimRun('takeover');
    const renewalGate = deferred<void>();
    const renew = store.renewRunOwnership.bind(store);
    vi.spyOn(store, 'renewRunOwnership').mockImplementationOnce(async args => {
      await renewalGate.promise;
      return renew(args);
    });
    // The renewal sent at 5s fails at 6s; the settled release answers true at 10s.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1000);
    renewalGate.resolve();
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS - 1000);
    gate.resolve();
    await settled;
    // One bounded wait ends by 11s and spends the grace, so the 15s renewal reports the takeover.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1000);
    expect(participant.isLost()).toBe(true);
  });

  it('keeps a fence whose renewal errors past the lease while it settles, before its release starts (#30206)', async () => {
    const { store, participant } = await sharedClaim();
    let failRenewal!: (cause: Error) => void;
    vi.spyOn(store, 'renewRunOwnership').mockImplementationOnce(
      () => new Promise((_, reject) => (failRenewal = reject)),
    );
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    const terminalWrites = deferred<void>();
    const settled = participant.settle(() => terminalWrites.promise);
    // Past the lease deadline, the renewal errors while the terminal writes still run and no release has started.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS);
    failRenewal(new Error('connection terminated'));
    await vi.advanceTimersByTimeAsync(0);
    terminalWrites.resolve();
    expect(await settled).toBe('owned');
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1);
    expect(participant.isLost()).toBe(false);
  });

  it('still marks a settling fence lost when its renewal errors past the lease and no release answers in time (#30206)', async () => {
    const { store, participant } = await sharedClaim();
    let failRenewal!: (cause: Error) => void;
    vi.spyOn(store, 'renewRunOwnership').mockImplementationOnce(
      () => new Promise((_, reject) => (failRenewal = reject)),
    );
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    const terminalWrites = deferred<void>();
    void participant.settle(() => terminalWrites.promise);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS);
    failRenewal(new Error('connection terminated'));
    // The terminal writes never finish, so the release never starts within the wait.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1);
    expect(participant.isLost()).toBe(true);
  });

  it('keeps a settled fence whose own release confirms after a renewal error started waiting on a hung release (#30206)', async () => {
    const { store, mastra, coordinator, participant } = await sharedClaim();
    const entered = hangNextRelease(store);
    void ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    await entered;
    let failRenewal!: (cause: Error) => void;
    vi.spyOn(store, 'renewRunOwnership').mockImplementationOnce(
      () => new Promise((_, reject) => (failRenewal = reject)),
    );
    // The renewal sent at 5s is still in flight when the participant starts settling.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    const terminalWrites = deferred<void>();
    const settled = participant.settle(() => terminalWrites.promise);
    // Past the lease deadline, the renewal errors. The handler waits on the shared release, which never answers.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS);
    failRenewal(new Error('connection terminated'));
    await vi.advanceTimersByTimeAsync(0);
    // The participant's own release then confirms, well within that wait.
    terminalWrites.resolve();
    expect(await settled).toBe('owned');
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1);
    expect(participant.isLost()).toBe(false);
  });

  it('keeps a settled fence when its own release confirms after an earlier shared release hangs (#30206)', async () => {
    const { store, mastra, coordinator, participant, claimRun } = await sharedClaim();
    const entered = hangNextRelease(store);
    void ExecutionFence.releaseSharedClaim(mastra, 'run-1', coordinator.claim, 'settled');
    await entered;
    const renewalGate = deferred<void>();
    const renew = store.renewRunOwnership.bind(store);
    vi.spyOn(store, 'renewRunOwnership').mockImplementationOnce(async args => {
      await renewalGate.promise;
      return renew(args);
    });
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(await participant.settle(async () => {})).toBe('owned');
    const successor = await claimRun();
    renewalGate.resolve();
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1);
    expect(participant.isLost()).toBe(false);
    expect(await store.getRunOwnership({ runId: 'run-1' })).toMatchObject({ ownerId: successor.executionId });
  });
});
