import type { ProcessInputStepArgs } from '../index';

/**
 * Context handed to a {@link LoadedToolStore} on every operation.
 */
export interface LoadedToolStoreContext {
  /** Thread ID from the request context, or undefined when no thread is active. */
  threadId: string | undefined;
  /**
   * The current processInputStep arguments (exposes messages, requestContext, etc).
   * May be undefined on resume paths that resolve loaded state without a live step.
   */
  args?: ProcessInputStepArgs;
}

/**
 * Backend abstraction for tracking which tools are "loaded" for a conversation.
 *
 * Two implementations ship with Mastra:
 * - {@link LegacyMapLoadedToolStore} (default) keeps loaded state in an in-memory
 *   map with TTL cleanup. This preserves the original processor behavior.
 * - {@link ContextLoadedToolStore} ('context' mode, opt-in) derives loaded state
 *   from the conversation messages. Restart-safe, requires no memory, and de-loads
 *   automatically when a result block is no longer present in the messages — parity
 *   with native provider tool-search.
 */
export interface LoadedToolStore {
  /** Resolve the set of currently-loaded tool names for this context. */
  getLoadedNames(ctx: LoadedToolStoreContext): Promise<Set<string>> | Set<string>;
  /** Record one or more tool names as loaded. */
  addLoaded(names: string[], ctx: LoadedToolStoreContext): Promise<void> | void;
}

/**
 * Reads the structured `result` of a `search_tools` / `load_tool` tool-invocation
 * part and returns the tool names it activated.
 *
 * - `search_tools` (autoLoad) results carry `results: [{ name }]`.
 * - `load_tool` results carry `loaded: string[]`.
 */
function extractActivatedNames(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const names: string[] = [];

  const maybeResults = (result as { results?: unknown }).results;
  if (Array.isArray(maybeResults)) {
    for (const entry of maybeResults) {
      const name = (entry as { name?: unknown })?.name;
      if (typeof name === 'string') names.push(name);
    }
  }

  const maybeLoaded = (result as { loaded?: unknown }).loaded;
  if (Array.isArray(maybeLoaded)) {
    for (const name of maybeLoaded) {
      if (typeof name === 'string') names.push(name);
    }
  }

  return names;
}

/**
 * Scans conversation messages for completed `search_tools` / `load_tool` invocations
 * and unions the tool names they activated.
 */
export function deriveLoadedNamesFromMessages(args: ProcessInputStepArgs): Set<string> {
  const loaded = new Set<string>();

  if (!Array.isArray(args.messages)) return loaded;

  for (const message of args.messages) {
    const parts = message.content?.parts;
    if (!parts) continue;

    for (const part of parts) {
      if (part.type !== 'tool-invocation') continue;
      const invocation = part.toolInvocation;
      if (!invocation) continue;
      if (invocation.toolName !== 'search_tools' && invocation.toolName !== 'load_tool') continue;
      if (invocation.state !== 'result') continue;

      for (const name of extractActivatedNames(invocation.result)) {
        loaded.add(name);
      }
    }
  }

  return loaded;
}

/**
 * 'context' mode store. The conversation messages are the source of truth — a tool
 * is loaded iff a `search_tools`/`load_tool` result naming it is still present in
 * `args.messages`.
 *
 * A small same-process supplemental set (keyed by real thread ID) bridges the gap
 * between a tool being activated during `execute` and that result becoming visible
 * in the messages on the next step. It is only ever additive to the message-derived
 * set and is never the durable record, so:
 *
 * - Restart-safe: after a restart the messages alone still yield the loaded set.
 * - De-loads automatically when the result block leaves the messages (native parity):
 *   the supplemental set is intersected with what the messages can still confirm
 *   once messages are available.
 * - No `'default'` thread-ID leak: the supplemental set is keyed by real thread IDs
 *   only and is never populated for anonymous requests.
 * - Requires no memory configuration.
 */
export class ContextLoadedToolStore implements LoadedToolStore {
  /** Same-process supplemental set, keyed by real thread ID. Additive only. */
  private supplemental = new Map<string, Set<string>>();

