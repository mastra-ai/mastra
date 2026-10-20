/**
 * Bounded in-memory retention for suspended agent runs.
 *
 * A run that suspends (tool approval, `ask_user`, any `suspend()`) keeps its
 * `AgentThreadStreamRuntime` record warm: the record blocks the thread and backs
 * subscriber replay, and a same-instance resume reattaches to it. Nothing used to
 * bound that record's lifetime, so an abandoned suspend — or a resume that landed on
 * another instance — retained the full in-memory transcript until the process exited.
 *
 * These tests cover the lifetime bound: the lazy sweep on registration evicts records
 * parked longer than `MASTRA_SUSPENDED_RUN_TTL_MS`, frees the local state that record
 * held (active slot, resumable marker, lease renewal), and leaves everything else
 * alone — fresh suspensions, long-running runs, the newer stream of a run that was
 * already resumed, and the cross-process lease itself, which another instance may
 * have taken over by resuming the same run.
 *
 * The runtime reads its TTL once at module load, so the knob is set in a hoisted block
 * (before the module graph is imported) — a short TTL lets these tests pin the sweep's
 * boundary exactly. Virtual time is advanced around the sweeping registration the same
 * way `runscope-leak.test.ts` advances past the internal-workflow TTL.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const { SUSPENDED_RUN_TTL_MS, LEASE_RENEW_INTERVAL_MS } = vi.hoisted(() => {
  const ttlMs = 60_000;
  process.env.MASTRA_SUSPENDED_RUN_TTL_MS = String(ttlMs);
  // Renewal is what keeps an abandoned lease alive; shrink the interval so a test
  // can watch it tick without waiting the production five seconds for each one.
  const renewIntervalMs = 20;
  process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS = String(renewIntervalMs);
  return { SUSPENDED_RUN_TTL_MS: ttlMs, LEASE_RENEW_INTERVAL_MS: renewIntervalMs };
});
// Vitest reuses a worker process across test files, so leave the default TTL in place
// for whichever file this worker picks up next.
afterAll(() => {
  delete process.env.MASTRA_SUSPENDED_RUN_TTL_MS;
  delete process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS;
});

// Mirrors the runtime's thread key + topic encoding: how a subscriber on another
// instance finds a given thread's events.
const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
const threadKey = (resourceId: string, threadId: string) => [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
const threadTopic = (resourceId: string, threadId: string) =>
  `agent.thread-stream.${encodeURIComponent(threadKey(resourceId, threadId))}`;

const RESOURCE_ID = 'resource-1';
const fakeAgent = { id: 'ttl-test-agent' } as unknown as Agent<any, any, any, any>;

/**
 * Minimal stand-in for the run output `registerRun` consumes: a run id, a live
 * `status`, a `fullStream` the runtime's broadcast tee pumps, and a completion
 * promise. Suspension is driven part-by-part so the runtime marks the run
 * suspending from the stream (as a real approval/suspend tool call does) rather
 * than from test-only state.
 */
function createFakeRun(runId: string) {
  let status: 'running' | 'suspended' | 'success' = 'running';
  let streamController!: ReadableStreamDefaultController<unknown>;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });

  const output = {
    runId,
    get status() {
      return status;
    },
    fullStream: new ReadableStream<unknown>({
      start(controller) {
        streamController = controller;
      },
    }),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput<unknown>;

  return {
    output,
    emitSuspendPart(toolCallId = `${runId}-call`) {
      streamController.enqueue({
        type: 'tool-call-suspended',
        payload: { toolCallId, toolName: 'askUser' },
      });
    },
    emitFinishPart() {
      streamController.enqueue({ type: 'finish', finishReason: 'stop' });
    },
    settle(finalStatus: 'suspended' | 'success') {
      status = finalStatus;
      streamController.close();
      finish();
    },
  };
}

type FakeRun = ReturnType<typeof createFakeRun>;

/** Records everything the runtime publishes for one thread, for event assertions. */
async function watchThread(pubsub: EventEmitterPubSub, threadId: string) {
  const events: Event[] = [];
  await pubsub.subscribe(threadTopic(RESOURCE_ID, threadId), event => {
    events.push(event);
  });
  return {
    has: (type: string, runId: string) => events.some(event => event.type === type && event.runId === runId),
    find: (type: string, runId: string) => events.find(event => event.type === type && event.runId === runId),
    waitFor: (type: string, runId: string) =>
      vi.waitFor(() => expect(events.some(event => event.type === type && event.runId === runId)).toBe(true)),
  };
}

