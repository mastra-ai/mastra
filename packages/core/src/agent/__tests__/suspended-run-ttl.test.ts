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
 * parked longer than `MASTRA_SUSPENDED_RUN_TTL_MS`, completes the teardown an
 * abandoned suspend never got (lease, active slot, `run-completed` for remote
 * subscribers), and leaves everything else alone — fresh suspensions, long-running
 * runs, and the newer stream of a run that was already resumed.
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

const { SUSPENDED_RUN_TTL_MS, originalSuspendedRunTtlMs, originalAgentThreadLeaseTtlMs } = vi.hoisted(() => {
  const originalSuspendedRunTtlMs = process.env.MASTRA_SUSPENDED_RUN_TTL_MS;
  const originalAgentThreadLeaseTtlMs = process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
  const ttlMs = 60_000;
  process.env.MASTRA_SUSPENDED_RUN_TTL_MS = String(ttlMs);
  // A real suspended holder renews its thread lease while parked. Keep the
  // in-memory test lease live across fake wall-clock jumps for the same reason.
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(ttlMs * 2);
  return { SUSPENDED_RUN_TTL_MS: ttlMs, originalSuspendedRunTtlMs, originalAgentThreadLeaseTtlMs };
});
// Vitest reuses a worker process across test files, so restore the worker's
// original TTL configuration for whichever file it picks up next.
afterAll(() => {
  if (originalSuspendedRunTtlMs === undefined) {
    delete process.env.MASTRA_SUSPENDED_RUN_TTL_MS;
  } else {
    process.env.MASTRA_SUSPENDED_RUN_TTL_MS = originalSuspendedRunTtlMs;
  }
  if (originalAgentThreadLeaseTtlMs === undefined) {
    delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
  } else {
    process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = originalAgentThreadLeaseTtlMs;
  }
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
    count: (type: string, runId: string) => events.filter(event => event.type === type && event.runId === runId).length,
    waitFor: (type: string, runId: string) =>
      vi.waitFor(() => expect(events.some(event => event.type === type && event.runId === runId)).toBe(true)),
    waitForCount: (type: string, runId: string, count: number) =>
      vi.waitFor(() =>
        expect(events.filter(event => event.type === type && event.runId === runId)).toHaveLength(count),
      ),
  };
}

type ThreadWatcher = Awaited<ReturnType<typeof watchThread>>;

