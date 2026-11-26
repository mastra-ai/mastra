/**
 * A message sent to a running evented agent cuts short a model request that has
 * produced only reasoning, so the loop asks again with the message. When the
 * run's steps execute in another process than the one that stored the signal,
 * the `signal-available` hint on the run's control topic is what tells that
 * process. The hint is only an optimization: the stored row reaches the run at
 * its next drain point either way.
 *
 * The cross-process cases run the worker in a fresh module registry, sharing
 * only storage and a broker with the processes that start the run and send to
 * it, as a worker pod does.
 */
import { EventEmitter } from 'node:events';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event, EventCallback, SubscribeOptions } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { LeasingBrokerConnection } from '../../../mastra/test-utils/shared-broker';
import { MockMemory } from '../../../memory/mock';
import type { MastraDBMessage } from '../../../memory/types';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import type { PendingSignalEnqueueResult } from '../../../storage/domains/memory/base';
import { InMemoryMemory } from '../../../storage/domains/memory/inmemory';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_CONTROL_TOPIC, AgentControlEventTypes, AgentStreamEventTypes } from '../../streams/constants';
import { AGENT_THREAD_STREAM_TOPIC_PREFIX } from '../../thread-stream-topic';
import { publishSignalAvailable, requestAcknowledgedAbort } from '../abort-transport';
import { createEventedAgent } from '../create-evented-agent';
import { __resetExecutionFencesForTests } from '../execution-fence';

/** Bounds a hang; every test settles on its own gates long before it. */
const TEST_TIMEOUT_MS = 10_000;

const CONTROL_TOPIC_PREFIX = AGENT_CONTROL_TOPIC('');

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => (release = resolve));
  return { promise, release };
}

/** Resolves `when(id)` once `add(id)` was called, before or after. */
class Seen {
  readonly ids: string[] = [];
  #waiters: Array<{ id: string; count: number; resolve: () => void }> = [];

  #count(id: string) {
    return this.ids.filter(seen => seen === id).length;
  }

  add(id: string) {
    this.ids.push(id);
    const reached = this.#waiters.filter(waiter => waiter.id === id && waiter.count <= this.#count(id));
    this.#waiters = this.#waiters.filter(waiter => !reached.includes(waiter));
    for (const waiter of reached) waiter.resolve();
  }

  /** Resolves once `id` was added `count` times. */
  whenCount(id: string, count: number): Promise<void> {
    if (this.#count(id) >= count) return Promise.resolve();
    return new Promise(resolve => this.#waiters.push({ id, count, resolve }));
  }

  when(id: string): Promise<void> {
    return this.whenCount(id, 1);
  }
}

function signalIdOf(event: Pick<Event, 'type' | 'data'>): string | undefined {
  if (event.type !== AgentControlEventTypes.SIGNAL_AVAILABLE) return undefined;
  return (event.data as { signalId?: string } | undefined)?.signalId;
}

/** Wraps a pubsub so the test learns which hints it published, and how its control-topic subscribers handled one. */
function observeHints<T extends { new (...args: any[]): EventEmitterPubSub | LeasingBrokerConnection }>(Base: T) {
  return class extends Base {
    /** Ids of the hints published through this pubsub. */
    published = new Seen();
    /** The hints published through this pubsub, with the run whose control topic each went to. */
    readonly hints: Array<{ runId: string; signalId: string }> = [];
    /** Runs when a hint is published through this pubsub, before it is sent. */
    onHint?: (signalId: string) => void;
    /** Ids of the hints that reached this pubsub's control-topic subscribers. */
    delivered = new Seen();
    /** Ids of the hints this pubsub's control-topic subscribers acknowledged. */
    acked = new Seen();
    /** Ids of the hints this pubsub's control-topic subscribers finished handling, with or without an error. */
    handled = new Seen();
    /** Errors this pubsub's control-topic subscribers threw while handling a hint. */
    readonly handlerErrors: unknown[] = [];
    /** Drop every hint published through this pubsub, as a transport that loses it does. */
    dropHints = false;
    /** While set, hints reach this pubsub's subscribers only once it resolves. */
    holdHints?: Promise<void>;
    /** Ids of the forwarded signals this pubsub's thread subscribers finished handling. */
    forwardHandled = new Seen();
    /** Runs before each event this pubsub publishes. */
    onPublish?: (topic: string, event: Omit<Event, 'id' | 'createdAt'>) => void;
    readonly #wrapped = new Map<string, Map<EventCallback, EventCallback>>();

    override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
      this.onPublish?.(topic, event);
      const signalId = signalIdOf(event);
      if (signalId) {
        this.onHint?.(signalId);
        this.published.add(signalId);
        this.hints.push({ runId: topic.slice(CONTROL_TOPIC_PREFIX.length), signalId });
        if (this.dropHints) return;
      }
      return super.publish(topic, event, options);
    }

    override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
      let wrapped: EventCallback;
      if (topic.startsWith(CONTROL_TOPIC_PREFIX)) {
        wrapped = async (event, ack, nack) => {
          const signalId = signalIdOf(event);
          if (!signalId) return cb(event, ack, nack);
          this.delivered.add(signalId);
          try {
            if (this.holdHints) await this.holdHints;
            await cb(
              event,
              async () => {
                this.acked.add(signalId);
                await ack?.();
              },
              nack,
            );
          } catch (error) {
            this.handlerErrors.push(error);
            throw error;
          } finally {
            this.handled.add(signalId);
          }
        };
      } else if (topic.startsWith(AGENT_THREAD_STREAM_TOPIC_PREFIX)) {
        wrapped = async (event, ack, nack) => {
          await cb(event, ack, nack);
          const data = event.data as { type?: string; signal?: { id?: string } } | undefined;
          if (data?.type === 'signal-enqueued' && data.signal?.id) this.forwardHandled.add(data.signal.id);
        };
      } else {
        return super.subscribe(topic, cb, options);
      }
      const byCallback = this.#wrapped.get(topic) ?? new Map<EventCallback, EventCallback>();
      this.#wrapped.set(topic, byCallback);
      byCallback.set(cb, wrapped);
      return super.subscribe(topic, wrapped, options);
    }

    override async unsubscribe(topic: string, cb: EventCallback) {
      const wrapped = this.#wrapped.get(topic)?.get(cb);
      this.#wrapped.get(topic)?.delete(cb);
      return super.unsubscribe(topic, wrapped ?? cb);
    }
  };
}

