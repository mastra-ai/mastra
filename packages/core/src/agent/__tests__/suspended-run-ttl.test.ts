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
    expect(releaseLease).not.toHaveBeenCalledWith(threadKey(RESOURCE_ID, 'thread-1'), 'run-1');
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
