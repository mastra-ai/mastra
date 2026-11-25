/**
 * Signals sent from one replica to a thread whose run another replica holds,
 * when the agents keep pending signals in memory storage. Two Mastra instances
 * stand in for two replicas: each has its own pubsub client, so each has its
 * own thread runtime, while both share the pubsub's events and one lease
 * table, as two processes share Redis. The sending replica runs no workers.
 */
import { EventEmitter } from 'node:events';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory/memory';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../../storage/domains/memory/inmemory';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { agentThreadStreamTopic } from '../../thread-stream-topic';
import { createEventedAgent } from '../create-evented-agent';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => (release = resolve));
  return { promise, release };
}

/** The in-memory memory storage, read and written by every replica of the test, as a shared database is. */
class SharedMemory extends InMemoryMemory {
  constructor() {
    super({ db: new InMemoryDB() });
  }

  override get pendingSignalsSharedAcrossProcesses(): boolean {
    return true;
  }
}

/** The shared memory storage, recording the id of every insert of a pending signal that reached it. */
class RecordingSharedMemory extends SharedMemory {
  readonly enqueued: string[] = [];

  override async enqueuePendingSignal(args: Parameters<InMemoryMemory['enqueuePendingSignal']>[0]) {
    this.enqueued.push(args.message.id);
    return super.enqueuePendingSignal(args);
  }
}

/** A replica's pubsub client: its own subscribers, the replicas' shared events and lease table. */
class ReplicaPubSub extends EventEmitterPubSub {
  /** Set to hold this replica's next acquire of `key` until the test releases it. */
  held?: { key: string; requested: ReturnType<typeof gate>; release: ReturnType<typeof gate> };

  constructor(
    events: EventEmitter,
    private leases: EventEmitterPubSub,
  ) {
    super(events);
  }

  override async acquireLease(key: string, owner: string, ttlMs: number) {
    const held = this.held;
    if (held?.key === key) {
      this.held = undefined;
      held.requested.release();
      await held.release.promise;
    }
    return this.leases.acquireLease(key, owner, ttlMs);
  }
  override getLeaseOwner(key: string) {
    return this.leases.getLeaseOwner(key);
  }
  override releaseLease(key: string, owner: string) {
    return this.leases.releaseLease(key, owner);
  }
  override renewLease(key: string, owner: string, ttlMs: number) {
    return this.leases.renewLease(key, owner, ttlMs);
  }
  override transferLease(key: string, fromOwner: string, toOwner: string, ttlMs: number) {
    return this.leases.transferLease(key, fromOwner, toOwner, ttlMs);
  }
}

function textOf(prompt: unknown): string {
  return JSON.stringify(prompt);
}

/** How many times `text` occurs in a model prompt. */
function occurrences(prompt: unknown, text: string): number {
  return textOf(prompt).split(text).length - 1;
}

const AGENT_ID = 'replicated-agent';
const BARRIER = 'BARRIER_QUEUED_AFTER_THE_RUN';

/**
 * Replicas of one deployment. `holder` runs the thread's run: its first model
 * call asks for a tool that waits for the test, later calls answer with text.
 */
