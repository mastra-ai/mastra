import { createEmptyTokenUsage } from './types';
import type { TokenUsage, ToolCategory } from './types';

/** Usage fields that are summed across steps when present on a step's usage. */
type OptionalUsageField = 'reasoningTokens' | 'cachedInputTokens' | 'cacheCreationInputTokens';

function addOptionalUsageField(usage: TokenUsage, key: OptionalUsageField, value: number | undefined): void {
  if (value !== undefined) {
    usage[key] = (usage[key] ?? 0) + value;
  }
}

/**
 * Owns the session's currently-selected mode id and the concurrency guard for
 * switching modes. The Harness still owns the mode *definitions*
 * (`config.modes`) and the persistence/hydration of the selected mode; this
 * only tracks which mode is active and coordinates overlapping switches.
 */
export class SessionMode {
  /** Id of the currently-selected mode. Empty until the Harness resolves its default mode. */
  #id = '';
  /**
   * Monotonically increasing counter bumped on each switch. An async
   * `switchMode` captures the version it began with and bails if a newer switch
   * has since superseded it.
   */
  #switchVersion = 0;

  /** The currently-selected mode id. */
  get(): string {
    return this.#id;
  }

  /** Set the currently-selected mode id (on default resolution or hydration). */
  set(modeId: string): void {
    this.#id = modeId;
  }

  /**
   * Begin a switch to `modeId`: set the mode and bump the switch version,
   * returning the version this switch owns. Use {@link isCurrentSwitch} after
   * each await to detect whether a newer switch has superseded this one.
   */
  beginSwitch(modeId: string): number {
    this.#id = modeId;
    return ++this.#switchVersion;
  }

  /** Whether `version` is still the latest switch (i.e. not superseded). */
  isCurrentSwitch(version: number): boolean {
    return this.#switchVersion === version;
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
 * - the currently-selected mode (`session.mode`) — the active mode id and the
 *   switch-version guard. The Harness still owns the mode *definitions*
 *   (`config.modes`) and the persistence/hydration of the selected mode.
 */
export class Session {
  /** Tool categories the user has granted "allow" for the lifetime of this session. */
  readonly #grantedCategories = new Set<string>();
  /** Individual tool names the user has granted "allow" for the lifetime of this session. */
  readonly #grantedTools = new Set<string>();
  /** Running token-usage tally for the active thread. */
  #tokenUsage: TokenUsage = createEmptyTokenUsage();
  /** The session's currently-selected mode and switch-concurrency guard. */
  readonly mode = new SessionMode();

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