const HintBrokerConnection = observeHints(LeasingBrokerConnection);
type HintBrokerConnection = InstanceType<typeof HintBrokerConnection>;
const HintPubSub = observeHints(EventEmitterPubSub);
type HintPubSub = InstanceType<typeof HintPubSub>;
type ObservedPubSub = HintBrokerConnection | HintPubSub;

/** A broker that several Mastra instances connect to, as pods share one Redis. */
function hintBroker() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  const leases = new EventEmitterPubSub();
  return { connect: () => new HintBrokerConnection(emitter, false, leases) };
}

/**
 * The in-memory memory storage over `db`, recording the inserts that reached
 * it and the ids it stored. The claim hooks hold a claim before or after it
 * reads the store, as a claim whose query or answer is slow does.
 */
class ObservedSignals extends InMemoryMemory {
  /** The inserts that reached this store, with the run each named. */
  readonly enqueued: Array<{ id: string; toRunId?: string }> = [];
  /** Ids of the rows this store accepted. */
  readonly stored = new Set<string>();
  beforeClaimRead?: () => Promise<void>;
  afterClaimRead?: (rows: MastraDBMessage[]) => Promise<void>;
  claims = 0;
  readonly #shared: boolean;

  constructor({ db = new InMemoryDB(), shared = false }: { db?: InMemoryDB; shared?: boolean } = {}) {
    super({ db });
    this.#shared = shared;
  }

  override get pendingSignalsSharedAcrossProcesses(): boolean {
    return this.#shared;
  }

  override async enqueuePendingSignal(args: {
    message: MastraDBMessage;
    toRunId?: string;
  }): Promise<PendingSignalEnqueueResult> {
    this.enqueued.push({ id: args.message.id, ...(args.toRunId ? { toRunId: args.toRunId } : {}) });
    const written = await super.enqueuePendingSignal(args);
    if (written === 'accepted') this.stored.add(args.message.id);
    return written;
  }

  override async claimPendingSignals(args: { threadId: string; runId: string; consumedIds: string[] }) {
    this.claims++;
    await this.beforeClaimRead?.();
    const rows = await super.claimPendingSignals(args);
    await this.afterClaimRead?.(rows);
    return rows;
  }
}

/**
 * Records, for every pubsub of a test, the hints published for a row none of
 * `stores` holds yet, which must never happen: a process that hears a hint may
 * claim at once. Each pubsub's handler errors are checked when the test ends.
 */
function guardHints(pubsubs: ObservedPubSub[], stores: ObservedSignals[]) {
  const hintsBeforeStored: string[] = [];
  for (const pubsub of pubsubs) {
    pubsub.onHint = signalId => {
      if (!stores.some(store => store.stored.has(signalId))) hintsBeforeStored.push(signalId);
    };
  }
  onTestFinished(() => {
    for (const pubsub of pubsubs) expect(pubsub.handlerErrors).toEqual([]);
  });
  return hintsBeforeStored;
}

/** Memory storage that keeps no pending signals, as stores other than Postgres, LibSQL and in-memory. */
class NoPendingSignalsMemory extends InMemoryMemory {
  override readonly supportsPendingSignals = false;

  constructor() {
    super({ db: new InMemoryDB() });
  }
}

function storageOf(memoryStore: InMemoryMemory) {
  const storage = new InMemoryStore();
  storage.stores.memory = memoryStore;
  return storage;
}

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function toolCallStream(toolName: string) {
  return convertArrayToReadableStream<LanguageModelV2StreamPart>([
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId: `call-${toolName}`, toolName, input: '{}' },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ]);
}

function answerStream(call: number) {
  return convertArrayToReadableStream<LanguageModelV2StreamPart>([
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: `text-${call}` },
    { type: 'text-delta', id: `text-${call}`, delta: `answer ${call}` },
    { type: 'text-end', id: `text-${call}` },
    { type: 'finish', finishReason: 'stop', usage },
  ]);
}

/**
 * Streams `head`, then holds. Cut short by the request's abort, or streams `tail` and finishes once `release`
 * resolves. `onAbort` runs when the request is cut short.
 */
function heldStream(
  { head, tail }: { head: LanguageModelV2StreamPart[]; tail: LanguageModelV2StreamPart[] },
  abortSignal: AbortSignal | undefined,
  release: Promise<void>,
  onAbort: () => void,
) {
  return new ReadableStream<LanguageModelV2StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      for (const part of head) controller.enqueue(part);
      let settled = false;
      const cut = () => {
        if (settled) return;
        settled = true;
        onAbort();
        controller.error(abortSignal?.reason);
      };
      // A signal aborted before the stream started never fires its listener.
      if (abortSignal?.aborted) cut();
      else abortSignal?.addEventListener('abort', cut, { once: true });
      void release.then(() => {
        if (settled) return;
        settled = true;
        for (const part of tail) controller.enqueue(part);
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
        controller.close();
      });
    },
  });
}

