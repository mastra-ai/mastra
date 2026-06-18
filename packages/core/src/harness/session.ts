import type { Agent } from '../agent';
import type { AgentThreadSubscription } from '../agent/types';
import { createEmptyTokenUsage } from './types';
import type { TokenUsage, ToolCategory } from './types';

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

  constructor(store: () => ThreadSettingsStore | undefined, model: SessionModel) {
    this.#store = store;
    this.#model = model;
  }

  /** The currently-selected mode id. */
  get(): string {
    return this.#id;
  }

  /** Set the currently-selected mode id (on default resolution or hydration). */
  set({ modeId }: { modeId: string }): void {
    this.#id = modeId;
  }

  /**
   * Switch to `modeId`, coordinating the selected model and persistence.
   *
   * The Harness handles aborting in-flight work and emitting events; this owns
   * the version-guarded sequence: remember the outgoing mode's model, persist
   * the new mode, then resolve and apply the incoming mode's model. A newer
   * switch starting mid-flight supersedes this one, which then bails.
   *
   * Returns the resolved model id for the new mode (or null), so the caller can
   * emit `model_changed` after applying it.
   */
  async switch({
    modeId,
    defaultModelId,
  }: {
    modeId: string;
    defaultModelId?: string;
  }): Promise<{ modelId: string | null }> {
    const previousModeId = this.#id;
    const previousModelId = this.#model.get();
    const version = ++this.#switchVersion;
    this.#id = modeId;

    // Remember the outgoing mode's model before moving on.
    if (previousModelId) {
      await this.#model.saveForMode({ modeId: previousModeId, modelId: previousModelId });
    }
    if (this.#switchVersion !== version) return { modelId: null };

    await this.#store()?.set(MODE_ID_KEY, modeId);
    if (this.#switchVersion !== version) return { modelId: null };

    const modelId = await this.#model.resolveForMode({ modeId, defaultModelId });
    if (this.#switchVersion !== version) return { modelId: null };
    if (modelId) {
      this.#model.set({ modelId });
    }
    return { modelId };
  }
}

/**
 * A Harness session owns the per-conversation runtime state that today lives
 * flattened on the {@link Harness} instance. This class is the seam we extract
 * that state into, one concern at a time, so the Harness can eventually own a
 * `Session` rather than the state itself.
 *
 * Currently owns:
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
 *
 * It also exposes a couple of accessors that compose `run` and `stream`:
 * {@link getCurrentRunId} (the active run id, preferring the live subscription)
 * and {@link abortRun} (abort the live run and mark it aborting).
 *
 * Mode/model persistence is thread-scoped, so the Session writes through a
 * {@link ThreadSettingsStore} the Harness backs with thread metadata; when no
 * storage is configured the store is absent and state stays in memory.
 */
export class Session {
  /** Tool categories the user has granted "allow" for the lifetime of this session. */
  readonly #grantedCategories = new Set<string>();
  /** Individual tool names the user has granted "allow" for the lifetime of this session. */
  readonly #grantedTools = new Set<string>();
  /** Running token-usage tally for the active thread. */
  #tokenUsage: TokenUsage = createEmptyTokenUsage();
  /** Thread-settings persistence handle, injected by the Harness via {@link setStore}. */
  #store: ThreadSettingsStore | undefined;
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

  /**
   * Attach the thread-settings store the Session persists mode/model through.
   * The Harness calls this once storage is available; without it, mode/model
   * state lives purely in memory.
   */
  setStore(store: ThreadSettingsStore | undefined): void {
    this.#store = store;
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
   */
  abortRun(): void {
    this.suspensions.clear();
    this.stream.abort();
    this.run.requestAbort();
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
