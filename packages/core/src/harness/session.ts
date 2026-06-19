import type { Agent } from '../agent';
import type { AgentThreadSubscription } from '../agent/types';
import type { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import { safeStringify } from '../utils';
import type { TaskItemSnapshot } from './tools';
import { createEmptyTokenUsage, defaultDisplayState, defaultOMProgressState } from './types';
import type {
  HarnessDisplayState,
  HarnessEvent,
  HarnessMessage,
  HarnessMode,
  HarnessRequestState,
  HarnessRequestStateUpdater,
  HarnessThread,
  TokenUsage,
  ToolCategory,
} from './types';

/**
 * Minimal persistence surface the Session uses to read and write per-thread
 * settings (mode id, per-mode model id, …). The Harness backs this with thread
 * metadata; when no storage is configured it is absent and the Session keeps
 * its state purely in memory.
 */
export interface ThreadSettingsStore {
  /** Read a setting for the active thread, or undefined when unset/unavailable. */
  get(key: string): Promise<unknown>;
  /** Persist a setting for the active thread (no-op when storage is unavailable). */
  set(key: string, value: unknown): Promise<void>;
}

/** Usage fields that are summed across steps when present on a step's usage. */
type OptionalUsageField = 'reasoningTokens' | 'cachedInputTokens' | 'cacheCreationInputTokens';

function addOptionalUsageField(usage: TokenUsage, key: OptionalUsageField, value: number | undefined): void {
  if (value !== undefined) {
    usage[key] = (usage[key] ?? 0) + value;
  }
}

/** Persisted thread-setting key for the currently-selected mode. */
const MODE_ID_KEY = 'currentModeId';
/** Persisted thread-setting key prefix for a mode's last-used model. */
const modeModelKey = (modeId: string) => `modeModelId_${modeId}`;

/**
 * Owns the session's identity: the memory `resourceId` and the active
 * `threadId` this session reads and writes under. Together they form the memory
 * binding (`{ thread, resource }`) every run uses. In a multi-user host one
 * Harness serves many sessions, so this identity — "whose session is this, and
 * which thread is it on" — belongs to the Session, not the Harness.
 *
 * `defaultResourceId` is the resourceId the session started with; switching to a
 * different resource (e.g. impersonation, or browsing another user's threads)
 * updates the current resourceId while the default is retained so the session
 * can return to its own identity.
 *
 * The active thread the session is bound to lives on {@link SessionThread}, not
 * here — identity is the stable "who", the thread is the navigational "where".
 */
export class SessionIdentity {
  /** The memory resourceId the session currently reads/writes under. */
  #resourceId: string;
  /** The resourceId the session started with, retained across resource switches. */
  readonly #defaultResourceId: string;

  constructor({ resourceId }: { resourceId: string }) {
    this.#resourceId = resourceId;
    this.#defaultResourceId = resourceId;
  }

  /** The resourceId the session currently reads/writes under. */
  getResourceId(): string {
    return this.#resourceId;
  }

  /** The resourceId the session started with. */
  getDefaultResourceId(): string {
    return this.#defaultResourceId;
  }

  /** Point the session at a different resourceId (the default is unchanged). */
  setResourceId({ resourceId }: { resourceId: string }): void {
    this.#resourceId = resourceId;
  }
}

/**
 * The shared-host storage surface the Session's thread domain leverages to read
 * and write threads. The Harness backs this with its memory storage (mapping raw
 * storage rows to {@link HarnessThread}/{@link HarnessMessage}); when no storage
 * is configured the handle is absent and the data methods degrade gracefully
 * (empty lists, undefined settings, no-op writes).
 *
 * This is a gateway to shared infrastructure — not a callback into Harness
 * orchestration. The Session owns the thread-domain logic; the host owns the DB.
 */
export interface ThreadDataStore {
  /** List threads for a resource (or all resources), already mapped + filtered of forked subagents unless asked. */
  listThreads(input: { resourceId?: string; includeForkedSubagents?: boolean }): Promise<HarnessThread[]>;
  /** Fetch a single thread by id, or null when it doesn't exist. */
  getById(input: { threadId: string }): Promise<HarnessThread | null>;
  /** List messages for a thread, newest-`limit` (returned oldest-first) or all. */
  listMessages(input: { threadId: string; limit?: number }): Promise<HarnessMessage[]>;
  /** The first user message for each given thread id. */
  firstUserMessages(input: { threadIds: string[] }): Promise<Map<string, HarnessMessage>>;
  /** Read a value from a thread's metadata. */
  getMetadata(input: { threadId: string; key: string }): Promise<unknown>;
  /** Write a value into a thread's metadata. */
  setMetadata(input: { threadId: string; key: string; value: unknown }): Promise<void>;
  /** Delete a value from a thread's metadata. */
  deleteMetadata(input: { threadId: string; key: string }): Promise<void>;
}

/**
 * Owns the session's thread domain: the navigational binding (which thread the
 * session is currently on) plus the data reads/queries scoped to it. `null`
 * until the session is bound (a thread is created, switched to, or reacquired on
 * startup); switching/deleting updates it.
 *
 * In the multi-user model each session has its own current thread and reads its
 * own threads, while the Harness host shares storage, the thread lock, and the
 * event bus. So the binding + data queries are per-session and live here; the
 * session leverages the host's storage via an injected {@link ThreadDataStore}.
 * Lifecycle *transitions* (create/switch/clone/delete) remain host machinery
 * because they drive the shared event bus and rebind the shared agent stream.
 */
export class SessionThread {
  /** The active thread id, or null when the session is not bound to a thread. */
  #threadId: string | null = null;
  /** Gateway to the host's shared thread storage, injected via {@link connect}. */
  #store: ThreadDataStore | undefined;
  /** Reads the session's current resourceId (sibling identity state). */
  readonly #getResourceId: () => string;

  constructor(getResourceId: () => string) {
    this.#getResourceId = getResourceId;
  }

  /**
   * Attach the shared-host storage gateway the thread domain reads/writes
   * through. The Harness calls this once storage is available; without it the
   * data methods degrade gracefully.
   */
  connect(store: ThreadDataStore | undefined): void {
    this.#store = store;
  }

  /** The active thread id, or null when the session is not bound to a thread. */
  getId(): string | null {
    return this.#threadId;
  }

  /** Whether the session is currently bound to a thread. */
  isSet(): boolean {
    return this.#threadId !== null;
  }

  /** The active thread id, throwing when the session is not bound to a thread. */
  requireId(): string {
    if (this.#threadId === null) {
      throw new Error('No active thread on this session');
    }
    return this.#threadId;
  }

  /** Bind the session to a thread. */
  set({ threadId }: { threadId: string }): void {
    this.#threadId = threadId;
  }

  /** Clear the session's thread binding. */
  clear(): void {
    this.#threadId = null;
  }

  // ---------------------------------------------------------------------------
  // Data domain: reads/queries scoped to this session, backed by host storage.
  // ---------------------------------------------------------------------------

  /** List this session's threads (its own resource by default, or all resources). */
  async list(options?: { allResources?: boolean; includeForkedSubagents?: boolean }): Promise<HarnessThread[]> {
    if (!this.#store) return [];
    return this.#store.listThreads({
      resourceId: options?.allResources ? undefined : this.#getResourceId(),
      includeForkedSubagents: options?.includeForkedSubagents,
    });
  }

  /** Fetch a single thread by id, or null when it doesn't exist / no storage. */
  async getById({ threadId }: { threadId: string }): Promise<HarnessThread | null> {
    if (!this.#store) return null;
    return this.#store.getById({ threadId });
  }

  /** List messages for a thread (newest-`limit`, returned oldest-first), or all. */
  async listMessages({ threadId, limit }: { threadId: string; limit?: number }): Promise<HarnessMessage[]> {
    if (!this.#store) return [];
    return this.#store.listMessages({ threadId, limit });
  }

  /** List messages for the session's active thread (empty when not bound). */
  async listActiveMessages({ limit }: { limit?: number } = {}): Promise<HarnessMessage[]> {
    if (this.#threadId === null) return [];
    return this.listMessages({ threadId: this.#threadId, limit });
  }

  /** The first user message for a single thread, or null. */
  async firstUserMessage({ threadId }: { threadId: string }): Promise<HarnessMessage | null> {
    const messages = await this.firstUserMessages({ threadIds: [threadId] });
    return messages.get(threadId) ?? null;
  }

  /** The first user message for each given thread id. */
  async firstUserMessages({ threadIds }: { threadIds: string[] }): Promise<Map<string, HarnessMessage>> {
    if (!this.#store || threadIds.length === 0) return new Map();
    return this.#store.firstUserMessages({ threadIds });
  }

  /** Read a setting (metadata value) for the active thread. */
  async getSetting({ key }: { key: string }): Promise<unknown> {
    if (!this.#store || this.#threadId === null) return undefined;
    return this.#store.getMetadata({ threadId: this.#threadId, key });
  }

  /** Persist a setting (metadata value) for the active thread. */
  async setSetting({ key, value }: { key: string; value: unknown }): Promise<void> {
    if (!this.#store || this.#threadId === null) return;
    await this.#store.setMetadata({ threadId: this.#threadId, key, value });
  }

  /** Delete a setting (metadata value) for the active thread. */
  async deleteSetting({ key }: { key: string }): Promise<void> {
    if (!this.#store || this.#threadId === null) return;
    await this.#store.deleteMetadata({ threadId: this.#threadId, key });
  }
}

/**
 * Owns the session's live subscription to the active thread's agent event
 * stream. A subscription is created per `(agent, resource, thread)` and reused
 * while that triple is unchanged (tracked by {@link key}); switching threads or
 * agents tears the old one down and opens a new one.
 *
 * The Session owns the subscription *handle* and its dedup key plus the
 * mechanical lifecycle (reuse check, teardown, identity check, run-id read).
 * The Harness still owns *how* a subscription is produced (calling the agent)
 * and *how* its stream is consumed, passing the resolved handle in via
 * {@link attach}.
 */
export class SessionStream {
  /** The live subscription to the active thread, or null when none is open. */
  #subscription: AgentThreadSubscription<any> | null = null;
  /** Dedup key (`agentId:resourceId:threadId`) for the open subscription, or null. */
  #key: string | null = null;

  /** Build the dedup key identifying a subscription to `threadId` for `agent`. */
  static keyFor({ agent, resourceId, threadId }: { agent: Agent; resourceId: string; threadId: string }): string {
    return `${agent.id}:${resourceId}:${threadId}`;
  }

  /** Whether the open subscription already targets `key` (so it can be reused). */
  matches({ key }: { key: string }): boolean {
    return this.#key === key && this.#subscription !== null;
  }

  /** Adopt `subscription` as the live one, recording its dedup `key`. */
  attach({ subscription, key }: { subscription: AgentThreadSubscription<any>; key: string }): void {
    this.#subscription = subscription;
    this.#key = key;
  }

  /** Whether a subscription is currently open. */
  isOpen(): boolean {
    return this.#subscription !== null;
  }

  /** Whether `subscription` is the one currently adopted (identity check). */
  isCurrent({ subscription }: { subscription: AgentThreadSubscription<any> }): boolean {
    return this.#subscription === subscription;
  }

  /** The run id the live subscription reports as active, or null when none/idle. */
  activeRunId(): string | null {
    return this.#subscription?.activeRunId() ?? null;
  }

  /** Whether the live subscription currently has a run in flight. */
  isActive(): boolean {
    return this.activeRunId() !== null;
  }

  /** Abort the live subscription's in-flight run, if any. Swallows errors. */
  abort(): void {
    try {
      this.#subscription?.abort();
    } catch {}
  }

  /** Detach the live subscription without aborting (e.g. on stream error). */
  detach(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#key = null;
  }

  /** Fully tear down the live subscription: abort, unsubscribe, and clear. */
  cleanup(): void {
    this.#subscription?.abort();
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#key = null;
  }
}

/** A tool call parked awaiting a resume, keyed in {@link SessionSuspensions}. */
export interface PendingSuspension {
  /** The run id to resume when this tool call is answered. */
  runId: string;
  /** The suspended tool's name (e.g. `ask_user`, `submit_plan`). */
  toolName: string;
}

/**
 * Owns the session's parked tool suspensions: tool calls paused via the native
 * tool-suspension primitive (e.g. `ask_user` / `request_access` / `submit_plan`)
 * that are awaiting a resume, keyed by `toolCallId`. Each entry records the run
 * id to resume and the tool name. A Map (rather than single fields) lets several
 * tools — e.g. parallel `ask_user` calls in one step — stay suspended and be
 * resumed independently.
 *
 * This is the resume *data* the Harness reads to drive a resume. The richer
 * per-suspension UI snapshot lives on the Harness display state; the Session
 * owns only what's needed to resume.
 */
export class SessionSuspensions {
  /** Parked tool calls awaiting a resume, keyed by `toolCallId`. */
  readonly #pending = new Map<string, PendingSuspension>();

  /** Park `toolCallId` as awaiting a resume on `runId` for `toolName`. */
  register({ toolCallId, runId, toolName }: { toolCallId: string; runId: string; toolName: string }): void {
    this.#pending.set(toolCallId, { runId, toolName });
  }

  /** The parked suspension for `toolCallId`, or undefined when none. */
  get({ toolCallId }: { toolCallId: string }): PendingSuspension | undefined {
    return this.#pending.get(toolCallId);
  }

  /** Whether `toolCallId` is currently parked. */
  has({ toolCallId }: { toolCallId: string }): boolean {
    return this.#pending.has(toolCallId);
  }

  /** Drop `toolCallId` from the parked set (e.g. once resumed). */
  delete({ toolCallId }: { toolCallId: string }): void {
    this.#pending.delete(toolCallId);
  }

  /** Drop all parked suspensions (e.g. on abort or thread switch). */
  clear(): void {
    this.#pending.clear();
  }

  /** Whether any tool calls are parked awaiting a resume. */
  hasPending(): boolean {
    return this.#pending.size > 0;
  }

  /**
   * Resolve which parked suspension to act on. With an explicit `toolCallId` it
   * must match a parked suspension; without one it returns the single parked
   * suspension (or undefined when there are zero or several).
   */
  resolveToolCallId(toolCallId?: string): string | undefined {
    if (toolCallId) {
      return this.#pending.has(toolCallId) ? toolCallId : undefined;
    }
    if (this.#pending.size === 1) {
      return this.#pending.keys().next().value;
    }
    return undefined;
  }
}

/** A message queued to send once the active run finishes, held in {@link SessionFollowUps}. */
export interface FollowUp {
  /** The message text to send. */
  content: string;
  /** Optional request context to apply when the queued message is sent. */
  requestContext?: RequestContext;
}

/**
 * Owns the session's follow-up queue: messages a user submits while a run is in
 * progress, held FIFO until the active run finishes and the queue is drained.
 *
 * This owns the queue *data* (enqueue/dequeue/requeue/clear/count). The Harness
 * still drives draining — sending each message and emitting `follow_up_queued`
 * as the count changes — and keeps the display-state mirror (`queuedFollowUps`).
 */
export class SessionFollowUps {
  /** Messages waiting to be sent after the current run, in arrival order. */
  #queue: FollowUp[] = [];

  /** Number of messages currently queued. */
  count(): number {
    return this.#queue.length;
  }

  /** Whether the queue is empty. */
  isEmpty(): boolean {
    return this.#queue.length === 0;
  }

  /** Append a follow-up to the back of the queue. */
  enqueue(followUp: FollowUp): void {
    this.#queue.push(followUp);
  }

  /** Remove and return the next follow-up, or undefined when empty. */
  dequeue(): FollowUp | undefined {
    return this.#queue.shift();
  }

  /** Put a follow-up back at the front (e.g. when draining it failed). */
  requeue(followUp: FollowUp): void {
    this.#queue.unshift(followUp);
  }

  /** Drop all queued follow-ups (e.g. on steer or thread switch). */
  clear(): void {
    this.#queue = [];
  }
}

/** The decision a user returns to resolve a parked tool-approval gate. */
export interface ApprovalDecision {
  /** Whether to run the gated tool or reject it. */
  decision: 'approve' | 'decline';
  /** Optional request context to apply when the gated tool resumes. */
  requestContext?: RequestContext;
}

/**
 * A user's response to a parked approval. `always_allow_category` approves the
 * tool and additionally grants its category for the rest of the session.
 */
export interface ApprovalResponse {
  decision: 'approve' | 'decline' | 'always_allow_category';
  requestContext?: RequestContext;
}

/**
 * Owns the session's interactive tool-approval gate: when a tool requires user
 * approval, the run parks on a promise here until the UI responds approve or
 * decline. Holds the pending resolver and the name of the tool being gated.
 *
 * At most one approval is in flight at a time. The Session owns the gate
 * mechanics (arm / resolve / clear); the Harness still maps a decision to its
 * effects (running vs declining the tool, and any "always allow" grant), since
 * those touch config-derived tool categories.
 */
export class SessionApproval {
  /** Resolver for the parked approval promise, or null when nothing is gated. */
  #resolve: ((decision: ApprovalDecision) => void) | null = null;
  /** Name of the tool currently awaiting approval, or null when none. */
  #toolName: string | null = null;

  /**
   * Park a new approval for `toolName` and return a promise that resolves once
   * {@link resolve} is called with the user's decision. The caller awaits this
   * while the run is suspended on the gate.
   */
  arm({ toolName }: { toolName: string }): Promise<ApprovalDecision> {
    this.#toolName = toolName;
    return new Promise<ApprovalDecision>(resolve => {
      this.#resolve = resolve;
    });
  }

  /** Whether an approval is currently parked awaiting a decision. */
  isArmed(): boolean {
    return this.#resolve !== null;
  }

  /**
   * Apply a user's {@link ApprovalResponse} to the parked gate. A no-op when
   * nothing is armed. `always_allow_category` runs `onAlwaysAllow` with the
   * gated tool name (so the caller can grant the tool's category — a lookup that
   * needs Harness config) and then approves; `approve`/`decline` resolve as-is.
   */
  respond({
    decision,
    requestContext,
    onAlwaysAllow,
  }: ApprovalResponse & { onAlwaysAllow?: (toolName: string) => void }): void {
    if (!this.isArmed()) return;

    if (decision === 'always_allow_category' && this.#toolName) {
      onAlwaysAllow?.(this.#toolName);
    }

    const resolved: ApprovalDecision = {
      decision: decision === 'decline' ? 'decline' : 'approve',
      requestContext,
    };
    this.#resolve?.(resolved);
    this.#resolve = null;
    this.#toolName = null;
  }

  /**
   * Release a parked gate without a user decision — used when the run is
   * aborted. Resolves the awaiting producer as a `decline` so the gated tool is
   * rejected (not run) and the run can finalize. A no-op when nothing is armed.
   */
  cancel(): void {
    if (!this.isArmed()) return;
    this.#resolve?.({ decision: 'decline' });
    this.#resolve = null;
    this.#toolName = null;
  }

  /** Clear the gated tool name once a parked approval has been consumed. */
  clearToolName(): void {
    this.#toolName = null;
  }
}

/**
 * Owns the session's transient run identity and abort control: the id of the
 * run currently streaming on the active thread, its trace id, a monotonic
 * operation counter bumped each time a new operation starts, and the
 * AbortController/abort-requested flag governing cancellation. All of this is
 * per-run scratch state — it is never persisted and resets between runs.
 *
 * The live agent subscription itself lives on {@link SessionStream}
 * (`session.stream`); this holds the last run id observed on a chunk so callers
 * have a stable value once the subscription has settled.
 */
export class SessionRun {
  /** Id of the run currently streaming on the active thread, or null when idle. */
  #runId: string | null = null;
  /** Trace id for the current run, or null when unset. */
  #traceId: string | null = null;
  /** Monotonic counter bumped at the start of each operation. */
  #operationId = 0;
  /** Controller whose signal cancels the active run; null when no run is armed. */
  #abortController: AbortController | null = null;
  /** Whether an abort has been requested for the current run. */
  #abortRequested = false;

  /** The current run id (null when idle). */
  getRunId(): string | null {
    return this.#runId;
  }

  /** Set the current run id. */
  setRunId({ runId }: { runId: string | null }): void {
    this.#runId = runId;
  }

  /** The current trace id (null when unset). */
  getTraceId(): string | null {
    return this.#traceId;
  }

  /** Set the current trace id. */
  setTraceId({ traceId }: { traceId: string | null }): void {
    this.#traceId = traceId;
  }

  /**
   * Clear all run state (run id, trace id, abort controller + requested flag)
   * when a run ends or is reset. Does not touch the operation counter.
   */
  reset(): void {
    this.#runId = null;
    this.#traceId = null;
    this.#abortController = null;
    this.#abortRequested = false;
  }

  /** Bump and return the operation counter at the start of a new operation. */
  nextOperation(): number {
    this.#operationId += 1;
    return this.#operationId;
  }

  /**
   * Lazily create (if needed) and return the AbortController for the current
   * run. Callers pass its `.signal` into the underlying stream.
   */
  ensureAbortController(): AbortController {
    this.#abortController ??= new AbortController();
    return this.#abortController;
  }

  /** Signal for the current run's AbortController, or undefined when none is armed. */
  getAbortSignal(): AbortSignal | undefined {
    return this.#abortController?.signal;
  }

  /**
   * Whether a run is currently in progress. A run is armed with an
   * AbortController for its duration, so the presence of one is what "running"
   * means; this is the semantic accessor callers should use.
   */
  isRunning(): boolean {
    return this.#abortController !== null;
  }

  /**
   * Whether an AbortController is currently armed. Equivalent to
   * {@link isRunning} today; kept for callers that assert on the controller's
   * lifecycle specifically (e.g. that it was cleared after an abort).
   */
  hasAbortController(): boolean {
    return this.#abortController !== null;
  }

  /** Clear the abort-requested flag at the start of a fresh run. */
  clearAbortRequested(): void {
    this.#abortRequested = false;
  }

  /** Whether an abort has been requested for the current run. */
  isAbortRequested(): boolean {
    return this.#abortRequested;
  }

  /**
   * Request an abort: mark the run as aborting and fire the AbortController (if
   * armed), then drop the controller. Leaves the requested flag set so the
   * run-end path can resolve its reason as 'aborted'; {@link reset} clears it.
   */
  requestAbort(): void {
    this.#abortRequested = true;
    if (this.#abortController) {
      try {
        this.#abortController.abort();
      } catch {}
      this.#abortController = null;
    }
  }
}

/**
 * Owns the session's currently-selected model. Source of truth for "which model
 * is active", plus the per-mode model memory persisted to the thread-settings
 * store (so each mode remembers the model it was last used with).
 */
export class SessionModel {
  #id = '';
  readonly #store: () => ThreadSettingsStore | undefined;

  constructor(store: () => ThreadSettingsStore | undefined) {
    this.#store = store;
  }

  /** The currently-selected model id ('' when none selected yet). */
  get(): string {
    return this.#id;
  }

  /** Whether a model is currently selected. */
  hasSelection(): boolean {
    return this.#id !== '';
  }

  /** Set the in-memory selected model id (no persistence). */
  set({ modelId }: { modelId: string }): void {
    this.#id = modelId;
  }

  /** Persist `modelId` as the last-used model for `modeId`. */
  async saveForMode({ modeId, modelId }: { modeId: string; modelId: string }): Promise<void> {
    await this.#store()?.set(modeModelKey(modeId), modelId);
  }

  /**
   * Resolve the model for `modeId`: the persisted per-mode model if present,
   * else `defaultModelId`, else null.
   */
  async resolveForMode({
    modeId,
    defaultModelId,
  }: {
    modeId: string;
    defaultModelId?: string;
  }): Promise<string | null> {
    const stored = (await this.#store()?.get(modeModelKey(modeId))) as string | undefined;
    if (stored) return stored;
    return defaultModelId ?? null;
  }
}

/**
 * Owns the session's currently-selected mode and the logic for switching modes.
 * Holds the active mode id and runs the version-guarded switch sequence —
 * persisting the selection and coordinating the per-mode model with
 * {@link SessionModel}. The Harness still owns the mode *definitions*
 * (`config.modes`); this owns "which mode is active" and how a switch unfolds.
 */
export class SessionMode {
  /** Id of the currently-selected mode. Empty until the Harness resolves its default mode. */
  #id = '';
  /**
   * Monotonically increasing counter bumped on each switch. A slower in-flight
   * switch detects it was superseded by a newer one and bails.
   */
  #switchVersion = 0;
  readonly #store: () => ThreadSettingsStore | undefined;
  readonly #model: SessionModel;
  /**
   * Resolves a mode id to its full definition. Injected by the Harness via
   * {@link setResolver}, since the mode *catalog* (`config.modes`) is host config.
   */
  #resolveMode: ((modeId: string) => HarnessMode | null) | undefined;
  /**
   * Aborts any in-progress generation before a switch. Injected by the Harness
   * via {@link setResolver}, since aborting a run is Harness-owned orchestration.
   */
  #abort: (() => void) | undefined;
  /**
   * Emits Harness events (mode_changed / model_changed) during a switch.
   * Injected by the Harness via {@link setResolver}.
   */
  #emit: ((event: HarnessEvent) => void) | undefined;

  constructor(store: () => ThreadSettingsStore | undefined, model: SessionModel) {
    this.#store = store;
    this.#model = model;
  }

  /**
   * Attach the resolver that maps a mode id to its definition, plus the
   * Harness-owned orchestration callbacks ({@link switch} uses to abort the
   * in-flight run and emit events). The Harness owns the mode catalog
   * (`config.modes`) and injects these once.
   */
  setResolver(
    resolve: (modeId: string) => HarnessMode | null,
    options?: { abort?: () => void; emit?: (event: HarnessEvent) => void },
  ): void {
    this.#resolveMode = resolve;
    this.#abort = options?.abort;
    this.#emit = options?.emit;
  }

  /** The currently-selected mode id. */
  get(): string {
    return this.#id;
  }

  /**
   * Resolve the currently-selected mode id to its full definition against the
   * host's mode catalog. Throws if the selected mode id isn't in the catalog.
   */
  resolve(): HarnessMode {
    const mode = this.#resolveMode?.(this.#id) ?? null;
    if (!mode) {
      throw new Error(`Mode not found: ${this.#id}`);
    }
    return mode;
  }

  /** Set the currently-selected mode id (on default resolution or hydration). */
  set({ modeId }: { modeId: string }): void {
    this.#id = modeId;
  }

  /**
   * Switch to a different mode.
   *
   * Aborts any in-progress generation, emits `mode_changed`, then runs the
   * version-guarded sequence: remember the outgoing mode's model, persist the
   * new mode, then resolve and apply the incoming mode's model — emitting
   * `model_changed` once applied. A newer switch starting mid-flight supersedes
   * this one, which then bails before emitting `model_changed`.
   */
  async switch({ modeId }: { modeId: string }): Promise<void> {
    const mode = this.#resolveMode?.(modeId) ?? null;
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    this.#abort?.();

    const previousModeId = this.#id;
    const previousModelId = this.#model.get();
    const version = ++this.#switchVersion;
    this.#id = modeId;

    // Emit the mode change immediately so UIs can update without waiting for
    // the storage round-trips below.
    this.#emit?.({ type: 'mode_changed', modeId, previousModeId });

    // Remember the outgoing mode's model before moving on.
    if (previousModelId) {
      await this.#model.saveForMode({ modeId: previousModeId, modelId: previousModelId });
    }
    if (this.#switchVersion !== version) return;

    await this.#store()?.set(MODE_ID_KEY, modeId);
    if (this.#switchVersion !== version) return;

    const modelId = await this.#model.resolveForMode({ modeId, defaultModelId: mode.defaultModelId });
    if (this.#switchVersion !== version) return;
    if (modelId) {
      this.#model.set({ modelId });
      this.#emit?.({ type: 'model_changed', modelId } as HarnessEvent);
    }
  }
}

type SessionStateUpdater<TState, TResult> = HarnessRequestStateUpdater<TState, TResult>;

interface SessionStateOptions<TState> {
  initialState?: Partial<TState>;
  stateSchema?: PublicSchema<TState, any>;
  emit?: (event: HarnessEvent) => void;
}

/**
 * Owns the live Harness state for a single Session.
 *
 * Reads return shallow snapshots, writes are serialized through a promise queue,
 * and validated updates emit the same `state_changed` event the Harness used to
 * emit when it owned state directly.
 */
class SessionState<TState = unknown> {
  #state: TState;
  #updateQueue: Promise<void> = Promise.resolve();
  readonly #schema: StandardSchemaWithJSON | undefined;
  readonly #emit: ((event: HarnessEvent) => void) | undefined;

  constructor({ initialState, stateSchema, emit }: SessionStateOptions<TState>) {
    this.#schema = stateSchema ? toStandardSchema(stateSchema) : undefined;
    this.#state = {
      ...this.getSchemaDefaults(),
      ...(initialState as Record<string, unknown> | undefined),
    } as TState;
    this.#emit = emit;
  }

  get(): Readonly<TState> {
    return { ...(this.#state as Record<string, unknown>) } as TState;
  }

  private getSchemaDefaults(): Partial<TState> {
    if (!this.#schema) return {};

    const defaults: Record<string, unknown> = {};

    try {
      // Extract defaults from the JSON Schema representation.
      const jsonSchema = this.#schema['~standard'].jsonSchema.output({ target: 'draft-07' }) as {
        properties?: Record<string, { default?: unknown }>;
      };
      if (jsonSchema?.properties) {
        for (const [key, prop] of Object.entries(jsonSchema.properties)) {
          if (prop.default !== undefined) {
            defaults[key] = prop.default;
          }
        }
      }
    } catch {
      // Schema doesn't support JSON Schema extraction — skip defaults.
    }

    return defaults as Partial<TState>;
  }

  private async apply(updates: Partial<TState>): Promise<void> {
    const changedKeys = Object.keys(updates as Record<string, unknown>);
    const newState = { ...(this.#state as Record<string, unknown>), ...(updates as Record<string, unknown>) };

    if (this.#schema) {
      const result = await this.#schema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map(i => i.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      this.#state = result.value as TState;
    } else {
      this.#state = newState as TState;
    }

    this.#emit?.({ type: 'state_changed', state: this.get() as Record<string, unknown>, changedKeys });
  }

  set(updates: Partial<TState>): Promise<void> {
    const updateSnapshot = { ...(updates as Record<string, unknown>) } as Partial<TState>;
    const run = this.#updateQueue.then(() => this.apply(updateSnapshot));
    this.#updateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  update<TResult>(updater: SessionStateUpdater<TState, TResult>): Promise<TResult> {
    const run = this.#updateQueue.then(async () => {
      const update = await updater(this.get());
      if (update.updates && Object.keys(update.updates as Record<string, unknown>).length > 0) {
        await this.apply(update.updates);
      }
      for (const event of update.events ?? []) {
        this.#emit?.(event);
      }
      return update.result;
    });

    this.#updateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

/**
 * A Harness session owns the per-conversation runtime state that today lives
 * flattened on the {@link Harness} instance. This class is the seam we extract
 * that state into, one concern at a time, so the Harness can eventually own a
 * `Session` rather than the state itself.
 *
 * Currently owns:
 * - the live Harness state (`session.state`): schema-validated snapshots and
 *   serialized updates that emit `state_changed`. `Harness.getState()` /
 *   `Harness.setState()` are compatibility wrappers over this domain.
 * - session-scoped permission grants — the "allow for this session" approvals a
 *   user makes when a tool or tool category is gated behind the permission check.
 * - the live token-usage counter for the active thread. The Session holds the
 *   in-memory running tally; the Harness remains responsible for persisting it
 *   to (and hydrating it from) thread metadata, because usage is thread-scoped.
 * - the currently-selected mode (`session.mode`) and model (`session.model`).
 *   The Session is the source of truth for which mode/model is active and owns
 *   the mode-switch sequence and per-mode model memory. The Harness still owns
 *   the mode *definitions* (`config.modes`).
 * - transient run identity and abort control (`session.run`): the current run
 *   id, trace id, monotonic operation counter, and the AbortController/
 *   abort-requested flag. This is per-run scratch state and is never persisted.
 * - the live agent thread subscription (`session.stream`): the open
 *   subscription to the active thread's event stream and its dedup key. The
 *   Harness still produces the subscription (calling the agent) and consumes its
 *   stream; the Session owns the handle and its lifecycle.
 * - the parked tool suspensions (`session.suspensions`): tool calls paused via
 *   the native tool-suspension primitive awaiting a resume, keyed by toolCallId.
 *   The Session owns the resume data; the Harness keeps the richer per-suspension
 *   UI snapshot on its display state.
 * - the follow-up queue (`session.followUps`): messages a user submits while a
 *   run is in progress, held FIFO until the run finishes. The Session owns the
 *   queue; the Harness drives draining and keeps the `queuedFollowUps` display
 *   mirror.
 * - the interactive tool-approval gate (`session.approval`): when a tool needs
 *   user approval, the run parks on a promise here until the UI responds. The
 *   Session owns the gate; the Harness maps the decision to its effects (run vs
 *   decline, any "always allow" grant), which touch config-derived categories.
 *
 * It also exposes a couple of accessors that compose `run` and `stream`:
 * {@link getCurrentRunId} (the active run id, preferring the live subscription)
 * and {@link abortRun} (abort the live run and mark it aborting).
 *
 * Mode/model persistence is thread-scoped, so the Session writes through a
 * {@link ThreadSettingsStore} the Harness backs with thread metadata; when no
 * storage is configured the store is absent and state stays in memory.
 */
/**
 * Owns the session's canonical display state — the projection a UI renders from
 * instead of folding raw events itself. The Session holds the snapshot and the
 * reducer ({@link apply}) that keeps it in sync with every Harness event; the
 * Harness still owns the event bus and dispatches `display_state_changed` to
 * listeners after applying.
 *
 * The reducer needs a few read-only host/session facts it doesn't own: the live
 * token-usage tally, a subagent display-name lookup (Harness config), and the
 * active thread id (to decide whether a `thread_deleted` clears the view). Those
 * are injected at construction so the reducer stays self-contained.
 */
export class SessionDisplayState {
  #state: HarnessDisplayState = defaultDisplayState();

  constructor(
    private readonly deps: {
      /** The session's live token-usage tally, mirrored into the view on usage/thread events. */
      getTokenUsage: () => TokenUsage;
      /** Resolve a subagent's display name from Harness config, or undefined when unnamed. */
      getSubagentDisplayName: (agentType: string) => string | undefined;
      /** The active thread id, used to gate `thread_deleted` resets. */
      getThreadId: () => string | null;
      /** Clear the session's follow-up queue when thread-scoped display state resets. */
      clearFollowUps: () => void;
    },
  ) {}

  /**
   * A read-only snapshot of the canonical display state. UIs should render from
   * this instead of building state up from raw events.
   */
  get(): Readonly<HarnessDisplayState> {
    return this.#state;
  }

  /**
   * Drop the display mirror of every parked tool suspension. Used on abort,
   * which abandons the run's parked suspensions; the caller dispatches
   * `display_state_changed`.
   */
  clearPendingSuspensions(): void {
    this.#state.pendingSuspensions.clear();
  }

  /**
   * Clear the modified-files tally without touching the rest of the snapshot.
   * Used after a clone, which starts the cloned thread with a clean working set
   * while the surrounding UI reset handles tasks/tools explicitly.
   */
  clearModifiedFiles(): void {
    this.#state.modifiedFiles.clear();
  }

  /**
   * Drop the display mirror of a single parked tool suspension once it has been
   * resumed, so the UI stops rendering only the resolved prompt while any other
   * parked suspensions stay visible.
   */
  deletePendingSuspension(toolCallId: string): void {
    this.#state.pendingSuspensions.delete(toolCallId);
  }

  /**
   * Restore task display state after a UI replays persisted task-tool history.
   * Updates the snapshot without emitting a live `task_updated` event, since no
   * task tool just ran. The caller dispatches `display_state_changed`.
   */
  restoreTasks(tasks: TaskItemSnapshot[]): void {
    this.#state.previousTasks = [...this.#state.tasks];
    this.#state.tasks = [...tasks];
  }

  /**
   * Reset display fields scoped to a thread. Called on thread switch/creation.
   * Also clears the session's follow-up queue (mirrored by `queuedFollowUps`).
   */
  resetThread(): void {
    const ds = this.#state;
    ds.activeTools = new Map();
    ds.toolInputBuffers = new Map();
    ds.pendingApproval = null;
    ds.pendingSuspensions = new Map();
    ds.activeSubagents = new Map();
    ds.currentMessage = null;
    this.deps.clearFollowUps();
    ds.queuedFollowUps = 0;
    ds.modifiedFiles = new Map();
    ds.tasks = [];
    ds.previousTasks = [];
    ds.omProgress = defaultOMProgressState();
    ds.bufferingMessages = false;
    ds.bufferingObservations = false;
  }

  /**
   * Apply a display-state update based on an incoming event. The centralized
   * state machine that keeps {@link HarnessDisplayState} in sync with every
   * event the Harness emits.
   */
  apply(event: HarnessEvent): void {
    const ds = this.#state;

    switch (event.type) {
      // ── Agent lifecycle ────────────────────────────────────────────────
      case 'agent_start':
        ds.isRunning = true;
        ds.activeTools = new Map();
        ds.toolInputBuffers = new Map();
        ds.currentMessage = null;
        ds.pendingApproval = null;
        // Parked tool suspensions are intentionally NOT cleared here: resuming
        // one parked tool restarts the run (a fresh agent_start) and the other
        // parallel prompts must stay rendered until they are resolved.
        break;

      case 'agent_end':
        ds.isRunning = false;
        ds.pendingApproval = null;
        // A suspended run keeps its pending tool suspensions alive so the UI can
        // still render the prompts (e.g. `ask_user`, which pauses via the native
        // tool-suspension primitive). When the run ends for any other reason the
        // parked suspensions are abandoned, so clear them all.
        if (event.reason !== 'suspended') {
          ds.pendingSuspensions.clear();
        }
        // Mark any still-running tools as errored (handles abort mid-run)
        for (const [, tool] of ds.activeTools) {
          if (tool.status === 'running' || tool.status === 'streaming_input') {
            tool.status = 'error';
          }
        }
        ds.activeSubagents = new Map();
        break;

      // ── Message streaming ──────────────────────────────────────────────
      case 'message_start':
        ds.currentMessage = event.message;
        break;

      case 'message_update':
        ds.currentMessage = event.message;
        break;

      case 'message_end':
        ds.currentMessage = event.message;
        break;

      // ── Tool lifecycle ─────────────────────────────────────────────────
      case 'tool_input_start': {
        ds.toolInputBuffers.set(event.toolCallId, { text: '', toolName: event.toolName });
        const existing = ds.activeTools.get(event.toolCallId);
        if (existing) {
          existing.status = 'streaming_input';
        } else {
          ds.activeTools.set(event.toolCallId, {
            name: event.toolName,
            args: {},
            status: 'streaming_input',
          });
        }
        break;
      }

      case 'tool_input_delta': {
        const buf = ds.toolInputBuffers.get(event.toolCallId);
        if (buf) {
          buf.text += event.argsTextDelta;
        }
        break;
      }

      case 'tool_input_end':
        ds.toolInputBuffers.delete(event.toolCallId);
        break;

      case 'tool_start': {
        const existingTool = ds.activeTools.get(event.toolCallId);
        if (existingTool) {
          existingTool.name = event.toolName;
          existingTool.args = event.args;
          existingTool.status = 'running';
        } else {
          ds.activeTools.set(event.toolCallId, {
            name: event.toolName,
            args: event.args,
            status: 'running',
          });
        }
        break;
      }

      case 'tool_update': {
        const tool = ds.activeTools.get(event.toolCallId);
        if (tool) {
          tool.partialResult =
            typeof event.partialResult === 'string' ? event.partialResult : safeStringify(event.partialResult);
        }
        break;
      }

      case 'tool_end': {
        const endedTool = ds.activeTools.get(event.toolCallId);
        if (endedTool) {
          endedTool.status = event.isError ? 'error' : 'completed';
          endedTool.result = event.result;
          endedTool.isError = event.isError;
        }
        // Track file modifications
        if (!event.isError) {
          const FILE_TOOLS = ['string_replace_lsp', 'write_file', 'ast_smart_edit'];
          const toolState = ds.activeTools.get(event.toolCallId);
          if (toolState && FILE_TOOLS.includes(toolState.name)) {
            const toolArgs = toolState.args as Record<string, unknown>;
            const filePath = toolArgs?.path as string;
            if (filePath) {
              const existing = ds.modifiedFiles.get(filePath);
              if (existing) {
                existing.operations.push(toolState.name);
              } else {
                ds.modifiedFiles.set(filePath, {
                  operations: [toolState.name],
                  firstModified: new Date(),
                });
              }
            }
          }
        }
        break;
      }

      case 'shell_output': {
        const shellTool = ds.activeTools.get(event.toolCallId);
        if (shellTool) {
          shellTool.shellOutput = (shellTool.shellOutput ?? '') + event.output;
        }
        break;
      }

      case 'tool_approval_required':
        ds.pendingApproval = {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        };
        break;

      case 'tool_suspended':
        ds.pendingSuspensions.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          suspendPayload: event.suspendPayload,
          resumeSchema: event.resumeSchema,
        });
        break;

      // ── Subagent tracking ──────────────────────────────────────────────
      case 'subagent_start': {
        const displayName = this.deps.getSubagentDisplayName(event.agentType);
        ds.activeSubagents.set(event.toolCallId, {
          agentType: event.agentType,
          ...(displayName !== undefined ? { displayName } : {}),
          task: event.task,
          modelId: event.modelId,
          forked: event.forked,
          toolCalls: [],
          textDelta: '',
          status: 'running',
        });
        break;
      }

      case 'subagent_text_delta': {
        const sub = ds.activeSubagents.get(event.toolCallId);
        if (sub) {
          sub.textDelta += event.textDelta;
        }
        break;
      }

      case 'subagent_tool_start': {
        const subAgent = ds.activeSubagents.get(event.toolCallId);
        if (subAgent) {
          subAgent.toolCalls.push({ name: event.subToolName, isError: false });
        }
        break;
      }

      case 'subagent_tool_end': {
        const subTool = ds.activeSubagents.get(event.toolCallId);
        if (subTool) {
          const tc = subTool.toolCalls.find(t => t.name === event.subToolName && !t.isError);
          if (tc) {
            tc.isError = event.isError;
          }
        }
        break;
      }

      case 'subagent_end': {
        const endedSub = ds.activeSubagents.get(event.toolCallId);
        if (endedSub) {
          endedSub.status = event.isError ? 'error' : 'completed';
          endedSub.durationMs = event.durationMs;
          endedSub.result = event.result;
        }
        break;
      }

      // ── Observational Memory ───────────────────────────────────────────
      case 'om_status': {
        const w = event.windows;
        ds.omProgress.pendingTokens = w.active.messages.tokens;
        ds.omProgress.threshold = w.active.messages.threshold;
        ds.omProgress.thresholdPercent =
          w.active.messages.threshold > 0 ? (w.active.messages.tokens / w.active.messages.threshold) * 100 : 0;
        ds.omProgress.observationTokens = w.active.observations.tokens;
        ds.omProgress.reflectionThreshold = w.active.observations.threshold;
        ds.omProgress.reflectionThresholdPercent =
          w.active.observations.threshold > 0
            ? (w.active.observations.tokens / w.active.observations.threshold) * 100
            : 0;
        ds.omProgress.buffered = {
          observations: { ...w.buffered.observations },
          reflection: { ...w.buffered.reflection },
        };
        ds.omProgress.generationCount = event.generationCount;
        ds.omProgress.stepNumber = event.stepNumber;
        // Drive buffering animation flags from status fields
        ds.bufferingMessages = w.buffered.observations.status === 'running';
        ds.bufferingObservations = w.buffered.reflection.status === 'running';
        break;
      }

      case 'om_observation_start':
        ds.omProgress.status = 'observing';
        ds.omProgress.cycleId = event.cycleId;
        ds.omProgress.startTime = Date.now();
        break;

      case 'om_observation_end':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        ds.omProgress.observationTokens = event.observationTokens;
        // Messages have been observed — reset pending tokens
        ds.omProgress.pendingTokens = 0;
        ds.omProgress.thresholdPercent = 0;
        break;

      case 'om_observation_failed':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        break;

      case 'om_reflection_start':
        ds.omProgress.status = 'reflecting';
        ds.omProgress.cycleId = event.cycleId;
        ds.omProgress.startTime = Date.now();
        ds.omProgress.preReflectionTokens = ds.omProgress.observationTokens;
        ds.omProgress.observationTokens = event.tokensToReflect;
        ds.omProgress.reflectionThresholdPercent =
          ds.omProgress.reflectionThreshold > 0 ? (event.tokensToReflect / ds.omProgress.reflectionThreshold) * 100 : 0;
        break;

      case 'om_reflection_end':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        ds.omProgress.observationTokens = event.compressedTokens;
        ds.omProgress.reflectionThresholdPercent =
          ds.omProgress.reflectionThreshold > 0
            ? (event.compressedTokens / ds.omProgress.reflectionThreshold) * 100
            : 0;
        break;

      case 'om_reflection_failed':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        break;

      case 'om_buffering_start':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = true;
        } else {
          ds.bufferingObservations = true;
        }
        break;

      case 'om_buffering_end':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      case 'om_buffering_failed':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      case 'om_activation':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      // ── Token usage ────────────────────────────────────────────────────
      case 'usage_update':
        ds.tokenUsage = this.deps.getTokenUsage();
        break;

      // ── Tasks ──────────────────────────────────────────────────────────
      case 'task_updated':
        ds.previousTasks = [...ds.tasks];
        ds.tasks = event.tasks;
        break;

      // ── Follow-up queue ────────────────────────────────────────────────
      case 'follow_up_queued':
        ds.queuedFollowUps = event.count;
        break;

      // ── Thread lifecycle ───────────────────────────────────────────────
      case 'thread_changed':
        this.resetThread();
        ds.tokenUsage = this.deps.getTokenUsage();
        break;

      case 'thread_created':
        this.resetThread();
        ds.tokenUsage = createEmptyTokenUsage();
        break;

      case 'thread_deleted':
        if (!this.deps.getThreadId()) {
          this.resetThread();
          ds.tokenUsage = createEmptyTokenUsage();
        }
        break;

      // ── State changes (for OM threshold overrides) ──────────────────────
      case 'state_changed': {
        const keys = event.changedKeys;
        if (keys.includes('observationThreshold')) {
          const value = (event.state as Record<string, unknown>).observationThreshold;
          if (typeof value === 'number') {
            ds.omProgress.threshold = value;
            ds.omProgress.thresholdPercent = value > 0 ? (ds.omProgress.pendingTokens / value) * 100 : 0;
          }
        }
        if (keys.includes('reflectionThreshold')) {
          const value = (event.state as Record<string, unknown>).reflectionThreshold;
          if (typeof value === 'number') {
            ds.omProgress.reflectionThreshold = value;
            ds.omProgress.reflectionThresholdPercent = value > 0 ? (ds.omProgress.observationTokens / value) * 100 : 0;
          }
        }
        break;
      }

      default:
        break;
    }
  }
}

export class Session<TState = unknown> {
  /** Tool categories the user has granted "allow" for the lifetime of this session. */
  readonly #grantedCategories = new Set<string>();
  /** Individual tool names the user has granted "allow" for the lifetime of this session. */
  readonly #grantedTools = new Set<string>();
  /** Running token-usage tally for the active thread. */
  #tokenUsage: TokenUsage = createEmptyTokenUsage();
  /** Thread-settings persistence handle, injected by the Harness via {@link setStore}. */
  #store: ThreadSettingsStore | undefined;
  /** Resolves a tool name to its category, injected by the Harness via {@link setCategoryResolver} (the category map is Harness config). */
  #resolveCategory: ((toolName: string) => ToolCategory | null) | undefined;
  /** Resolves a subagent's display name from Harness config, injected via {@link setSubagentNameResolver}. */
  #resolveSubagentName: ((agentType: string) => string | undefined) | undefined;
  /** The session's currently-selected model (source of truth) + per-mode memory. */
  readonly model = new SessionModel(() => this.#store);
  /** The session's currently-selected mode and switch sequence. */
  readonly mode = new SessionMode(() => this.#store, this.model);
  /** Transient run identity (run id, trace id, operation counter) for the active run. */
  readonly run = new SessionRun();
  /** Live subscription to the active thread's agent event stream. */
  readonly stream = new SessionStream();
  /** Tool calls parked awaiting a resume (the resume data, keyed by toolCallId). */
  readonly suspensions = new SessionSuspensions();
  /** Messages queued to send after the active run finishes. */
  readonly followUps = new SessionFollowUps();
  /** The interactive tool-approval gate the current run parks on. */
  readonly approval = new SessionApproval();
  /** The session's identity: the memory resourceId it reads/writes under. */
  readonly identity: SessionIdentity;
  /** The session's thread domain: current binding + reads scoped to it. */
  readonly thread: SessionThread;
  /** The canonical display state a UI renders, plus the reducer that maintains it. */
  readonly displayState: SessionDisplayState;
  /** The session-owned Harness state domain. */
  readonly state: HarnessRequestState<TState>;

  constructor({ resourceId, state }: { resourceId: string; state?: SessionStateOptions<TState> }) {
    this.identity = new SessionIdentity({ resourceId });
    this.thread = new SessionThread(() => this.identity.getResourceId());
    this.displayState = new SessionDisplayState({
      getTokenUsage: () => this.getTokenUsage(),
      getSubagentDisplayName: agentType => this.#resolveSubagentName?.(agentType),
      getThreadId: () => this.thread.getId(),
      clearFollowUps: () => this.followUps.clear(),
    });
    this.state = new SessionState(state ?? { initialState: {} as TState });
  }

  /**
   * Attach the thread-settings store the Session persists mode/model through.
   * The Harness calls this once storage is available; without it, mode/model
   * state lives purely in memory.
   */
  setStore(store: ThreadSettingsStore | undefined): void {
    this.#store = store;
  }

  /**
   * Attach the tool→category resolver used when a user picks "always allow
   * category". The category map is Harness config, so the Harness injects this
   * once; without it, an "always_allow_category" decision simply approves.
   */
  setCategoryResolver(resolveCategory: (toolName: string) => ToolCategory | null): void {
    this.#resolveCategory = resolveCategory;
  }

  /**
   * Attach the subagent display-name resolver the display-state reducer uses to
   * label active subagents. The subagent catalog is Harness config, so the
   * Harness injects this once; without it, subagents render without a name.
   */
  setSubagentNameResolver(resolveSubagentName: (agentType: string) => string | undefined): void {
    this.#resolveSubagentName = resolveSubagentName;
  }

  /**
   * The id of the run currently active on this session: the live subscription's
   * active run id when it is streaming, falling back to the last run id the run
   * tracker observed. Null when the session is idle.
   */
  getCurrentRunId(): string | null {
    return this.stream.activeRunId() ?? this.run.getRunId();
  }

  /**
   * Abort the session's active run: drop any parked tool suspensions, abort the
   * live subscription's in-flight run, and mark the run as aborting so the
   * run-end path resolves its reason as 'aborted'.
   *
   * Dropping the parked suspensions matters because a run sitting in a tool
   * `suspend()` (e.g. `ask_user` / `request_access`) is not actively streaming,
   * so aborting the controller alone would leave it orphaned. The Harness still
   * clears its own display-state mirror of those suspensions separately.
   *
   * Releasing a parked tool-approval gate matters for the same reason: a run
   * awaiting `approval.arm()` is not streaming, so we resolve it as a decline so
   * the gated tool is rejected and the run can finalize rather than hang.
   */
  abortRun(): void {
    this.suspensions.clear();
    this.approval.cancel();
    this.stream.abort();
    this.run.requestAbort();
  }

  /**
   * Respond to the parked tool-approval gate with the user's decision. A no-op
   * when nothing is awaiting approval. "always_allow_category" grants the gated
   * tool's category for the rest of the session (resolved via the injected
   * {@link setCategoryResolver}) and then approves; "approve"/"decline" release
   * the run as-is.
   */
  respondToToolApproval({
    decision,
    requestContext,
  }: {
    decision: 'approve' | 'decline' | 'always_allow_category';
    requestContext?: RequestContext;
  }): void {
    this.approval.respond({
      decision,
      requestContext,
      onAlwaysAllow: toolName => {
        const category = this.#resolveCategory?.(toolName);
        if (category) this.grantCategory(category);
      },
    });
  }

  /** Grant a tool category "allow" for the remainder of the session. */
  grantCategory(category: ToolCategory): void {
    this.#grantedCategories.add(category);
  }

  /** Grant an individual tool "allow" for the remainder of the session. */
  grantTool(toolName: string): void {
    this.#grantedTools.add(toolName);
  }

  /** Whether the given tool category has been granted for the session. */
  hasCategoryGrant(category: ToolCategory): boolean {
    return this.#grantedCategories.has(category);
  }

  /** Whether the given tool has been granted for the session. */
  hasToolGrant(toolName: string): boolean {
    return this.#grantedTools.has(toolName);
  }

  /** Snapshot of all session-scoped grants. */
  getGrants(): { categories: ToolCategory[]; tools: string[] } {
    return {
      categories: [...this.#grantedCategories] as ToolCategory[],
      tools: [...this.#grantedTools],
    };
  }

  /** A copy of the running token-usage tally for the active thread. */
  getTokenUsage(): TokenUsage {
    return { ...this.#tokenUsage };
  }

  /**
   * Replace the running tally, e.g. when hydrating from persisted thread
   * metadata on thread switch.
   */
  setTokenUsage(usage: TokenUsage): void {
    this.#tokenUsage = { ...usage };
  }

  /** Reset the running tally to zero, e.g. on a new/empty thread. */
  resetTokenUsage(): void {
    this.#tokenUsage = createEmptyTokenUsage();
  }

  /** Fold a single step's usage into the running tally. */
  addUsage(stepUsage: TokenUsage): void {
    this.#tokenUsage.promptTokens += stepUsage.promptTokens;
    this.#tokenUsage.completionTokens += stepUsage.completionTokens;
    this.#tokenUsage.totalTokens += stepUsage.totalTokens;
    addOptionalUsageField(this.#tokenUsage, 'reasoningTokens', stepUsage.reasoningTokens);
    addOptionalUsageField(this.#tokenUsage, 'cachedInputTokens', stepUsage.cachedInputTokens);
    addOptionalUsageField(this.#tokenUsage, 'cacheCreationInputTokens', stepUsage.cacheCreationInputTokens);
    if (stepUsage.raw !== undefined) {
      this.#tokenUsage.raw = stepUsage.raw;
    }
  }
}