/** Streams reasoning, then holds. Cut short by the request's abort, or answers once `release` resolves. */
function reasoningStream(abortSignal: AbortSignal | undefined, release: Promise<void>, onAbort: () => void) {
  return heldStream(
    {
      head: [
        { type: 'reasoning-start', id: 'thinking' },
        { type: 'reasoning-delta', id: 'thinking', delta: 'thinking' },
      ],
      tail: [
        { type: 'reasoning-end', id: 'thinking' },
        { type: 'text-start', id: 'text-held' },
        { type: 'text-delta', id: 'text-held', delta: 'answer after thinking' },
        { type: 'text-end', id: 'text-held' },
      ],
    },
    abortSignal,
    release,
    onAbort,
  );
}

/** Streams the start of an answer, then holds. Cut short by the request's abort, or finishes once `release` resolves. */
function textStream(abortSignal: AbortSignal | undefined, release: Promise<void>, onAbort: () => void) {
  return heldStream(
    {
      head: [
        { type: 'text-start', id: 'text-held' },
        { type: 'text-delta', id: 'text-held', delta: 'started answering' },
      ],
      tail: [
        { type: 'text-delta', id: 'text-held', delta: ' and finished' },
        { type: 'text-end', id: 'text-held' },
      ],
    },
    abortSignal,
    release,
    onAbort,
  );
}

type ModelCall = { prompt: unknown; abortSignal?: AbortSignal; call: number };

/** A model whose calls the test scripts; every prompt is recorded, and `beforeCall.run` runs as each call starts. */
function scriptedModel(respond: (call: ModelCall) => ReadableStream<LanguageModelV2StreamPart>) {
  const prompts: unknown[] = [];
  const beforeCall: { run?: () => void } = {};
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt, abortSignal }) => {
      beforeCall.run?.();
      prompts.push(prompt);
      return { warnings: [], stream: respond({ prompt, abortSignal, call: prompts.length }) };
    },
  });
  return { model, prompts, beforeCall };
}

/** Asks for the `wait` tool, then answers. */
function toolThenAnswer({ call }: ModelCall) {
  return call === 1 ? toolCallStream('wait') : answerStream(call);
}

/** The first request reasons until it is cut short or `release` resolves; later ones answer. */
function reasoningThenAnswer(release: Promise<void>, onAbort: () => void) {
  return ({ call, abortSignal }: ModelCall) =>
    call === 1 ? reasoningStream(abortSignal, release, onAbort) : answerStream(call);
}

function occurrences(prompt: unknown, text: string): number {
  return JSON.stringify(prompt).split(text).length - 1;
}

function newScope() {
  return { resourceId: `resource-${crypto.randomUUID()}`, threadId: `thread-${crypto.randomUUID()}` };
}

/**
 * Consumes a run's stream; `reasoned` and `answering` resolve once the consumer saw reasoning or text, and reject
 * when the stream ends or fails first.
 */
function consume(stream: { fullStream: AsyncIterable<unknown> }) {
  const chunks: Array<{ type: string; payload?: any }> = [];
  const reasoned = gate();
  const answering = gate();
  const done = (async () => {
    for await (const chunk of stream.fullStream as AsyncIterable<{ type: string; payload?: any }>) {
      chunks.push(chunk);
      if (chunk.type === 'reasoning-delta') reasoned.release();
      if (chunk.type === 'text-delta') answering.release();
    }
    const error = chunks.find(chunk => chunk.type === 'error');
    if (error) throw error.payload?.error ?? new Error('the run reported an error');
  })();
  const seen = (chunkGate: ReturnType<typeof gate>, chunkType: string) => {
    const seenFirst = Promise.race([
      chunkGate.promise,
      done.then(
        () => {
          throw new Error(`the run's stream ended without a ${chunkType} chunk`);
        },
        error => {
          throw new Error(`the run's stream failed before a ${chunkType} chunk`, { cause: error });
        },
      ),
    ]);
    // A test that waits on only some of the gates leaves the others unawaited.
    void seenFirst.catch(() => {});
    return seenFirst;
  };
  return { chunks, reasoned: seen(reasoned, 'reasoning-delta'), answering: seen(answering, 'text-delta'), done };
}

/**
 * Counts the model request steps that started on `pubsub`'s process, from the iteration-start event each publishes
 * before it reads its signals, and groups the claims by the step they ran in. `atModelCall` holds, for each model
 * call, the claims its step had made when the call started.
 */
function watchModelSteps(
  pubsub: HintBrokerConnection,
  signals: ObservedSignals,
  beforeCall: ReturnType<typeof scriptedModel>['beforeCall'],
) {
  let started = 0;
  const claims = new Map<number, string[][]>();
  const atModelCall: string[][][] = [];
  pubsub.onPublish = (topic, event) => {
    if (topic.startsWith('agent.stream.') && event.type === AgentStreamEventTypes.ITERATION_START) started++;
  };
  beforeCall.run = () => atModelCall.push((claims.get(started) ?? []).map(ids => [...ids]));
  let hold: ((step: number, index: number) => Promise<void> | void) | undefined;
  signals.afterClaimRead = async rows => {
    const step = started;
    const inStep = claims.get(step) ?? [];
    claims.set(step, inStep);
    inStep.push(rows.map(row => row.id));
    await hold?.(step, inStep.length);
  };
  /** Runs `onClaim` for each claim after it read the store, with the step it ran in and its index there. */
  const onClaim = (onClaim: (step: number, index: number) => Promise<void> | void) => {
    hold = onClaim;
  };
  return { started: () => started, claims, atModelCall, onClaim };
}

const AGENT_ID = 'hinted';

