/**
 * A run parked on a suspension must survive losing its thread lease to the run that
 * resumed it elsewhere (#29974).
 *
 * A durable run that suspends (tool approval, `ask_user`, any `suspend()`) keeps its
 * `AgentThreadStreamRuntime` record warm and keeps renewing its thread lease: holding
 * the thread is what queues later sends onto the suspension instead of starting a
 * second run beside it. A resume on another process registers the *same* run id and
 * takes the thread under its own lease owner, so the parked process's next renewal
 * finds a lease it no longer holds. Treating that as a lost lease used to remote-abort
 * the run — with the run id it still had, which reaches the process now executing the
 * resume and kills it mid-stream.
 *
 * A parked run has no step left to stop, so there is nothing for it to abort: it must
 * step its record aside (keep it resumable, stop blocking the thread) and let go, the
 * way it already does for a thread a different run ran to an end. These tests cover
 * both takeover shapes. `abortRunStream` is the observable — it is the hook that
 * publishes the cross-process abort request.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const { LEASE_RENEW_INTERVAL_MS } = vi.hoisted(() => {
  // Renewal is how a parked run learns its lease was taken; shrink the interval so a test
  // can watch that tick without waiting the production five seconds for each one.
  const renewIntervalMs = 20;
  process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS = String(renewIntervalMs);
  // The lease-lost path stops a run that is still executing after this grace. Keep it short
  // so a remote abort that should not happen is observable inside the test window.
  process.env.MASTRA_AGENT_THREAD_LEASE_LOST_TOOL_GRACE_MS = '200';
  return { LEASE_RENEW_INTERVAL_MS: renewIntervalMs };
});
// Vitest reuses a worker process across test files, so leave the defaults in place for
// whichever file this worker picks up next.
afterAll(() => {
  delete process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS;
  delete process.env.MASTRA_AGENT_THREAD_LEASE_LOST_TOOL_GRACE_MS;
});

// Mirrors the runtime's thread key + topic encoding: how a subscriber on another
// instance finds a given thread's events.
const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
const threadKey = (threadId: string) => [RESOURCE, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
const threadTopic = (threadId: string) => `agent.thread-stream.${encodeURIComponent(threadKey(threadId))}`;

const THREAD = 'parked-lease-loss-thread';
const RESOURCE = 'parked-lease-loss-user';
const LEASE_KEY = threadKey(THREAD);
const RUN_ID = 'run-1';

/**
 * What another process's resume stores as the thread's owner: the same run id, claimed for
 * one execution, so it is not the plain owner this process acquired the lease with.
 */
const resumedOwner = (runId: string) => `mastra:thread-lease:${JSON.stringify([runId, 'execution', 'resume-exec-1'])}`;

/** One lease table shared by every process, with real expiry, like Redis. */
class SharedLeases {
  leases = new Map<string, { owner: string; expiresAt: number }>();

  owner(key: string) {
    const lease = this.leases.get(key);
    return lease && lease.expiresAt > Date.now() ? lease.owner : undefined;
  }
}

/** This process's pubsub, leasing from the table two processes share, as two replicas share Redis. */
class SharedLeasePubSub extends EventEmitterPubSub {
  constructor(private shared: SharedLeases) {
    super();
  }
  override async acquireLease(key: string, owner: string, ttlMs: number) {
    const current = this.shared.owner(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return { acquired: true, owner };
  }
  override async getLeaseOwner(key: string) {
    return this.shared.owner(key);
  }
  override async releaseLease(key: string, owner: string) {
    if (this.shared.leases.get(key)?.owner === owner) this.shared.leases.delete(key);
  }
  override async renewLease(key: string, owner: string, ttlMs: number) {
    if (this.shared.owner(key) !== owner) return false;
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return true;
  }
  override async transferLease(key: string, fromOwner: string, toOwner: string) {
    if (this.shared.owner(key) !== fromOwner) return false;
    const lease = this.shared.leases.get(key)!;
    this.shared.leases.set(key, { ...lease, owner: toOwner });
    return true;
  }
}

/**
 * Minimal stand-in for the run output `registerRun` consumes: a run id, a live `status`, a
 * `fullStream` the runtime's broadcast tee pumps, and a completion promise. Suspension is
 * driven part-by-part so the runtime marks the run suspending from the stream (as a real
 * approval/suspend tool call does) rather than from test-only state.
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

/** Records everything the runtime publishes for the thread, for event assertions. */
async function watchThread(pubsub: EventEmitterPubSub, threadId: string) {
  const events: Event[] = [];
  await pubsub.subscribe(threadTopic(threadId), event => {
    events.push(event);
  });
  return {
    has: (type: string, runId: string) => events.some(event => event.type === type && event.runId === runId),
    waitFor: (type: string, runId: string) =>
      vi.waitFor(() => expect(events.some(event => event.type === type && event.runId === runId)).toBe(true)),
  };
}

type ThreadWatcher = Awaited<ReturnType<typeof watchThread>>;

/** Let anything the runtime publishes reach its subscribers before asserting it did not. */
const flushPublishes = () => new Promise(resolve => setTimeout(resolve, 0));

describe('a parked run whose thread lease moved to the resume that continues it', () => {
  let runtime: AgentThreadStreamRuntime;
  let shared: SharedLeases;
  let pubsub: SharedLeasePubSub;
  let abortRunStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    runtime = new AgentThreadStreamRuntime();
    shared = new SharedLeases();
    pubsub = new SharedLeasePubSub(shared);
    abortRunStream = vi.fn(() => true);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await pubsub.close();
  });