function replicas(storage: InMemoryStore) {
  const events = new EventEmitter();
  const leases = new EventEmitterPubSub();
  const scope = { resourceId: `resource-${crypto.randomUUID()}`, threadId: `thread-${crypto.randomUUID()}` };
  const leaseKey = [scope.resourceId, scope.threadId].join('\u0000');
  const prompts: unknown[] = [];
  const toolReached = gate();
  const toolGate = gate();
  const barrierReached = gate();
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const call = prompts.length;
      if (textOf(prompt).includes(BARRIER)) barrierReached.release();
      return {
        warnings: [],
        stream: convertArrayToReadableStream(
          call === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-wait', toolName: 'wait', input: '{}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: `text-${call}` },
                { type: 'text-delta', id: `text-${call}`, delta: `answer ${call}` },
                { type: 'text-end', id: `text-${call}` },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ],
        ),
      };
    },
  });
  const wait = createTool({
    id: 'wait',
    description: 'Waits for the test',
    inputSchema: z.object({}),
    execute: async () => {
      toolReached.release();
      await toolGate.promise;
      return 'waited';
    },
  });

  type Memory = MastraMemory | ((args: { requestContext: RequestContext }) => MastraMemory);
  const replica = ({
    memory,
    evented = true,
    workers = true,
  }: {
    memory: Memory;
    evented?: boolean;
    workers?: boolean;
  }) => {
    const pubsub = new ReplicaPubSub(events, leases);
    const base = new Agent({ id: AGENT_ID, name: AGENT_ID, instructions: 'Test', model, memory, tools: { wait } });
    const agent = evented ? createEventedAgent({ agent: base, pubsub }) : base;
    const mastra = new Mastra({
      agents: { [AGENT_ID]: agent },
      storage,
      pubsub,
      logger: false,
      ...(workers ? {} : { workers: false as const }),
    });
    return { agent: mastra.getAgent(AGENT_ID), pubsub };
  };

  /** Starts the holder's run and waits until its tool holds it, past its first model request. */
  const startRun = async (holder: ReturnType<typeof replica>, requestContext?: RequestContext) => {
    const runId = `held-run-${crypto.randomUUID()}`;
    const stream = await holder.agent.stream('Start', {
      runId,
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 4,
      ...(requestContext ? { requestContext } : {}),
    });
    const done = (async () => {
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'error') throw (chunk as { payload?: { error?: unknown } }).payload?.error;
      }
    })();
    await toolReached.promise;
    return { runId, done };
  };

  /** Resolves once the holder took each of `signalIds` for its run. */
  const admittedBy = async (holder: ReturnType<typeof replica>, signalIds: () => string[]) => {
    const admitted = new Set<string>();
    const all = gate();
    await holder.pubsub.subscribe(agentThreadStreamTopic(scope.resourceId, scope.threadId), event => {
      const data = event.data as { type?: string; signalId?: string } | undefined;
      if (data?.type !== 'user-message-admitted' || !data.signalId) return;
      admitted.add(data.signalId);
      const ids = signalIds();
      if (ids.length && ids.every(id => admitted.has(id))) all.release();
    });
    return all.promise;
  };

  /**
   * `sender` sends a wake to the thread it believes idle, so it reserves the thread for a run of its own, and a
   * second message joins that reservation before it asks for the lease. The lease belongs to the holder's run.
   */
  const sendToLosingReservation = async (sender: ReturnType<typeof replica>, holder: ReturnType<typeof replica>) => {
    sender.pubsub.held = { key: leaseKey, requested: gate(), release: gate() };
    const { requested, release } = sender.pubsub.held;
    let ids: string[] = [];
    const admitted = admittedBy(holder, () => ids);
    const wake = sender.agent.sendSignal(
      { type: 'user-message', contents: 'WAKE_TO_A_LOSING_RESERVATION' },
      { ...scope, ifIdle: { behavior: 'wake' } },
    );
    await requested.promise;
    const joined = sender.agent.sendSignal({ type: 'user-message', contents: 'JOINED_A_LOSING_RESERVATION' }, scope);
    ids = [wake.signal.id, joined.signal.id];
    release.release();
    return { wake, joined, admitted };
  };

  /**
   * Queues a message behind the holder's run and waits for its model call. Queued messages start after every
   * follow-up turn the run left, so once this returns no follow-up turn of the run is still to come.
   */
  const afterFollowUps = async (holder: ReturnType<typeof replica>) => {
    const barrier = holder.agent.queueMessage(BARRIER, scope);
    await barrier.accepted;
    return barrierReached.promise;
  };

  /** The holder's model calls, without the barrier's. */
  const runPrompts = () => prompts.filter(prompt => !textOf(prompt).includes(BARRIER));

  return {
    scope,
    prompts,
    toolGate,
    replica,
    startRun,
    admittedBy,
    sendToLosingReservation,
    afterFollowUps,
    runPrompts,
  };
}

describe('a reservation that loses the thread to a run on another replica', () => {
  it.each([
    ['keeps its signals in the same memory storage', true],
    // The default engine keeps a run's signals in the process that runs it.
    ['keeps its signals in its own process', false],
  ] as const)(
    'delivers a signal that joined the reservation to the model request after the running tool when that run %s',
    async (_case, evented) => {
      const storage = new InMemoryStore();
      const memoryStore = new SharedMemory();
      storage.stores.memory = memoryStore;
      const { scope, toolGate, replica, startRun, sendToLosingReservation, afterFollowUps, runPrompts } =
        replicas(storage);
      const holder = replica({ memory: new MockMemory({ storage }), evented });
      const { runId, done } = await startRun(holder);
      // Never saw the run start, so it believes the thread idle.
      const sender = replica({ memory: new MockMemory({ storage }), workers: false });
      const { wake, joined, admitted } = await sendToLosingReservation(sender, holder);
      await expect(wake.accepted).resolves.toEqual({ action: 'deliver', runId });
      await expect(joined.accepted).resolves.toEqual({ action: 'deliver', runId });
      await admitted;
      const followUpsDone = afterFollowUps(holder);
      toolGate.release();
      await done;
      await followUpsDone;

      // The run's model request after the tool has both, once each, and no turn of their own follows.
      const prompts = runPrompts();
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[0], 'A_LOSING_RESERVATION')).toBe(0);
      expect(occurrences(prompts[1], 'WAKE_TO_A_LOSING_RESERVATION')).toBe(1);
      expect(occurrences(prompts[1], 'JOINED_A_LOSING_RESERVATION')).toBe(1);
      const saved = (await memoryStore.listMessages({ threadId: scope.threadId, perPage: false })).messages;
      expect(saved.filter(message => message.id === wake.signal.id)).toHaveLength(1);
      expect(saved.filter(message => message.id === joined.signal.id)).toHaveLength(1);
      expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
      // Nothing is left hidden for any run: a claim by the thread's next signal run returns nothing.
      await memoryStore.setSignalRun({ threadId: scope.threadId, runId: 'next-run' });
      expect(
        await memoryStore.claimPendingSignals({ threadId: scope.threadId, runId: 'next-run', consumedIds: [] }),
      ).toEqual([]);
    },
  );
});