/**
 * The process a user's request reaches, which starts the run and runs no
 * workers, and a worker process that executes the run's steps. With
 * `senderSignals`, another process without workers, whose agent's memory
 * storage is `senderSignals`, sends to the run the API process holds.
 */
async function apiAndWorker({
  model,
  signals = new ObservedSignals(),
  inputProcessors,
  senderSignals,
}: {
  model: MockLanguageModelV2;
  signals?: ObservedSignals;
  inputProcessors?: Processor[];
  senderSignals?: ObservedSignals;
}) {
  const broker = hintBroker();
  const storage = storageOf(signals);
  // The `wait` tool reports that it runs, and returns once the test releases it.
  const toolReached = gate();
  const tool = gate();
  const waitConfig = {
    id: 'wait',
    description: 'Waits for the test',
    inputSchema: z.object({}),
    execute: async () => {
      toolReached.release();
      await tool.promise;
      return 'waited';
    },
  };
  const agentConfig = {
    id: AGENT_ID,
    name: AGENT_ID,
    instructions: 'Test',
    model,
    ...(inputProcessors ? { inputProcessors } : {}),
  };

  const apiPubsub = broker.connect();
  const apiAgent = createEventedAgent({
    agent: new Agent({ ...agentConfig, memory: new MockMemory({ storage }), tools: { wait: createTool(waitConfig) } }),
    pubsub: apiPubsub,
  });
  const api = new Mastra({ agents: { agent: apiAgent }, storage, pubsub: apiPubsub, workers: false, logger: false });

  let sender: { agent: typeof apiAgent; mastra: Mastra; pubsub: HintBrokerConnection } | undefined;
  if (senderSignals) {
    const senderStorage = storageOf(senderSignals);
    const pubsub = broker.connect();
    const agent = createEventedAgent({
      agent: new Agent({
        ...agentConfig,
        memory: new MockMemory({ storage: senderStorage }),
        tools: { wait: createTool(waitConfig) },
      }),
      pubsub,
    });
    const mastra = new Mastra({ agents: { agent }, storage: senderStorage, pubsub, workers: false, logger: false });
    sender = { agent, mastra, pubsub };
  }

  vi.resetModules();
  const workerFences = await import('../execution-fence');
  const { createEventedAgent: createWorkerAgent } = await import('../create-evented-agent');
  const { Agent: WorkerAgent } = await import('../../agent');
  const { Mastra: WorkerMastra } = await import('../../../mastra');
  const { MockMemory: WorkerMemory } = await import('../../../memory/mock');
  const { createTool: createWorkerTool } = await import('../../../tools');
  const { InMemoryServerCache: WorkerCache } = await import('../../../cache/inmemory');
  // A step publishes through a pubsub that reads this cache before it sends, so the read marks the moment the step
  // published: the ids of the rows stored at that moment are recorded for each control-topic publish.
  const storedAtStepHints: string[][] = [];
  class ObservedCache extends WorkerCache {
    override async listLength(key: string) {
      if (decodeURIComponent(key).includes(CONTROL_TOPIC_PREFIX)) storedAtStepHints.push([...signals.stored]);
      return super.listLength(key);
    }
  }
  const workerPubsub = broker.connect();
  const worker = new WorkerMastra({
    cache: new ObservedCache(),
    agents: {
      agent: createWorkerAgent({
        agent: new WorkerAgent({
          ...agentConfig,
          memory: new WorkerMemory({ storage }),
          tools: { wait: createWorkerTool(waitConfig) },
        }),
        pubsub: workerPubsub,
      }),
    },
    storage,
    pubsub: workerPubsub,
    logger: false,
  });
  const hintsBeforeStored = guardHints(
    [apiPubsub, workerPubsub, ...(sender ? [sender.pubsub] : [])],
    [signals, ...(senderSignals ? [senderSignals] : [])],
  );
  onTestFinished(async () => {
    await api.shutdown();
    await sender?.mastra.shutdown();
    await worker.shutdown();
    // Each module copy keeps its own fences: the API process holds the run's coordinator, the worker its steps'.
    __resetExecutionFencesForTests();
    workerFences.__resetExecutionFencesForTests();
    await apiPubsub.close();
    await sender?.pubsub.close();
    await workerPubsub.close();
  });
  await worker.startWorkers();
  return {
    apiAgent,
    apiPubsub,
    workerPubsub,
    sender,
    signals,
    hintsBeforeStored,
    storedAtStepHints,
    toolReached: toolReached.promise,
    tool,
  };
}

function startRun<A extends { stream: (message: string, options: any) => Promise<any> }>(
  agent: A,
  scope: ReturnType<typeof newScope>,
  options: Record<string, unknown> = {},
): ReturnType<A['stream']> {
  return agent.stream('Start', {
    memory: { thread: scope.threadId, resource: scope.resourceId },
    maxSteps: 4,
    ...options,
  }) as ReturnType<A['stream']>;
}

