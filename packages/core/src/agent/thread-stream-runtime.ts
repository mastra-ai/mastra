import { randomUUID } from 'node:crypto';

import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { EventCallback } from '../events/types';
import type { RequestContext } from '../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import type { MastraModelOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import { createSignal } from './signals';
import type { CreatedAgentSignal } from './signals';
import type {
  AgentSignal,
  AgentSubscribeToThreadOptions,
  AgentThreadSubscription,
  SendAgentSignalOptions,
  SendAgentSignalResult,
} from './types';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
const AGENT_THREAD_STREAM_TOPIC_PREFIX = 'agent.thread-stream';

export let defaultAgentThreadPubSub: PubSub = new EventEmitterPubSub();

function callerSignalPayloadKey(signal: AgentSignal): string | undefined {
  try {
    return JSON.stringify({
      type: signal.type,
      contents: signal.contents,
      attributes: signal.attributes,
      metadata: signal.metadata,
    });
  } catch {
    return undefined;
  }
}

function withThreadMemory(memory: unknown, resourceId: string, threadId: string) {
  return {
    ...((memory && typeof memory === 'object' ? memory : {}) as Record<string, unknown>),
    resource: (memory as { resource?: string } | undefined)?.resource ?? resourceId,
    thread: (memory as { thread?: string } | undefined)?.thread ?? threadId,
  };
}

type AgentThreadRunRecord<OUTPUT = unknown> = {
  agent: Agent<any, any, any, any>;
  output: MastraModelOutput<OUTPUT>;
  runId: string;
  threadId: string;
  resourceId?: string;
  streamOptions: AgentExecutionOptions<OUTPUT>;
};

type PreparedThreadRun = {
  abortController: AbortController;
  cleanup: () => void;
};

type PendingIdleSignal<OUTPUT = unknown> = {
  agent: Agent<any, any, any, any>;
  signal: CreatedAgentSignal;
  runId: string;
  resourceId: string;
  threadId: string;
  streamOptions?: AgentExecutionOptions<OUTPUT>;
};

type AgentThreadRuntimeState = {
  threadRunsById: Map<string, AgentThreadRunRecord<any>>;
  threadKeysByRunId: Map<string, string>;
  activeThreadRunIds: Map<string, string>;
  pendingSignalsByThread: Map<string, CreatedAgentSignal[]>;
  pendingIdleSignalsByThread: Map<string, PendingIdleSignal<any>[]>;
  watchedThreadRunIds: Set<string>;
  preparedRunsById: Map<string, PreparedThreadRun>;
  abortedRunIds: Set<string>;
  acceptedCallerSignals: Map<string, SendAgentSignalResult>;
  callerSignalIdsByRunId: Map<string, Set<string>>;
  pendingOutputWaiters: Map<string, Array<(out: MastraModelOutput<any>) => void>>;
};

type SerializableAgentSignal = AgentSignal & Pick<CreatedAgentSignal, 'id' | 'createdAt'>;

type AgentThreadStreamRuntimeEvent =
  | { type: 'run-registered'; runId: string }
  | { type: 'run-completed'; runId: string }
  | { type: 'run-aborted'; runId: string }
  | { type: 'signal-enqueued'; runId: string; signal: SerializableAgentSignal; sourceId: string };

function createRuntimeState(): AgentThreadRuntimeState {
  return {
    threadRunsById: new Map(),
    threadKeysByRunId: new Map(),
    activeThreadRunIds: new Map(),
    pendingSignalsByThread: new Map(),
    pendingIdleSignalsByThread: new Map(),
    watchedThreadRunIds: new Set(),
    preparedRunsById: new Map(),
    abortedRunIds: new Set(),
    acceptedCallerSignals: new Map(),
    callerSignalIdsByRunId: new Map(),
    pendingOutputWaiters: new Map(),
  };
}

export class AgentThreadStreamRuntime {
  #id = randomUUID();
  #statesByPubSub = new WeakMap<PubSub, AgentThreadRuntimeState>();

