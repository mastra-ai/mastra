/**
 * A message sent to a running evented agent cuts short a model request that has
 * produced only reasoning, so the loop asks again with the message. When the
 * run's steps execute in another process than the sender's, the sender's
 * `signal-available` hint on the run's control topic is what tells that
 * process. The hint is only an optimization: the stored row reaches the run at
 * its next drain point either way.
 *
 * The cross-process cases run the worker in a fresh module registry, sharing
 * only storage and a broker with the process that starts the run, as a worker
 * pod does.
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
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import type { AgentSignalClaimArgs, StoredAgentSignal } from '../../../storage/domains/agent-signals/base';
import { InMemoryAgentSignalsStorage } from '../../../storage/domains/agent-signals/inmemory';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AgentControlEventTypes, AgentStreamEventTypes } from '../../streams/constants';
import { AgentThreadStreamRuntime } from '../../thread-stream-runtime';
import { publishSignalAvailable, requestAcknowledgedAbort } from '../abort-transport';
import { createEventedAgent } from '../create-evented-agent';
import { __resetExecutionFencesForTests } from '../execution-fence';

/** Bounds a hang; every test settles on its own gates long before it. */
const TEST_TIMEOUT_MS = 10_000;

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

type HintObservation = {
  /** Ids of the hints published through this pubsub. */
  published: Seen;
  /** Ids of the hints that reached this pubsub's control-topic subscribers. */
  delivered: Seen;
  /** Ids of the hints this pubsub's control-topic subscribers finished handling. */
  handled: Seen;
  /** Drop every hint published through this pubsub, as a transport that loses it does. */
  dropHints: boolean;
  /** While set, hints reach this pubsub's subscribers only once it resolves. */
  holdHints?: Promise<void>;
  /** Runs before each event this pubsub publishes. */
  onPublish?: (topic: string, event: Omit<Event, 'id' | 'createdAt'>) => void;
};

function signalIdOf(event: Pick<Event, 'type' | 'data'>): string | undefined {
  if (event.type !== AgentControlEventTypes.SIGNAL_AVAILABLE) return undefined;
  return (event.data as { signalId?: string } | undefined)?.signalId;
}

/** Wraps a pubsub's control-topic subscribers so the test learns when they received and handled a hint. */
function observeHints<T extends { new (...args: any[]): EventEmitterPubSub | LeasingBrokerConnection }>(Base: T) {
  return class extends Base implements HintObservation {
    published = new Seen();
    delivered = new Seen();
    handled = new Seen();
    dropHints = false;
    holdHints?: Promise<void>;
    onPublish?: (topic: string, event: Omit<Event, 'id' | 'createdAt'>) => void;
    readonly #wrapped = new Map<EventCallback, EventCallback>();

    override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
      this.onPublish?.(topic, event);
      const signalId = signalIdOf(event);
      if (signalId) {
        this.published.add(signalId);
        if (this.dropHints) return;
      }
      return super.publish(topic, event, options);
    }

    override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
      if (!topic.startsWith('agent.control.')) return super.subscribe(topic, cb, options);
      const wrapped: EventCallback = async (event, ack, nack) => {
        const signalId = signalIdOf(event);
        if (signalId) this.delivered.add(signalId);
        if (signalId && this.holdHints) await this.holdHints;
        await cb(event, ack, nack);
        if (signalId) this.handled.add(signalId);
      };
      this.#wrapped.set(cb, wrapped);
      return super.subscribe(topic, wrapped, options);
    }

    override async unsubscribe(topic: string, cb: EventCallback) {
      const wrapped = this.#wrapped.get(cb);
      this.#wrapped.delete(cb);
      return super.unsubscribe(topic, wrapped ?? cb);
    }
  };
}

const HintBrokerConnection = observeHints(LeasingBrokerConnection);
const HintPubSub = observeHints(EventEmitterPubSub);
type HintPubSub = InstanceType<typeof HintPubSub>;

/** A broker that several Mastra instances connect to, as pods share one Redis. */
function hintBroker() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  const leases = new EventEmitterPubSub();
  return { connect: () => new HintBrokerConnection(emitter, false, leases) };
}

