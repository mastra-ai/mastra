import { randomUUID } from 'node:crypto';

import { getErrorFromUnknown } from '../error';
import { EventEmitterPubSub } from '../events/event-emitter';
import { isLeaseProvider, NoopLeaseProvider } from '../events/pubsub';
import type { LeaseProvider, PubSub } from '../events/pubsub';
import type { EventCallback } from '../events/types';
import { parseMemoryRequestContext } from '../memory/types';
import type { RequestContext } from '../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import type { MastraModelOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import type { MessageListInput } from './message-list';
import { createMessageSignal, createSignal, resolveDeliveryAttributes } from './signals';
import type { AgentMessageInput, AgentStateSignalInput, CreatedAgentSignal } from './signals';
import { applyStateSignal } from './state-signals';
import type {
  AgentSignal,
  AgentSubscribeToThreadOptions,
  AgentThreadSubscription,
  QueueAgentMessageOptions,
  QueueAgentMessageResult,
  SendAgentMessageOptions,
  SendAgentMessageResult,
  SendAgentSignalOptions,
  SendAgentSignalAccepted,
  SendAgentSignalResult,
  SendAgentStateSignalOptions,
  SendAgentStateSignalResult,
} from './types';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
const AGENT_THREAD_STREAM_TOPIC_PREFIX = 'agent.thread-stream';
/**
 * TTL for the cross-process thread lease acquired in the idle-wake path.
 * Kept short so a crashed owner process frees the thread quickly. A
 * background timer renews the lease while the run is still running.
 */
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Lease TTL. Overridable via `MASTRA_AGENT_THREAD_LEASE_TTL_MS` so cross-process
 * tests can shrink the takeover window (production keeps the 15s default).
 */
const AGENT_THREAD_LEASE_TTL_MS = readPositiveIntEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', 15_000);
/**
 * Interval at which the owner process renews its lease. Defaults to TTL/3,
 * leaving room for two missed renewals (network blip, GC pause) before the
 * lease expires. Overridable via `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS`.
 */
const AGENT_THREAD_LEASE_RENEW_INTERVAL_MS = readPositiveIntEnv(
  'MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS',
  Math.floor(AGENT_THREAD_LEASE_TTL_MS / 3),
);

export let defaultAgentThreadPubSub: PubSub = new EventEmitterPubSub();

function withThreadMemory(memory: unknown, resourceId: string, threadId: string) {
  return {
    ...((memory && typeof memory === 'object' ? memory : {}) as Record<string, unknown>),
    resource: (memory as { resource?: string } | undefined)?.resource ?? resourceId,
    thread: (memory as { thread?: string } | undefined)?.thread ?? threadId,
  };
}

type AgentThreadRunLifecycle = 'running' | 'suspending' | 'suspended' | 'completed' | 'failed' | 'aborted';

type AgentThreadRunSuspension = {
  toolCallId?: string;
  toolName?: string;
  kind: 'approval' | 'generic-tool';
};

