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
import { readPositiveIntEnv } from '../utils';
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
 * Lease TTL for the cross-process thread lease acquired in the idle-wake
 * path. Kept short so a crashed owner process frees the thread quickly; a
 * background timer renews it while the run is still running. Overridable via
 * `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (production keeps the 15s default).
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
/**
 * TTL for a suspended run's warm in-memory state — the parked thread-run record
 * (swept by #sweepStaleSuspendedRecords). The Mastra internal-workflow registry
 * reads the same `MASTRA_SUSPENDED_RUN_TTL_MS` so both expire on one bound. A
 * suspended run is kept warm so a same-instance resume can reattach and the thread
 * stays blocked; once it lapses the state is evicted and resume falls back to the
 * durable snapshot. Multi-instance deployments (resume rarely lands on the origin)
 * can shed it sooner; 30 minute default.
 */
const AGENT_SUSPENDED_RUN_TTL_MS = readPositiveIntEnv('MASTRA_SUSPENDED_RUN_TTL_MS', 30 * 60 * 1000);

export const AGENT_THREAD_LEASE_CONFLICT_CODE = 'AGENT_THREAD_LEASE_CONFLICT';

export class AgentThreadLeaseConflictError extends Error {
  readonly code = AGENT_THREAD_LEASE_CONFLICT_CODE;

  constructor(runId: string, owner: string) {
    super(`Cannot register run ${runId}: thread lease is held by ${owner}`);
    this.name = 'AgentThreadLeaseConflictError';
  }
}

export let defaultAgentThreadPubSub: PubSub = new EventEmitterPubSub();

/**
 * Strip raw model-request bookkeeping from a chunk before it is broadcast to
 * the thread-stream topic (and retained for subscriber replay). `step-start`
 * embeds the full serialized provider request (including any base64 media in
 * context), and `step-finish`/`finish` repeat it via `metadata.request`,
 * `output.steps[]` (each step re-embeds its cumulative request/response) and
 * `messages`. No thread subscriber needs those — they are available to the
 * local caller via `output.request`/`output.steps` — and broadcasting them
 * multiplies the largest object in the system ≥5× per step, persists it in
 * durable pubsub backends, and exposes prompt contents to every subscriber.
 * Only the broadcast copy is rewritten; the caller's MastraModelOutput is
 * untouched.
 */
function sanitizeBroadcastPart(part: unknown): unknown {
  if (!part || typeof part !== 'object' || !('type' in part)) return part;
  const typed = part as { type?: string; payload?: Record<string, unknown> };
  const payload = typed.payload;
  if (!payload || typeof payload !== 'object') return part;

  if (typed.type === 'step-start') {
    if (!('request' in payload) && !('inputMessages' in payload)) return part;
    const { request: _request, inputMessages: _inputMessages, ...rest } = payload;
    return { ...typed, payload: rest };
  }

  if (typed.type === 'step-finish' || typed.type === 'finish') {
    let changed = false;
    const next: Record<string, unknown> = { ...payload };
    const metadata = payload.metadata;
    if (metadata && typeof metadata === 'object' && 'request' in metadata) {
      const { request: _request, ...restMetadata } = metadata as Record<string, unknown>;
      next.metadata = restMetadata;
      changed = true;
    }
    const output = payload.output;
    if (output && typeof output === 'object' && 'steps' in output) {
      const { steps: _steps, ...restOutput } = output as Record<string, unknown>;
      next.output = restOutput;
      changed = true;
    }
    if ('messages' in payload) {
      delete next.messages;
      changed = true;
    }
    return changed ? { ...typed, payload: next } : part;
  }

  return part;
}

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
  suspensions?: Map<string | undefined, AgentThreadRunSuspension>;
  /** When the record was parked as suspended (ms epoch); drives the TTL sweep. */
  suspendedAt?: number;
  threadId: string;
  resourceId?: string;
  streamOptions: AgentExecutionOptions<OUTPUT>;
  createSubscriberStream?: () => ReadableStream<unknown>;
  /** Settles once every stream-part broadcast publish for this run completed. */
  broadcastFinished?: Promise<void>;
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
  remoteThreadKeysByRunId: Map<string, string>;
  activeThreadRunIds: Map<string, string>;
  activeThreadStreamIds: Map<string, string>;
  streamSeqByRunId: Map<string, number>;
  approvalSuspendedRunIds: Set<string>;
  suspendedRunIds: Set<string>;
  suspensionMetadataByRunId: Map<string, Map<string | undefined, AgentThreadRunSuspension>>;
  pendingSignalsByThread: Map<string, CreatedAgentSignal[]>;
  // Signals queued for a run that is starting but has not made its first model
  // request yet. The first LLM step drains these and folds them into that
  // request; `pendingSignalsByThread` follow-ups instead become their own turn.
  preRunSignalsByThread: Map<string, CreatedAgentSignal[]>;
  pendingIdleSignalsByThread: Map<string, PendingIdleSignal<any>[]>;
  pendingContinuationsByThread: Map<string, PendingContinuation<any>[]>;
  watchedThreadStreamIds: Set<string>;
  preparedRunsById: Map<string, PreparedThreadRun>;
  resumeTailsByRunId: Map<string, Promise<void>>;
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

export type ActiveThreadRun = { runId: string; resourceId?: string; threadId: string };

export type AgentThreadStrictRegistrationOptions = {
  strict: true;
  /**
   * Revalidates ownership held outside this runtime (for example, a durable
   * recovery lease). A validation failure rolls back local registration but
   * deliberately leaves the same-run thread lease intact for the new owner.
   */
  validate?: () => void | Promise<void>;
};

export type AgentThreadRunRegistration = {
  /**
   * Remove this exact registration. Callers that lost an external ownership
   * claim can preserve the same-run thread lease for its successor.
   */
  rollback(options?: { releaseLease?: boolean }): Promise<void>;
};

type SerializableAgentSignal = AgentSignal & Pick<CreatedAgentSignal, 'id' | 'createdAt'>;

type AgentThreadStreamRuntimeEvent =
  | { type: 'run-registered'; runId: string; streamId: string; streamSeq: number; sourceId?: string }
  | { type: 'stream-part'; runId: string; streamId: string; part: unknown; sourceId: string }
  | { type: 'run-completed'; runId: string; streamId?: string; persisted?: boolean }
  | { type: 'run-suspended'; runId: string; streamId?: string }
  | { type: 'run-discarded'; runId: string; streamId: string }
  | { type: 'run-abort-requested'; runId: string; streamId: string }
  | { type: 'run-aborted'; runId: string; streamId?: string }
  | { type: 'run-failed'; runId: string; streamId?: string; error: string }
  | { type: 'signal-enqueued'; runId: string; signal: SerializableAgentSignal; sourceId: string; preRun?: boolean };

function createRuntimeState(): AgentThreadRuntimeState {
  return {
    threadRunsById: new Map(),
    threadRunsByStreamId: new Map(),
    threadKeysByRunId: new Map(),
    remoteThreadKeysByRunId: new Map(),
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
    resumeTailsByRunId: new Map(),
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

  #resolveLeaseProvider(pubsub?: PubSub): { provider: LeaseProvider; isFallback: boolean } {
    const provider = this.#getLeaseProvider(pubsub);
    return { provider, isFallback: provider === NoopLeaseProvider };
  }

  async #hasLiveThreadLease(pubsub: PubSub, key: string, runId: string): Promise<boolean> {
    const { provider, isFallback } = this.#resolveLeaseProvider(pubsub);
    if (isFallback) return true;
    return provider
      .getLeaseOwner(key)
      .then(owner => owner === runId)
      .catch(() => false);
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

  #parseThreadKey(key: string): { resourceId?: string; threadId: string } {
    const separator = key.indexOf(AGENT_THREAD_KEY_SEPARATOR);
    const resourceId = key.slice(0, separator);
    return { resourceId: resourceId || undefined, threadId: key.slice(separator + AGENT_THREAD_KEY_SEPARATOR.length) };
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
      !!record.suspensions?.size ||
      this.#isSuspendedRun(state, record.runId)
    );
  }

  #isActivelyRunning(state: AgentThreadRuntimeState, record: AgentThreadRunRecord<any>) {
    return (
      record.output.status === 'running' &&
      record.lifecycle !== 'suspending' &&
      record.lifecycle !== 'suspended' &&
      !record.suspensions?.size &&
      !this.#isSuspendedRun(state, record.runId)
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
    const suspensions = state.suspensionMetadataByRunId.get(runId) ?? new Map();
    suspensions.set(suspension.toolCallId, suspension);
    state.suspensionMetadataByRunId.set(runId, suspensions);
    const record = state.threadRunsByStreamId.get(streamId) ?? state.threadRunsById.get(runId);
    if (record) {
      record.lifecycle = 'suspending';
      record.suspensions = suspensions;
    }
    if (suspension.kind === 'approval') {
      state.approvalSuspendedRunIds.add(runId);
    }
  }

  #clearSuspendedRun(state: AgentThreadRuntimeState, runId: string) {
    state.suspendedRunIds.delete(runId);
    state.suspensionMetadataByRunId.delete(runId);
    state.approvalSuspendedRunIds.delete(runId);
    const record = state.threadRunsById.get(runId);
    if (record) {
      record.suspensions = undefined;
    }
  }

  #clearSuspendedToolCall(state: AgentThreadRuntimeState, runId: string, toolCallId: string) {
    const suspensions = state.suspensionMetadataByRunId.get(runId);
    suspensions?.delete(toolCallId);

    if (suspensions?.size) {
      if (![...suspensions.values()].some(suspension => suspension.kind === 'approval')) {
        state.approvalSuspendedRunIds.delete(runId);
      }
      return;
    }

    this.#clearSuspendedRun(state, runId);
  }

  #generateSignalMessageId(
    agent: Agent<any, any, any, any>,
    target: { threadId?: string; resourceId?: string },
  ): string {
    return (
      agent.getMastraInstance?.()?.generateId({
        idType: 'message',
        source: 'agent',
        entityId: agent.id,
        threadId: target.threadId,
        resourceId: target.resourceId,
      }) ?? randomUUID()
    );
  }

  #createMessageSignalInput(message: AgentMessageInput): AgentSignal {
    const normalizedMessage = typeof message === 'string' || Array.isArray(message) ? { contents: message } : message;
    return {
      ...normalizedMessage,
      type: 'user',
      tagName: 'user',
    };
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
    let cancelled = false;
    let error: unknown;
    let cancelSource: (() => Promise<void>) | undefined;
    // Resolves once the broadcast pump has drained the source stream AND every
    // stream-part publish has completed. Terminal events (`run-completed` /
    // `run-suspended`) must wait on this: publishing the terminal event while
    // part publishes are still in flight lets it overtake them on the wire,
    // and a subscriber that deferred the run would flush an empty buffer and
    // then drop the late-arriving parts.
    let resolveBroadcastFinished!: () => void;
    const broadcastFinished = new Promise<void>(resolve => {
      resolveBroadcastFinished = resolve;
    });

    const wake = () => {
      const pending = [...waiters];
      waiters.clear();
      for (const waiter of pending) waiter();
    };

    const emitPart = async (rawPart: unknown) => {
      if (rawPart && typeof rawPart === 'object' && 'type' in rawPart) {
        const typedPart = rawPart as { type?: string; payload?: { toolCallId?: string; toolName?: string } };
        if (typedPart.type === 'tool-call-approval' || typedPart.type === 'tool-call-suspended') {
          runtime.#markRunSuspending(runtime.#getState(pubsub), output.runId, streamId, {
            toolCallId: typedPart.payload?.toolCallId,
            toolName: typedPart.payload?.toolName,
            kind: typedPart.type === 'tool-call-approval' ? 'approval' : 'generic-tool',
          });
        }
      }
      const part = sanitizeBroadcastPart(rawPart);
      parts.push(part);
      await runtime.#publishAndWait(pubsub, key, {
        type: 'stream-part',
        runId: output.runId,
        streamId,
        part,
        sourceId: runtime.#getSourceId(),
      });
      wake();
      // An error chunk settles `_waitUntilFinished()` without closing
      // `fullStream` (durable error-recovery keeps consuming), so the pump can
      // stay blocked on `read()` forever. The error chunk is the last part
      // this run broadcasts, and it has now been published — settle
      // `broadcastFinished` here so the terminal publish gate (and the lease
      // release/drain behind it) is never stranded on the error path.
      if ((part as { type?: string } | null | undefined)?.type === 'error') {
        resolveBroadcastFinished();
      }
    };

    const start = () => {
      if (started) return;
      started = true;
      void (async () => {
        try {
          if (cancelled) return;
          const source = output.fullStream as ReadableStream<unknown> | undefined;
          if (!source) return;

          if (typeof source.getReader === 'function') {
            const reader = source.getReader();
            cancelSource = async () => {
              await reader.cancel().catch(() => {});
            };
            try {
              while (!cancelled) {
                const { value: part, done: streamDone } = await reader.read();
                if (streamDone) break;
                await emitPart(part);
              }
            } finally {
              reader.releaseLock();
            }
          } else {
            const iterable = source as AsyncIterable<unknown> | Iterable<unknown>;
            const iterator =
              Symbol.asyncIterator in Object(iterable)
                ? (iterable as AsyncIterable<unknown>)[Symbol.asyncIterator]()
                : (iterable as Iterable<unknown>)[Symbol.iterator]();
            let iteratorClosed = false;
            const closeIterator = async () => {
              if (iteratorClosed) return;
              iteratorClosed = true;
              await iterator.return?.();
            };
            cancelSource = async () => {
              await closeIterator().catch(() => {});
            };
            try {
              while (!cancelled) {
                const { value: part, done: streamDone } = await iterator.next();
                if (streamDone) {
                  iteratorClosed = true;
                  break;
                }
                await emitPart(part);
              }
            } finally {
              if (!iteratorClosed) await closeIterator();
            }
          }
        } catch (caught) {
          error = caught;
        } finally {
          done = true;
          resolveBroadcastFinished();
          wake();
        }
      })();
    };

    const cancel = async () => {
      if (cancelled) return;
      cancelled = true;
      if (!started) {
        done = true;
        resolveBroadcastFinished();
        wake();
        return;
      }
      await cancelSource?.();
      // The pump can already be awaiting an in-flight publish. Do not let the
      // rollback return until that work has drained and no later part can land.
      await broadcastFinished;
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

    return {
      output,
      createSubscriberStream: createStream,
      startBroadcast: start,
      cancelBroadcast: cancel,
      broadcastFinished,
    };
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

  isRunAborted(runId: string, pubsub?: PubSub): boolean {
    return this.#getState(pubsub).abortedRunIds.has(runId);
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
      const streamId = state.activeThreadRunIds.get(key) === runId ? state.activeThreadStreamIds.get(key) : undefined;
      this.#releaseThreadLease(pubsub, key, runId);
      this.#publish(pubsub, key, { type: 'run-aborted', runId, streamId });
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

  /** Same predicate as {@link getActiveThreadRunId}, over every tracked thread. */
  listActiveThreadRuns(pubsub?: PubSub): ActiveThreadRun[] {
    const state = this.#getState(pubsub);
    const runs: ActiveThreadRun[] = [];
    for (const [key, runId] of state.activeThreadRunIds) {
      const record = state.threadRunsById.get(runId);
      if (record && !this.#isThreadBlockingRun(state, record)) continue;
      runs.push({ runId, ...this.#parseThreadKey(key) });
    }
    return runs;
  }

  hasThreadRun(runId: string, pubsub?: PubSub): boolean {
    return this.#getState(pubsub).threadRunsById.has(runId);
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

    const suspensions = state.suspensionMetadataByRunId.get(options.runId);
    const suspension = options.toolCallId ? suspensions?.get(options.toolCallId) : suspensions?.values().next().value;
    if (options.toolCallId && !suspension) {
      return undefined;
    }

    return { runId: options.runId, toolCallId: options.toolCallId ?? suspension?.toolCallId };
  }

  /**
   * Starts resumes for the same parent run one at a time. A resume mutates the
   * parent's persisted workflow snapshot, so overlapping resumes can each load
   * the same stale snapshot and lose a sibling tool result. Callers still
   * resolve as soon as their resumed stream starts; only the next queued resume
   * waits for the current stream to suspend or finish.
   */
  async queueStreamResume<OUTPUT>(
    runId: string,
    resume: () => Promise<MastraModelOutput<OUTPUT>>,
    pubsub?: PubSub,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const state = this.#getState(pubsub);
    const previousTail = state.resumeTailsByRunId.get(runId) ?? Promise.resolve();
    let resolveStarted!: (output: MastraModelOutput<OUTPUT>) => void;
    let rejectStarted!: (error: unknown) => void;
    const started = new Promise<MastraModelOutput<OUTPUT>>((resolve, reject) => {
      resolveStarted = resolve;
      rejectStarted = reject;
    });

    const resumeTail = previousTail
      .catch(() => {})
      .then(async () => {
        try {
          const output = await resume();
          resolveStarted(output);
          await output._waitUntilFinished();
        } catch (error) {
          rejectStarted(error);
          throw error;
        }
      });
    const settledTail = resumeTail
      .catch(() => {})
      .finally(() => {
        if (state.resumeTailsByRunId.get(runId) === settledTail) {
          state.resumeTailsByRunId.delete(runId);
        }
      });
    state.resumeTailsByRunId.set(runId, settledTail);

    return started;
  }

  abortThread(options: AgentSubscribeToThreadOptions, pubsub?: PubSub): boolean {
    const resolvedPubSub = this.#getPubSub(pubsub);
    const state = this.#getState(resolvedPubSub);
    const key = this.#threadKey(options.resourceId, options.threadId);
    const runId = this.getActiveThreadRunId(options, resolvedPubSub);
    if (!runId) return false;
    if (state.preparedRunsById.has(runId)) return this.abortRun(runId, resolvedPubSub);
    if (state.threadKeysByRunId.get(runId) === key) {
      // Reserved locally (a sendSignal wake that has not prepared its run yet):
      // record the abort intent in abortedRunIds so prepareRunOptions aborts the
      // run the moment it starts, instead of letting it run to completion.
      this.abortRun(runId, resolvedPubSub);
      return true;
    }
    if (state.remoteThreadKeysByRunId.get(runId) !== key) return false;
    const streamId = state.activeThreadStreamIds.get(key);
    if (!streamId) return false;
    this.#publish(resolvedPubSub, key, { type: 'run-abort-requested', runId, streamId });
    return true;
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
    state.remoteThreadKeysByRunId.clear();
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
    state.resumeTailsByRunId.clear();
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
          output: {
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
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
      broadcastFinished,
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
    const registered = this.#publishAndWait(pubsub, key, {
      type: 'run-registered',
      runId,
      streamId,
      streamSeq,
      sourceId: this.#getSourceId(),
    });
    void registered.then(startBroadcast, startBroadcast);
    // Wait for the local stream to finish AND for every stream-part publish to
    // land before publishing `run-completed`: the terminal event must not
    // overtake the parts on the wire, or a deferred subscriber flushes an
    // empty buffer and drops the late parts.
    void Promise.allSettled([outputForSubscribers._waitUntilFinished(), broadcastFinished]).then(() => {
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
        // The signal this run rebroadcasts is persisted by definition.
        this.#publish(pubsub, key, { type: 'run-completed', runId, streamId, persisted: true });
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
    if (signal.transient) return;

    await this.#persistSignal(agent, signal, resourceId, threadId, requestContext);
    this.#broadcastPersistedSignal(state, pubsub, key, runId, signal, resourceId, threadId);
  }

  /**
   * Evict SUSPENDED records parked longer than {@link AGENT_SUSPENDED_RUN_TTL_MS}.
   * Called lazily on each registration so cleanup is proportional to activity and
   * zero-cost when idle — mirrors the internal-workflow registry sweep. Bounds the
   * records left behind by abandoned suspends and by resumes that land on a
   * different instance (which never clean the origin instance's record).
   *
   * An expiring record only proves that this runtime no longer owns warm state.
   * Another instance may have resumed the same runId and taken over its lease, so
   * cleanup must remain local: stop this runtime's renewal timer and let an
   * abandoned lease expire naturally instead of releasing or broadcasting a
   * terminal event that could disrupt the resumed run.
   */
  #sweepStaleSuspendedRecords(state: AgentThreadRuntimeState, pubsub: PubSub | undefined) {
    const now = Date.now();
    for (const [streamId, record] of state.threadRunsByStreamId) {
      if (record.lifecycle !== 'suspended' || record.suspendedAt === undefined) continue;
      if (now - record.suspendedAt <= AGENT_SUSPENDED_RUN_TTL_MS) continue;
      state.threadRunsByStreamId.delete(streamId);
      state.watchedThreadStreamIds.delete(streamId);
      // A same-instance resume re-registers the run under a newer streamId, so a
      // record that is no longer the run's current record is just the superseded
      // older stream: dropping its stream entry above is enough. Only the current
      // record (an abandoned suspend) gets the full run-level teardown below.
      if (state.threadRunsById.get(record.runId) !== record) continue;
      const staleKey = this.#threadKey(record.resourceId, record.threadId);
      state.threadRunsById.delete(record.runId);
      state.threadKeysByRunId.delete(record.runId);
      this.#clearSuspendedRun(state, record.runId);
      this.#stopLeaseRenewal(this.#getPubSub(pubsub), record.runId);
      if (
        state.activeThreadRunIds.get(staleKey) === record.runId &&
        state.activeThreadStreamIds.get(staleKey) === streamId
      ) {
        state.activeThreadRunIds.delete(staleKey);
        state.activeThreadStreamIds.delete(staleKey);
      }
    }
  }

  registerRun<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
    pubsub: PubSub | undefined,
    registrationOptions: AgentThreadStrictRegistrationOptions,
  ): Promise<AgentThreadRunRegistration> | undefined;
  registerRun<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
    pubsub?: PubSub,
  ): Promise<void> | undefined;
  registerRun<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
    pubsub?: PubSub,
    registrationOptions?: AgentThreadStrictRegistrationOptions,
  ): Promise<void | AgentThreadRunRegistration> | undefined {
    const { threadId, resourceId } = this.#getThreadTarget(streamOptions);
    if (!threadId) return;

    if (registrationOptions?.strict) {
      return this.#registerRunStrict(agent, output, streamOptions, pubsub, threadId, resourceId, registrationOptions);
    }

    const state = this.#getState(pubsub);
    this.#sweepStaleSuspendedRecords(state, pubsub);
    const key = this.#threadKey(resourceId, threadId);
    const { streamId, streamSeq } = this.#nextStreamIdentity(state, output.runId);
    const {
      output: outputForSubscribers,
      createSubscriberStream,
      startBroadcast,
      broadcastFinished,
    } = this.#withBroadcastStream(output, pubsub, key, streamId);
    const resumedToolCallId = (streamOptions as AgentExecutionOptions<OUTPUT> & { toolCallId?: string }).toolCallId;
    if (resumedToolCallId) {
      this.#clearSuspendedToolCall(state, output.runId, resumedToolCallId);
    } else {
      this.#clearSuspendedRun(state, output.runId);
    }

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
      suspensions: state.suspensionMetadataByRunId.get(output.runId),
      broadcastFinished,
    };

    state.threadRunsById.set(output.runId, record);
    state.threadRunsByStreamId.set(streamId, record);
    state.threadKeysByRunId.set(output.runId, key);
    state.activeThreadRunIds.set(key, output.runId);
    state.activeThreadStreamIds.set(key, streamId);
    const resolvedPubSub = this.#getPubSub(pubsub);
    const registered = (async () => {
      // Every thread-bound run must hold the cross-process lease while it is
      // live: the liveness checks (markActiveIfLive / #waitForRemoteRunToFinish)
      // treat a lease-less run as a ghost, so a plain `agent.stream()` run that
      // never acquired would let contending instances start competing runs
      // instead of serializing behind it. Acquire BEFORE publishing
      // `run-registered` so an observer that checks liveness on receipt finds
      // the lease held. Same-owner acquire is an idempotent TTL refresh, so
      // signal-woken runs that already hold the lease under this runId just
      // renew. Fail-open on loss or error (simultaneous-start race): proceed
      // and never roll back the local registration — matches pre-lease
      // semantics and sendSignal's documented fail-open rationale. A thrown
      // acquire (transient provider error) is treated as acquired so renewal
      // starts: if the acquire landed server-side but the response failed,
      // skipping renewal would let the lease expire mid-run; renewal
      // self-stops when we don't own the key.
      const lease = await this.#getLeaseProvider(resolvedPubSub)
        .acquireLease(key, output.runId, AGENT_THREAD_LEASE_TTL_MS)
        .catch(() => ({ acquired: true as boolean }));
      if (lease.acquired) this.#startLeaseRenewal(resolvedPubSub, key, output.runId);
      await this.#publishAndWait(pubsub, key, {
        type: 'run-registered',
        runId: output.runId,
        streamId,
        streamSeq,
        sourceId: this.#getSourceId(),
      });
    })();
    // Always drive the run's stream to completion, even when no caller consumes
    // the returned output (e.g. a fire-and-forget schedule wake). The broadcast
    // tee buffers every part, so a later/external subscriber still replays the
    // full stream; without this pump the run never reaches a terminal state and
    // its active-run record + thread lease would never release, permanently
    // wedging the thread.
    void registered.then(startBroadcast, startBroadcast);
    this.#watchThreadRunCompletion(state, pubsub, key, record, registered);
    return registered;
  }

  async #registerRunStrict<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
    pubsub: PubSub | undefined,
    threadId: string,
    resourceId: string | undefined,
    registrationOptions: AgentThreadStrictRegistrationOptions,
  ): Promise<AgentThreadRunRegistration> {
    await registrationOptions.validate?.();

    const state = this.#getState(pubsub);
    this.#sweepStaleSuspendedRecords(state, pubsub);
    const key = this.#threadKey(resourceId, threadId);
    const activeRunId = state.activeThreadRunIds.get(key);
    const activeRecord = activeRunId ? state.threadRunsById.get(activeRunId) : undefined;
    if (activeRecord && activeRecord.runId !== output.runId && this.#isThreadBlockingRun(state, activeRecord)) {
      throw new Error(`Cannot register run ${output.runId}: thread is already active with run ${activeRunId}`);
    }
    const resolvedPubSub = this.#getPubSub(pubsub);
    const leaseProvider = this.#getLeaseProvider(resolvedPubSub);
    const lease = await leaseProvider.acquireLease(key, output.runId, AGENT_THREAD_LEASE_TTL_MS);
    if (!lease.acquired) {
      throw new AgentThreadLeaseConflictError(output.runId, lease.owner ?? 'another owner');
    }

    // A failed external-ownership validation means another recovery attempt may
    // already own this same runId. Do not release its indistinguishable thread
    // lease; its TTL or the successor registration will take over renewal.
    await registrationOptions.validate?.();

    this.#startLeaseRenewal(resolvedPubSub, key, output.runId);
    const { streamId, streamSeq } = this.#nextStreamIdentity(state, output.runId);
    const {
      output: outputForSubscribers,
      createSubscriberStream,
      startBroadcast,
      cancelBroadcast,
      broadcastFinished,
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
      suspensions: state.suspensionMetadataByRunId.get(output.runId),
      broadcastFinished,
    };

    let rolledBack = false;
    let registrationPublished = false;
    let completionWatcherDisabled = false;
    const rollback = async ({ releaseLease = true }: { releaseLease?: boolean } = {}) => {
      if (rolledBack) return;
      rolledBack = true;
      completionWatcherDisabled = true;
      await cancelBroadcast();

      const ownsCurrentRecord = state.threadRunsById.get(record.runId) === record;
      if (state.threadRunsByStreamId.get(record.streamId) === record) {
        state.threadRunsByStreamId.delete(record.streamId);
      }
      state.watchedThreadStreamIds.delete(record.streamId);
      if (ownsCurrentRecord) {
        state.threadRunsById.delete(record.runId);
        if (state.threadKeysByRunId.get(record.runId) === key) {
          state.threadKeysByRunId.delete(record.runId);
        }
      }
      if (
        state.activeThreadRunIds.get(key) === record.runId &&
        state.activeThreadStreamIds.get(key) === record.streamId
      ) {
        state.activeThreadRunIds.delete(key);
        state.activeThreadStreamIds.delete(key);
      }

      // Renewal is keyed by runId, so only the current record may stop or
      // release it; an older rollback must not disturb a newer registration.
      if (ownsCurrentRecord) {
        this.#stopLeaseRenewal(resolvedPubSub, record.runId);
        if (releaseLease) {
          await leaseProvider.releaseLease(key, record.runId).catch(() => {});
        }
      }
      if (registrationPublished) await discardPublishedRegistration().catch(() => {});
    };

    const discardPublishedRegistration = async () => {
      await this.#publishAndWait(pubsub, key, {
        type: 'run-discarded',
        runId: record.runId,
        streamId: record.streamId,
      });
    };

    state.threadRunsById.set(output.runId, record);
    state.threadRunsByStreamId.set(streamId, record);
    state.threadKeysByRunId.set(output.runId, key);
    state.activeThreadRunIds.set(key, output.runId);
    state.activeThreadStreamIds.set(key, streamId);

    try {
      await this.#publishAndWait(pubsub, key, {
        type: 'run-registered',
        runId: output.runId,
        streamId,
        streamSeq,
        sourceId: this.#getSourceId(),
      });
      registrationPublished = true;
      await registrationOptions.validate?.();
    } catch (error) {
      if (!rolledBack) {
        let releaseLease = true;
        try {
          await registrationOptions.validate?.();
        } catch {
          releaseLease = false;
        }
        await rollback({ releaseLease });
        // A durable backend may accept/deliver the registration and still fail
        // its acknowledgement. `rollback` compensates every confirmed publish;
        // an ambiguous acknowledgement also gets an idempotent discard here.
        if (!registrationPublished) await discardPublishedRegistration().catch(() => {});
      }
      throw error;
    }

    const resumedToolCallId = (streamOptions as AgentExecutionOptions<OUTPUT> & { toolCallId?: string }).toolCallId;
    if (resumedToolCallId) {
      this.#clearSuspendedToolCall(state, output.runId, resumedToolCallId);
    } else {
      this.#clearSuspendedRun(state, output.runId);
    }
    this.#watchThreadRunCompletion(state, pubsub, key, record, undefined, () => completionWatcherDisabled);
    startBroadcast();
    return { rollback };
  }

  #watchThreadRunCompletion(
    state: AgentThreadRuntimeState,
    pubsub: PubSub | undefined,
    key: string,
    record: AgentThreadRunRecord<any>,
    registered?: Promise<unknown>,
    isDisabled?: () => boolean,
  ) {
    if (state.watchedThreadStreamIds.has(record.streamId)) return;
    state.watchedThreadStreamIds.add(record.streamId);

    // Wait for BOTH the run to finish AND `run-registered` to be on the wire
    // before publishing the terminal event. A run that finishes faster than
    // the async lease-acquire that precedes the registration publish would
    // otherwise put `run-completed` on the wire before `run-registered`,
    // which subscribers cannot reconcile (and would release a lease that is
    // still being acquired).
    const finished = record.output._waitUntilFinished();
    void Promise.allSettled(registered ? [finished, registered] : [finished]).then(() => {
      state.watchedThreadStreamIds.delete(record.streamId);
      if (isDisabled?.()) return;
      this.#cleanupPreparedRun(state, record.runId);

      if (record.output.status === 'suspended' && this.#isSuspendedRun(state, record.runId)) {
        record.lifecycle = 'suspended';
        // Leak fix: stamp when the run parked so the lazy TTL sweep
        // (#sweepStaleSuspendedRecords) can evict it. The record stays fully intact
        // for resume routing / thread-blocking / subscriber replay exactly as before
        // — it is simply no longer retained for the life of the process. Mirrors the
        // internal-workflow registry, which already bounds parked runs this way.
        record.suspendedAt = Date.now();
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
      // Wait for every stream-part broadcast publish to land before putting the
      // terminal event on the wire: `run-completed` overtaking in-flight parts
      // makes a deferred subscriber flush an empty buffer and drop the late
      // parts. The stream has already ended here (the run is terminal, not
      // suspended), so the broadcast pump is guaranteed to settle. Local state
      // cleanup above stays immediate.
      void Promise.resolve(record.broadcastFinished).then(() => {
        if (isDisabled?.()) return;
        this.#publish(pubsub, key, {
          type: 'run-completed',
          runId: record.runId,
          streamId: record.streamId,
          // Origin-side truth for replay filtering: only a successful run flushed
          // its messages to storage, so only its retained chunks are backed by a
          // persisted message and safe to replay to fresh subscribers.
          persisted: record.output.status === 'success',
        });
        if (this.#hasPendingThreadWork(state, key)) {
          void this.#drainPendingSignals(state, pubsub, key, record);
        } else {
          this.#releaseThreadLease(pubsub, key, record.runId);
        }
      });
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
    let signal: CreatedAgentSignal | undefined;
    let nextRunId: string | undefined;
    try {
      signal = queue?.shift();
      if (signal && queue) {
        if (queue.length === 0) {
          state.pendingSignalsByThread.delete(key);
        }

        // Hand the lease from the finished run to this drained run before
        // streaming, so the lease key never goes empty during the handoff. If the
        // old owner already lost the lease (e.g. a pubsub blip let the TTL lapse
        // and another process took over), forward the signal to the new winner
        // instead of starting a competing run here.
        nextRunId = randomUUID();
        state.activeThreadRunIds.set(key, nextRunId);
        state.threadKeysByRunId.set(nextRunId, key);
        const owns = await this.#acquireOrTransferThreadLease(pubsub, key, nextRunId, previousRun.runId);
        if (!owns.acquired) {
          if (state.activeThreadRunIds.get(key) === nextRunId) {
            state.activeThreadRunIds.delete(key);
          }
          state.threadKeysByRunId.delete(nextRunId);
          // Early follow-ups were already published as retained signal-enqueued
          // events, so only discard this runtime's local pre-run copies.
          state.preRunSignalsByThread.delete(key);
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
    } catch (err) {
      // Starting the follow-up run failed (e.g. a transient connection error
      // from `agent.stream`, or the lease transfer itself threw). Mirror the
      // `#startContinuation` failure path: clean up the failed run's state,
      // restore the signal so it is not lost, surface the failure, then hand
      // the lease to remaining queued work and only release once nothing is
      // left to drain. The restored signal is deliberately NOT re-drained here
      // (that would tight-loop against a still-broken upstream); it delivers on
      // the next natural drain trigger instead.
      const failedRunId = nextRunId ?? previousRun.runId;
      if (nextRunId) {
        state.threadKeysByRunId.delete(nextRunId);
        this.#cleanupPreparedRun(state, nextRunId);
        if (state.activeThreadRunIds.get(key) === nextRunId) {
          state.activeThreadRunIds.delete(key);
        }
      }
      if (signal) {
        // Restore through the map, not the local `queue` array: the shift above
        // deletes the map entry when it empties the queue, so the local array
        // may be detached from the map by the time we get here.
        state.pendingSignalsByThread.set(key, [signal, ...(state.pendingSignalsByThread.get(key) ?? [])]);
      }
      this.#publish(pubsub, key, {
        type: 'run-failed',
        runId: failedRunId,
        error: `failed to start follow-up run for queued message: ${getErrorFromUnknown(err).message}; the message was requeued and will deliver on the next turn`,
      });
      if (previousRun.runId !== failedRunId) {
        // A synchronous throw from the lease transfer leaves the lease still
        // owned by the finished previous run with its renewal timer alive,
        // which would hold the key forever. Release it unconditionally before
        // the handoff below: the handoff helpers can report work without
        // starting a local run (e.g. the idle drain's lease-lost branch), so
        // gating this release on their outcome would leak the lease. Releasing
        // is owner-guarded, so this is a no-op when the transfer completed and
        // the failed run owned the lease.
        this.#releaseThreadLease(pubsub, key, previousRun.runId);
      }
      void this.#drainPendingContinuations(state, pubsub, key, failedRunId).then(async started => {
        if (started) return;
        if (await this.#drainPendingIdleSignals(state, pubsub, key, failedRunId)) return;
        this.#releaseThreadLease(pubsub, key, failedRunId);
      });
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
      state.threadKeysByRunId.set(pending.runId, key);
      const owns = await this.#acquireOrTransferThreadLease(pubsub, key, pending.runId, fromRunId);
      if (!owns.acquired) {
        if (state.activeThreadRunIds.get(key) === pending.runId) {
          state.activeThreadRunIds.delete(key);
        }
        state.threadKeysByRunId.delete(pending.runId);
        state.preRunSignalsByThread.delete(key);
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
      state.preRunSignalsByThread.delete(key);
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
    options: { memory?: AgentExecutionOptions<any>['memory']; requestContext?: RequestContext; runId?: string },
    pubsub?: PubSub,
  ) {
    const { threadId, resourceId } = this.#getThreadTarget(options);
    if (!threadId) return;

    // Read-only runs never persist to the thread, so they cannot corrupt
    // message ordering and must not serialize (or reserve): structured-output's
    // `useAgent` path re-enters agent.stream() on the same thread mid-run and
    // would deadlock behind its own parent run.
    const memory = options.memory;
    if (memory && typeof memory === 'object' && 'options' in memory && memory.options?.readOnly) return;

    const state = this.#getState(pubsub);
    const key = this.#threadKey(resourceId, threadId);
    while (true) {
      const activeRunId = state.activeThreadRunIds.get(key);
      if (!activeRunId) {
        // Reserve the thread for this run before returning so a concurrent
        // stream() on the same thread waits instead of racing us during the
        // window between this wait and registerRun. The reservation is
        // superseded by registerRun (same runId) or released by the caller
        // on failure.
        if (options.runId) {
          state.activeThreadRunIds.set(key, options.runId);
          state.threadKeysByRunId.set(options.runId, key);
        }
        return;
      }

      // A caller that targets the active run (resumeStream, approval continuations) is a
      // continuation of that run, not a contender — never wait on ourselves.
      if (options.runId && options.runId === activeRunId) return;

      const activeRecord = state.threadRunsById.get(activeRunId);
      if (activeRecord) {
        if (!this.#isThreadBlockingRun(state, activeRecord)) {
          return;
        }
        if (activeRecord.agent.id === agent.id && !this.#isActivelyRunning(state, activeRecord)) {
          // Same-agent record that is suspended/suspending: waiting could block indefinitely
          // on human input (resume/approval), so preserve the historical exemption.
          return;
        }
        await activeRecord.output._waitUntilFinished().catch(() => {});
        continue;
      }

      if (state.threadKeysByRunId.get(activeRunId) === key) {
        // A local run reserved the thread but has not registered yet (it is
        // between its own wait and registerRun). There is no record to await,
        // so yield briefly and re-check; the window ends when the run
        // registers or its caller releases the reservation.
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }

      await this.#waitForRemoteRunToFinish(pubsub, key, activeRunId);
    }
  }

  /**
   * Releases a thread reservation made by `waitForCrossAgentThreadRun` when the
   * run fails before reaching `registerRun`. No-op once the run has registered
   * (registration owns cleanup from then on) or if the reservation was already
   * replaced.
   */
  releaseThreadRunReservation(runId: string, pubsub?: PubSub) {
    const state = this.#getState(pubsub);
    if (state.threadRunsById.has(runId)) return;
    const key = state.threadKeysByRunId.get(runId);
    if (!key) return;
    state.threadKeysByRunId.delete(runId);
    if (state.activeThreadRunIds.get(key) === runId) {
      state.activeThreadRunIds.delete(key);
    }
  }

  async #waitForRemoteRunToFinish(pubsub: PubSub | undefined, key: string, runId: string) {
    const resolvedPubSub = this.#getPubSub(pubsub);
    const { provider, isFallback } = this.#resolveLeaseProvider(resolvedPubSub);
    const topic = this.#threadTopic(key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribed = false;
    let settled = false;
    let resolveWait!: () => void;
    const wait = new Promise<void>(resolve => {
      resolveWait = resolve;
    });
    const clearRemoteActive = (streamId?: string) => {
      const state = this.#getState(resolvedPubSub);
      if (
        state.activeThreadRunIds.get(key) !== runId ||
        (streamId && state.activeThreadStreamIds.get(key) !== streamId)
      ) {
        return;
      }
      state.activeThreadRunIds.delete(key);
      state.activeThreadStreamIds.delete(key);
      if (state.remoteThreadKeysByRunId.get(runId) === key) state.remoteThreadKeysByRunId.delete(runId);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolveWait();
    };
    const checkLease = async () => {
      if (settled) return;
      if (isFallback) return;
      const owner = await provider.getLeaseOwner(key).catch(() => undefined);
      if (settled) return;
      if (owner !== runId) {
        clearRemoteActive();
        finish();
        return;
      }
      timer = setTimeout(() => void checkLease(), AGENT_THREAD_LEASE_TTL_MS);
    };
    const onEvent: EventCallback = async (event, ack) => {
      const data = event.data as AgentThreadStreamRuntimeEvent | undefined;
      const isTerminal =
        (data?.type === 'run-completed' ||
          data?.type === 'run-aborted' ||
          data?.type === 'run-failed' ||
          data?.type === 'run-discarded') &&
        data.runId === runId;
      // Acknowledge every delivered event, not just the terminal one — this is a
      // private fan-out subscription, so anything left unacked stays pending on
      // the backend. The terminal ack completes before the waiter resolves so
      // the subsequent unsubscribe cannot race it.
      // A failing ack must never strand the waiter: the backend's ack deadline
      // will redeliver or expire the entry, but this run is still finished.
      try {
        await ack?.();
      } catch {}
      if (isTerminal) {
        clearRemoteActive(data.streamId);
        finish();
      }
    };

    try {
      await resolvedPubSub.subscribe(topic, onEvent);
      subscribed = true;
      if (!isFallback) timer = setTimeout(() => void checkLease(), AGENT_THREAD_LEASE_TTL_MS);
      await wait;
    } catch {
      finish();
      await wait;
    } finally {
      if (timer) clearTimeout(timer);
      if (subscribed) await resolvedPubSub.unsubscribe(topic, onEvent).catch(() => {});
    }
  }

  async subscribeToThread<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    options: AgentSubscribeToThreadOptions,
    pubsub?: PubSub,
  ): Promise<AgentThreadSubscription<OUTPUT>> {
    void agent;
    const resolvedPubSub = this.#getPubSub(pubsub);
    const { provider: leaseProvider, isFallback: hasFallbackLeaseProvider } =
      this.#resolveLeaseProvider(resolvedPubSub);
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
              try {
                controller.close();
              } catch {}
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

    const localStreamIds = new Set<string>();
    const replayedStreamIds = new Set<string>();
    // Replayed runs whose origin no longer holds the thread lease (the run is
    // terminal or its process died). Their parts are buffered instead of being
    // yielded live: a retained backend replays every run's chunks to a fresh
    // subscriber, but a run that failed mid-stream never persisted a message,
    // so replaying it would surface a phantom partial message that hydrated
    // history can never reconcile. The run is only released to the subscriber
    // once its terminal control event proves it finished cleanly; failed,
    // aborted, or never-terminated (process crash) runs are dropped.
    const deferredRunsByStreamId = new Map<string, AgentThreadRunRecord<any>>();
    const remoteRunLeaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let currentReader: ReadableStreamDefaultReader<any> | null = null;
    let activeReaderRunId: string | null = null;
    let activeReaderStreamId: string | null = null;
    let currentRunRequestContext: RequestContext | undefined;
    let cancelledByAbort = false;

    const markActiveIfLive = async (runId: string, streamId: string, local: boolean) => {
      if (!local && !(await this.#hasLiveThreadLease(resolvedPubSub, key, runId))) return;
      state.activeThreadRunIds.set(key, runId);
      state.activeThreadStreamIds.set(key, streamId);
      if (!local) state.remoteThreadKeysByRunId.set(runId, key);
    };

    // A deferred run may be flushed only when its replayed chunks ended with a
    // clean `finish` — the origin publishes `run-completed` after the run's
    // messages were flushed to storage, so a clean finish implies a persisted
    // message backs the replay. An in-band `error` chunk, a finish with
    // `stepResult.reason: 'error'`, or a missing finish all mean nothing was
    // persisted for the run.
    const deferredRunEndedCleanly = (parts: unknown[]) => {
      let sawFinish = false;
      for (const part of parts) {
        const typed = part as { type?: string; payload?: { stepResult?: { reason?: string } } } | undefined;
        if (typed?.type === 'error' || typed?.type === 'abort') return false;
        if (typed?.type === 'finish') {
          if (typed.payload?.stepResult?.reason === 'error') return false;
          sawFinish = true;
        }
      }
      return sawFinish;
    };

    const discardDeferredRun = (streamId: string) => {
      deferredRunsByStreamId.delete(streamId);
      const timer = remoteRunLeaseTimers.get(streamId);
      if (timer) clearTimeout(timer);
      remoteRunLeaseTimers.delete(streamId);
      const remoteRun = remoteRuns.get(streamId);
      if (!remoteRun) return;
      remoteRun.parts.length = 0;
      remoteRun.done = true;
      while (remoteRun.waiters.length) remoteRun.waiters.shift()?.();
      while (remoteRun.finishWaiters.length) remoteRun.finishWaiters.shift()?.();
      remoteRuns.delete(streamId);
    };

    const clearActiveIfCurrent = (runId: string, streamId?: string) => {
      if (
        state.activeThreadRunIds.get(key) !== runId ||
        (streamId && state.activeThreadStreamIds.get(key) !== streamId)
      ) {
        return;
      }
      state.activeThreadRunIds.delete(key);
      state.activeThreadStreamIds.delete(key);
      if (state.remoteThreadKeysByRunId.get(runId) === key) state.remoteThreadKeysByRunId.delete(runId);
    };

    const stopRemoteRunLeaseWatch = (streamId: string) => {
      const timer = remoteRunLeaseTimers.get(streamId);
      if (timer) clearTimeout(timer);
      remoteRunLeaseTimers.delete(streamId);
    };

    const startRemoteRunLeaseWatch = (runId: string, streamId: string) => {
      if (hasFallbackLeaseProvider || remoteRunLeaseTimers.has(streamId)) return;

      const checkLease = async () => {
        remoteRunLeaseTimers.delete(streamId);
        const remoteRun = remoteRuns.get(streamId);
        if (done || !remoteRun || remoteRun.done) return;

        let owner: string | undefined;
        try {
          owner = await leaseProvider.getLeaseOwner(key);
        } catch {
          if (done || remoteRuns.get(streamId) !== remoteRun || remoteRun.done) return;
          remoteRunLeaseTimers.set(
            streamId,
            setTimeout(() => void checkLease(), AGENT_THREAD_LEASE_TTL_MS),
          );
          return;
        }
        if (done || remoteRuns.get(streamId) !== remoteRun || remoteRun.done) return;
        if (owner === runId) {
          remoteRunLeaseTimers.set(
            streamId,
            setTimeout(() => void checkLease(), AGENT_THREAD_LEASE_TTL_MS),
          );
          return;
        }

        clearActiveIfCurrent(runId, streamId);
        remoteRun.parts.push({
          type: 'error',
          payload: { error: new Error(`Thread run ${runId} lost its lease before publishing a terminal event`) },
        });
        remoteRun.done = true;
        while (remoteRun.waiters.length) remoteRun.waiters.shift()?.();
        while (remoteRun.finishWaiters.length) remoteRun.finishWaiters.shift()?.();
        remoteRuns.delete(streamId);
        seenStreamIds.delete(streamId);
        await this.#drainPendingIdleSignals(state, resolvedPubSub, key, runId);
        wake();
      };

      remoteRunLeaseTimers.set(
        streamId,
        setTimeout(() => void checkLease(), AGENT_THREAD_LEASE_TTL_MS),
      );
    };

    const handleEvent = async (event: Parameters<EventCallback>[0]) => {
      if (done) return;
      const data = event.data as AgentThreadStreamRuntimeEvent | undefined;
      if (!data) return;
      if (data.type === 'run-registered') {
        const localRecord = state.threadRunsByStreamId.get(data.streamId);
        if (localRecord) {
          localStreamIds.add(data.streamId);
        } else {
          replayedStreamIds.add(data.streamId);
        }
        const local = Boolean(localRecord);
        // A registration published by this very runtime instance is always a
        // live delivery — a restarted process gets a fresh source id, so a
        // matching id can never be a stale replay of a dead run. This also
        // covers runs that complete before the event is delivered in-process
        // (record cleaned up, lease released) where deferral would strand the
        // run because its terminal event was already processed.
        const live =
          local ||
          (data.sourceId !== undefined && data.sourceId === this.#getSourceId()) ||
          (await this.#hasLiveThreadLease(resolvedPubSub, key, data.runId));
        if (live) {
          state.activeThreadRunIds.set(key, data.runId);
          state.activeThreadStreamIds.set(key, data.streamId);
          if (!local) state.remoteThreadKeysByRunId.set(data.runId, key);
        }
        // Reuse a proxy that a stream-part-first delivery already created for
        // this stream — creating a fresh record here would orphan its
        // buffered parts.
        const record =
          localRecord ??
          deferredRunsByStreamId.get(data.streamId) ??
          createRemoteRun(data.runId, data.streamId, data.streamSeq);
        if (live) {
          deferredRunsByStreamId.delete(data.streamId);
          enqueueRun(record);
        } else {
          // Replayed run from a retained backend with no live owner: buffer it
          // until its terminal event proves it completed cleanly.
          deferredRunsByStreamId.set(data.streamId, record);
        }
        wake();
        return;
      }
      if (data.type === 'stream-part') {
        if (
          data.sourceId === this.#id &&
          (localStreamIds.has(data.streamId) || !replayedStreamIds.has(data.streamId))
        ) {
          return;
        }
        if (
          state.activeThreadRunIds.get(key) !== data.runId ||
          state.activeThreadStreamIds.get(key) !== data.streamId
        ) {
          await markActiveIfLive(data.runId, data.streamId, false);
        }
        let remoteRun = remoteRuns.get(data.streamId);
        if (!remoteRun) {
          // A subscriber can attach after another runtime already broadcast run-registered.
          // Treat the first stream-part on this thread topic as proof of the remote run and
          // create the local proxy stream from that point forward.
          const record = createRemoteRun(data.runId, data.streamId, state.streamSeqByRunId.get(data.runId) ?? 1);
          if (await this.#hasLiveThreadLease(resolvedPubSub, key, data.runId)) {
            enqueueRun(record);
          } else {
            deferredRunsByStreamId.set(data.streamId, record);
          }
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
      if (data.type === 'run-abort-requested') {
        if (
          state.preparedRunsById.has(data.runId) &&
          state.threadKeysByRunId.get(data.runId) === key &&
          state.activeThreadRunIds.get(key) === data.runId &&
          state.activeThreadStreamIds.get(key) === data.streamId &&
          (await this.#hasLiveThreadLease(resolvedPubSub, key, data.runId))
        ) {
          this.abortRun(data.runId, resolvedPubSub);
        }
        return;
      }
      if (data.type === 'run-failed') {
        const eventStreamId = data.streamId ?? data.runId;
        stopRemoteRunLeaseWatch(eventStreamId);
        clearActiveIfCurrent(data.runId, data.streamId);
        if (deferredRunsByStreamId.has(eventStreamId)) {
          // Replayed failure of a run that never persisted anything — drop it.
          discardDeferredRun(eventStreamId);
          seenStreamIds.delete(eventStreamId);
          await this.#drainPendingIdleSignals(state, resolvedPubSub, key, data.runId);
          wake();
          return;
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
        await this.#drainPendingIdleSignals(state, resolvedPubSub, key, data.runId);
        wake();
        return;
      }
      if (data.type === 'run-discarded') {
        stopRemoteRunLeaseWatch(data.streamId);
        clearActiveIfCurrent(data.runId, data.streamId);
        localStreamIds.delete(data.streamId);
        replayedStreamIds.delete(data.streamId);
        for (let index = pendingRuns.length - 1; index >= 0; index--) {
          if (pendingRuns[index]?.streamId === data.streamId) pendingRuns.splice(index, 1);
        }
        discardDeferredRun(data.streamId);
        const remoteRun = remoteRuns.get(data.streamId);
        if (remoteRun) {
          remoteRun.done = true;
          while (remoteRun.waiters.length) remoteRun.waiters.shift()?.();
          while (remoteRun.finishWaiters.length) remoteRun.finishWaiters.shift()?.();
          remoteRuns.delete(data.streamId);
        }
        seenStreamIds.delete(data.streamId);
        if (activeReaderRunId === data.runId && activeReaderStreamId === data.streamId && currentReader) {
          try {
            void currentReader.cancel();
          } catch {}
        }
        wake();
        return;
      }
      if (data.type === 'run-completed' || data.type === 'run-aborted' || data.type === 'run-suspended') {
        const eventStreamId = data.streamId ?? data.runId;
        stopRemoteRunLeaseWatch(eventStreamId);
        const deferredRecord = deferredRunsByStreamId.get(eventStreamId);
        if (deferredRecord) {
          deferredRunsByStreamId.delete(eventStreamId);
          const bufferedRun = remoteRuns.get(eventStreamId);
          // Prefer the origin's explicit `persisted` verdict; fall back to the
          // clean-finish heuristic for events published by older origins.
          const flush =
            data.type === 'run-suspended' ||
            (data.type === 'run-completed' &&
              (data.persisted ?? (bufferedRun !== undefined && deferredRunEndedCleanly(bufferedRun.parts))));
          if (flush) {
            enqueueRun(deferredRecord);
          } else {
            // Unpersisted terminal run (mid-stream failure surfaces as
            // `run-completed` on the wire, aborts as `run-aborted`): no stored
            // message backs its partial content, so it must not replay.
            discardDeferredRun(eventStreamId);
          }
        }
        if (data.type === 'run-suspended') {
          state.suspendedRunIds.add(data.runId);
          const record = state.threadRunsByStreamId.get(eventStreamId) ?? state.threadRunsById.get(data.runId);
          if (record) record.lifecycle = 'suspended';
        } else {
          clearActiveIfCurrent(data.runId, data.streamId);
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
          await this.#drainPendingIdleSignals(state, resolvedPubSub, key, data.runId);
        }
        wake();
      }
    };

    let eventTail = Promise.resolve();
    const onEvent: EventCallback = (event, ack) => {
      // Events are processed strictly in publish order, but each delivery is
      // acknowledged on its own outcome. Every delivered event is acked once it
      // has been inspected — including events this subscriber filters out —
      // because a persistent backend (Redis consumer groups) keeps unacked
      // deliveries pending for the lifetime of the subscription.
      const processed = eventTail.then(() => handleEvent(event));
      // The tail must survive a failed event so later events still run.
      eventTail = processed.then(
        () => {},
        () => {},
      );
      // Returned rejection lets the backend nack and redeliver.
      return processed.then(() => ack?.());
    };

    await resolvedPubSub.subscribe(topic, onEvent);

    const currentRunId = activeRunId();
    const currentRecord = currentRunId ? state.threadRunsById.get(currentRunId) : undefined;
    if (currentRecord) {
      localStreamIds.add(currentRecord.streamId);
      enqueueRun(currentRecord);
    }

    const unsubscribe = () => {
      if (done) return;
      done = true;
      for (const timer of remoteRunLeaseTimers.values()) clearTimeout(timer);
      remoteRunLeaseTimers.clear();
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
      __getCurrentRunRequestContext: () => currentRunRequestContext,
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
            activeReaderStreamId = run.streamId;
            currentRunRequestContext = run.streamOptions.requestContext;
            if (remoteRuns.has(run.streamId)) startRemoteRunLeaseWatch(run.runId, run.streamId);
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
              stopRemoteRunLeaseWatch(run.streamId);
              currentReader = null;
              activeReaderRunId = null;
              activeReaderStreamId = null;
              currentRunRequestContext = undefined;
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
    return this.sendSignal<OUTPUT>(agent, this.#createMessageSignalInput(message), target, pubsub);
  }

  queueMessage<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    message: AgentMessageInput,
    target: QueueAgentMessageOptions<OUTPUT>,
    pubsub?: PubSub,
  ): QueueAgentMessageResult<OUTPUT> {
    const state = this.#getState(pubsub);
    const acceptedAt = new Date();
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
    const signal = createMessageSignal(message, {
      id: this.#generateSignalMessageId(agent, { resourceId, threadId }),
      acceptedAt,
    });
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

    if (runId) {
      activeRecord ??= state.threadRunsById.get(runId);
      if (activeRecord) {
        key ??= this.#threadKey(activeRecord.resourceId, activeRecord.threadId);
      }
    }

    const resourceId = target.resourceId ?? activeRecord?.resourceId;
    const threadId = target.threadId ?? activeRecord?.threadId;
    if (!resourceId || !threadId) {
      throw new Error('No active agent run found for signal target');
    }

    const isActiveTarget = Boolean(
      runId && (activeRecord?.output.status === 'running' || (key && state.activeThreadRunIds.get(key) === runId)),
    );
    let signal = createSignal({
      ...signalInput,
      id: signalInput.id ?? this.#generateSignalMessageId(agent, { resourceId, threadId }),
      acceptedAt: new Date(),
    });

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
        // Transient signals are never written to storage, so a `persist` behavior has nothing
        // to do with them — report the drop honestly as `discard` instead of `persist`.
        if (signal.transient) {
          return {
            signal,
            accepted: Promise.resolve({ action: 'discard' as const }),
          };
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

    runId = randomUUID();
    key ??= this.#threadKey(resourceId, threadId);
    if (idleBehavior === 'persist') {
      // Transient signals are never written to storage, so an idle `persist` behavior drops
      // them entirely (no store, no broadcast) — report that as `discard`, not `persist`.
      if (signal.transient) {
        return {
          signal,
          accepted: Promise.resolve({ action: 'discard' as const }),
        };
      }
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
        state.preRunSignalsByThread.delete(reservedKey);

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