describe('a message sent to an evented run whose steps execute in another process', () => {
  it(
    'cuts short a model request that has produced only reasoning, and the next request has the message once',
    async () => {
      let cutShort = 0;
      const firstRequest = gate();
      const { model, prompts } = scriptedModel(reasoningThenAnswer(firstRequest.promise, () => cutShort++));
      const { apiAgent, apiPubsub, workerPubsub, signals, hintsBeforeStored } = await apiAndWorker({ model });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'STEER_FROM_API' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      // A request the hint did not cut answers now, and the message waits for the next drain point.
      firstRequest.release();
      await done;

      expect(cutShort).toBe(1);
      expect(workerPubsub.handled.ids).toEqual([sent.signal.id]);
      expect(workerPubsub.acked.ids).toEqual(workerPubsub.delivered.ids);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STEER_FROM_API')).toBe(1);
      expect(signals.enqueued).toEqual([{ id: sent.signal.id, toRunId: stream.runId }]);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'lets the request finish when the hint is lost, and the next request has the message once',
    async () => {
      let cutShort = 0;
      const firstRequest = gate();
      const { model, prompts } = scriptedModel(reasoningThenAnswer(firstRequest.promise, () => cutShort++));
      const { apiAgent, apiPubsub, workerPubsub } = await apiAndWorker({ model });
      apiPubsub.dropHints = true;
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'STEER_HINT_LOST' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      firstRequest.release();
      await done;

      expect(workerPubsub.handled.ids).toEqual([]);
      expect(cutShort).toBe(0);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[0], 'STEER_HINT_LOST')).toBe(0);
      expect(occurrences(prompts[1], 'STEER_HINT_LOST')).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'does not cut short a request that has started its answer, and the next request has the message once',
    async () => {
      let cutShort = 0;
      const firstRequest = gate();
      const { model, prompts } = scriptedModel(({ call, abortSignal }) =>
        call === 1 ? textStream(abortSignal, firstRequest.promise, () => cutShort++) : answerStream(call),
      );
      const { apiAgent, apiPubsub, workerPubsub, hintsBeforeStored } = await apiAndWorker({ model });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { answering, done } = consume(stream);
      await answering;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'SENT_WHILE_ANSWERING' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      firstRequest.release();
      await done;

      expect(cutShort).toBe(0);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[0], 'SENT_WHILE_ANSWERING')).toBe(0);
      expect(occurrences(prompts[1], 'SENT_WHILE_ANSWERING')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'cuts short the request once for a hint heard twice, and does not cut the next request for it',
    async () => {
      let cutShort = 0;
      let sentId: string | undefined;
      const firstRequest = gate();
      const secondRequest = gate();
      const { model, prompts } = scriptedModel(({ call, abortSignal }) => {
        if (call === 1) return reasoningStream(abortSignal, firstRequest.promise, () => cutShort++);
        if (call === 2) {
          secondRequest.release();
          // Answers once the worker handled the hint a second time.
          return reasoningStream(abortSignal, workerPubsub.handled.whenCount(sentId!, 2), () => cutShort++);
        }
        return answerStream(call);
      });
      const { apiAgent, apiPubsub, workerPubsub, hintsBeforeStored } = await apiAndWorker({ model });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'HINTED_TWICE' }, scope);
      sentId = sent.signal.id;
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      // A request the hint did not cut answers now.
      firstRequest.release();
      // The same hint again, heard once the next request is running.
      workerPubsub.holdHints = secondRequest.promise;
      await publishSignalAvailable(apiPubsub, stream.runId, sent.signal.id);
      await done;

      expect(workerPubsub.handled.ids).toEqual([sent.signal.id, sent.signal.id]);
      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'HINTED_TWICE')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  // The control subscription is live, so a hint can arrive once its signal is already in the request it would cut.
  it(
    'does not cut short a request that already has the hinted message',
    async () => {
      let cutShort = 0;
      const secondRequest = gate();
      const { model, prompts } = scriptedModel(({ call, abortSignal }) => {
        if (call === 1) return toolCallStream('wait');
        if (call === 2) return reasoningStream(abortSignal, secondRequest.promise, () => cutShort++);
        return answerStream(call);
      });
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool, hintsBeforeStored } = await apiAndWorker({
        model,
      });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await toolReached;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'SENT_DURING_TOOL' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      // Heard while the tool runs, when no model request can be cut short.
      await workerPubsub.handled.when(sent.signal.id);
      tool.release();
      await reasoned;
      expect(occurrences(prompts[1], 'SENT_DURING_TOOL')).toBe(1);
      await publishSignalAvailable(apiPubsub, stream.runId, sent.signal.id);
      await workerPubsub.handled.whenCount(sent.signal.id, 2);
      secondRequest.release();
      await done;

      expect(cutShort).toBe(0);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'SENT_DURING_TOOL')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'takes a message stored while the request read its signals into that same request, without cutting it',
    async () => {
      const claimRead = gate();
      const claimHeld = gate();
      const signals = new ObservedSignals();
      const { model, prompts, beforeCall } = scriptedModel(toolThenAnswer);
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool, hintsBeforeStored } = await apiAndWorker({
        model,
        signals,
      });
      const modelSteps = watchModelSteps(workerPubsub, signals, beforeCall);
      // Holds the first claim of the model request step after the tool.
      modelSteps.onClaim(async (step, index) => {
        if (step !== 2 || index !== 1) return;
        claimRead.release();
        await claimHeld.promise;
      });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await toolReached;
      tool.release();
      await claimRead.promise;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'STORED_DURING_CLAIM' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      claimHeld.release();
      await done;

      // One claim before the first request; before the second, the claim that missed it and the one that took it.
      expect(modelSteps.atModelCall).toEqual([[[]], [[], [sent.signal.id]]]);
      expect(modelSteps.started()).toBe(2);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STORED_DURING_CLAIM')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'does not claim once more for a message the first claim took while its hint was heard',
    async () => {
      const claimReached = gate();
      const claimHeld = gate();
      const signals = new ObservedSignals();
      const { model, prompts, beforeCall } = scriptedModel(toolThenAnswer);
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool, hintsBeforeStored } = await apiAndWorker({
        model,
        signals,
      });
      const modelSteps = watchModelSteps(workerPubsub, signals, beforeCall);
      let held = false;
      // Holds the first claim of the model request step after the tool before it reads the store.
      signals.beforeClaimRead = async () => {
        if (modelSteps.started() !== 2 || held) return;
        held = true;
        claimReached.release();
        await claimHeld.promise;
      };
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await toolReached;
      tool.release();
      await claimReached.promise;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'TAKEN_WHILE_HINTED' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      claimHeld.release();
      await done;

      expect(modelSteps.atModelCall).toEqual([[[]], [[sent.signal.id]]]);
      expect(modelSteps.started()).toBe(2);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'TAKEN_WHILE_HINTED')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'cuts short the request about to start when a second message is announced during its one more claim',
    async () => {
      const firstRead = gate();
      const firstHeld = gate();
      const secondRead = gate();
      const secondHeld = gate();
      const signals = new ObservedSignals();
      const { model, prompts, beforeCall } = scriptedModel(toolThenAnswer);
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool, hintsBeforeStored } = await apiAndWorker({
        model,
        signals,
      });
      const modelSteps = watchModelSteps(workerPubsub, signals, beforeCall);
      // Holds both claims of the model request step after the tool.
      modelSteps.onClaim(async (step, index) => {
        if (step !== 2) return;
        if (index === 1) {
          firstRead.release();
          await firstHeld.promise;
        } else if (index === 2) {
          secondRead.release();
          await secondHeld.promise;
        }
      });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await toolReached;
      tool.release();

      await firstRead.promise;
      const first = apiAgent.sendSignal({ type: 'user', contents: 'FIRST_DURING_CLAIM' }, scope);
      await expect(first.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: first.signal.id }]);
      await workerPubsub.handled.when(first.signal.id);
      firstHeld.release();

      await secondRead.promise;
      const second = apiAgent.sendSignal({ type: 'user', contents: 'SECOND_DURING_CLAIM' }, scope);
      await expect(second.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      await workerPubsub.handled.when(second.signal.id);
      secondHeld.release();
      await done;

      // The claim that missed the first message, and the one more claim that took it but missed the second.
      expect(modelSteps.claims.get(2)?.slice(0, 2)).toEqual([[], [first.signal.id]]);
      // The first model request step, the one cut short before its model call, and the one that asked again.
      expect(modelSteps.started()).toBe(3);
      expect(modelSteps.atModelCall).toHaveLength(2);
      // The tool call, then the request that has both messages.
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'FIRST_DURING_CLAIM')).toBe(1);
      expect(occurrences(prompts[1], 'SECOND_DURING_CLAIM')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'keeps the messages of the first claim in the request when the run closed before its one more claim',
    async () => {
      const firstClaim = gate();
      const firstClaimHeld = gate();
      const afterFirstRead = gate();
      const afterFirstHeld = gate();
      const signals = new ObservedSignals();
      const { model, prompts, beforeCall } = scriptedModel(toolThenAnswer);
      const { apiAgent, workerPubsub, apiPubsub, toolReached, tool, hintsBeforeStored } = await apiAndWorker({
        model,
        signals,
      });
      const modelSteps = watchModelSteps(workerPubsub, signals, beforeCall);
      let heldBeforeRead = false;
      signals.beforeClaimRead = async () => {
        if (modelSteps.started() !== 2 || heldBeforeRead) return;
        heldBeforeRead = true;
        firstClaim.release();
        await firstClaimHeld.promise;
      };
      modelSteps.onClaim(async (step, index) => {
        if (step !== 2 || index !== 1) return;
        afterFirstRead.release();
        await afterFirstHeld.promise;
      });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await toolReached;
      tool.release();

      // Stored before the request's first claim reads the store, so that claim takes it.
      await firstClaim.promise;
      const sent = apiAgent.sendSignal({ type: 'user', contents: 'TAKEN_BY_FIRST_CLAIM' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      firstClaimHeld.release();

      // A hint for a row no claim finds, as one for a signal cancelled in between, makes the step claim once more.
      // The run is closed first, so the thread no longer names it and that claim takes nothing.
      await afterFirstRead.promise;
      await publishSignalAvailable(apiPubsub, stream.runId, 'cancelled-in-between');
      await workerPubsub.handled.when('cancelled-in-between');
      await signals.closeSignalRun({ threadId: scope.threadId, runId: stream.runId, consumedIds: [] });
      afterFirstHeld.release();
      await done;

      // The first claim took the message; the one more claim, after the close, took nothing. The request it was
      // made for still asked, since waiting for the next step would not find that row either.
      expect(modelSteps.atModelCall).toEqual([[[]], [[sent.signal.id], []]]);
      expect(modelSteps.started()).toBe(2);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'TAKEN_BY_FIRST_CLAIM')).toBe(1);
      expect(hintsBeforeStored).toEqual(['cancelled-in-between']);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "cuts short a reasoning-only request with a processor's late signal, and announces it after storing it",
    async () => {
      type SendSignal = NonNullable<Parameters<NonNullable<Processor['processInputStep']>>[0]['sendSignal']>;
      let firstStepSend: SendSignal | undefined;
      let lateSignal: ReturnType<SendSignal> | undefined;
      let cutShort = 0;
      const secondRequest = gate();
      const secondRequestStarted = gate();
      const { model, prompts } = scriptedModel(({ call, abortSignal }) => {
        if (call === 1) return toolCallStream('wait');
        if (call === 2) {
          const stream = reasoningStream(abortSignal, secondRequest.promise, () => cutShort++);
          // A processor of the first step still holds its `sendSignal`, and sends while this request thinks.
          lateSignal = firstStepSend!({ type: 'user', contents: 'LATE_PROCESSOR_SIGNAL' });
          secondRequestStarted.release();
          return stream;
        }
        return answerStream(call);
      });
      const { apiAgent, apiPubsub, workerPubsub, tool, signals, hintsBeforeStored, storedAtStepHints } =
        await apiAndWorker({
          model,
          inputProcessors: [
            {
              id: 'holds-send-signal',
              async processInputStep({ stepNumber, sendSignal }) {
                if (stepNumber === 0) firstStepSend = sendSignal;
              },
            },
          ],
        });
      tool.release();
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await secondRequestStarted.promise;
      const { id } = await lateSignal!;
      await workerPubsub.published.when(id);
      // Published by the worker's step once it stored the row, for whichever process runs the run's next request.
      expect(storedAtStepHints).toEqual([[id]]);
      expect(workerPubsub.hints).toEqual([{ runId: stream.runId, signalId: id }]);
      expect(apiPubsub.hints).toEqual([]);
      await workerPubsub.handled.when(id);
      // A request nothing cut answers now, and the signal waits for the next drain point.
      secondRequest.release();
      await done;

      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(3);
      expect(occurrences(prompts[2], 'LATE_PROCESSOR_SIGNAL')).toBe(1);
      expect(signals.enqueued).toEqual([{ id, toRunId: stream.runId }]);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'drops a hint published after the run ended, and nothing fails',
    async () => {
      const signals = new ObservedSignals();
      const { model, prompts, beforeCall } = scriptedModel(({ call }) => answerStream(call));
      const { apiAgent, apiPubsub, workerPubsub } = await apiAndWorker({ model, signals });
      const modelSteps = watchModelSteps(workerPubsub, signals, beforeCall);
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await done;
      const claimsAtTheEnd = signals.claims;

      // The worker still listens on the run's control topic, but no model request step is there to hear it.
      await expect(publishSignalAvailable(apiPubsub, stream.runId, 'after-the-end')).resolves.toBeUndefined();
      await workerPubsub.handled.when('after-the-end');

      // With no hint, one claim before the model call.
      expect(modelSteps.atModelCall).toEqual([[[]]]);
      expect(workerPubsub.delivered.ids).toEqual(['after-the-end']);
      expect(signals.claims).toBe(claimsAtTheEnd);
      expect(prompts).toHaveLength(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'still aborts a run that heard hints, and acknowledges the abort',
    async () => {
      let cutShort = 0;
      const { model, prompts } = scriptedModel(({ call, abortSignal }) =>
        call === 1 ? toolCallStream('wait') : reasoningStream(abortSignal, new Promise(() => {}), () => cutShort++),
      );
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool } = await apiAndWorker({ model });
      let abortedSteps: Array<{ finishReason?: string }> | undefined;
      const scope = newScope();
      const stream = await startRun(apiAgent, scope, {
        onAbort: (data: { steps: Array<{ finishReason?: string }> }) => {
          abortedSteps = data.steps;
        },
      });
      const { reasoned, done } = consume(stream);
      await toolReached;
      const sent = apiAgent.sendSignal({ type: 'user', contents: 'BEFORE_THE_ABORT' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      tool.release();
      await reasoned;
      // A hint for the message the request already has.
      await publishSignalAvailable(apiPubsub, stream.runId, sent.signal.id);
      await workerPubsub.handled.whenCount(sent.signal.id, 2);

      await expect(requestAcknowledgedAbort(apiPubsub, stream.runId)).resolves.toBe(true);
      await done;

      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(abortedSteps?.at(-1)?.finishReason).toBe('abort');
    },
    TEST_TIMEOUT_MS,
  );
});

describe('a message sent from a process that holds neither the run nor its steps', () => {
  /** Starts the run once the sender watches the thread, so the sender learns the run keeps its signals in storage. */
  async function startWatchedRun(
    apiAgent: { stream: (message: string, options: any) => Promise<any> },
    senderAgent: { subscribeToThread: (scope: ReturnType<typeof newScope>) => Promise<any> },
    scope: ReturnType<typeof newScope>,
  ) {
    const observer = await senderAgent.subscribeToThread(scope);
    onTestFinished(() => observer.unsubscribe());
    const observedRun = observer.stream[Symbol.asyncIterator]().next();
    const stream = await startRun(apiAgent, scope);
    await observedRun;
    return stream;
  }

  it(
    'is announced by the sender that stored it, and cuts short the reasoning-only request once',
    async () => {
      let cutShort = 0;
      const firstRequest = gate();
      const { model, prompts } = scriptedModel(reasoningThenAnswer(firstRequest.promise, () => cutShort++));
      const db = new InMemoryDB();
      const signals = new ObservedSignals({ db, shared: true });
      const senderSignals = new ObservedSignals({ db, shared: true });
      const { apiAgent, apiPubsub, workerPubsub, sender, hintsBeforeStored } = await apiAndWorker({
        model,
        signals,
        senderSignals,
      });
      const scope = newScope();
      const stream = await startWatchedRun(apiAgent, sender!.agent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = sender!.agent.sendSignal({ type: 'user', contents: 'STORED_BY_THE_SENDER' }, scope);
      await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
      expect(senderSignals.enqueued).toEqual([{ id: sent.signal.id, toRunId: stream.runId }]);
      expect(sender!.pubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await workerPubsub.handled.when(sent.signal.id);
      // A request the hint did not cut answers now, and the message waits for the next drain point.
      firstRequest.release();
      await done;

      expect(signals.enqueued).toEqual([]);
      expect(apiPubsub.hints).toEqual([]);
      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STORED_BY_THE_SENDER')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'is announced by the process holding the run when that process stores it, and cuts short the request once',
    async () => {
      let cutShort = 0;
      const firstRequest = gate();
      const { model, prompts } = scriptedModel(reasoningThenAnswer(firstRequest.promise, () => cutShort++));
      const db = new InMemoryDB();
      const signals = new ObservedSignals({ db, shared: true });
      // The sender's memory storage reports that only its own process reads it, so the sender forwards unstored.
      const senderSignals = new ObservedSignals({ db });
      const { apiAgent, apiPubsub, workerPubsub, sender, hintsBeforeStored } = await apiAndWorker({
        model,
        signals,
        senderSignals,
      });
      const scope = newScope();
      const stream = await startWatchedRun(apiAgent, sender!.agent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = sender!.agent.sendSignal({ type: 'user', contents: 'STORED_BY_THE_HOLDER' }, scope);
      await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
      // The holder finished storing the forwarded signal.
      await apiPubsub.forwardHandled.when(sent.signal.id);
      expect(senderSignals.enqueued).toEqual([]);
      expect(signals.enqueued).toEqual([{ id: sent.signal.id, toRunId: stream.runId }]);
      expect(apiPubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      expect(sender!.pubsub.hints).toEqual([]);
      await workerPubsub.handled.when(sent.signal.id);
      // A request the hint did not cut answers now, and the message waits for the next drain point.
      firstRequest.release();
      await done;

      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STORED_BY_THE_HOLDER')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('a message sent to an evented run in the process that executes its steps', () => {
  /** A single-process evented agent on `pubsub` whose memory storage is `memoryStore`. */
  function singleProcess(
    respond: (call: ModelCall) => ReadableStream<LanguageModelV2StreamPart>,
    pubsub: HintPubSub,
    memoryStore: InMemoryMemory,
  ) {
    const { model, prompts } = scriptedModel(respond);
    const storage = storageOf(memoryStore);
    const hintsBeforeStored = guardHints([pubsub], memoryStore instanceof ObservedSignals ? [memoryStore] : []);
    const toolReached = gate();
    const tool = gate();
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'hinted-local',
        name: 'hinted-local',
        instructions: 'Test',
        model,
        memory: new MockMemory({ storage }),
        tools: {
          wait: createTool({
            id: 'wait',
            description: 'Waits for the test',
            inputSchema: z.object({}),
            execute: async () => {
              toolReached.release();
              await tool.promise;
              return 'waited';
            },
          }),
        },
      }),
      pubsub,
    });
    const mastra = new Mastra({ agents: { agent }, storage, pubsub, logger: false });
    onTestFinished(() => mastra.shutdown());
    return { agent, prompts, hintsBeforeStored, toolReached: toolReached.promise, tool };
  }

  // The queue listener cuts the request short first; the hint that follows must not cut the next request.
  it(
    'cuts short a reasoning-only request once when both the queue listener and the hint hear the message',
    async () => {
      let cutShort = 0;
      let sentId: string | undefined;
      const secondRequest = gate();
      const pubsub = new HintPubSub();
      // Hints reach the step only once the next request is running.
      pubsub.holdHints = secondRequest.promise;
      const signals = new ObservedSignals();
      const { agent, prompts, hintsBeforeStored } = singleProcess(
        ({ call, abortSignal }) => {
          if (call === 1) return reasoningStream(abortSignal, new Promise(() => {}), () => cutShort++);
          if (call === 2) {
            secondRequest.release();
            // Answers once the step handled the hint.
            return reasoningStream(abortSignal, pubsub.handled.when(sentId!), () => cutShort++);
          }
          return answerStream(call);
        },
        pubsub,
        signals,
      );
      const scope = newScope();
      const stream = await startRun(agent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = agent.sendSignal({ type: 'user', contents: 'STEER_LOCAL' }, scope);
      sentId = sent.signal.id;
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(pubsub.hints).toEqual([{ runId: stream.runId, signalId: sent.signal.id }]);
      await done;

      expect(pubsub.handled.ids).toEqual([sent.signal.id]);
      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STEER_LOCAL')).toBe(1);
      expect(hintsBeforeStored).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'announces nothing for a send that finds the run closed, which is stored for the thread with no run named',
    async () => {
      const pubsub = new HintPubSub();
      const signals = new ObservedSignals();
      const followUp = gate();
      const { agent, prompts, toolReached, tool } = singleProcess(
        call => {
          if (occurrences(call.prompt, 'AFTER_CLOSE_SEND') > 0) followUp.release();
          return toolThenAnswer(call);
        },
        pubsub,
        signals,
      );
      const scope = newScope();
      const stream = await startRun(agent, scope);
      const { done } = consume(stream);
      await toolReached;
      // The executing process closed the run before this send was stored, as finalize does before FINISH.
      await signals.closeSignalRun({ threadId: scope.threadId, runId: stream.runId, consumedIds: [] });
      const sent = agent.sendSignal({ type: 'user', contents: 'AFTER_CLOSE_SEND' }, scope);
      await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
      // Refused for the run, then stored for the thread's next turn.
      expect(signals.enqueued).toEqual([{ id: sent.signal.id, toRunId: stream.runId }, { id: sent.signal.id }]);
      tool.release();
      await done;
      // The thread's next turn takes it.
      await followUp.promise;

      expect(occurrences(prompts[1], 'AFTER_CLOSE_SEND')).toBe(0);
      expect(occurrences(prompts[2], 'AFTER_CLOSE_SEND')).toBe(1);
      expect(pubsub.hints).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'keeps the control topic of a run that holds its signals in memory free of hints, and still delivers the message',
    async () => {
      const pubsub = new HintPubSub();
      const { agent, prompts, toolReached, tool } = singleProcess(toolThenAnswer, pubsub, new NoPendingSignalsMemory());
      const scope = newScope();
      const stream = await startRun(agent, scope);
      const { done } = consume(stream);
      await toolReached;

      const sent = agent.sendSignal({ type: 'user', contents: 'KEPT_IN_MEMORY' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      tool.release();
      await done;

      expect(pubsub.hints).toEqual([]);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'KEPT_IN_MEMORY')).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );
});