  /** Start `runId` on the thread and drive it to a suspended, parked record holding the lease. */
  async function parkRun(runId: string, threadId: string, watcher: ThreadWatcher) {
    const agent = { id: 'parked-lease-loss-agent', abortRunStream } as unknown as Agent<any, any, any, any>;
    const run = createFakeRun(runId);
    await runtime.registerRun(agent, run.output, { memory: { thread: threadId, resource: RESOURCE } }, pubsub, {
      continuation: 'across-suspension',
    });

    // Let the broadcast tee publish the suspend part before the run settles, so the
    // runtime sees the suspension the same way it does in production: marked from the
    // stream first, parked when the stream finishes.
    run.emitSuspendPart();
    await watcher.waitFor('stream-part', runId);
    run.settle('suspended');
    await watcher.waitFor('run-suspended', runId);

    expect(runtime.getResumableThreadRun({ threadId, resourceId: RESOURCE, runId }, pubsub)).toEqual({
      runId,
      toolCallId: `${runId}-call`,
    });
    return run;
  }

  /**
   * Park a run here, hand the thread to `successor` in the shared backend, and check this
   * process lets go instead of stopping the run that took it.
   */
  async function expectStepAsideWhenThreadTaken(successor: string) {
    const watcher = await watchThread(pubsub, THREAD);
    await parkRun(RUN_ID, THREAD, watcher);
    // While parked the record still holds the thread, which is what queues a later send
    // onto the suspension instead of starting a run beside it.
    expect(shared.owner(LEASE_KEY)).toBe(RUN_ID);
    expect(runtime.getActiveThreadRunId({ threadId: THREAD, resourceId: RESOURCE }, pubsub)).toBe(RUN_ID);

    shared.leases.set(LEASE_KEY, { owner: successor, expiresAt: Date.now() + 60_000 });

    // The next renewal finds a lease this process no longer holds. Wait until it has acted
    // on that either way, then assert which way: it must drop its hold on the thread and
    // not publish an abort, which reaches the process executing the resume and cuts that
    // stream off mid-flight.
    await vi.waitFor(() =>
      expect(
        abortRunStream.mock.calls.length > 0 ||
          runtime.getActiveThreadRunId({ threadId: THREAD, resourceId: RESOURCE }, pubsub) === undefined,
      ).toBe(true),
    );
    await flushPublishes();

    expect(abortRunStream).not.toHaveBeenCalled();
    expect(runtime.getActiveThreadRunId({ threadId: THREAD, resourceId: RESOURCE }, pubsub)).toBeUndefined();
    expect(watcher.has('run-aborted', RUN_ID)).toBe(false);
    expect(watcher.has('run-completed', RUN_ID)).toBe(false);
    // The lease is the taker's, so this process must not hand it back.
    expect(shared.owner(LEASE_KEY)).toBe(successor);

    // Parked but no longer blocking: the thread reads idle again and the record stays
    // resumable, so a resume that lands back on this process still finds it.
    expect(runtime.getThreadState({ threadId: THREAD, resourceId: RESOURCE }, pubsub)).toBe('idle');
    expect(runtime.getResumableThreadRun({ threadId: THREAD, resourceId: RESOURCE, runId: RUN_ID }, pubsub)).toEqual({
      runId: RUN_ID,
      toolCallId: `${RUN_ID}-call`,
    });
  }

  it('steps the parked record aside when the resumed run takes the thread elsewhere', async () => {
    await expectStepAsideWhenThreadTaken(resumedOwner(RUN_ID));
  });

  it('steps the parked record aside when a different run takes the thread', async () => {
    await expectStepAsideWhenThreadTaken('successor-run');
  });

  it('still stops a run that loses its lease while its steps are still running', async () => {
    const watcher = await watchThread(pubsub, THREAD);
    // Not parked: the stream is still open, so the record has steps worth stopping.
    const agent = { id: 'running-lease-loss-agent', abortRunStream } as unknown as Agent<any, any, any, any>;
    const run = createFakeRun(RUN_ID);
    await runtime.registerRun(agent, run.output, { memory: { thread: THREAD, resource: RESOURCE } }, pubsub);
    await watcher.waitFor('run-registered', RUN_ID);

    shared.leases.set(LEASE_KEY, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });

    await vi.waitFor(() => expect(abortRunStream).toHaveBeenCalledWith(RUN_ID));
  });

  it('keeps a parked run that still holds its lease for a resume on this process', async () => {
    const watcher = await watchThread(pubsub, THREAD);
    await parkRun(RUN_ID, THREAD, watcher);

    // Several renewal intervals: nothing has taken the thread, so the hold stands.
    await new Promise(resolve => setTimeout(resolve, LEASE_RENEW_INTERVAL_MS * 4));

    expect(abortRunStream).not.toHaveBeenCalled();
    expect(shared.owner(LEASE_KEY)).toBe(RUN_ID);
    expect(runtime.getActiveThreadRunId({ threadId: THREAD, resourceId: RESOURCE }, pubsub)).toBe(RUN_ID);
    expect(runtime.getResumableThreadRun({ threadId: THREAD, resourceId: RESOURCE, runId: RUN_ID }, pubsub)).toEqual({
      runId: RUN_ID,
      toolCallId: `${RUN_ID}-call`,
    });
  });
});