describe('suspended run in-memory TTL', () => {
  let runtime: AgentThreadStreamRuntime;
  let pubsub: EventEmitterPubSub;
  let releaseLease: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runtime = new AgentThreadStreamRuntime();
    pubsub = new EventEmitterPubSub();
    releaseLease = vi.spyOn(pubsub, 'releaseLease');
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await pubsub.close();
  });

  /** Start a run on `threadId` and drive it to a suspended, thread-blocking record. */
  async function registerSuspendedRun(runId: string, threadId: string, watcher: ThreadWatcher) {
    const run = createFakeRun(runId);
    await runtime.registerRun(fakeAgent, run.output, { memory: { thread: threadId, resource: RESOURCE_ID } }, pubsub);

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

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

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
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), expect.any(String));
    expect(watcher.has('run-completed', 'run-1')).toBe(false);
  });

  it('finishes the teardown an abandoned suspend never got: lease released, subscribers told', async () => {
    const watcher = await watchThread(pubsub, 'thread-1');
    await registerSuspendedRun('run-1', 'thread-1', watcher);
    const owner = await pubsub.getLeaseOwner(threadKey(RESOURCE_ID, 'thread-1'));

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

    // Without releasing, the run's lease-renewal timer would keep this instance
    // owning the thread forever as far as every other instance can tell.
    expect(releaseLease).toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), owner, 'run-1');
    // `run-completed` has to land on the *suspended* run's thread topic — remote
    // subscribers watch that topic to learn the thread is no longer blocked.
    await watcher.waitFor('run-completed', 'run-1');
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
    );

    await sweepAfter(SUSPENDED_RUN_TTL_MS * 10);

    // The TTL bounds *parked* state only. A long-lived run (a big tool loop, a
    // stream nobody is draining fast) must keep its record and its thread slot.
    expect(runtime.getActiveThreadRunId({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('run-1');
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('active');
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), expect.any(String));
    expect(watcher.has('run-completed', 'run-1')).toBe(false);

    longRun.settle('success');
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

    for (const [index, threadId] of ['thread-a', 'thread-b', 'thread-c'].entries()) {
      const runId = `run-${threadId.slice(-1)}`;
      expect(runtime.getResumableThreadRun({ threadId, resourceId: RESOURCE_ID, runId }, pubsub)).toBeUndefined();
      expect(runtime.getThreadState({ threadId, resourceId: RESOURCE_ID }, pubsub)).toBe('idle');
      await watchers[index]!.waitFor('run-completed', runId);
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
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), expect.any(String));
    expect(watcher.has('run-completed', 'run-1')).toBe(false);

    // The resumed run still owns its own teardown when it finishes for real.
    resumed.settle('success');
    await watcher.waitFor('run-completed', 'run-1');
    expect(runtime.getThreadState({ threadId: 'thread-1', resourceId: RESOURCE_ID }, pubsub)).toBe('idle');
  });

  it('does not tear down a lease re-owned by a cross-instance resume', async () => {
    const threadId = 'cross-instance-thread';
    const runId = 'cross-instance-run';
    const key = threadKey(RESOURCE_ID, threadId);
    const watcher = await watchThread(pubsub, threadId);
    await registerSuspendedRun(runId, threadId, watcher);
    const originOwner = await pubsub.getLeaseOwner(key);
    expect(originOwner).toBeDefined();

    // A resume can land on another server while the origin still retains its
    // parked record. Both runtimes deliberately reuse the durable runId.
    const resumedRuntime = new AgentThreadStreamRuntime();
    const resumed = createFakeRun(runId);
    await resumedRuntime.registerRun(
      fakeAgent,
      resumed.output,
      { memory: { thread: threadId, resource: RESOURCE_ID } },
      pubsub,
    );

    const resumedOwner = await pubsub.getLeaseOwner(key);
    expect(resumedOwner).toBeDefined();
    expect(resumedOwner).not.toBe(originOwner);

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);

    // The origin may discard its stale in-memory record, but it must not release
    // the resumed holder's lease or announce that the still-live run completed.
    await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(key)).toBe(resumedOwner));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(watcher.has('run-completed', runId)).toBe(false);

    resumed.settle('success');
    await watcher.waitFor('run-completed', runId);
  });

  it('keeps a re-suspended current stream intact when a stale sweep completion arrives', async () => {
    const threadId = 'release-race-thread';
    const runId = 'release-race-run';
    const key = threadKey(RESOURCE_ID, threadId);
    const watcher = await watchThread(pubsub, threadId);
    await registerSuspendedRun(runId, threadId, watcher);
    const originOwner = await pubsub.getLeaseOwner(key);
    expect(originOwner).toBeDefined();

    const resumedRuntime = new AgentThreadStreamRuntime();
    const subscription = await resumedRuntime.subscribeToThread(
      fakeAgent,
      { threadId, resourceId: RESOURCE_ID },
      pubsub,
    );
    const resumed = createFakeRun(runId);
    let injectResume = false;
    const getLeaseOwner = pubsub.getLeaseOwner.bind(pubsub);
    const releaseLeaseOriginal = EventEmitterPubSub.prototype.releaseLease.bind(pubsub);

    vi.spyOn(pubsub, 'releaseLease').mockImplementation(async (leaseKey, owner, metadata) => {
      await releaseLeaseOriginal(leaseKey, owner, metadata);
      if (leaseKey === key && owner === originOwner) injectResume = true;
    });
    vi.spyOn(pubsub, 'getLeaseOwner').mockImplementation(async leaseKey => {
      const observedOwner = await getLeaseOwner(leaseKey);
      if (leaseKey !== key || !injectResume || observedOwner !== undefined) return observedOwner;
      injectResume = false;

      // Reproduce the release/read/publish gap deterministically: the sweep has
      // observed an empty key, then another instance acquires and re-suspends the
      // same durable run before that stale observation drives run-completed.
      await resumedRuntime.registerRun(
        fakeAgent,
        resumed.output,
        { memory: { thread: threadId, resource: RESOURCE_ID } },
        pubsub,
      );
      const previousPartCount = watcher.count('stream-part', runId);
      resumed.emitSuspendPart();
      await watcher.waitForCount('stream-part', runId, previousPartCount + 1);
      resumed.settle('suspended');
      await vi.waitFor(() =>
        expect(resumedRuntime.getResumableThreadRun({ threadId, resourceId: RESOURCE_ID, runId }, pubsub)).toEqual({
          runId,
          toolCallId: `${runId}-call`,
        }),
      );
      return observedOwner;
    });

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1);
    await watcher.waitFor('run-completed', runId);
    await new Promise(resolve => setTimeout(resolve, 0));

    // The completion belongs to the origin's older stream. It may close that
    // proxy, but it cannot clear or drain the resumed runtime's current stream.
    expect(resumedRuntime.getResumableThreadRun({ threadId, resourceId: RESOURCE_ID, runId }, pubsub)).toEqual({
      runId,
      toolCallId: `${runId}-call`,
    });
    const resumedOwner = await pubsub.getLeaseOwner(key);
    expect(resumedOwner).toBeDefined();
    expect(resumedOwner).not.toBe(originOwner);
    expect(subscription.activeRunId()).toBe(runId);

    // Finish a same-instance resume so its renewal timer and lease do not leak
    // beyond this test.
    const cleanupRun = createFakeRun(runId);
    await resumedRuntime.registerRun(
      fakeAgent,
      cleanupRun.output,
      { memory: { thread: threadId, resource: RESOURCE_ID } },
      pubsub,
    );
    cleanupRun.settle('success');
    await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(key)).toBeUndefined());
    subscription.unsubscribe();
  });
});