/**
 * Signal storage that records inserts whose hint was already published, which
 * must never happen: a process that hears a hint may claim at once. The claim
 * hooks hold a claim before or after it reads the store, as a claim whose
 * query or answer is slow does. Shared across processes unless told otherwise.
 */
class ObservedSignals extends InMemoryAgentSignalsStorage {
  constructor(readonly shared = true) {
    super();
  }
  /** Whether the hint for a signal id was published anywhere. */
  hintPublished?: (id: string) => boolean;
  readonly insertedAfterHint: string[] = [];
  beforeClaimRead?: (args: AgentSignalClaimArgs) => Promise<void>;
  afterClaimRead?: (args: AgentSignalClaimArgs, rows: StoredAgentSignal[]) => Promise<void>;

  override get sharedAcrossProcesses(): boolean {
    return this.shared;
  }

  override async enqueue(row: Parameters<InMemoryAgentSignalsStorage['enqueue']>[0]) {
    if (this.hintPublished?.(row.id)) this.insertedAfterHint.push(row.id);
    return super.enqueue(row);
  }

  claims = 0;

  override async claim(args: AgentSignalClaimArgs): Promise<StoredAgentSignal[]> {
    this.claims++;
    await this.beforeClaimRead?.(args);
    const rows = await super.claim(args);
    await this.afterClaimRead?.(args, rows);
    return rows;
  }
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
 * Streams reasoning, then holds. Cut short by the request's abort, or answers once `release` resolves.
 * `onAbort` runs when the request is cut short.
 */
function reasoningStream(abortSignal: AbortSignal | undefined, release: Promise<void>, onAbort: () => void) {
  return new ReadableStream<LanguageModelV2StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'reasoning-start', id: 'thinking' });
      controller.enqueue({ type: 'reasoning-delta', id: 'thinking', delta: 'thinking' });
      let settled = false;
      abortSignal?.addEventListener(
        'abort',
        () => {
          if (settled) return;
          settled = true;
          onAbort();
          controller.error(abortSignal.reason);
        },
        { once: true },
      );
      void release.then(() => {
        if (settled) return;
        settled = true;
        controller.enqueue({ type: 'reasoning-end', id: 'thinking' });
        controller.enqueue({ type: 'text-start', id: 'text-held' });
        controller.enqueue({ type: 'text-delta', id: 'text-held', delta: 'answer after thinking' });
        controller.enqueue({ type: 'text-end', id: 'text-held' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
        controller.close();
      });
    },
  });
}

type ModelCall = { prompt: unknown; abortSignal?: AbortSignal; call: number };

/** A model whose calls the test scripts; every prompt is recorded. */
function scriptedModel(respond: (call: ModelCall) => ReadableStream<LanguageModelV2StreamPart>) {
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt, abortSignal }) => {
      prompts.push(prompt);
      return { warnings: [], stream: respond({ prompt, abortSignal, call: prompts.length }) };
    },
  });
  return { model, prompts };
}

/** Asks for the `wait` tool, then answers. */
function toolThenAnswer({ call }: ModelCall) {
  return call === 1 ? toolCallStream('wait') : answerStream(call);
}

function occurrences(prompt: unknown, text: string): number {
  return JSON.stringify(prompt).split(text).length - 1;
}

function newScope() {
  return { resourceId: `resource-${crypto.randomUUID()}`, threadId: `thread-${crypto.randomUUID()}` };
}

/** Consumes a run's stream; `reasoned` resolves once the consumer saw reasoning. */
function consume(stream: { fullStream: AsyncIterable<unknown> }) {
  const chunks: Array<{ type: string; payload?: any }> = [];
  const reasoned = gate();
  const done = (async () => {
    for await (const chunk of stream.fullStream as AsyncIterable<{ type: string; payload?: any }>) {
      chunks.push(chunk);
      if (chunk.type === 'reasoning-delta') reasoned.release();
    }
    const error = chunks.find(chunk => chunk.type === 'error');
    if (error) throw error.payload?.error ?? new Error('the run reported an error');
  })();
  return { chunks, reasoned: reasoned.promise, done };
}