type ThreadWatcher = Awaited<ReturnType<typeof watchThread>>;

/** Let anything the sweep publishes reach its subscribers before asserting it did not. */
const flushPublishes = () => new Promise(resolve => setTimeout(resolve, 0));

describe('suspended run in-memory TTL', () => {
  let runtime: AgentThreadStreamRuntime;
  let pubsub: EventEmitterPubSub;
  let releaseLease: ReturnType<typeof vi.spyOn>;
  let renewLease: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runtime = new AgentThreadStreamRuntime();
    pubsub = new EventEmitterPubSub();
    releaseLease = vi.spyOn(pubsub, 'releaseLease');
    renewLease = vi.spyOn(pubsub, 'renewLease');
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await pubsub.close();
  });

  /** Start a run on `threadId` and drive it to a suspended, thread-blocking record. */
  async function registerSuspendedRun(runId: string, threadId: string, watcher: ThreadWatcher) {
    const run = createFakeRun(runId);
    await runtime.registerRun(fakeAgent, run.output, { memory: { thread: threadId, resource: RESOURCE_ID } }, pubsub, {
      continuation: 'across-suspension',
    });

    // Let the broadcast tee publish the suspend part before the run settles, so the
    // runtime sees the suspension the same way it does in production: marked from
    // the stream first, parked when the stream finishes.
    run.emitSuspendPart();
    await watcher.waitFor('stream-part', runId);
    run.settle('suspended');
    await watcher.waitFor('run-suspended', runId);

    expect(runtime.getResumableThreadRun({ threadId, resourceId: RESOURCE_ID, runId }, pubsub)).toEqual({
      runId,
      toolCallId: `${runId}-call`,
    });
    return run;
  }

  /**
   * Age every parked record by `elapsedMs`, then fire the registration that sweeps —
   * a run on an unrelated thread will do, since the registry is per-process. Real
   * timers are restored before the assertions so the runtime's own async plumbing
   * (and `vi.waitFor`) runs unfaked.
   */
  async function sweepAfter(elapsedMs: number, threadId = 'sweep-trigger-thread'): Promise<FakeRun> {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.now() });
    vi.setSystemTime(Date.now() + elapsedMs);
    try {
      const run = createFakeRun(`sweeper-${threadId}`);
      await runtime.registerRun(fakeAgent, run.output, { memory: { thread: threadId, resource: RESOURCE_ID } }, pubsub);
      return run;
    } finally {
      vi.useRealTimers();
    }
  }

  it('evicts a suspended run once it has been parked past the TTL', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);
    const didPublishTerminal = runtime.captureThreadRunTerminalPublish('run-1', pubsub);

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

    expect(didPublishTerminal?.()).toBe(false);
    expect(
      runtime.getResumableThreadRun({ threadId: 'thread-1', resourceId: RESOURCE_ID, runId: 'run-1' }, pubsub),
    ).toBeUndefined();
    expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBeUndefined();
    // The thread must read idle again, otherwise the abandoned suspend keeps
    // blocking every follow-up turn on it.
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('idle');
  });

  it('keeps a suspended run warm for same-instance resume within the TTL', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);

    await sweepAfter(SUSPENDED_RUN_TTL_MS - 1_000);

    expect(
      runtime.getResumableThreadRun({ threadId: 'thread-1', resourceId: RESOURCE_ID, runId: 'run-1' }, pubsub),
    ).toEqual({
      runId: 'run-1',
      toolCallId: 'run-1-call',
    });
    expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('run-1');
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('active');
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');
    expect(watcher.has('run-completed', 'run-1')).toBe(false);
  });

  it('evicts without releasing the lease or announcing the run finished', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
    await flushPublishes();

    // An expiring record only proves this instance dropped its warm state. Another
    // instance may have resumed the same run and taken the lease, so releasing it
    // here — or telling subscribers the run completed — would cut that resume off
    // mid-flight. An abandoned lease expires on its own once renewal stops.
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');
    expect(watcher.has('run-completed', 'run-1')).toBe(false);
  });

  it('stops renewing the evicted run’s lease, so an abandoned one expires on its own', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);

    // While the record is warm, the runtime keeps the thread owned: that renewal is
    // the only reason an abandoned lease could outlive its 15s TTL.
    await vi.waitFor(() =>
      expect(renewLease).toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000),
    );

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

    renewLease.mockClear();
    await new Promise(resolve => setTimeout(resolve, LEASE_RENEW_INTERVAL_MS * 4));
    expect(renewLease).not.toHaveBeenCalled();
  });

  describe('sending to the thread while the evicted run still holds its lease', () => {
    const sendToThread = (agent: Agent<any, any, any, any>, threadId = 'thread-1') =>
      runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'hello again' },
        { resourceId: RESOURCE_ID, threadId, ifIdle: { behavior: 'wake' } },
        pubsub,
      ).accepted;

    function createWakeableAgent(runId: string) {
      const run = createFakeRun(runId);
      const stream = vi.fn(async () => run.output);
      return { agent: { id: 'ttl-test-agent', stream } as unknown as Agent<any, any, any, any>, stream, run };
    }

    it('reports the thread blocked instead of acknowledging a delivery nothing consumes', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');

      // The sweep kept run-1's lease (see above), so this send loses it to run-1. No
      // run here or elsewhere consumes a signal forwarded to it, so `deliver` would
      // silently drop the message.
      await expect(sendToThread(agent)).resolves.toEqual({
        action: 'blocked',
        reason: 'thread-blocked',
        runId: 'run-1',
      });
      await flushPublishes();
      expect(watcher.has('signal-enqueued', 'run-1')).toBe(false);
      expect(stream).not.toHaveBeenCalled();
    });

    it('reports blocked when this instance claimed the thread and the claimed owner loses the lease', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const owner = createWakeableAgent('run-2');
      const claim = await runtime.claimThreadOwnership(
        owner.agent,
        { resourceId: RESOURCE_ID, threadId: 'thread-1' },
        pubsub,
      );
      expect(claim.claimed).toBe(true);

      // The claimed owner runs the wake itself, then loses the thread lease to the
      // swept run-1. Forwarding to run-1 would drop the message just like the
      // unclaimed path.
      try {
        await expect(sendToThread(createWakeableAgent('run-3').agent)).resolves.toEqual({
          action: 'blocked',
          reason: 'thread-blocked',
          runId: 'run-1',
        });
        await flushPublishes();
        expect(watcher.has('signal-enqueued', 'run-1')).toBe(false);
        expect(owner.stream).not.toHaveBeenCalled();
      } finally {
        claim.unsubscribe();
      }
    });

    it('wakes a new run once the abandoned lease is gone', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream, run } = createWakeableAgent('run-2');

      // Stand-in for the abandoned lease expiring on its own.
      await pubsub.releaseLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');

      const accepted = await sendToThread(agent);
      expect(accepted).toMatchObject({ action: 'wake' });
      expect(stream).toHaveBeenCalledTimes(1);
      run.settle('success');
    });

    it('reports blocked when the swept run’s registration is redelivered to a thread subscriber', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');
      const registration = watcher.find('run-registered', 'run-1')!;

      const subscription = await runtime.subscribeToThread(
        agent,
        { resourceId: RESOURCE_ID, threadId: 'thread-1' },
        pubsub,
      );
      try {
        // A broker that redelivers backlog to a new subscriber hands it run-1's
        // registration while run-1 still holds the lease. That must not restore the
        // evicted run as active, or the send takes the active-run path and
        // acknowledges a delivery nothing consumes.
        await pubsub.publish(threadTopic(RESOURCE_ID, 'thread-1'), {
          type: registration.type,
          runId: registration.runId,
          data: registration.data,
        });
        await flushPublishes();
        await flushPublishes();
        expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBeUndefined();
        await expect(sendToThread(agent)).resolves.toEqual({
          action: 'blocked',
          reason: 'thread-blocked',
          runId: 'run-1',
        });
        await flushPublishes();
        expect(watcher.has('signal-enqueued', 'run-1')).toBe(false);
        expect(stream).not.toHaveBeenCalled();
      } finally {
        subscription.unsubscribe();
      }
    });

    it('reports blocked when a queued message targets a swept run a stream part restored as active', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');
      const part = watcher.find('stream-part', 'run-1')!;

      const subscription = await runtime.subscribeToThread(
        agent,
        { resourceId: RESOURCE_ID, threadId: 'thread-1' },
        pubsub,
      );
      try {
        // A retained stream part for run-1 restores it as active while it still holds
        // the lease. A queued message must not wait on a run that never finishes here.
        await pubsub.publish(threadTopic(RESOURCE_ID, 'thread-1'), {
          type: part.type,
          runId: part.runId,
          data: { ...part.data, sourceId: 'other-instance' },
        });
        await flushPublishes();
        await flushPublishes();
        expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('run-1');

        const queued = runtime.queueSignal(
          agent,
          { type: 'user-message', contents: 'queued while swept' },
          { resourceId: RESOURCE_ID, threadId: 'thread-1' },
          pubsub,
        );
        await expect(queued.accepted).resolves.toEqual({
          action: 'blocked',
          reason: 'thread-blocked',
          runId: 'run-1',
        });
        await flushPublishes();
        expect(watcher.has('signal-enqueued', 'run-1')).toBe(false);
        expect(stream).not.toHaveBeenCalled();
      } finally {
        subscription.unsubscribe();
      }
    });

    it('forwards to the swept run once another instance registers its resume', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      const sweptAt = Date.now() + SUSPENDED_RUN_TTL_MS + 1;
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');
      const registration = watcher.find('run-registered', 'run-1')!;

      const subscription = await runtime.subscribeToThread(
        agent,
        { resourceId: RESOURCE_ID, threadId: 'thread-1' },
        pubsub,
      );
      try {
        // Another instance resumed run-1 under the kept lease after the sweep and announced it.
        vi.useFakeTimers({ shouldAdvanceTime: true, now: sweptAt + 1_000 });
        await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000);
        await pubsub.publish(threadTopic(RESOURCE_ID, 'thread-1'), {
          type: registration.type,
          runId: registration.runId,
          data: { ...registration.data, sourceId: 'other-instance', streamId: 'run-1-resumed' },
        });
        await vi.waitFor(() =>
          expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('run-1'),
        );
        await expect(sendToThread(agent)).resolves.toEqual({ action: 'deliver', runId: 'run-1' });
        await watcher.waitFor('signal-enqueued', 'run-1');
        expect(stream).not.toHaveBeenCalled();
      } finally {
        subscription.unsubscribe();
      }
    });

    it('keeps a subscriber reading another instance’s resume of the run the sweep drops', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      const { agent } = createWakeableAgent('run-2');
      const registration = watcher.find('run-registered', 'run-1')!;

      const subscription = await runtime.subscribeToThread(
        agent,
        { resourceId: RESOURCE_ID, threadId: 'thread-1' },
        pubsub,
      );
      const texts: string[] = [];
      let finished = false;
      const reading = (async () => {
        for await (const part of subscription.stream as AsyncIterable<any>) {
          if (part?.runId !== 'run-1') continue;
          if (part.type === 'text-delta') texts.push(part.payload.text);
          if (part.type === 'finish') {
            finished = true;
            return;
          }
        }
      })();
      const publishResumedPart = (part: unknown) =>
        pubsub.publish(threadTopic(RESOURCE_ID, 'thread-1'), {
          type: 'stream-part',
          runId: 'run-1',
          data: { type: 'stream-part', runId: 'run-1', streamId: 'run-1-resumed', part, sourceId: 'other-instance' },
        });
      try {
        // Another instance resumed run-1 while this instance still holds its parked record.
        await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000);
        await pubsub.publish(threadTopic(RESOURCE_ID, 'thread-1'), {
          type: registration.type,
          runId: registration.runId,
          data: { ...registration.data, sourceId: 'other-instance', streamId: 'run-1-resumed' },
        });
        await publishResumedPart({ type: 'text-delta', payload: { text: 'before-sweep' } });
        await vi.waitFor(() => expect(texts).toEqual(['before-sweep']));

        await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
        await publishResumedPart({ type: 'text-delta', payload: { text: 'after-sweep' } });
        await publishResumedPart({ type: 'finish', finishReason: 'stop' });

        await vi.waitFor(() => expect(finished).toBe(true));
        expect(texts).toEqual(['before-sweep', 'after-sweep']);
      } finally {
        subscription.unsubscribe();
        await reading;
      }
    });

    it('still forwards to a lease owner the sweep did not evict', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      // Another instance owns the thread under a run this one never swept.
      await pubsub.releaseLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');
      await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'remote-run', 15_000);
      const { agent, stream } = createWakeableAgent('run-2');

      await expect(sendToThread(agent)).resolves.toEqual({ action: 'deliver', runId: 'remote-run' });
      await watcher.waitFor('signal-enqueued', 'remote-run');
      expect(stream).not.toHaveBeenCalled();
    });

    it('forwards to the swept run again once its lease TTL has passed since the sweep', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const sweptAt = Date.now() + SUSPENDED_RUN_TTL_MS + 1;
      const { agent, stream } = createWakeableAgent('run-2');

      // Still owned by run-1 a full lease TTL after the sweep: some instance (not this
      // one) resumed it and keeps renewing, so it is live and forwarding is right.
      vi.useFakeTimers({ shouldAdvanceTime: true, now: sweptAt + 15_001 });
      await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000);

      await expect(sendToThread(agent)).resolves.toEqual({ action: 'deliver', runId: 'run-1' });
      expect(stream).not.toHaveBeenCalled();
    });

    it('keeps reporting blocked while a renewal that was in flight at sweep time holds the lease', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);

      // Hold the next renewal open across the sweep, as a slow lease backend would.
      let landRenewal!: (renewed: boolean) => void;
      renewLease.mockImplementationOnce(
        () =>
          new Promise<boolean>(resolve => {
            landRenewal = resolve;
          }),
      );
      await vi.waitFor(() => expect(landRenewal).toBeTypeOf('function'));

      const sweptAt = Date.now() + SUSPENDED_RUN_TTL_MS + 1;
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');

      // The renewal lands 10s after the sweep and extends the lease from then.
      vi.useFakeTimers({ shouldAdvanceTime: true, now: sweptAt + 10_000 });
      await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000);
      landRenewal(true);
      await Promise.resolve();
      await Promise.resolve();

      // Past one lease TTL from the sweep, but the abandoned lease is still held.
      vi.setSystemTime(sweptAt + 20_000);
      await expect(sendToThread(agent)).resolves.toEqual({
        action: 'blocked',
        reason: 'thread-blocked',
        runId: 'run-1',
      });
      expect(stream).not.toHaveBeenCalled();
    });
    it('keeps reporting blocked while a renewal from before the sweep is still pending a lease TTL later', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);

      // The lease backend applied this renewal but its response has not arrived yet.
      let landRenewal!: (renewed: boolean) => void;
      renewLease.mockImplementationOnce(
        () =>
          new Promise<boolean>(resolve => {
            landRenewal = resolve;
          }),
      );
      await vi.waitFor(() => expect(landRenewal).toBeTypeOf('function'));

      const sweptAt = Date.now() + SUSPENDED_RUN_TTL_MS + 1;
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');

      vi.useFakeTimers({ shouldAdvanceTime: true, now: sweptAt + 20_000 });
      await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000);
      // A later sweep must not prune the marker while that renewal is outstanding.
      await registerSuspendedRun('run-3', 'thread-3', await watchThread(pubsub, 'thread-3'));

      await expect(sendToThread(agent)).resolves.toEqual({
        action: 'blocked',
        reason: 'thread-blocked',
        runId: 'run-1',
      });
      expect(stream).not.toHaveBeenCalled();
      landRenewal(true);
    });

    it('keeps reporting blocked when another instance registration predates the sweep', async () => {
      const watcher = await watchThread(pubsub, 'thread-1');
      await registerSuspendedRun('run-1', 'thread-1', watcher);
      const sweptAt = Date.now() + SUSPENDED_RUN_TTL_MS + 1;
      await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
      const { agent, stream } = createWakeableAgent('run-2');
      const registration = watcher.find('run-registered', 'run-1')!;

      const subscription = await runtime.subscribeToThread(
        agent,
        { resourceId: RESOURCE_ID, threadId: 'thread-1' },
        pubsub,
      );
      try {
        // A retained registration from another instance, published before this sweep.
        vi.useFakeTimers({ shouldAdvanceTime: true, now: sweptAt - 1_000 });
        await pubsub.publish(threadTopic(RESOURCE_ID, 'thread-1'), {
          type: registration.type,
          runId: registration.runId,
          data: { ...registration.data, sourceId: 'other-instance', streamId: 'run-1-old' },
        });
        vi.setSystemTime(sweptAt + 1_000);
        await pubsub.acquireLease(threadKey(RESOURCE_ID, 'thread-1'), 'run-1', 15_000);
        await vi.advanceTimersByTimeAsync(10);

        await expect(sendToThread(agent)).resolves.toEqual({
          action: 'blocked',
          reason: 'thread-blocked',
          runId: 'run-1',
        });
        expect(watcher.find('signal-enqueued', 'run-1')).toBeUndefined();
        expect(stream).not.toHaveBeenCalled();
      } finally {
        subscription.unsubscribe();
      }
    });
  });

  it('does not evict anything until a registration triggers the sweep', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);

    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.now() });
    vi.setSystemTime(Date.now() + SUSPENDED_RUN_TTL_MS * 10);

    // The sweep is lazy by design — zero cost while the process is idle.
    expect(
      runtime.getResumableThreadRun({ threadId: 'thread-1', resourceId: RESOURCE_ID, runId: 'run-1' }, pubsub),
    ).toEqual({
      runId: 'run-1',
      toolCallId: 'run-1-call',
    });
  });

  it('never evicts a still-running run, however long it runs', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    const longRun = createFakeRun('run-1');
    await runtime.registerRun(
      fakeAgent,
      longRun.output,
      { memory: { thread: 'thread-1', resource: RESOURCE_ID } },
      pubsub,
      { continuation: 'across-suspension' },
    );
    const didPublishTerminal = runtime.captureThreadRunTerminalPublish('run-1', pubsub);

    await sweepAfter(SUSPENDED_RUN_TTL_MS * 10);

    // The TTL bounds *parked* state only. A long-lived run (a big tool loop, a
    // stream nobody is draining fast) must keep its record and its thread slot.
    expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('run-1');
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('active');
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');
    expect(watcher.has('run-completed', 'run-1')).toBe(false);
    expect(didPublishTerminal?.()).toBe(false);

    longRun.emitFinishPart();
    await watcher.waitFor('stream-part', 'run-1');
    expect(didPublishTerminal?.()).toBe(true);
    longRun.settle('success');
    await watcher.waitFor('run-completed', 'run-1');
  });

  it('evicts every stale suspended run in one sweep', async () => {
    const watchers = await Promise.all([
      watchThread(pubsub, 'thread-a'),
      watchThread(pubsub, 'thread-b'),
      watchThread(pubsub, 'thread-c'),
    ]);
    await registerSuspendedRun('run-a', 'thread-a', watchers[0]);
    await registerSuspendedRun('run-b', 'thread-b', watchers[1]);
    await registerSuspendedRun('run-c', 'thread-c', watchers[2]);

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

    await flushPublishes();

    for (const [index, threadId] of ['thread-a', 'thread-b', 'thread-c'].entries()) {
      const runId = `run-${threadId.slice(-1)}`;
      expect(runtime.getResumableThreadRun({ threadId, resourceId: RESOURCE_ID, runId }, pubsub)).toBeUndefined();
      expect(runtime.getThreadState({ threadId, resourceId: RESOURCE_ID }, pubsub)).toBe('idle');
      expect(watchers[index]!.has('run-completed', runId)).toBe(false);
    }
  });

  it('leaves a resumed run alone when its superseded older stream expires', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);

    // Same-instance resume: the run re-registers under a new streamId while its
    // suspended stream record stays behind, already stamped as parked.
    const resumed = createFakeRun('run-1');
    await runtime.registerRun(
      fakeAgent,
      resumed.output,
      { memory: { thread: 'thread-1', resource: RESOURCE_ID } },
      pubsub,
    );

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

    // Only the superseded stream entry may be dropped. Tearing the run down here
    // would strand the live resumed stream: its thread slot and lease would be
    // released underneath it and subscribers told the run had completed.
    expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('run-1');
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('active');
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');
    expect(watcher.has('run-completed', 'run-1')).toBe(false);

    // The resumed run still owns its own teardown when it finishes for real.
    resumed.settle('success');
    await watcher.waitFor('run-completed', 'run-1');
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('idle');
  });
});
