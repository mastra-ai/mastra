/**
 * RunScope — per-run bag of *non-serializable* runtime state.
 *
 * The evented workflow engine routes step inputs/outputs through `JSON.stringify`
 * (storage snapshots, `UnixSocketPubSub` frames). Live class instances, function
 * closures, abort controllers, and stream transports cannot survive that round
 * trip even with the Phase 2 codec. RunScope keeps those values off the wire:
 * step factories read and write through a typed key-value bag keyed by `runId`
 * and held on the parent `Mastra` instance. Nothing in the scope is ever
 * persisted or published.
 *
 * Scopes are managed alongside the internal-workflow registry on `Mastra`
 * (see `__createRunScope` / `__deleteRunScope`) so they share the same TTL
 * sweep and explicit unregister hooks as the run-scoped workflow registrations
 * they back.
 *
 * Keys are branded symbols carrying their value type as a phantom parameter,
 * so `scope.get(SAVE_QUEUE_MANAGER)` returns `SaveQueueManager | undefined`
 * without any cast at the call site. Concrete key registries live next to the
 * consumers (see `loop/run-scope-keys.ts`, `agent/workflows/prepare-stream/
 * run-scope-keys.ts`) to avoid pulling domain types into the `mastra` layer.
 */

/**
 * A typed handle to a slot in a {@link RunScope}. The phantom `__t` parameter
 * carries the value type so `get` / `set` are inferred correctly without an
 * explicit type argument.
 */
export interface RunScopeKey<T> extends Symbol {
  /** Phantom marker — never read at runtime. */
  readonly __t?: T;
}

/**
 * Create a new {@link RunScopeKey}. Each call produces a fresh `Symbol`, so two
 * keys with the same label do not collide.
 */
export function createRunScopeKey<T>(label: string): RunScopeKey<T> {
  return Symbol(label) as RunScopeKey<T>;
}

export interface RunScope {
  get<T>(key: RunScopeKey<T>): T | undefined;
  /**
   * Read a required slot. Throws if missing — use this to make a missing
   * invariant fail loudly instead of producing a downstream `undefined`.
   */
  getOrThrow<T>(key: RunScopeKey<T>): T;
  set<T>(key: RunScopeKey<T>, value: T): void;
  delete<T>(key: RunScopeKey<T>): void;
  has<T>(key: RunScopeKey<T>): boolean;
  /** Test-only: number of slots currently populated. */
  readonly size: number;
}

class MapRunScope implements RunScope {
  readonly #slots = new Map<symbol, unknown>();

  get<T>(key: RunScopeKey<T>): T | undefined {
    return this.#slots.get(key as unknown as symbol) as T | undefined;
  }

  getOrThrow<T>(key: RunScopeKey<T>): T {
    const sym = key as unknown as symbol;
    if (!this.#slots.has(sym)) {
      throw new Error(`RunScope: missing required slot ${sym.toString()}`);
    }
    return this.#slots.get(sym) as T;
  }

  set<T>(key: RunScopeKey<T>, value: T): void {
    this.#slots.set(key as unknown as symbol, value);
  }

  delete<T>(key: RunScopeKey<T>): void {
    this.#slots.delete(key as unknown as symbol);
  }

  has<T>(key: RunScopeKey<T>): boolean {
    return this.#slots.has(key as unknown as symbol);
  }

  get size(): number {
    return this.#slots.size;
  }
}

export function createRunScope(): RunScope {
  return new MapRunScope();
}