  getLoadedNames(ctx: LoadedToolStoreContext): Set<string> {
    const fromMessages = ctx.args ? deriveLoadedNamesFromMessages(ctx.args) : new Set<string>();

    if (!ctx.threadId) return fromMessages;

    const supplemental = this.supplemental.get(ctx.threadId);
    if (!supplemental || supplemental.size === 0) return fromMessages;

    // Once a name appears in the messages it becomes message-owned, so prune it from
    // the supplemental set. This hands de-loading back to the messages (native
    // parity): an evicted block disappears from the messages and is no longer
    // shadowed by the supplemental set. Names not yet visible (just activated) stay
    // in the supplemental set until the messages catch up.
    if (ctx.args) {
      for (const name of [...supplemental]) {
        if (fromMessages.has(name)) supplemental.delete(name);
      }
    }

    return new Set([...fromMessages, ...supplemental]);
  }

  addLoaded(names: string[], ctx: LoadedToolStoreContext): void {
    if (names.length === 0 || !ctx.threadId) return;
    let set = this.supplemental.get(ctx.threadId);
    if (!set) {
      set = new Set();
      this.supplemental.set(ctx.threadId, set);
    }
    for (const name of names) set.add(name);
  }
}

/**
 * Thread state with timestamp for TTL management.
 */
interface LegacyThreadState {
  tools: Set<string>;
  lastAccessed: number;
}

interface LegacyMapLoadedToolStoreOptions {
  /**
   * Time-to-live for thread state in milliseconds. After this duration of
   * inactivity, thread state is eligible for cleanup. Set to 0 to disable.
   * @default 3600000 (1 hour)
   */
  ttl?: number;
}

/**
 * Legacy default store. Keeps loaded-tool state in an in-memory
 * `Map<threadId, { tools, lastAccessed }>` with TTL-based cleanup.
 *
 * This reproduces the original ToolSearchProcessor behavior exactly, including the
 * `'default'` thread-ID fallback used when no thread is active. It is the default
 * backend so existing behavior is unchanged; the context store is opt-in via the
 * processor's `storage` option.
 *
 * Known limitations (inherent to the in-memory map, fixed by the context store):
 * - State is lost on process restart.
 * - Anonymous requests (no thread ID) share the `'default'` entry.
 */
export class LegacyMapLoadedToolStore implements LoadedToolStore {
  private ttl: number;
  private threadLoadedTools = new Map<string, LegacyThreadState>();
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(options: LegacyMapLoadedToolStoreOptions = {}) {
    this.ttl = options.ttl ?? 3_600_000;
    if (this.ttl > 0) {
      this.scheduleCleanup();
    }
  }

  private resolveThreadId(ctx: LoadedToolStoreContext): string {
    return ctx.threadId || 'default';
  }

  private getState(threadId: string): LegacyThreadState {
    let state = this.threadLoadedTools.get(threadId);
    if (!state) {
      state = { tools: new Set(), lastAccessed: Date.now() };
      this.threadLoadedTools.set(threadId, state);
    }
    state.lastAccessed = Date.now();
    return state;
  }

  getLoadedNames(ctx: LoadedToolStoreContext): Set<string> {
    return new Set(this.getState(this.resolveThreadId(ctx)).tools);
  }

  addLoaded(names: string[], ctx: LoadedToolStoreContext): void {
    if (names.length === 0) return;
    const state = this.getState(this.resolveThreadId(ctx));
    for (const name of names) state.tools.add(name);
  }

  clearState(threadId: string = 'default'): void {
    this.threadLoadedTools.delete(threadId);
  }

  clearAllState(): void {
    this.threadLoadedTools.clear();
  }

  cleanupStaleState(): number {
    if (this.ttl <= 0) return 0;
    const now = Date.now();
    let cleaned = 0;
    for (const [threadId, state] of this.threadLoadedTools.entries()) {
      if (now - state.lastAccessed > this.ttl) {
        this.threadLoadedTools.delete(threadId);
        cleaned++;
      }
    }
    return cleaned;
  }

  getStateStats(): { threadCount: number; oldestAccessTime: number | null } {
    if (this.threadLoadedTools.size === 0) {
      return { threadCount: 0, oldestAccessTime: null };
    }
    let oldest = Date.now();
    for (const state of this.threadLoadedTools.values()) {
      if (state.lastAccessed < oldest) oldest = state.lastAccessed;
    }
    return { threadCount: this.threadLoadedTools.size, oldestAccessTime: oldest };
  }

  private scheduleCleanup(): void {
    const cleanupInterval = Math.max(this.ttl / 2, 60_000);
    this.intervalId = setInterval(() => {
      this.cleanupStaleState();
    }, cleanupInterval);
    this.intervalId.unref?.();
  }
}