  #getPubSub(pubsub?: PubSub): PubSub {
    return pubsub ?? defaultAgentThreadPubSub;
  }

  #getState(pubsub?: PubSub): AgentThreadRuntimeState {
    const resolvedPubSub = this.#getPubSub(pubsub);
    let state = this.#statesByPubSub.get(resolvedPubSub);
    if (!state) {
      state = createRuntimeState();
      this.#statesByPubSub.set(resolvedPubSub, state);
    }
    return state;
  }

  #threadKey(resourceId: string | undefined, threadId: string): string {
    return [resourceId ?? '', threadId].join(AGENT_THREAD_KEY_SEPARATOR);
  }

  #threadTopic(key: string): string {
    return `${AGENT_THREAD_STREAM_TOPIC_PREFIX}.${encodeURIComponent(key)}`;
  }

  #serializeSignal(signal: CreatedAgentSignal): SerializableAgentSignal {
    return signal;
  }

  #publish(pubsub: PubSub | undefined, key: string, event: AgentThreadStreamRuntimeEvent) {
    void this.#getPubSub(pubsub)
      .publish(this.#threadTopic(key), {
        type: event.type,
        runId: event.runId,
        data: event,
      })
      .catch(() => {});
  }

  #getThreadTarget(options?: { memory?: AgentExecutionOptions<any>['memory']; requestContext?: RequestContext }) {
    const thread = options?.memory?.thread;
    const threadId =
      (options?.requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
      (typeof thread === 'string' ? thread : thread?.id);
    const resourceId =
      (options?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined) || options?.memory?.resource;

    return { threadId, resourceId };
  }

  prepareRunOptions<OUTPUT>(options: AgentExecutionOptions<OUTPUT>, pubsub?: PubSub): AgentExecutionOptions<OUTPUT> {
    const { threadId } = this.#getThreadTarget(options);
    if (!threadId || !options.runId) return options;

    const state = this.#getState(pubsub);
    const abortController = new AbortController();
    const upstreamAbortSignal = options.abortSignal;
    const abort = () => abortController.abort();
    if (upstreamAbortSignal?.aborted) {
      abort();
    } else {
      upstreamAbortSignal?.addEventListener('abort', abort, { once: true });
    }

    state.preparedRunsById.set(options.runId, {
      abortController,
      cleanup: () => upstreamAbortSignal?.removeEventListener('abort', abort),
    });

    if (state.abortedRunIds.has(options.runId)) {
      abort();
    }

    return {
      ...options,
      abortSignal: abortController.signal,
    };
  }

  abortRun(runId: string, pubsub?: PubSub): boolean {
    const state = this.#getState(pubsub);
    const preparedRun = state.preparedRunsById.get(runId);
    if (!preparedRun) {
      state.abortedRunIds.add(runId);
      return false;
    }

    preparedRun.abortController.abort();
    state.abortedRunIds.add(runId);

    const key = state.threadKeysByRunId.get(runId);
    if (key) {
      this.#publish(pubsub, key, { type: 'run-aborted', runId });
    }

    return true;
  }

  abortThread(options: AgentSubscribeToThreadOptions, pubsub?: PubSub): boolean {
    const state = this.#getState(pubsub);
    const key = this.#threadKey(options.resourceId, options.threadId);
    const activeRunId = state.activeThreadRunIds.get(key);
    if (!activeRunId) return false;
    return this.abortRun(activeRunId, pubsub);
  }

  /** @internal */
  resetForTests() {
    for (const pubsub of [defaultAgentThreadPubSub]) {
      this.#resetState(pubsub);
      void (pubsub as { close?: () => Promise<void> }).close?.();
    }
    defaultAgentThreadPubSub = new EventEmitterPubSub();
  }

  #resetState(pubsub: PubSub) {
    const state = this.#statesByPubSub.get(pubsub);
    if (!state) return;

    state.preparedRunsById.forEach(preparedRun => {
      preparedRun.abortController.abort();
      preparedRun.cleanup();
    });
    state.threadRunsById.clear();
    state.threadKeysByRunId.clear();
    state.activeThreadRunIds.clear();
    state.pendingSignalsByThread.clear();
    state.pendingIdleSignalsByThread.clear();
    state.watchedThreadRunIds.clear();
    state.preparedRunsById.clear();
    state.abortedRunIds.clear();
    state.acceptedCallerSignals.clear();
    state.callerSignalIdsByRunId.clear();
    state.pendingOutputWaiters.clear();
  }

  #cleanupPreparedRun(state: AgentThreadRuntimeState, runId: string) {
    state.preparedRunsById.get(runId)?.cleanup();
    state.preparedRunsById.delete(runId);
    state.abortedRunIds.delete(runId);
  }

  #forgetCallerSignalsForRun(state: AgentThreadRuntimeState, runId: string) {
    const callerSignalIds = state.callerSignalIdsByRunId.get(runId);
    if (!callerSignalIds) return;
    state.callerSignalIdsByRunId.delete(runId);
    for (const callerSignalId of callerSignalIds) state.acceptedCallerSignals.delete(callerSignalId);
  }

  async #persistSignal(
    agent: Agent<any, any, any, any>,
    signal: CreatedAgentSignal,
    resourceId: string,
    threadId: string,
    requestContext?: RequestContext,
  ) {
    const memory = await agent.getMemory({ requestContext });
    if (!memory) return;
    await memory.saveMessages({
      messages: [signal.toDBMessage({ resourceId, threadId })],
    });
  }

  registerRun<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
    pubsub?: PubSub,
  ) {
    const { threadId, resourceId } = this.#getThreadTarget(streamOptions);
    if (!threadId) return;

    const state = this.#getState(pubsub);
    const key = this.#threadKey(resourceId, threadId);
    const record: AgentThreadRunRecord<OUTPUT> = {
      agent,
      output,
      runId: output.runId,
      threadId,
      resourceId,
      streamOptions: streamOptions as AgentThreadRunRecord<OUTPUT>['streamOptions'],
    };

    state.threadRunsById.set(output.runId, record);
    state.threadKeysByRunId.set(output.runId, key);
    state.activeThreadRunIds.set(key, output.runId);
    const waiters = state.pendingOutputWaiters.get(output.runId);
    if (waiters) {
      state.pendingOutputWaiters.delete(output.runId);
      for (const resolve of waiters) resolve(output);
    }
    this.#publish(pubsub, key, { type: 'run-registered', runId: output.runId });
    this.#watchThreadRunCompletion(state, pubsub, key, record);
  }

  /**
   * Returns the `MastraModelOutput` for a registered run, or `undefined` if the
   * run has finished and been cleared. Used by signal-routed callers that send
   * a signal, receive a `runId`, and then need the matching output handle.
   */
  getRunOutput<OUTPUT = unknown>(runId: string, pubsub?: PubSub): MastraModelOutput<OUTPUT> | undefined {
    const state = this.#getState(pubsub);
    const record = state.threadRunsById.get(runId);
    return record?.output as MastraModelOutput<OUTPUT> | undefined;
  }

  /**
   * Resolves with the `MastraModelOutput` for `runId` as soon as `registerRun`
   * registers it, or immediately if it is already registered and retained.
   */
  waitForRunOutput<OUTPUT = unknown>(runId: string, pubsub?: PubSub): Promise<MastraModelOutput<OUTPUT>> {
    const state = this.#getState(pubsub);
    const existing = state.threadRunsById.get(runId);
    if (existing) return Promise.resolve(existing.output as MastraModelOutput<OUTPUT>);
    return new Promise<MastraModelOutput<OUTPUT>>(resolve => {
      const waiters = state.pendingOutputWaiters.get(runId) ?? [];
      waiters.push(resolve as (out: MastraModelOutput<any>) => void);
      state.pendingOutputWaiters.set(runId, waiters);
    });
  }

  #watchThreadRunCompletion(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    record: AgentThreadRunRecord<any>,
  ) {
    if (state.watchedThreadRunIds.has(record.runId)) return;
    state.watchedThreadRunIds.add(record.runId);

    void record.output._waitUntilFinished().finally(() => {
      state.watchedThreadRunIds.delete(record.runId);
      state.threadRunsById.delete(record.runId);
      state.threadKeysByRunId.delete(record.runId);
      this.#cleanupPreparedRun(state, record.runId);
      this.#forgetCallerSignalsForRun(state, record.runId);
      if (state.activeThreadRunIds.get(key) === record.runId) {
        state.activeThreadRunIds.delete(key);
      }
      this.#publish(pubsub, key, { type: 'run-completed', runId: record.runId });
      void this.#drainPendingSignals(state, pubsub, key, record);
    });
  }

  async #drainPendingSignals(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    previousRun: AgentThreadRunRecord<any>,
  ) {
    if (state.activeThreadRunIds.has(key)) {
      return;
    }

    const queue = state.pendingSignalsByThread.get(key);
    const signal = queue?.shift();
    if (signal && queue) {
      if (queue.length === 0) {
        state.pendingSignalsByThread.delete(key);
      }

      const output = await previousRun.agent.stream(signal, {
        ...(previousRun.streamOptions as any),
        runId: randomUUID(),
        memory: withThreadMemory(
          previousRun.streamOptions.memory,
          previousRun.resourceId ?? '',
          previousRun.threadId ?? '',
        ),
      });

      if (queue.length > 0) {
        const nextRecord = state.threadRunsById.get(output.runId);
        if (nextRecord) {
          this.#watchThreadRunCompletion(state, pubsub, key, nextRecord);
        }
      }
      return;
    }

    await this.#drainPendingIdleSignals(state, pubsub, key);
  }

  async #drainPendingIdleSignals(state: AgentThreadRuntimeState, pubsub: PubSub | undefined, key: string) {
    if (state.activeThreadRunIds.has(key)) {
      return;
    }

    const idleQueue = state.pendingIdleSignalsByThread.get(key);
    const pendingIdle = idleQueue?.shift();
    if (!pendingIdle || !idleQueue) {
      return;
    }
    if (idleQueue.length === 0) {
      state.pendingIdleSignalsByThread.delete(key);
    }

    state.activeThreadRunIds.set(key, pendingIdle.runId);
    state.threadKeysByRunId.set(pendingIdle.runId, key);
    try {
      const output = await pendingIdle.agent.stream(pendingIdle.signal, {
        ...(pendingIdle.streamOptions as any),
        runId: pendingIdle.runId,
        memory: withThreadMemory(pendingIdle.streamOptions?.memory, pendingIdle.resourceId, pendingIdle.threadId),
      });

      if ((idleQueue?.length ?? 0) > 0) {
        const nextRecord = state.threadRunsById.get(output.runId);
        if (nextRecord) {
          this.#watchThreadRunCompletion(state, pubsub, key, nextRecord);
        }
      }
    } catch {
      state.threadKeysByRunId.delete(pendingIdle.runId);
      this.#cleanupPreparedRun(state, pendingIdle.runId);
      this.#forgetCallerSignalsForRun(state, pendingIdle.runId);
      if (state.activeThreadRunIds.get(key) === pendingIdle.runId) {
        state.activeThreadRunIds.delete(key);
      }
    }
  }

  drainPendingSignals(runId: string, pubsub?: PubSub) {
    const state = this.#getState(pubsub);
    const record = state.threadRunsById.get(runId);
    const key = record ? this.#threadKey(record.resourceId, record.threadId) : state.threadKeysByRunId.get(runId);
    if (!key) return [];

    const queue = state.pendingSignalsByThread.get(key);
    if (!queue || queue.length === 0) {
      return [];
    }

    state.pendingSignalsByThread.delete(key);
    return queue;
  }

  async waitForCrossAgentThreadRun(
    agent: Agent<any, any, any, any>,
    options: { memory?: AgentExecutionOptions<any>['memory']; requestContext?: RequestContext },
    pubsub?: PubSub,
  ) {
    const { threadId, resourceId } = this.#getThreadTarget(options);
    if (!threadId) return;

    const state = this.#getState(pubsub);
    const key = this.#threadKey(resourceId, threadId);
    while (true) {
      const activeRunId = state.activeThreadRunIds.get(key);
      const activeRecord = activeRunId ? state.threadRunsById.get(activeRunId) : undefined;
      if (!activeRunId || activeRecord?.agent.id === agent.id || activeRecord?.output.status !== 'running') return;
      if (activeRecord) {
        await activeRecord.output._waitUntilFinished().catch(() => {});
        continue;
      }
      await this.#waitForRemoteRunToFinish(pubsub, key, activeRunId);
    }
  }

  async #waitForRemoteRunToFinish(pubsub: PubSub | undefined, key: string, runId: string) {
    const resolvedPubSub = this.#getPubSub(pubsub);
    const topic = this.#threadTopic(key);
    await new Promise<void>(resolve => {
      const onEvent: EventCallback = event => {
        const data = event.data as AgentThreadStreamRuntimeEvent | undefined;
        if ((data?.type === 'run-completed' || data?.type === 'run-aborted') && data.runId === runId) {
          void resolvedPubSub.unsubscribe(topic, onEvent).catch(() => {});
          resolve();
        }
      };
      void resolvedPubSub.subscribe(topic, onEvent).catch(() => resolve());
    });
  }

  async subscribeToThread<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    options: AgentSubscribeToThreadOptions,
    pubsub?: PubSub,
  ): Promise<AgentThreadSubscription<OUTPUT>> {
    void agent;
    const resolvedPubSub = this.#getPubSub(pubsub);
    const state = this.#getState(resolvedPubSub);
    const key = this.#threadKey(options.resourceId, options.threadId);
    const topic = this.#threadTopic(key);
    const seenRunIds = new Set<string>();
    const pendingRuns: AgentThreadRunRecord<any>[] = [];
    const waiters: Array<() => void> = [];
    let done = false;

    const wake = () => {
      while (waiters.length) waiters.shift()?.();
    };

    const activeRunId = () => {
      const runId = state.activeThreadRunIds.get(key);
      if (!runId) return null;
      const record = state.threadRunsById.get(runId);
      if (!record) return state.threadKeysByRunId.get(runId) === key ? null : runId;
      return record.output.status === 'running' ? runId : null;
    };

    const enqueueRun = (record: AgentThreadRunRecord<any>) => {
      if (done || seenRunIds.has(record.runId)) return;
      seenRunIds.add(record.runId);
      pendingRuns.push(record);
      wake();
    };

    const onEvent: EventCallback = event => {
      const data = event.data as AgentThreadStreamRuntimeEvent | undefined;
      if (!data) return;
      if (data.type === 'run-registered') {
        state.activeThreadRunIds.set(key, data.runId);
        const record = state.threadRunsById.get(data.runId);
        if (record) enqueueRun(record);
        wake();
        return;
      }
      if (data.type === 'signal-enqueued') {
        if (data.sourceId === this.#id) return;
        const queue = state.pendingSignalsByThread.get(key) ?? [];
        queue.push(createSignal(data.signal));
        state.pendingSignalsByThread.set(key, queue);
        return;
      }
      if (data.type === 'run-completed' || data.type === 'run-aborted') {
        if (state.activeThreadRunIds.get(key) === data.runId) {
          state.activeThreadRunIds.delete(key);
        }
        void this.#drainPendingIdleSignals(state, resolvedPubSub, key);
        wake();
      }
    };

    await resolvedPubSub.subscribe(topic, onEvent);

    const currentRunId = activeRunId();
    const currentRecord = currentRunId ? state.threadRunsById.get(currentRunId) : undefined;
    if (currentRecord) {
      enqueueRun(currentRecord);
    }

    const unsubscribe = () => {
      if (done) return;
      done = true;
      void resolvedPubSub.unsubscribe(topic, onEvent).catch(() => {});
      wake();
    };

    return {
      activeRunId,
      abort: () => this.abortThread(options, resolvedPubSub),
      unsubscribe,
      stream: (async function* () {
        try {
          while (!done || pendingRuns.length > 0) {
            if (pendingRuns.length === 0) {
              await new Promise<void>(resolve => waiters.push(resolve));
              continue;
            }
            const run = pendingRuns.shift()!;
            for await (const part of run.output.fullStream) {
              yield part as any;
              if (done) break;
            }
          }
        } finally {
          unsubscribe();
        }
      })(),
    };
  }

  /**
   * Routes a signal to an agent thread.
   *
   * Signals can land in three places:
   * - an active same-agent run, where they are queued for the execution loop to drain;
   * - a reserved thread run that has not registered its stream record yet;
   * - a new idle-started run, when the caller opts into `ifIdle`.
   *
   * Cross-agent active runs are intentionally not interrupted here. They either finish first
   * through `waitForCrossAgentThreadRun()` on the stream path, or this method falls through to
   * the idle-start path when the caller provided a resource/thread target and `ifIdle` options.
   */
  sendSignal<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    signalInput: AgentSignal,
    target: SendAgentSignalOptions<OUTPUT>,
    pubsub?: PubSub,
  ): SendAgentSignalResult {
    const state = this.#getState(pubsub);
    const signal = createSignal(signalInput);
    const callerSignalId = signalInput.id;
    let key: string | undefined;
    let runId = target.runId;
    const activeBehavior = target.ifActive?.behavior ?? 'deliver';
    const idleBehavior = target.ifIdle?.behavior ?? 'wake';

    let activeRecord: AgentThreadRunRecord<any> | undefined;
    if (target.resourceId && target.threadId) {
      key = this.#threadKey(target.resourceId, target.threadId);
      const activeRunId = state.activeThreadRunIds.get(key);
      activeRecord = activeRunId ? state.threadRunsById.get(activeRunId) : undefined;
      if (activeRecord && activeRecord.output.status !== 'running') {
        state.activeThreadRunIds.delete(key);
        activeRecord = undefined;
      }

      // Prefer the active same-agent run for thread-targeted signals. This is the normal
      // follow-up path used by clients that know the thread/resource but not the run id.
      if (activeRecord && activeRecord.agent.id === agent.id) {
        runId = activeRecord.runId;
      } else if (activeRunId && !activeRecord) {
        // A run can be reserved before its stream record is registered. Keep the reserved
        // id so early follow-ups still attach to the run that is starting.
        runId = activeRunId;
      }
    }

    if (runId && !activeRecord) {
      activeRecord = state.threadRunsById.get(runId);
    }
    if (!key && activeRecord) {
      key = this.#threadKey(activeRecord.resourceId, activeRecord.threadId);
    }
    const isActiveTarget = Boolean(
      runId && (activeRecord?.output.status === 'running' || (key && state.activeThreadRunIds.get(key) === runId)),
    );
    const resourceId = target.resourceId ?? activeRecord?.resourceId;
    const threadId = target.threadId ?? activeRecord?.threadId;
    const scopedRunId = target.runId;
    const signalPayloadKey = callerSignalPayloadKey(signalInput);
    const callerSignalKey =
      callerSignalId !== undefined && signalPayloadKey !== undefined
        ? [agent.id, resourceId ?? '', threadId ?? '', scopedRunId ?? '', callerSignalId, signalPayloadKey].join(
            '\u0000',
          )
        : undefined;
    if (callerSignalKey) {
      const accepted = state.acceptedCallerSignals.get(callerSignalKey);
      if (accepted) return accepted;
    }
    const acceptSignal = (result: SendAgentSignalResult, cache = true): SendAgentSignalResult => {
      if (callerSignalKey && cache) {
        state.acceptedCallerSignals.set(callerSignalKey, result);
        const signalIds = state.callerSignalIdsByRunId.get(result.runId) ?? new Set<string>();
        signalIds.add(callerSignalKey);
        state.callerSignalIdsByRunId.set(result.runId, signalIds);
      }
      return result;
    };

    if (isActiveTarget && activeBehavior !== 'deliver') {
      if (activeBehavior === 'persist') {
        if (!resourceId || !threadId) {
          throw new Error('resourceId and threadId are required to persist an active signal');
        }
        const persisted = this.#persistSignal(
          agent,
          signal,
          resourceId,
          threadId,
          target.ifIdle?.streamOptions?.requestContext,
        );
        void persisted.catch(() => {});
        return acceptSignal({ accepted: true, runId: runId!, signal, persisted });
      }
      return acceptSignal({ accepted: true, runId: runId!, signal });
    }

    if (runId) {
      activeRecord ??= state.threadRunsById.get(runId);
      if (activeRecord?.output.status === 'running') {
        key ??= this.#threadKey(activeRecord.resourceId, activeRecord.threadId);
        if (activeRecord.agent.id === agent.id) {
          // Same-agent active run: queue the signal for in-loop draining so it becomes
          // the next model input instead of waiting for the run to finish.
          const queue = state.pendingSignalsByThread.get(key) ?? [];
          queue.push(signal);
          state.pendingSignalsByThread.set(key, queue);
          this.#publish(pubsub, key, {
            type: 'signal-enqueued',
            runId,
            signal: this.#serializeSignal(signal),
            sourceId: this.#id,
          });
          this.#watchThreadRunCompletion(state, pubsub, key, activeRecord);
          return acceptSignal({ accepted: true, runId, signal });
        }
      }

      if (key && state.activeThreadRunIds.get(key) === runId) {
        // Reserved local runs need a local queue until registerRun() attaches the stream record.
        // Remote active runs only need the PubSub event; the owning process queues it locally.
        if (state.threadKeysByRunId.get(runId) === key) {
          const queue = state.pendingSignalsByThread.get(key) ?? [];
          queue.push(signal);
          state.pendingSignalsByThread.set(key, queue);
        }
        this.#publish(pubsub, key, {
          type: 'signal-enqueued',
          runId,
          signal: this.#serializeSignal(signal),
          sourceId: this.#id,
        });
        return acceptSignal({ accepted: true, runId, signal });
      }
    }

    if (!resourceId || !threadId) {
      throw new Error('No active agent run found for signal target');
    }

    runId = randomUUID();
    if (idleBehavior !== 'wake') {
      if (idleBehavior === 'persist') {
        const persisted = this.#persistSignal(
          agent,
          signal,
          resourceId,
          threadId,
          target.ifIdle?.streamOptions?.requestContext,
        );
        void persisted.catch(() => {});
        return acceptSignal({ accepted: true, runId, signal, persisted }, false);
      }
      return acceptSignal({ accepted: true, runId, signal }, false);
    }

    key ??= this.#threadKey(resourceId, threadId);
    if (state.activeThreadRunIds.has(key)) {
      // Another run owns the thread. Queue this idle-start request and let the watcher
      // launch it only after the active run clears the thread reservation.
      const idleQueue = state.pendingIdleSignalsByThread.get(key) ?? [];
      idleQueue.push({ agent, signal, runId, resourceId, threadId, streamOptions: target.ifIdle?.streamOptions });
      state.pendingIdleSignalsByThread.set(key, idleQueue);
      if (activeRecord) {
        this.#watchThreadRunCompletion(state, pubsub, key, activeRecord);
      }
      return acceptSignal({ accepted: true, runId, signal });
    }

    // No active same-agent run accepted the signal. Reserve the thread before starting
    // the idle stream so concurrent callers do not launch duplicate runs.
    state.activeThreadRunIds.set(key, runId);
    state.threadKeysByRunId.set(runId, key);
    const output = agent
      .stream(signal, {
        ...(target.ifIdle?.streamOptions as any),
        runId,
        memory: withThreadMemory(target.ifIdle?.streamOptions?.memory, resourceId, threadId),
      })
      .catch(err => {
        state.threadKeysByRunId.delete(runId);
        this.#cleanupPreparedRun(state, runId);
        this.#forgetCallerSignalsForRun(state, runId);
        if (state.activeThreadRunIds.get(key) === runId) {
          state.activeThreadRunIds.delete(key);
        }
        throw err;
      }) as Promise<MastraModelOutput<unknown>>;
    void output.catch(() => {});

    return acceptSignal({ accepted: true, runId, signal, output });
  }
}

export const agentThreadStreamRuntime = new AgentThreadStreamRuntime();