/**
 * Counts the model request steps that started on `pubsub`'s process, from the iteration-start event each publishes
 * before it reads its signals, and groups the pending claims by the step they ran in.
 */
function watchModelSteps(pubsub: InstanceType<typeof HintBrokerConnection>, signals: ObservedSignals) {
  let started = 0;
  const claims = new Map<number, string[][]>();
  pubsub.onPublish = (topic, event) => {
    if (topic.startsWith('agent.stream.') && event.type === AgentStreamEventTypes.ITERATION_START) started++;
  };
  /** Runs `hold` for each pending claim after it read the store, with the step it ran in and its index there. */
  const onPendingClaim = (hold: (step: number, index: number) => Promise<void> | void) => {
    signals.afterClaimRead = async (args, rows) => {
      if (args.scope !== 'pending') return;
      const step = started;
      const inStep = claims.get(step) ?? [];
      claims.set(step, inStep);
      inStep.push(rows.map(row => row.id));
      await hold(step, inStep.length);
    };
  };
  return { started: () => started, claims, onPendingClaim };
}

/**
 * The process a user's request reaches, which starts the run and runs no
 * workers, and a worker process that executes the run's steps.
 */
async function apiAndWorker({
  model,
  signals = new ObservedSignals(),
  inputProcessors,
}: {
  model: MockLanguageModelV2;
  signals?: ObservedSignals;
  inputProcessors?: Processor[];
}) {
  const broker = hintBroker();
  const storage = new InMemoryStore();
  storage.stores.agentSignals = signals;
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

  const apiPubsub = broker.connect();
  const apiAgent = createEventedAgent({
    agent: new Agent({
      id: 'hinted',
      name: 'hinted',
      instructions: 'Test',
      model,
      memory: new MockMemory({ storage }),
      tools: { wait: createTool(waitConfig) },
      ...(inputProcessors ? { inputProcessors } : {}),
    }),
    pubsub: apiPubsub,
  });
  const api = new Mastra({ agents: { agent: apiAgent }, storage, pubsub: apiPubsub, workers: false, logger: false });

  vi.resetModules();
  const workerFences = await import('../execution-fence');
  const { createEventedAgent: createWorkerAgent } = await import('../create-evented-agent');
  const { Agent: WorkerAgent } = await import('../../agent');
  const { Mastra: WorkerMastra } = await import('../../../mastra');
  const { MockMemory: WorkerMemory } = await import('../../../memory/mock');
  const { createTool: createWorkerTool } = await import('../../../tools');
  const workerPubsub = broker.connect();
  const worker = new WorkerMastra({
    agents: {
      agent: createWorkerAgent({
        agent: new WorkerAgent({
          id: 'hinted',
          name: 'hinted',
          instructions: 'Test',
          model,
          memory: new WorkerMemory({ storage }),
          tools: { wait: createWorkerTool(waitConfig) },
          ...(inputProcessors ? { inputProcessors } : {}),
        }),
        pubsub: workerPubsub,
      }),
    },
    storage,
    pubsub: workerPubsub,
    logger: false,
  });
  signals.hintPublished = id => apiPubsub.published.ids.includes(id) || workerPubsub.published.ids.includes(id);
  onTestFinished(async () => {
    await api.shutdown();
    await worker.shutdown();
    // Each module copy keeps its own fences: the API process holds the run's coordinator, the worker its steps'.
    __resetExecutionFencesForTests();
    workerFences.__resetExecutionFencesForTests();
    await apiPubsub.close();
    await workerPubsub.close();
  });
  await worker.startWorkers();
  return { apiAgent, apiPubsub, workerPubsub, signals, toolReached: toolReached.promise, tool };
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
      const { model, prompts } = scriptedModel(({ call, abortSignal }) =>
        call === 1 ? reasoningStream(abortSignal, firstRequest.promise, () => cutShort++) : answerStream(call),
      );
      const { apiAgent, apiPubsub, workerPubsub, signals } = await apiAndWorker({ model });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'STEER_FROM_API' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.published.ids).toEqual([sent.signal.id]);
      await workerPubsub.handled.when(sent.signal.id);
      // A request the hint did not cut answers now, and the message waits for the next drain point.
      firstRequest.release();
      await done;

      expect(cutShort).toBe(1);
      expect(workerPubsub.handled.ids).toEqual([sent.signal.id]);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STEER_FROM_API')).toBe(1);
      expect(signals.insertedAfterHint).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'lets the request finish when the hint is lost, and the next request has the message once',
    async () => {
      let cutShort = 0;
      const firstRequest = gate();
      const { model, prompts } = scriptedModel(({ call, abortSignal }) =>
        call === 1 ? reasoningStream(abortSignal, firstRequest.promise, () => cutShort++) : answerStream(call),
      );
      const { apiAgent, apiPubsub, workerPubsub } = await apiAndWorker({ model });
      apiPubsub.dropHints = true;
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'STEER_HINT_LOST' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.published.ids).toEqual([sent.signal.id]);
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
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool, signals } = await apiAndWorker({ model });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { reasoned, done } = consume(stream);
      await toolReached;

      const sent = apiAgent.sendSignal({ type: 'user', contents: 'SENT_DURING_TOOL' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.published.ids).toEqual([sent.signal.id]);
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
      expect(signals.insertedAfterHint).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'takes a message stored while the request read its signals into that same request',
    async () => {
      const claimRead = gate();
      const claimHeld = gate();
      const signals = new ObservedSignals();
      const { model, prompts } = scriptedModel(toolThenAnswer);
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool } = await apiAndWorker({ model, signals });
      const modelSteps = watchModelSteps(workerPubsub, signals);
      // Holds the first claim of the model request step after the tool.
      modelSteps.onPendingClaim(async (step, index) => {
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
      expect(apiPubsub.published.ids).toEqual([sent.signal.id]);
      await workerPubsub.handled.when(sent.signal.id);
      claimHeld.release();
      await done;

      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STORED_DURING_CLAIM')).toBe(1);
      expect(modelSteps.started()).toBe(2);
      // The claim that missed it, and the one more claim that took it.
      expect(modelSteps.claims.get(2)?.slice(0, 2)).toEqual([[], [sent.signal.id]]);
      expect(signals.insertedAfterHint).toEqual([]);
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
      const { model, prompts } = scriptedModel(toolThenAnswer);
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool } = await apiAndWorker({ model, signals });
      const modelSteps = watchModelSteps(workerPubsub, signals);
      // Holds both claims of the model request step after the tool.
      modelSteps.onPendingClaim(async (step, index) => {
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
      await workerPubsub.handled.when(first.signal.id);
      firstHeld.release();

      await secondRead.promise;
      const second = apiAgent.sendSignal({ type: 'user', contents: 'SECOND_DURING_CLAIM' }, scope);
      await expect(second.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(apiPubsub.published.ids).toEqual([first.signal.id, second.signal.id]);
      await workerPubsub.handled.when(second.signal.id);
      secondHeld.release();
      await done;

      // The tool call, then the request that has both messages. The request that missed the second stopped before
      // its model call.
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'FIRST_DURING_CLAIM')).toBe(1);
      expect(occurrences(prompts[1], 'SECOND_DURING_CLAIM')).toBe(1);
      // The first model request step, the one cut short, and the one that asked again.
      expect(modelSteps.started()).toBe(3);
      // The claim that missed the first message, and the one more claim that took it but missed the second.
      expect(modelSteps.claims.get(2)?.slice(0, 2)).toEqual([[], [first.signal.id]]);
      expect(signals.insertedAfterHint).toEqual([]);
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
      const { model, prompts } = scriptedModel(toolThenAnswer);
      const { apiAgent, apiPubsub, workerPubsub, toolReached, tool } = await apiAndWorker({ model, signals });
      const modelSteps = watchModelSteps(workerPubsub, signals);
      let heldBeforeRead = false;
      signals.beforeClaimRead = async args => {
        if (args.scope !== 'pending' || modelSteps.started() !== 2 || heldBeforeRead) return;
        heldBeforeRead = true;
        firstClaim.release();
        await firstClaimHeld.promise;
      };
      modelSteps.onPendingClaim(async (step, index) => {
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
      expect(apiPubsub.published.ids).toEqual([sent.signal.id]);
      firstClaimHeld.release();

      // A hint for a row no claim finds, as one for a signal cancelled in between, makes the step claim once more.
      // The run is closed first, as a takeover by the thread's next run does, so that claim takes nothing.
      await afterFirstRead.promise;
      await publishSignalAvailable(apiPubsub, stream.runId, 'cancelled-in-between');
      await workerPubsub.handled.when('cancelled-in-between');
      await signals.closeRun({
        threadKey: `${scope.resourceId}\u0000${scope.threadId}`,
        runId: stream.runId,
        consumedIds: [sent.signal.id],
      });
      afterFirstHeld.release();
      await done;

      // The hint's row was never taken, so the request stopped before its model call and the next one asked.
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'TAKEN_BY_FIRST_CLAIM')).toBe(1);
      expect(modelSteps.started()).toBe(3);
      // The first claim took the message; the one more claim, after the close, took nothing.
      expect(modelSteps.claims.get(2)?.slice(0, 2)).toEqual([[sent.signal.id], []]);
      expect(signals.insertedAfterHint).toEqual([]);
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
      const { apiAgent, workerPubsub, tool, signals } = await apiAndWorker({
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
      // Published by the worker's step, which stored it.
      expect(workerPubsub.published.ids).toEqual([id]);
      await workerPubsub.handled.when(id);
      // A request nothing cut answers now, and the signal waits for the next drain point.
      secondRequest.release();
      await done;

      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(3);
      expect(occurrences(prompts[2], 'LATE_PROCESSOR_SIGNAL')).toBe(1);
      expect(signals.insertedAfterHint).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'drops a hint published after the run ended, and nothing fails',
    async () => {
      const { model, prompts } = scriptedModel(({ call }) => answerStream(call));
      const { apiAgent, apiPubsub, workerPubsub, signals } = await apiAndWorker({ model });
      const scope = newScope();
      const stream = await startRun(apiAgent, scope);
      const { done } = consume(stream);
      await done;
      const claimsAtTheEnd = signals.claims;

      // The worker still listens on the run's control topic, but no model request step is there to hear it.
      await expect(publishSignalAvailable(apiPubsub, stream.runId, 'after-the-end')).resolves.toBeUndefined();
      await workerPubsub.handled.when('after-the-end');

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

/** Holds the first acquisition of `key`'s lease until `release` resolves. */
class LeaseHeldPubSub extends HintPubSub {
  holdLease?: { key: string; reached: () => void; release: Promise<void> };

  override async acquireLease(key: string, owner: string, ttlMs: number) {
    const hold = this.holdLease;
    if (hold?.key === key) {
      this.holdLease = undefined;
      hold.reached();
      await hold.release;
    }
    return super.acquireLease(key, owner, ttlMs);
  }
}

describe('a message sent to an evented run in the process that executes its steps', () => {
  /** A single-process evented agent on `pubsub`, whose storage keeps agent signals unless `signals` is false. */
  function singleProcess(model: MockLanguageModelV2, pubsub: HintPubSub, signals: ObservedSignals | false) {
    const storage = new InMemoryStore();
    storage.stores.agentSignals = signals || undefined;
    if (signals) signals.hintPublished = id => pubsub.published.ids.includes(id);
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
    return { agent, toolReached: toolReached.promise, tool };
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
      const { model, prompts } = scriptedModel(({ call, abortSignal }) => {
        if (call === 1) return reasoningStream(abortSignal, new Promise(() => {}), () => cutShort++);
        if (call === 2) {
          secondRequest.release();
          // Answers once the step handled the hint.
          return reasoningStream(abortSignal, pubsub.handled.when(sentId!), () => cutShort++);
        }
        return answerStream(call);
      });
      const signals = new ObservedSignals(false);
      const { agent } = singleProcess(model, pubsub, signals);
      const scope = newScope();
      const stream = await startRun(agent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      const sent = agent.sendSignal({ type: 'user', contents: 'STEER_LOCAL' }, scope);
      sentId = sent.signal.id;
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      expect(pubsub.published.ids).toEqual([sent.signal.id]);
      await done;

      expect(pubsub.handled.ids).toEqual([sent.signal.id]);
      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'STEER_LOCAL')).toBe(1);
      expect(signals.insertedAfterHint).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'keeps the control topic of a run that holds its signals in memory free of hints, and still delivers the message',
    async () => {
      const pubsub = new HintPubSub();
      const { model, prompts } = scriptedModel(toolThenAnswer);
      const { agent, toolReached, tool } = singleProcess(model, pubsub, false);
      const scope = newScope();
      const stream = await startRun(agent, scope);
      const { done } = consume(stream);
      await toolReached;

      const sent = agent.sendSignal({ type: 'user', contents: 'KEPT_IN_MEMORY' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      tool.release();
      await done;

      expect(pubsub.published.ids).toEqual([]);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'KEPT_IN_MEMORY')).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  // On a store each process keeps to itself, the process holding the run stores a signal another process forwards.
  it(
    'announces a forwarded signal the holder stored, and cuts short its reasoning-only request once',
    async () => {
      let cutShort = 0;
      const pubsub = new HintPubSub();
      const { model, prompts } = scriptedModel(({ call, abortSignal }) =>
        call === 1 ? reasoningStream(abortSignal, new Promise(() => {}), () => cutShort++) : answerStream(call),
      );
      const signals = new ObservedSignals(false);
      const { agent } = singleProcess(model, pubsub, signals);
      const scope = newScope();
      const stream = await startRun(agent, scope);
      const { reasoned, done } = consume(stream);
      await reasoned;

      // Another process's runtime, sending as an agent that keeps its signals in memory.
      const sender = new Agent({
        id: 'map-sender',
        name: 'map-sender',
        instructions: 'Test',
        model: scriptedModel(({ call }) => answerStream(call)).model,
      });
      const sent = new AgentThreadStreamRuntime().sendSignal(
        sender,
        { type: 'user', contents: 'FORWARDED_TO_HOLDER' },
        scope,
        agent.getPubSub(),
      );
      await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
      await pubsub.handled.when(sent.signal.id);
      await done;

      expect(pubsub.published.ids).toEqual([sent.signal.id]);
      expect(cutShort).toBe(1);
      expect(prompts).toHaveLength(2);
      expect(occurrences(prompts[1], 'FORWARDED_TO_HOLDER')).toBe(1);
      expect(signals.insertedAfterHint).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'announces a message that joins a reservation once it is stored, and the first request has it once',
    async () => {
      const pubsub = new LeaseHeldPubSub();
      const { model, prompts } = scriptedModel(({ call }) => answerStream(call));
      const signals = new ObservedSignals(false);
      const { agent } = singleProcess(model, pubsub, signals);
      const scope = newScope();
      const leaseReached = gate();
      const leaseHeld = gate();
      pubsub.holdLease = {
        key: `${scope.resourceId}\u0000${scope.threadId}`,
        reached: leaseReached.release,
        release: leaseHeld.promise,
      };
      // The first message wakes the idle thread, which reserves it for a run that starts once the lease is taken.
      const waking = agent.sendSignal(
        { type: 'user', contents: 'WAKES_THE_THREAD' },
        { ...scope, ifIdle: { streamOptions: { memory: { thread: scope.threadId, resource: scope.resourceId } } } },
      );
      await leaseReached.promise;

      const sent = agent.sendSignal({ type: 'user', contents: 'JOINS_THE_RESERVATION' }, scope);
      await pubsub.published.when(sent.signal.id);
      leaseHeld.release();
      const woken = await waking.accepted;
      if (woken.action !== 'wake') throw new Error(`expected the thread to wake, got ${woken.action}`);
      await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: woken.runId });
      await woken.output.consumeStream();

      expect(pubsub.published.ids).toEqual([sent.signal.id]);
      expect(prompts).toHaveLength(1);
      expect(occurrences(prompts[0], 'WAKES_THE_THREAD')).toBe(1);
      expect(occurrences(prompts[0], 'JOINS_THE_RESERVATION')).toBe(1);
      expect(signals.insertedAfterHint).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );
});