describe('an agent whose memory is a function of the request context', () => {
  it("forwards a signal from a replica without the run's context, which stores it in the run's memory", async () => {
    const { scope, prompts, toolGate, replica, startRun, admittedBy } = replicas(new InMemoryStore());
    const tenantStorage = new InMemoryStore();
    const tenantMemoryStore = new SharedMemory();
    tenantStorage.stores.memory = tenantMemoryStore;
    const defaultStorage = new InMemoryStore();
    const defaultMemoryStore = new SharedMemory();
    defaultStorage.stores.memory = defaultMemoryStore;
    const tenantMemory = new MockMemory({ storage: tenantStorage });
    const defaultMemory = new MockMemory({ storage: defaultStorage });
    const memoryFor = (calls: { count: number }) => {
      return ({ requestContext }: { requestContext: RequestContext }) => {
        calls.count++;
        return requestContext.get('tenant') === 'tenant-a' ? tenantMemory : defaultMemory;
      };
    };
    const holder = replica({ memory: memoryFor({ count: 0 }) });
    const senderCalls = { count: 0 };
    const sender = replica({ memory: memoryFor(senderCalls), workers: false });
    // The sender watches the thread, so it knows a run of the agent holds it.
    const observer = await sender.agent.subscribeToThread(scope);
    const observedRun = observer.stream[Symbol.asyncIterator]().next();
    const { runId, done } = await startRun(holder, new RequestContext([['tenant', 'tenant-a']]));
    await observedRun;

    const callsBeforeSend = senderCalls.count;
    let ids: string[] = [];
    const admitted = admittedBy(holder, () => ids);
    const sent = sender.agent.sendSignal({ type: 'user-message', contents: 'SENT_WITHOUT_THE_CONTEXT' }, scope);
    ids = [sent.signal.id];
    const answer = await sent.accepted.catch((error: unknown) => error);
    expect(senderCalls.count).toBe(callsBeforeSend);
    expect(answer).toEqual({ action: 'deliver', runId });
    await admitted;
    toolGate.release();
    await done;
    observer.unsubscribe();

    expect(occurrences(prompts[1], 'SENT_WITHOUT_THE_CONTEXT')).toBe(1);
    const saved = (await tenantMemoryStore.listMessages({ threadId: scope.threadId, perPage: false })).messages;
    expect(saved.filter(message => message.id === sent.signal.id)).toHaveLength(1);
    expect(await tenantMemoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
    expect(await defaultMemoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
    expect(
      (await defaultMemoryStore.listMessages({ threadId: scope.threadId, perPage: false })).messages.filter(
        message => message.id === sent.signal.id,
      ),
    ).toEqual([]);
  });
});

describe('a signal a replica that does not hold the run stores itself', () => {
  it('is stored once and reaches the run once: the replica holding the run does not store it again', async () => {
    const storage = new InMemoryStore();
    const memoryStore = new RecordingSharedMemory();
    storage.stores.memory = memoryStore;
    const { scope, prompts, toolGate, replica, startRun, admittedBy } = replicas(storage);
    const holder = replica({ memory: new MockMemory({ storage }) });
    const sender = replica({ memory: new MockMemory({ storage }), workers: false });
    // The sender watches the thread, so it knows the run keeps its signals in the shared store.
    const observer = await sender.agent.subscribeToThread(scope);
    const observedRun = observer.stream[Symbol.asyncIterator]().next();
    const { runId, done } = await startRun(holder);
    await observedRun;

    let ids: string[] = [];
    const admitted = admittedBy(holder, () => ids);
    const sent = sender.agent.sendSignal({ type: 'user-message', contents: 'STORED_BY_THE_SENDER' }, scope);
    ids = [sent.signal.id];
    await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId });
    // The sender's own insert committed before it answered.
    expect(memoryStore.enqueued.filter(id => id === sent.signal.id)).toHaveLength(1);
    // The holder admits the signal after handling the sender's event, and stores nothing for it.
    await admitted;
    expect(memoryStore.enqueued.filter(id => id === sent.signal.id)).toHaveLength(1);
    toolGate.release();
    await done;
    observer.unsubscribe();

    expect(occurrences(prompts[1], 'STORED_BY_THE_SENDER')).toBe(1);
    const saved = (await memoryStore.listMessages({ threadId: scope.threadId, perPage: false })).messages;
    expect(saved.filter(message => message.id === sent.signal.id)).toHaveLength(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });
});