type AgentThreadRunRecord<OUTPUT = unknown> = {
  agent: Agent<any, any, any, any>;
  output: MastraModelOutput<OUTPUT>;
  runId: string;
  streamId: string;
  streamSeq: number;
  lifecycle: AgentThreadRunLifecycle;
  suspension?: AgentThreadRunSuspension;
  threadId: string;
  resourceId?: string;
  streamOptions: AgentExecutionOptions<OUTPUT>;
  createSubscriberStream?: () => ReadableStream<unknown>;
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

type PendingContinuation<OUTPUT = unknown> = {
  agent: Agent<any, any, any, any>;
  messages: MessageListInput;
  runId: string;
  resourceId: string;
  threadId: string;
  streamOptions?: AgentExecutionOptions<OUTPUT>;
};

type AgentThreadRuntimeState = {
  threadRunsById: Map<string, AgentThreadRunRecord<any>>;
  threadRunsByStreamId: Map<string, AgentThreadRunRecord<any>>;
  threadKeysByRunId: Map<string, string>;
  activeThreadRunIds: Map<string, string>;
  activeThreadStreamIds: Map<string, string>;
  streamSeqByRunId: Map<string, number>;
  approvalSuspendedRunIds: Set<string>;
  suspendedRunIds: Set<string>;
  suspensionMetadataByRunId: Map<string, AgentThreadRunSuspension>;
  pendingSignalsByThread: Map<string, CreatedAgentSignal[]>;
  // Signals queued for a run that is starting but has not made its first model
  // request yet. The first LLM step drains these and folds them into that
  // request; `pendingSignalsByThread` follow-ups instead become their own turn.
  preRunSignalsByThread: Map<string, CreatedAgentSignal[]>;
  pendingIdleSignalsByThread: Map<string, PendingIdleSignal<any>[]>;
  pendingContinuationsByThread: Map<string, PendingContinuation<any>[]>;
  watchedThreadStreamIds: Set<string>;
  preparedRunsById: Map<string, PreparedThreadRun>;
  abortedRunIds: Set<string>;
  /**
   * Active lease-renewal timers keyed by runId. Set when the owner
   * process wins the cross-process lease, cleared on release. Stored
   * here (not on a Map<key,timer>) so a run's renewal timer survives even
   * if `activeThreadRunIds` is rotated by a follow-up signal.
   */
  leaseRenewalTimers: Map<string, ReturnType<typeof setInterval>>;
};

export type AgentThreadState = 'active' | 'idle';

type SerializableAgentSignal = AgentSignal & Pick<CreatedAgentSignal, 'id' | 'createdAt'>;

type AgentThreadStreamRuntimeEvent =
  | { type: 'run-registered'; runId: string; streamId: string; streamSeq: number }
  | { type: 'stream-part'; runId: string; streamId: string; part: unknown; sourceId: string }
  | { type: 'run-completed'; runId: string; streamId?: string }
  | { type: 'run-suspended'; runId: string; streamId?: string }
  | { type: 'run-aborted'; runId: string; streamId?: string }
  | { type: 'run-failed'; runId: string; streamId?: string; error: string }
  | { type: 'signal-enqueued'; runId: string; signal: SerializableAgentSignal; sourceId: string; preRun?: boolean };

function createRuntimeState(): AgentThreadRuntimeState {
  return {
    threadRunsById: new Map(),
    threadRunsByStreamId: new Map(),
    threadKeysByRunId: new Map(),
    activeThreadRunIds: new Map(),
    activeThreadStreamIds: new Map(),
    streamSeqByRunId: new Map(),
    approvalSuspendedRunIds: new Set(),
    suspendedRunIds: new Set(),
    suspensionMetadataByRunId: new Map(),
    pendingSignalsByThread: new Map(),
    preRunSignalsByThread: new Map(),
    pendingIdleSignalsByThread: new Map(),
    pendingContinuationsByThread: new Map(),
    watchedThreadStreamIds: new Set(),
    preparedRunsById: new Map(),
    abortedRunIds: new Set(),
    leaseRenewalTimers: new Map(),
  };
}

export class AgentThreadStreamRuntime {
  #id?: string;
  #statesByPubSub = new WeakMap<PubSub, AgentThreadRuntimeState>();

  #getPubSub(pubsub?: PubSub): PubSub {
    return pubsub ?? defaultAgentThreadPubSub;
  }

  /**
   * Resolve the {@link LeaseProvider} for the configured pubsub. Leasing is
   * a separate capability from event delivery: a backend only implements it
   * when it can genuinely coordinate a distributed lock (Redis via SET-NX,
   * in-memory for single-process). We feature-detect once here so all lease
   * call sites can use the resolved provider unconditionally.
   *
   * `CachingPubSub` exposes its inner's lease provider via `getLeaseProvider`
   * (caching is transparent to leasing). Otherwise we duck-type the pubsub
   * directly. Backends that cannot lease fall back to {@link NoopLeaseProvider}
   * (always-win / no-op), preserving single-process behavior.
   */
  #getLeaseProvider(pubsub?: PubSub): LeaseProvider {
    const resolved = this.#getPubSub(pubsub);
    const unwrap = (resolved as { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
    if (typeof unwrap === 'function') {
      const inner = unwrap.call(resolved);
      return inner ?? NoopLeaseProvider;
    }
    return isLeaseProvider(resolved) ? resolved : NoopLeaseProvider;
  }

  #getSourceId(): string {
    this.#id ??= randomUUID();
    return this.#id;
  }

  /**
   * Fire-and-forget release of the cross-process thread lease held by
   * this owner. Safe to call when no lease was ever acquired — the
   * pubsub's `releaseLease` is a no-op for non-owners (Lua-guarded
   * GET+DEL on Redis), and the default in-memory implementation is
   * identical. Also stops the renewal timer if one is running for
   * this run.
   */
  #releaseThreadLease(pubsub: PubSub | undefined, key: string, runId: string): void {
    const resolved = this.#getPubSub(pubsub);
    this.#stopLeaseRenewal(resolved, runId);
    void this.#getLeaseProvider(resolved)
      .releaseLease(key, runId)
      .catch(() => {});
  }

  /**
   * Start a background timer that renews the cross-process lease at
   * TTL/3 intervals while the run is still going. If the lease is lost
   * (e.g. expired due to clock skew or pubsub outage) the renewal
   * stops itself — there's nothing useful we can do from the runner
   * side beyond log; the original owner will keep running until the run
   * itself errors or completes.
   */
  #startLeaseRenewal(pubsub: PubSub, key: string, runId: string): void {
    const state = this.#getState(pubsub);
    if (state.leaseRenewalTimers.has(runId)) return;
    const leaseProvider = this.#getLeaseProvider(pubsub);
    const timer = setInterval(() => {
      void leaseProvider
        .renewLease(key, runId, AGENT_THREAD_LEASE_TTL_MS)
        .then(renewed => {
          if (!renewed) {
            // If renewLease reports the lease is gone, stop renewing; the current stream may still finish,
            // but another process can now claim the thread until this run completes or errors.
            this.#stopLeaseRenewal(pubsub, runId);
          }
        })
        .catch(() => {});
    }, AGENT_THREAD_LEASE_RENEW_INTERVAL_MS);
    // Don't keep the process alive solely to renew a lease.
    if (typeof timer === 'object' && timer && typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
    state.leaseRenewalTimers.set(runId, timer);
  }

  #stopLeaseRenewal(pubsub: PubSub, runId: string): void {
    const state = this.#getState(pubsub);
    const timer = state.leaseRenewalTimers.get(runId);
    if (!timer) return;
    clearInterval(timer);
    state.leaseRenewalTimers.delete(runId);
  }

  /**
   * Hand the cross-process thread lease from a finishing run (`fromRunId`)
   * to the run that will drain queued follow-up work next (`toRunId`),
   * without the lease key ever going empty.
   *
   * The previous owner releases its renewal timer and the new owner starts
   * its own; the lease key is re-stamped by `transferLease` (with a full fresh
   * TTL). On atomic backends (Redis, in-memory) a racing process cannot win a
   * freed key between a release and a re-acquire. Backends that can't transfer
   * atomically implement `transferLease` as release+acquire internally and own
   * that race cost. Returns `true` if the new owner now holds the lease.
   */
  async #transferThreadLease(
    pubsub: PubSub | undefined,
    key: string,
    fromRunId: string,
    toRunId: string,
  ): Promise<boolean> {
    const resolved = this.#getPubSub(pubsub);
    const leaseProvider = this.#getLeaseProvider(resolved);
    // `transferLease` is a required `LeaseProvider` method. Atomic backends
    // (Redis, in-memory) swap the key gap-free; backends that can't be atomic
    // implement it as release+acquire internally and own that race cost.
    const held = await leaseProvider
      .transferLease(key, fromRunId, toRunId, AGENT_THREAD_LEASE_TTL_MS)
      .catch(() => false);
    // Move the renewal timer to the new owner regardless: the old timer is
    // owner-guarded and would only no-op now, and the new owner needs its
    // own keep-alive for long drains.
    this.#stopLeaseRenewal(resolved, fromRunId);
    if (held) {
      this.#startLeaseRenewal(resolved, key, toRunId);
    }
    return held;
  }

  /**
   * Ensure this process owns the cross-process lease for `toRunId` before it
   * starts a run, regardless of whether it already held the lease.
   *
   * - When `fromRunId` is provided (draining after a run this process owned),
   *   atomically transfer the held lease to `toRunId` — gap-free, no empty key.
   * - When `fromRunId` is absent, or the transfer reports the old owner no
   *   longer holds the lease, fall back to a fresh `acquireLease`. This covers
   *   a *different* process that observed the owner finish via pub/sub and now
   *   wants to wake the thread: it never held the lease, so it must win one.
   *
   * On success the renewal timer is started for `toRunId`. On failure the
   * returned `owner` is the current holder so the caller can forward work to it.
   */
  async #acquireOrTransferThreadLease(
    pubsub: PubSub | undefined,
    key: string,
    toRunId: string,
    fromRunId?: string,
  ): Promise<{ acquired: boolean; owner?: string }> {
    const resolved = this.#getPubSub(pubsub);
    if (fromRunId) {
      const transferred = await this.#transferThreadLease(pubsub, key, fromRunId, toRunId);
      if (transferred) return { acquired: true, owner: toRunId };
      // Old owner lost the lease before the handoff — fall through to acquire.
    }
    const leaseProvider = this.#getLeaseProvider(resolved);
    const result = await leaseProvider
      .acquireLease(key, toRunId, AGENT_THREAD_LEASE_TTL_MS)
      .catch(() => ({ acquired: false as boolean, owner: undefined as string | undefined }));
    if (result.acquired) {
      this.#startLeaseRenewal(resolved, key, toRunId);
      return { acquired: true, owner: toRunId };
    }
    return { acquired: false, owner: result.owner };
  }

  /**
   * Whether the thread has any queued follow-up work that a finishing run's
   * completion handler would drain next: pending follow-up signals (including
   * any pre-run leftover that will be folded in), queued continuations, or
   * queued idle signals.
   */
  #hasPendingThreadWork(state: AgentThreadRuntimeState, key: string): boolean {
    return (
      (state.pendingSignalsByThread.get(key)?.length ?? 0) > 0 ||
      (state.preRunSignalsByThread.get(key)?.length ?? 0) > 0 ||
      (state.pendingContinuationsByThread.get(key)?.length ?? 0) > 0 ||
      (state.pendingIdleSignalsByThread.get(key)?.length ?? 0) > 0
    );
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

  #isApprovalSuspendedRun(state: AgentThreadRuntimeState, runId: string) {
    return state.approvalSuspendedRunIds.has(runId);
  }

  #isSuspendedRun(state: AgentThreadRuntimeState, runId: string) {
    return state.suspendedRunIds.has(runId) || this.#isApprovalSuspendedRun(state, runId);
  }

  #isThreadBlockingRun(state: AgentThreadRuntimeState, record: AgentThreadRunRecord<any>) {
    return (
      record.output.status === 'running' ||
      record.output.status === 'suspended' ||
      record.lifecycle === 'suspending' ||
      record.lifecycle === 'suspended' ||
      !!record.suspension ||
      this.#isSuspendedRun(state, record.runId)
    );
  }

  #serializeSignal(signal: CreatedAgentSignal): SerializableAgentSignal {
    return signal;
  }

  #nextStreamIdentity(state: AgentThreadRuntimeState, runId: string) {
    const streamSeq = (state.streamSeqByRunId.get(runId) ?? 0) + 1;
    state.streamSeqByRunId.set(runId, streamSeq);
    return { streamId: randomUUID(), streamSeq };
  }

  #markRunSuspending(
    state: AgentThreadRuntimeState,
    runId: string,
    streamId: string,
    suspension: AgentThreadRunSuspension,
  ) {
    state.suspendedRunIds.add(runId);
    state.suspensionMetadataByRunId.set(runId, suspension);
    const record = state.threadRunsByStreamId.get(streamId) ?? state.threadRunsById.get(runId);
    if (record) {
      record.lifecycle = 'suspending';
      record.suspension = suspension;
    }
    if (suspension.kind === 'approval') {
      state.approvalSuspendedRunIds.add(runId);
    }
  }

  #clearSuspendedRun(state: AgentThreadRuntimeState, runId: string) {
    state.suspendedRunIds.delete(runId);
    state.suspensionMetadataByRunId.delete(runId);
    state.approvalSuspendedRunIds.delete(runId);
  }

  getThreadState(options: { resourceId?: string; threadId: string }, pubsub?: PubSub): AgentThreadState {
    const state = this.#getState(pubsub);
    const key = this.#threadKey(options.resourceId, options.threadId);
    const activeRunId = state.activeThreadRunIds.get(key);
    if (!activeRunId) return 'idle';

    const activeRecord = state.threadRunsById.get(activeRunId);
    if (activeRecord && !this.#isThreadBlockingRun(state, activeRecord)) {
      state.activeThreadRunIds.delete(key);
      return 'idle';
    }

    return 'active';
  }

  #publish(pubsub: PubSub | undefined, key: string, event: AgentThreadStreamRuntimeEvent) {
    void this.#publishAndWait(pubsub, key, event).catch(() => {});
  }

  async #publishAndWait(pubsub: PubSub | undefined, key: string, event: AgentThreadStreamRuntimeEvent) {
    await this.#getPubSub(pubsub).publish(this.#threadTopic(key), {
      type: event.type,
      runId: event.runId,
      data: event,
    });
  }

  #withBroadcastStream<OUTPUT>(
    output: MastraModelOutput<OUTPUT>,
    pubsub: PubSub | undefined,
    key: string,
    streamId: string,
  ) {
    const runtime = this;

    const parts: unknown[] = [];
    const waiters = new Set<() => void>();
    let started = false;
    let done = false;
    let error: unknown;

    const wake = () => {
      const pending = [...waiters];
      waiters.clear();
      for (const waiter of pending) waiter();
    };

    const emitPart = async (part: unknown) => {
      if (part && typeof part === 'object' && 'type' in part) {
        const typedPart = part as { type?: string; payload?: { toolCallId?: string; toolName?: string } };
        if (typedPart.type === 'tool-call-approval' || typedPart.type === 'tool-call-suspended') {
          runtime.#markRunSuspending(runtime.#getState(pubsub), output.runId, streamId, {
            toolCallId: typedPart.payload?.toolCallId,
            toolName: typedPart.payload?.toolName,
            kind: typedPart.type === 'tool-call-approval' ? 'approval' : 'generic-tool',
          });
        }
      }
      parts.push(part);
      await runtime.#publishAndWait(pubsub, key, {
        type: 'stream-part',
        runId: output.runId,
        streamId,
        part,
        sourceId: runtime.#getSourceId(),
      });
      wake();
    };

    const start = () => {
      if (started) return;
      started = true;
      void (async () => {
        try {
          const source = output.fullStream as ReadableStream<unknown> | undefined;
          if (!source) return;

          if (typeof source.getReader === 'function') {
            const reader = source.getReader();
            try {
              while (true) {
                const { value: part, done: streamDone } = await reader.read();
                if (streamDone) break;
                await emitPart(part);
              }
            } finally {
              reader.releaseLock();
            }
          } else {
            for await (const part of source as any) {
              await emitPart(part);
            }
          }
        } catch (caught) {
          error = caught;
        } finally {
          done = true;
          wake();
        }
      })();
    };

    const createStream = () => {
      let index = 0;
      let closed = false;
      let waiter: (() => void) | undefined;
      return new ReadableStream({
        async pull(controller) {
          start();
          while (!closed) {
            if (index < parts.length) {
              controller.enqueue(parts[index++]);
              return;
            }
            if (error) {
              controller.error(error);
              return;
            }
            if (done) {
              controller.close();
              return;
            }
            await new Promise<void>(resolve => {
              waiter = resolve;
              waiters.add(resolve);
            });
            if (waiter) {
              waiters.delete(waiter);
              waiter = undefined;
            }
          }
        },
        cancel() {
          closed = true;
          if (waiter) {
            waiters.delete(waiter);
            waiter();
            waiter = undefined;
          }
        },
      });
    };

    return { output, createSubscriberStream: createStream, startBroadcast: start };
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
      this.#releaseThreadLease(pubsub, key, runId);
      this.#publish(pubsub, key, { type: 'run-aborted', runId });
    }

    return true;
  }

  getActiveThreadRunId(options: AgentSubscribeToThreadOptions, pubsub?: PubSub): string | undefined {
    const state = this.#getState(pubsub);
    const key = this.#threadKey(options.resourceId, options.threadId);
    const activeRunId = state.activeThreadRunIds.get(key);
    if (!activeRunId) return undefined;

    const record = state.threadRunsById.get(activeRunId);
    if (record && !this.#isThreadBlockingRun(state, record)) return undefined;

    return activeRunId;
  }

  getResumableThreadRun(
    options: AgentSubscribeToThreadOptions & { runId: string; toolCallId?: string },
    pubsub?: PubSub,
  ): { runId: string; toolCallId?: string } | undefined {
    const state = this.#getState(pubsub);
    const key = this.#threadKey(options.resourceId, options.threadId);
    const record = state.threadRunsById.get(options.runId);
    const isSuspended = this.#isSuspendedRun(state, options.runId);
    if (!record || state.threadKeysByRunId.get(options.runId) !== key || !isSuspended) {
      return undefined;
    }

    const suspension = record.suspension ?? state.suspensionMetadataByRunId.get(options.runId);
    if (options.toolCallId && suspension?.toolCallId && suspension.toolCallId !== options.toolCallId) {
      return undefined;
    }

    return { runId: options.runId, toolCallId: options.toolCallId ?? suspension?.toolCallId };
  }

  abortThread(options: AgentSubscribeToThreadOptions, pubsub?: PubSub): boolean {
    const activeRunId = this.getActiveThreadRunId(options, pubsub);
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
    state.leaseRenewalTimers.forEach(timer => clearInterval(timer));
    state.leaseRenewalTimers.clear();
    state.threadRunsById.clear();
    state.threadRunsByStreamId.clear();
    state.threadKeysByRunId.clear();
    state.activeThreadRunIds.clear();
    state.approvalSuspendedRunIds.clear();
    state.suspendedRunIds.clear();
    state.suspensionMetadataByRunId.clear();
    state.pendingSignalsByThread.clear();
    state.preRunSignalsByThread.clear();
    state.pendingIdleSignalsByThread.clear();
    state.pendingContinuationsByThread.clear();
    state.activeThreadStreamIds.clear();
    state.streamSeqByRunId.clear();
    state.watchedThreadStreamIds.clear();
    state.preparedRunsById.clear();
    state.abortedRunIds.clear();
  }

  #cleanupPreparedRun(state: AgentThreadRuntimeState, runId: string) {
    state.preparedRunsById.get(runId)?.cleanup();
    state.preparedRunsById.delete(runId);
    state.abortedRunIds.delete(runId);
  }

  async #persistSignal(
    agent: Agent<any, any, any, any>,
    signal: CreatedAgentSignal,
    resourceId: string,
    threadId: string,
    requestContext?: RequestContext,
  ) {
    // Transient signals are delivery-only: never write them to storage, even when the
    // active-behavior asked to persist. Honored here (not just in the memory layer) so it holds
    // for any memory implementation, including ones without a signal-aware save filter.
    if (signal.transient) return;
    const memory = await agent.getMemory({ requestContext });
    if (!memory) return;
    await memory.saveMessages({
      messages: [signal.toDBMessage({ resourceId, threadId })],
    });
  }

  #broadcastPersistedSignal(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    runId: string,
    signal: CreatedAgentSignal,
    resourceId: string,
    threadId: string,
  ) {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const parts: any[] = [
      { type: 'start', runId },
      { ...signal.toDataPart(), runId },
      {
        type: 'finish',
        runId,
        payload: {
          stepResult: { reason: 'stop' },
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
      },
    ];
    const output = {
      runId,
      status: 'running',
      fullStream: new ReadableStream({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
          finish();
        },
      }),
      _waitUntilFinished: () => finished,
    } as MastraModelOutput<any>;
    const { streamId, streamSeq } = this.#nextStreamIdentity(state, runId);
    const {
      output: outputForSubscribers,
      createSubscriberStream,
      startBroadcast,
    } = this.#withBroadcastStream(output, pubsub, key, streamId);
    const record: AgentThreadRunRecord<any> = {
      agent: { id: `persisted-signal:${signal.id}` } as Agent<any, any, any, any>,
      output: outputForSubscribers,
      runId,
      streamId,
      streamSeq,
      lifecycle: 'running',
      threadId,
      resourceId,
      streamOptions: {},
      createSubscriberStream,
    };

    state.threadRunsById.set(runId, record);
    state.threadRunsByStreamId.set(streamId, record);
    state.threadKeysByRunId.set(runId, key);
    state.activeThreadStreamIds.set(key, streamId);
    const registered = this.#publishAndWait(pubsub, key, { type: 'run-registered', runId, streamId, streamSeq });
    void registered.then(startBroadcast, startBroadcast);
    void outputForSubscribers._waitUntilFinished().finally(() => {
      setTimeout(() => {
        state.threadRunsByStreamId.delete(streamId);
        if (state.threadRunsById.get(runId) === record) {
          state.threadRunsById.delete(runId);
          state.threadKeysByRunId.delete(runId);
        }
        if (state.activeThreadRunIds.get(key) === runId && state.activeThreadStreamIds.get(key) === streamId) {
          state.activeThreadRunIds.delete(key);
          state.activeThreadStreamIds.delete(key);
        }
        this.#releaseThreadLease(pubsub, key, runId);
        this.#publish(pubsub, key, { type: 'run-completed', runId, streamId });
      }, 0);
    });
  }

  async #persistAndBroadcastIdleSignal(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    runId: string,
    agent: Agent<any, any, any, any>,
    signal: CreatedAgentSignal,
    resourceId: string,
    threadId: string,
    requestContext?: RequestContext,
  ) {
    await this.#persistSignal(agent, signal, resourceId, threadId, requestContext);
    this.#broadcastPersistedSignal(state, pubsub, key, runId, signal, resourceId, threadId);
  }

  registerRun<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
    pubsub?: PubSub,
  ): Promise<void> | undefined {
    const { threadId, resourceId } = this.#getThreadTarget(streamOptions);
    if (!threadId) return;

    const state = this.#getState(pubsub);
    const key = this.#threadKey(resourceId, threadId);
    const { streamId, streamSeq } = this.#nextStreamIdentity(state, output.runId);
    const {
      output: outputForSubscribers,
      createSubscriberStream,
      startBroadcast,
    } = this.#withBroadcastStream(output, pubsub, key, streamId);
    const record: AgentThreadRunRecord<OUTPUT> = {
      agent,
      output: outputForSubscribers,
      runId: output.runId,
      streamId,
      streamSeq,
      lifecycle: 'running',
      threadId,
      resourceId,
      streamOptions: streamOptions as AgentThreadRunRecord<OUTPUT>['streamOptions'],
      createSubscriberStream,
    };

    this.#clearSuspendedRun(state, output.runId);
    state.threadRunsById.set(output.runId, record);
    state.threadRunsByStreamId.set(streamId, record);
    state.threadKeysByRunId.set(output.runId, key);
    state.activeThreadRunIds.set(key, output.runId);
    state.activeThreadStreamIds.set(key, streamId);
    const registered = this.#publishAndWait(pubsub, key, {
      type: 'run-registered',
      runId: output.runId,
      streamId,
      streamSeq,
    });
    // Always drive the run's stream to completion, even when no caller consumes
    // the returned output (e.g. a fire-and-forget schedule wake). The broadcast
    // tee buffers every part, so a later/external subscriber still replays the
    // full stream; without this pump the run never reaches a terminal state and
    // its active-run record + thread lease would never release, permanently
    // wedging the thread.
    void registered.then(startBroadcast, startBroadcast);
    this.#watchThreadRunCompletion(state, pubsub, key, record);
    return registered;
  }

  #watchThreadRunCompletion(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    record: AgentThreadRunRecord<any>,
  ) {
    if (state.watchedThreadStreamIds.has(record.streamId)) return;
    state.watchedThreadStreamIds.add(record.streamId);

    void record.output._waitUntilFinished().finally(() => {
      state.watchedThreadStreamIds.delete(record.streamId);
      this.#cleanupPreparedRun(state, record.runId);

      if (record.output.status === 'suspended' && this.#isSuspendedRun(state, record.runId)) {
        record.lifecycle = 'suspended';
        this.#publish(pubsub, key, { type: 'run-suspended', runId: record.runId, streamId: record.streamId });
        return;
      }

      record.lifecycle = 'completed';
      this.#clearSuspendedRun(state, record.runId);
      state.threadRunsByStreamId.delete(record.streamId);
      if (state.threadRunsById.get(record.runId) === record) {
        state.threadRunsById.delete(record.runId);
        state.threadKeysByRunId.delete(record.runId);
      }

      if (
        state.activeThreadRunIds.get(key) === record.runId &&
        state.activeThreadStreamIds.get(key) === record.streamId
      ) {
        state.activeThreadRunIds.delete(key);
        state.activeThreadStreamIds.delete(key);
      }

      // If queued follow-up work exists, keep the cross-process lease held by
      // handing it to the next run instead of releasing it: releasing here
      // would briefly empty the lease key, letting a racing process win it and
      // start a competing run on this thread. The drain runs under the
      // transferred lease and releases it only once every queue is empty. If
      // there's no pending work, release as usual so other processes can wake
      // the thread.
      this.#publish(pubsub, key, { type: 'run-completed', runId: record.runId, streamId: record.streamId });
      if (this.#hasPendingThreadWork(state, key)) {
        void this.#drainPendingSignals(state, pubsub, key, record);
      } else {
        this.#releaseThreadLease(pubsub, key, record.runId);
      }
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

    // A run can finish before its first model request drained its pre-run
    // signals (e.g. it errored early). Don't strand them — fold them into the
    // follow-up queue so the next run still picks them up.
    const preRunLeftover = state.preRunSignalsByThread.get(key);
    if (preRunLeftover?.length) {
      state.preRunSignalsByThread.delete(key);
      state.pendingSignalsByThread.set(key, [...preRunLeftover, ...(state.pendingSignalsByThread.get(key) ?? [])]);
    }

    const queue = state.pendingSignalsByThread.get(key);
    const signal = queue?.shift();
    if (signal && queue) {
      if (queue.length === 0) {
        state.pendingSignalsByThread.delete(key);
      }

      // Hand the lease from the finished run to this drained run before
      // streaming, so the lease key never goes empty during the handoff. If the
      // old owner already lost the lease (e.g. a pubsub blip let the TTL lapse
      // and another process took over), forward the signal to the new winner
      // instead of starting a competing run here.
      const nextRunId = randomUUID();
      state.activeThreadRunIds.set(key, nextRunId);
      const owns = await this.#acquireOrTransferThreadLease(pubsub, key, nextRunId, previousRun.runId);
      if (!owns.acquired) {
        if (state.activeThreadRunIds.get(key) === nextRunId) {
          state.activeThreadRunIds.delete(key);
        }
        // Put the signal back at the head so a later drain (or the winner) runs
        // it, and forward it to the current lease owner.
        const restored = state.pendingSignalsByThread.get(key) ?? [];
        state.pendingSignalsByThread.set(key, [signal, ...restored]);
        if (owns.owner) {
          await this.#publishAndWait(pubsub, key, {
            type: 'signal-enqueued',
            runId: owns.owner,
            signal: this.#serializeSignal(signal),
            sourceId: this.#getSourceId(),
          }).catch(() => {});
          state.pendingSignalsByThread.get(key)?.shift();
          if ((state.pendingSignalsByThread.get(key)?.length ?? 0) === 0) {
            state.pendingSignalsByThread.delete(key);
          }
        }
        return;
      }

      const output = await previousRun.agent.stream(signal, {
        ...(previousRun.streamOptions as any),
        runId: nextRunId,
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

    if (await this.#drainPendingContinuations(state, pubsub, key, previousRun.runId)) {
      return;
    }

    if (await this.#drainPendingIdleSignals(state, pubsub, key, previousRun.runId)) {
      return;
    }

    // Nothing left to drain: release the lease we kept held for the drain.
    this.#releaseThreadLease(pubsub, key, previousRun.runId);
  }

  async #drainPendingContinuations(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    fromRunId?: string,
  ) {
    if (state.activeThreadRunIds.has(key)) {
      return false;
    }

    const queue = state.pendingContinuationsByThread.get(key);
    const pending = queue?.shift();
    if (!pending || !queue) {
      return false;
    }
    if (queue.length === 0) {
      state.pendingContinuationsByThread.delete(key);
    }

    // A continuation only ever drains in the process that owned the finished
    // run, so it always carries a `fromRunId` to hand the held lease to. If the
    // old owner already lost the lease, re-queue the continuation and let the
    // new lease owner take over rather than starting a competing run here.
    if (fromRunId) {
      state.activeThreadRunIds.set(key, pending.runId);
      const owns = await this.#acquireOrTransferThreadLease(pubsub, key, pending.runId, fromRunId);
      if (!owns.acquired) {
        if (state.activeThreadRunIds.get(key) === pending.runId) {
          state.activeThreadRunIds.delete(key);
        }
        const restored = state.pendingContinuationsByThread.get(key) ?? [];
        state.pendingContinuationsByThread.set(key, [pending, ...restored]);
        return false;
      }
    }

    this.#startContinuation(state, pubsub, key, pending);
    return true;
  }

  #startContinuation(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    pending: PendingContinuation<any>,
  ) {
    state.activeThreadRunIds.set(key, pending.runId);
    state.threadKeysByRunId.set(pending.runId, key);
    void pending.agent
      .stream(pending.messages, {
        ...(pending.streamOptions as any),
        runId: pending.runId,
        memory: withThreadMemory(pending.streamOptions?.memory, pending.resourceId, pending.threadId),
      })
      .then(output => {
        if ((state.pendingContinuationsByThread.get(key)?.length ?? 0) > 0) {
          const nextRecord = state.threadRunsById.get(output.runId);
          if (nextRecord) {
            this.#watchThreadRunCompletion(state, pubsub, key, nextRecord);
          }
        }
      })
      .catch(err => {
        state.threadKeysByRunId.delete(pending.runId);
        this.#cleanupPreparedRun(state, pending.runId);
        if (state.activeThreadRunIds.get(key) === pending.runId) {
          state.activeThreadRunIds.delete(key);
        }
        this.#publish(pubsub, key, {
          type: 'run-failed',
          runId: pending.runId,
          error: getErrorFromUnknown(err).message,
        });
        // Hand the lease to remaining queued work (transfer keeps the key from
        // going empty); only release once nothing is left to drain.
        void this.#drainPendingContinuations(state, pubsub, key, pending.runId).then(async started => {
          if (started) return;
          if (await this.#drainPendingIdleSignals(state, pubsub, key, pending.runId)) return;
          this.#releaseThreadLease(pubsub, key, pending.runId);
        });
      });
  }

  continueWithMessages<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    messages: MessageListInput,
    target: { resourceId: string; threadId: string; streamOptions?: AgentExecutionOptions<OUTPUT>; runId?: string },
    pubsub?: PubSub,
  ): { accepted: true; runId: string } {
    const state = this.#getState(pubsub);
    const key = this.#threadKey(target.resourceId, target.threadId);
    const runId = target.runId ?? randomUUID();
    const pending: PendingContinuation<OUTPUT> = {
      agent,
      messages,
      runId,
      resourceId: target.resourceId,
      threadId: target.threadId,
      streamOptions: target.streamOptions,
    };

    const activeRunId = state.activeThreadRunIds.get(key);
    const activeRecord = activeRunId ? state.threadRunsById.get(activeRunId) : undefined;
    if (state.activeThreadRunIds.has(key)) {
      const queue = state.pendingContinuationsByThread.get(key) ?? [];
      queue.push(pending);
      state.pendingContinuationsByThread.set(key, queue);
      if (activeRecord) {
        this.#watchThreadRunCompletion(state, pubsub, key, activeRecord);
      }
      return { accepted: true, runId };
    }

    this.#startContinuation(state, pubsub, key, pending);
    return { accepted: true, runId };
  }

  async #drainPendingIdleSignals(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    fromRunId?: string,
  ): Promise<boolean> {
    if (state.activeThreadRunIds.has(key)) {
      return false;
    }

    const idleQueue = state.pendingIdleSignalsByThread.get(key);
    const pendingIdle = idleQueue?.shift();
    if (!pendingIdle || !idleQueue) {
      return false;
    }
    if (idleQueue.length === 0) {
      state.pendingIdleSignalsByThread.delete(key);
    }

    state.activeThreadRunIds.set(key, pendingIdle.runId);
    state.threadKeysByRunId.set(pendingIdle.runId, key);

    // A queued idle signal may be draining either in the process that just
    // finished a run (it still holds the lease — hand it over) or in a
    // *different* process that observed the owner's run finish via pub/sub and
    // now wants to wake the thread (it holds no lease — it must win one). Either
    // way the run must only start if this process owns the cross-process lease,
    // otherwise two processes could each start a competing idle run.
    const owns = await this.#acquireOrTransferThreadLease(pubsub, key, pendingIdle.runId, fromRunId);
    if (!owns.acquired) {
      // Lost the wake race. Roll back the optimistic local reservation and
      // forward the signal to the winner so it is not dropped, then try the
      // next queued idle signal (which may belong to a different run we can win).
      if (state.activeThreadRunIds.get(key) === pendingIdle.runId) {
        state.activeThreadRunIds.delete(key);
      }
      state.threadKeysByRunId.delete(pendingIdle.runId);
      if (owns.owner) {
        await this.#publishAndWait(pubsub, key, {
          type: 'signal-enqueued',
          runId: owns.owner,
          signal: this.#serializeSignal(pendingIdle.signal),
          sourceId: this.#getSourceId(),
        }).catch(() => {});
      }
      await this.#drainPendingIdleSignals(state, pubsub, key, fromRunId);
      return true;
    }

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
    } catch (err) {
      state.threadKeysByRunId.delete(pendingIdle.runId);
      this.#cleanupPreparedRun(state, pendingIdle.runId);
      if (state.activeThreadRunIds.get(key) === pendingIdle.runId) {
        state.activeThreadRunIds.delete(key);
      }
      this.#publish(pubsub, key, {
        type: 'run-failed',
        runId: pendingIdle.runId,
        error: getErrorFromUnknown(err).message,
      });
      // Hand the lease to remaining idle work; release only when none remains.
      if (!(await this.#drainPendingIdleSignals(state, pubsub, key, pendingIdle.runId))) {
        this.#releaseThreadLease(pubsub, key, pendingIdle.runId);
      }
    }
    return true;
  }

  /**
   * Drains queued signals for a run.
   *
   * - `scope: 'pending'` (default) returns active-run follow-up signals — each
   *   becomes its own model turn via `signalDrainStep`.
   * - `scope: 'pre-run'` returns signals queued before the run's first model
   *   request — the first LLM step folds these into that request.
   */
  drainPendingSignals(runId: string, pubsub?: PubSub, scope: 'pending' | 'pre-run' = 'pending'): CreatedAgentSignal[] {
    const state = this.#getState(pubsub);
    const record = state.threadRunsById.get(runId);
    const key = record ? this.#threadKey(record.resourceId, record.threadId) : state.threadKeysByRunId.get(runId);
    if (!key) return [];

    const signalsByThread = scope === 'pre-run' ? state.preRunSignalsByThread : state.pendingSignalsByThread;
    const queue = signalsByThread.get(key);
    if (!queue || queue.length === 0) {
      return [];
    }

    signalsByThread.delete(key);
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
      if (!activeRunId) return;

      const activeRecord = state.threadRunsById.get(activeRunId);
      if (activeRecord) {
        if (activeRecord.agent.id === agent.id || !this.#isThreadBlockingRun(state, activeRecord)) {
          return;
        }
        await activeRecord.output._waitUntilFinished().catch(() => {});
        continue;
      }

      if (state.threadKeysByRunId.get(activeRunId) === key) return;

      await this.#waitForRemoteRunToFinish(pubsub, key, activeRunId);
    }
  }

  async #waitForRemoteRunToFinish(pubsub: PubSub | undefined, key: string, runId: string) {
    const resolvedPubSub = this.#getPubSub(pubsub);
    const topic = this.#threadTopic(key);
    await new Promise<void>(resolve => {
      const onEvent: EventCallback = event => {
        const data = event.data as AgentThreadStreamRuntimeEvent | undefined;
        if (
          (data?.type === 'run-completed' || data?.type === 'run-aborted' || data?.type === 'run-failed') &&
          data.runId === runId
        ) {
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
    const seenStreamIds = new Set<string>();
    const pendingRuns: AgentThreadRunRecord<any>[] = [];
    const waiters: Array<() => void> = [];
    const remoteRuns = new Map<
      string,
      {
        parts: unknown[];
        waiters: Array<() => void>;
        finishWaiters: Array<() => void>;
        done: boolean;
        stream: ReadableStream<unknown>;
      }
    >();
    let done = false;

    const wake = () => {
      while (waiters.length) waiters.shift()?.();
    };

    const activeRunId = () => {
      const runId = state.activeThreadRunIds.get(key);
      if (!runId) return null;
      const record = state.threadRunsById.get(runId);
      // No record yet means either a remote run (record never lives locally) or a local run
      // that sendSignal has reserved but has not yet registered via registerRun. Both are
      // in flight from the subscriber's perspective; treat them as active.
      if (!record) return runId;
      return this.#isThreadBlockingRun(state, record) ? runId : null;
    };

    const enqueueRun = (record: AgentThreadRunRecord<any>) => {
      if (done || seenStreamIds.has(record.streamId)) return;
      seenStreamIds.add(record.streamId);
      pendingRuns.push(record);
      wake();
    };

    const createRemoteRun = (runId: string, streamId: string, streamSeq: number): AgentThreadRunRecord<any> => {
      const remoteRun = {
        parts: [] as unknown[],
        waiters: [] as Array<() => void>,
        finishWaiters: [] as Array<() => void>,
        done: false,
        stream: undefined as unknown as ReadableStream<unknown>,
        closed: false,
      };
      remoteRun.stream = new ReadableStream({
        pull(controller) {
          const drain = () => {
            if (remoteRun.closed) return;
            while (remoteRun.parts.length > 0) {
              controller.enqueue(remoteRun.parts.shift());
            }
            if (remoteRun.done) {
              remoteRun.closed = true;
              controller.close();
            }
          };
          drain();
          if (!remoteRun.done && !remoteRun.closed) {
            remoteRun.waiters.push(drain);
          }
        },
        cancel() {
          remoteRun.done = true;
          remoteRun.closed = true;
          remoteRun.waiters.length = 0;
          while (remoteRun.finishWaiters.length) remoteRun.finishWaiters.shift()?.();
        },
      });
      remoteRuns.set(streamId, remoteRun);
      return {
        agent,
        output: {
          runId,
          status: 'running',
          fullStream: remoteRun.stream,
          _waitUntilFinished: async () => {
            if (remoteRun.done) return;
            await new Promise<void>(resolve => remoteRun.finishWaiters.push(resolve));
          },
        } as MastraModelOutput<any>,
        runId,
        streamId,
        streamSeq,
        lifecycle: 'running',
        threadId: options.threadId,
        resourceId: options.resourceId,
        streamOptions: {},
      };
    };

    const onEvent: EventCallback = event => {
      const data = event.data as AgentThreadStreamRuntimeEvent | undefined;
      if (!data) return;
      if (data.type === 'run-registered') {
        state.activeThreadRunIds.set(key, data.runId);
        state.activeThreadStreamIds.set(key, data.streamId);
        const record =
          state.threadRunsByStreamId.get(data.streamId) ?? createRemoteRun(data.runId, data.streamId, data.streamSeq);
        enqueueRun(record);
        wake();
        return;
      }
      if (data.type === 'stream-part') {
        if (data.sourceId === this.#id) return;
        let remoteRun = remoteRuns.get(data.streamId);
        if (!remoteRun) {
          // A subscriber can attach after another runtime already broadcast run-registered.
          // Treat the first stream-part on this thread topic as proof of the remote run and
          // create the local proxy stream from that point forward.
          state.activeThreadRunIds.set(key, data.runId);
          state.activeThreadStreamIds.set(key, data.streamId);
          enqueueRun(createRemoteRun(data.runId, data.streamId, state.streamSeqByRunId.get(data.runId) ?? 1));
          remoteRun = remoteRuns.get(data.streamId);
          if (!remoteRun) return;
        }
        remoteRun.parts.push(data.part);
        while (remoteRun.waiters.length) remoteRun.waiters.shift()?.();
        return;
      }
      if (data.type === 'signal-enqueued') {
        if (data.sourceId === this.#id) return;
        const signalsByThread = data.preRun ? state.preRunSignalsByThread : state.pendingSignalsByThread;
        const queue = signalsByThread.get(key) ?? [];
        queue.push(createSignal(data.signal));
        signalsByThread.set(key, queue);
        return;
      }
      if (data.type === 'run-failed') {
        const eventStreamId = data.streamId ?? data.runId;
        if (
          state.activeThreadRunIds.get(key) === data.runId &&
          (!data.streamId || state.activeThreadStreamIds.get(key) === data.streamId)
        ) {
          state.activeThreadRunIds.delete(key);
          state.activeThreadStreamIds.delete(key);
        }
        let errorRun: AgentThreadRunRecord<any> | undefined;
        let remoteRun = remoteRuns.get(eventStreamId);
        if (!remoteRun) {
          errorRun = createRemoteRun(data.runId, eventStreamId, state.streamSeqByRunId.get(data.runId) ?? 1);
          remoteRun = remoteRuns.get(eventStreamId);
        }
        if (remoteRun) {
          remoteRun.parts.push({ type: 'error', payload: { error: new Error(data.error) } });
          remoteRun.done = true;
          while (remoteRun.waiters.length) remoteRun.waiters.shift()?.();
          while (remoteRun.finishWaiters.length) remoteRun.finishWaiters.shift()?.();
          remoteRuns.delete(eventStreamId);
          seenStreamIds.delete(eventStreamId);
        }
        if (errorRun) enqueueRun(errorRun);
        void this.#drainPendingIdleSignals(state, resolvedPubSub, key);
        wake();
        return;
      }
      if (data.type === 'run-completed' || data.type === 'run-aborted' || data.type === 'run-suspended') {
        const eventStreamId = data.streamId ?? data.runId;
        if (data.type === 'run-suspended') {
          state.suspendedRunIds.add(data.runId);
          const record = state.threadRunsByStreamId.get(eventStreamId) ?? state.threadRunsById.get(data.runId);
          if (record) record.lifecycle = 'suspended';
        } else if (
          state.activeThreadRunIds.get(key) === data.runId &&
          (!data.streamId || state.activeThreadStreamIds.get(key) === data.streamId)
        ) {
          state.activeThreadRunIds.delete(key);
          state.activeThreadStreamIds.delete(key);
        }
        if (data.type !== 'run-suspended') {
          this.#clearSuspendedRun(state, data.runId);
        }
        const remoteRun = remoteRuns.get(eventStreamId);
        if (remoteRun) {
          remoteRun.done = true;
          while (remoteRun.waiters.length) remoteRun.waiters.shift()?.();
          while (remoteRun.finishWaiters.length) remoteRun.finishWaiters.shift()?.();
          remoteRuns.delete(eventStreamId);
          seenStreamIds.delete(eventStreamId);
        }
        // When a run is aborted, cancel the current subscriber stream reader so
        // the generator's inner loop unblocks and can yield the synthetic abort.
        if (data.type === 'run-aborted' && activeReaderRunId === data.runId && currentReader) {
          cancelledByAbort = true;
          try {
            void currentReader.cancel();
          } catch {}
        }
        if (data.type !== 'run-suspended') {
          void this.#drainPendingIdleSignals(state, resolvedPubSub, key);
        }
        wake();
      }
    };

    await resolvedPubSub.subscribe(topic, onEvent);

    const currentRunId = activeRunId();
    const currentRecord = currentRunId ? state.threadRunsById.get(currentRunId) : undefined;
    if (currentRecord) {
      enqueueRun(currentRecord);
    }

    // Mutable ref to the subscriber stream reader currently being consumed by
    // the generator. When a run-aborted event fires, we cancel this reader so
    // the blocked `reader.read()` resolves immediately with {done: true}.
    let currentReader: ReadableStreamDefaultReader<any> | null = null;
    let activeReaderRunId: string | null = null;
    // Set to true when the reader is cancelled explicitly due to a run-aborted
    // event, so the generator can yield a synthetic abort chunk.
    let cancelledByAbort = false;

    const unsubscribe = () => {
      if (done) return;
      done = true;
      void resolvedPubSub.unsubscribe(topic, onEvent).catch(() => {});
      // Cancel current reader so the generator's inner loop breaks.
      if (currentReader) {
        try {
          void currentReader.cancel();
        } catch {}
      }
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
            // Local registered runs expose createSubscriberStream, while remote runs are
            // already per-subscription streams. Do not silently skip locked streams here:
            // a locked fallback stream means a caller is sharing a non-multicast stream.
            const subscriberStream = run.createSubscriberStream?.() ?? run.output.fullStream;
            const reader = subscriberStream.getReader();
            currentReader = reader as ReadableStreamDefaultReader<any>;
            activeReaderRunId = run.runId;
            let readerReleased = false;
            try {
              while (true) {
                const { value: part, done: streamDone } = await reader.read();
                if (streamDone) {
                  break;
                }
                const typedPart = part as any;
                const partWithRunId =
                  typedPart && typeof typedPart === 'object' && !('runId' in typedPart)
                    ? { ...typedPart, runId: run.runId }
                    : typedPart;
                yield partWithRunId;
                if (done) break;
                const finishReason = typedPart.finishReason ?? typedPart.payload?.finishReason;
                const terminalBoundary =
                  typedPart.type === 'error' ||
                  typedPart.type === 'abort' ||
                  (typedPart.type === 'finish' && finishReason !== 'tool-calls');
                if (terminalBoundary) {
                  // After a final terminal chunk, drain any non-visible trailing
                  // data in the background to prevent upstream backpressure while
                  // allowing the generator to immediately serve subsequent runs.
                  readerReleased = true;
                  void (async () => {
                    try {
                      while (true) {
                        const { done: d } = await reader.read();
                        if (d) break;
                      }
                    } catch {}
                    reader.releaseLock();
                  })();
                  break;
                }
              }
              // If the stream closed because we cancelled the reader after a
              // run-aborted event, yield a synthetic abort so subscribers
              // finalize the run.
              if (!readerReleased && !done && cancelledByAbort) {
                yield { type: 'abort', runId: run.runId } as any;
                cancelledByAbort = false;
              }
            } finally {
              currentReader = null;
              activeReaderRunId = null;
              if (!readerReleased) {
                reader.releaseLock();
              }
            }
          }
        } finally {
          unsubscribe();
        }
      })(),
    };
  }

  sendMessage<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    message: AgentMessageInput,
    target: SendAgentMessageOptions<OUTPUT>,
    pubsub?: PubSub,
  ): SendAgentMessageResult<OUTPUT> {
    return this.sendSignal<OUTPUT>(agent, createMessageSignal(message, { acceptedAt: new Date() }), target, pubsub);
  }

  queueMessage<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    message: AgentMessageInput,
    target: QueueAgentMessageOptions<OUTPUT>,
    pubsub?: PubSub,
  ): QueueAgentMessageResult<OUTPUT> {
    const state = this.#getState(pubsub);
    const signal = createMessageSignal(message, { acceptedAt: new Date() });
    let key: string | undefined;
    let runId = target.runId;
    let activeRecord: AgentThreadRunRecord<any> | undefined;

    if (target.resourceId && target.threadId) {
      key = this.#threadKey(target.resourceId, target.threadId);
      const activeRunId = state.activeThreadRunIds.get(key);
      activeRecord = activeRunId ? state.threadRunsById.get(activeRunId) : undefined;
      if (activeRecord && !this.#isThreadBlockingRun(state, activeRecord)) {
        state.activeThreadRunIds.delete(key);
        activeRecord = undefined;
      }
      runId ??= activeRunId;
    }

    if (runId) {
      activeRecord ??= state.threadRunsById.get(runId);
      if (activeRecord) {
        key ??= this.#threadKey(activeRecord.resourceId, activeRecord.threadId);
      }
    }

    const resourceId = target.resourceId ?? activeRecord?.resourceId;
    const threadId = target.threadId ?? activeRecord?.threadId;
    if (!resourceId || !threadId) {
      throw new Error('resourceId and threadId are required to queue a message');
    }

    key ??= this.#threadKey(resourceId, threadId);
    const queuedRunId = randomUUID();
    const queuedStreamOptions = target.ifIdle?.streamOptions ?? activeRecord?.streamOptions;

    if (activeRecord) {
      const idleQueue = state.pendingIdleSignalsByThread.get(key) ?? [];
      idleQueue.push({ agent, signal, runId: queuedRunId, resourceId, threadId, streamOptions: queuedStreamOptions });
      state.pendingIdleSignalsByThread.set(key, idleQueue);
      this.#watchThreadRunCompletion(state, pubsub, key, activeRecord);
      return {
        signal,
        accepted: Promise.resolve({ action: 'deliver' as const, runId: queuedRunId }),
      };
    }

    return this.sendSignal<OUTPUT>(
      agent,
      signal,
      { ...target, runId, resourceId, threadId, ifIdle: { ...target.ifIdle, behavior: 'wake' } },
      pubsub,
    );
  }

  async sendStateSignal<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    stateInput: AgentStateSignalInput,
    target: SendAgentStateSignalOptions<OUTPUT>,
    pubsub?: PubSub,
  ): Promise<SendAgentStateSignalResult<OUTPUT>> {
    if (!target.resourceId || !target.threadId) {
      throw new Error('resourceId and threadId are required to send a state signal');
    }
    const resourceId = target.resourceId;
    const threadId = target.threadId;

    const requestContext = target.ifIdle?.streamOptions?.requestContext;
    const memoryContext = parseMemoryRequestContext(requestContext);
    const memory = await agent.getMemory({ requestContext });
    if (!memory) {
      throw new Error('sendStateSignal requires Mastra memory');
    }

    const loadedThread = (await memory.getThreadById({ threadId })) ?? memoryContext?.thread;
    if (!loadedThread) {
      throw new Error(`sendStateSignal could not load thread ${threadId}`);
    }

    const thread = {
      ...loadedThread,
      id: threadId,
      resourceId: loadedThread.resourceId ?? resourceId,
      createdAt: loadedThread.createdAt ?? new Date(),
      updatedAt: loadedThread.updatedAt ?? new Date(),
      metadata: loadedThread.metadata,
    };

    const applied = await applyStateSignal({
      input: stateInput,
      memory,
      thread,
      resourceId,
      threadId,
      memoryConfig: memoryContext?.memoryConfig,
      acceptedAt: new Date(),
    });

    if (applied.skipped) {
      return { skipped: true, reason: 'unchanged' };
    }

    return this.sendSignal<OUTPUT>(agent, applied.signal, target, pubsub);
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
  ): SendAgentSignalResult<OUTPUT> {
    const state = this.#getState(pubsub);
    let signal = createSignal({ ...signalInput, acceptedAt: new Date() });
    let key: string | undefined;
    let runId = target.runId;
    const activeBehavior = target.ifActive?.behavior ?? 'deliver';
    const idleBehavior = target.ifIdle?.behavior ?? 'wake';

    let activeRecord: AgentThreadRunRecord<any> | undefined;
    if (target.resourceId && target.threadId) {
      key = this.#threadKey(target.resourceId, target.threadId);
      const activeRunId = state.activeThreadRunIds.get(key);
      activeRecord = activeRunId ? state.threadRunsById.get(activeRunId) : undefined;
      if (activeRecord && !this.#isThreadBlockingRun(state, activeRecord)) {
        state.activeThreadRunIds.delete(key);
        activeRecord = undefined;
      }

      // Prefer the active same-agent run for thread-targeted signals. This is the normal
      // follow-up path used by clients that know the thread/resource but not the run id.
      if (activeRecord && activeRecord.agent.id === agent.id) {
        runId = activeRecord.runId;
      } else if (activeRunId && !activeRecord) {
        if (state.threadKeysByRunId.get(activeRunId) === key) {
          // A run can be reserved before its stream record is registered. Keep the reserved
          // id so early follow-ups still attach to the run that is starting.
          runId = activeRunId;
        } else {
          // Stale cross-pod entry. Clean it up from the local map, then let the lease decide
          state.activeThreadRunIds.delete(key);
          state.activeThreadStreamIds.delete(key);
        }
      }
    }

    const isActiveTarget = Boolean(
      runId && (activeRecord?.output.status === 'running' || (key && state.activeThreadRunIds.get(key) === runId)),
    );
    const resourceId = target.resourceId ?? activeRecord?.resourceId;
    const threadId = target.threadId ?? activeRecord?.threadId;

    // Resolve conditional delivery attributes now that we know the delivery path.
    signal = resolveDeliveryAttributes(
      signal,
      isActiveTarget ? target.ifActive?.attributes : target.ifIdle?.attributes,
    );

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
        return {
          signal,
          persisted,
          accepted: Promise.resolve({ action: 'persist' as const }),
        };
      }
      return {
        signal,
        accepted: Promise.resolve({ action: 'discard' as const }),
      };
    }

    if (runId) {
      activeRecord ??= state.threadRunsById.get(runId);
      // A run is "blocking" while it is running or suspended awaiting tool approval. Both
      // states mean the run has already made model requests, so a follow-up signal must be
      // queued as a pending (next-turn) signal rather than folded into a not-yet-started
      // first request via the pre-run path below.
      if (activeRecord && this.#isThreadBlockingRun(state, activeRecord)) {
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
            sourceId: this.#getSourceId(),
          });
          this.#watchThreadRunCompletion(state, pubsub, key, activeRecord);
          return {
            signal,
            accepted: Promise.resolve({ action: 'deliver' as const, runId }),
          };
        }

        return {
          signal,
          accepted: Promise.resolve({
            action: 'blocked' as const,
            reason: 'thread-blocked' as const,
            runId: activeRecord.runId,
          }),
        };
      }

      if (key && state.activeThreadRunIds.get(key) === runId) {
        // A local reserved run has not registered its stream record yet, so it
        // has not made its first model request — queue the signal as a pre-run
        // signal so the first LLM step folds it into that request. A run owned
        // by another runtime instance is reached only via PubSub; treat it as a
        // follow-up, since the sender cannot see the owner's request state.
        const isLocalReservedRun = state.threadKeysByRunId.get(runId) === key;
        if (isLocalReservedRun) {
          const queue = state.preRunSignalsByThread.get(key) ?? [];
          queue.push(signal);
          state.preRunSignalsByThread.set(key, queue);
        }
        this.#publish(pubsub, key, {
          type: 'signal-enqueued',
          runId,
          signal: this.#serializeSignal(signal),
          sourceId: this.#getSourceId(),
          preRun: isLocalReservedRun,
        });
        return {
          signal,
          accepted: Promise.resolve({ action: 'deliver' as const, runId }),
        };
      }
    }

    if (!resourceId || !threadId) {
      throw new Error('No active agent run found for signal target');
    }

    runId = randomUUID();
    key ??= this.#threadKey(resourceId, threadId);
    if (idleBehavior === 'persist') {
      const persisted = this.#persistAndBroadcastIdleSignal(
        state,
        pubsub,
        key,
        runId,
        agent,
        signal,
        resourceId,
        threadId,
        target.ifIdle?.streamOptions?.requestContext,
      );
      void persisted.catch(() => {});
      return {
        signal,
        persisted,
        accepted: Promise.resolve({ action: 'persist' as const }),
      };
    }
    if (idleBehavior !== 'wake') {
      return {
        signal,
        accepted: Promise.resolve({ action: 'discard' as const }),
      };
    }

    if (state.activeThreadRunIds.has(key)) {
      const blockingRunId = state.activeThreadRunIds.get(key)!;
      const blockingRecord = activeRecord ?? state.threadRunsById.get(blockingRunId);
      if (
        this.#isSuspendedRun(state, blockingRunId) ||
        blockingRecord?.output.status === 'suspended' ||
        blockingRecord?.lifecycle === 'suspended'
      ) {
        return {
          signal,
          accepted: Promise.resolve({
            action: 'blocked' as const,
            reason: 'thread-blocked' as const,
            runId: blockingRunId,
          }),
        };
      }

      // Another run owns the thread. Queue this idle-start request and let the watcher
      // launch it only after the active run clears the thread reservation.
      const idleQueue = state.pendingIdleSignalsByThread.get(key) ?? [];
      idleQueue.push({ agent, signal, runId, resourceId, threadId, streamOptions: target.ifIdle?.streamOptions });
      state.pendingIdleSignalsByThread.set(key, idleQueue);
      if (activeRecord) {
        this.#watchThreadRunCompletion(state, pubsub, key, activeRecord);
      }
      return {
        signal,
        accepted: Promise.resolve({ action: 'deliver' as const, runId }),
      };
    }

    // No active same-agent run accepted the signal. Reserve the thread before starting
    // the idle stream so concurrent callers do not launch duplicate runs.
    state.activeThreadRunIds.set(key, runId);
    state.threadKeysByRunId.set(runId, key);
    const reservedKey = key;
    const reservedRunId = runId;
    const resolvedPubSub = this.#getPubSub(pubsub);
    const leaseProvider = this.#getLeaseProvider(resolvedPubSub);
    // First acquire the cross-process lease via pubsub; on win, kick off the stream and
    // resolve a `wake` accepted result carrying the owned stream. On loss, hand the user
    // signal off to the winning process via signal-enqueued and resolve a `deliver` result
    // (the signal was queued onto the winning run, not run locally).
    const accepted: Promise<SendAgentSignalAccepted<OUTPUT>> = (async () => {
      // Fail-open on pubsub errors: if the lease backend is unreachable we treat the
      // call as "acquired" so the caller still gets a response. The tradeoff is that
      // if multiple processes hit the same pubsub failure simultaneously they can each
      // start a stream for the same thread (the bug this lease is supposed to prevent),
      // but failing closed would silently drop user messages on any Redis blip which
      // is the worse failure mode. Lease TTL + renewal still bound the duplicate
      // window to a single run, and the next clean acquireLease re-serializes callers.
      const lease = await leaseProvider
        .acquireLease(reservedKey, reservedRunId, AGENT_THREAD_LEASE_TTL_MS)
        .catch(() => ({ acquired: true as boolean, owner: reservedRunId as string | undefined }));

      if (!lease.acquired) {
        // Lost the wake race to another process. Roll back our optimistic local reservation
        // so we don't trip our own activeThreadRunIds check on a follow-up.
        if (state.activeThreadRunIds.get(reservedKey) === reservedRunId) {
          state.activeThreadRunIds.delete(reservedKey);
        }
        state.threadKeysByRunId.delete(reservedRunId);

        // Forward the user signal to the winning runId so the message is not dropped.
        // Await the publish so that callers using `accepted` resolution as their
        // "safe to exit" boundary (e.g. a serverless Lambda holding the request open
        // via waitUntil) don't tear down before the enqueue lands on the broker.
        const winnerRunId = lease.owner;
        if (winnerRunId) {
          await this.#publishAndWait(pubsub, reservedKey, {
            type: 'signal-enqueued',
            runId: winnerRunId,
            signal: this.#serializeSignal(signal),
            sourceId: this.#getSourceId(),
          }).catch(() => {});
        }
        return { action: 'deliver' as const, runId: winnerRunId ?? reservedRunId };
      }

      // We own the lease. Start the renewal timer so it survives runs
      // that outlive the TTL, then kick off the stream.
      this.#startLeaseRenewal(resolvedPubSub, reservedKey, reservedRunId);
      try {
        const output = await agent.stream(signal, {
          ...(target.ifIdle?.streamOptions as any),
          untilIdle: true,
          runId: reservedRunId,
          memory: withThreadMemory(target.ifIdle?.streamOptions?.memory, resourceId, threadId),
        });
        return { action: 'wake' as const, runId: reservedRunId, output };
      } catch (error) {
        state.threadKeysByRunId.delete(reservedRunId);
        this.#cleanupPreparedRun(state, reservedRunId);
        if (state.activeThreadRunIds.get(reservedKey) === reservedRunId) {
          state.activeThreadRunIds.delete(reservedKey);
        }
        this.#releaseThreadLease(pubsub, reservedKey, reservedRunId);
        this.#publish(pubsub, reservedKey, {
          type: 'run-failed',
          runId: reservedRunId,
          error: getErrorFromUnknown(error).message,
        });
        void this.#drainPendingIdleSignals(state, pubsub, reservedKey);
        throw error;
      }
    })();
    // Attach a detached no-op catch so that if stream setup throws (a misconfigured
    // agent: no/unsupported model, FGA denial) and the caller never awaits
    // `result.accepted`, the rejection does not surface as an unhandled rejection.
    // Callers that opt in to `accepted` still see the rejection via their own
    // await/catch — `accepted` itself remains rejectable; only this detached branch is
    // swallowed.
    void accepted.catch(() => {});

    return {
      signal,
      accepted,
    };
  }
}

export const agentThreadStreamRuntime = new AgentThreadStreamRuntime();
