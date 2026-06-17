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

  /**
   * Attach the thread-settings store the Session persists mode/model through.
   * The Harness calls this once storage is available; without it, mode/model
   * state lives purely in memory.
   */
  setStore(store: ThreadSettingsStore | undefined): void {
    this.#store = store;
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
