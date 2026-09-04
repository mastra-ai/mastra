type RecordToTuple<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * Reserved key for setting resourceId from middleware.
 * When set in RequestContext, this takes precedence over client-provided values
 * for security (prevents attackers from hijacking another user's memory).
 *
 * @example
 * ```typescript
 * // In your auth middleware:
 * const requestContext = c.get('requestContext');
 * requestContext.set(MASTRA_RESOURCE_ID_KEY, authenticatedUser.id);
 * ```
 */
export const MASTRA_RESOURCE_ID_KEY = 'mastra__resourceId';

/**
 * Reserved key for setting threadId from middleware.
 * When set in RequestContext, this takes precedence over client-provided values
 * for security (prevents attackers from hijacking another user's memory).
 *
 * @example
 * ```typescript
 * // In your auth middleware:
 * const requestContext = c.get('requestContext');
 * requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
 * ```
 */
export const MASTRA_THREAD_ID_KEY = 'mastra__threadId';

/**
 * Reserved key for storing version overrides on RequestContext.
 * When set, sub-agent delegation resolves versioned agents from these overrides.
 *
 * @example
 * ```typescript
 * requestContext.set(MASTRA_VERSIONS_KEY, {
 *   agents: { 'researcher-agent': { versionId: '123' } },
 * });
 * ```
 */
export const MASTRA_VERSIONS_KEY = 'mastra__versions';

/**
 * Reserved key for storing the raw auth token from the incoming request.
 * Used by the editor to forward authentication when connecting to MCP servers
 * that require the same auth as the Mastra server itself.
 */
export const MASTRA_AUTH_TOKEN_KEY = 'mastra__authToken';

/**
 * Reserved key carrying a delegating agent's `MastraMemory` into a delegated
 * run, so a sub-agent without its own memory can persist that run's transcript
 * without the shared sub-agent instance being modified. The value is
 * `{ agentId, memory }` and only the named agent reads it.
 *
 * Holds a live class instance, so it is deliberately run-scoped: it is excluded
 * from the durable request-context snapshot and is not copied into further
 * nested delegated runs. Internal to delegation — do not set it yourself.
 */
export const MASTRA_INHERITED_MEMORY_KEY = 'mastra__inheritedMemory';

export type VersionSelector = { versionId: string } | { status: 'draft' | 'published' };

export type VersionOverrides = {
  agents?: Record<string, VersionSelector>;
  /** Fallback status for sub-agents (and future primitives) without an explicit entry. */
  defaultStatus?: 'draft' | 'published';
};

export function mergeVersionOverrides(
  base?: VersionOverrides,
  overrides?: VersionOverrides,
): VersionOverrides | undefined {
  if (!base && !overrides) return undefined;

  return {
    ...base,
    ...overrides,
    agents: {
      ...base?.agents,
      ...overrides?.agents,
    },
    // overrides.defaultStatus wins; fall back to base.defaultStatus
    ...(overrides?.defaultStatus
      ? { defaultStatus: overrides.defaultStatus }
      : base?.defaultStatus
        ? { defaultStatus: base.defaultStatus }
        : {}),
  };
}

/**
 * Marker thrown by `RequestContext.toJSON()` when it detects cyclic re-entry.
 *
 * Cyclic re-entry happens when a stored value transitively references another
 * `RequestContext` whose `toJSON()` is already on the call stack. `JSON.stringify`
 * inside `isSerializable` then walks into that context, V8 invokes its
 * `toJSON()`, which iterates its registry and calls `JSON.stringify` on values
 * that may walk back through the first context — and so on. Each step is a
 * fresh `JSON.stringify` call with a fresh internal cycle stack, so V8's
 * built-in cycle detection never trips and the recursion would pin one CPU
 * core at 100% indefinitely.
 *
 * The fix: throw this marker on reentry. The marker propagates upward through
 * `isSerializable`'s nested catches (which re-throw it) until it reaches the
 * outermost `toJSON()`'s `isSerializable` — there it is swallowed and the
 * offending key is filtered, the same way in-value circular references are
 * filtered today.
 */
class CyclicRequestContextToJSONError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CyclicRequestContextToJSONError';
  }
}

/**
 * Tracks `RequestContext` instances whose `toJSON()` is currently on the call
 * stack. Used to detect cyclic re-entry. Stored as a `WeakSet` so entries are
 * garbage-collected with their owning context.
 */
const _toJSONInProgress = new WeakSet<RequestContext<any>>();

/**
 * Nesting depth of active `toJSON()` calls. The outermost call (depth === 1
 * after entry) catches the cyclic marker error and filters the offending
 * value; inner calls re-throw so the marker propagates to the outermost.
 */
let _toJSONDepth = 0;

/**
 * Maximum number of nodes the `isSerializable` probe lets `JSON.stringify`
 * visit for a single stored value.
 *
 * `JSON.stringify` expands shared (non-circular) references once per path,
 * not once per object: an acyclic graph where every level shares one child
 * (`{ a: n, b: n }` nested `d` times) holds `d + 1` heap objects but expands
 * to `2^d` visited nodes. Around `2^26` the output also exceeds V8's string
 * length cap and stringify throws `RangeError` — but only after doing the
 * traversal work, which keeps doubling past the cap. Unbounded, a ~30-object
 * value can block the event loop for minutes and then be silently filtered.
 *
 * The budget counts node *visits* (shared references count once per path)
 * because that is exactly the work any real downstream serialization of the
 * value would do — a value that fails the budget would also be pathological
 * to persist. 1M visits keeps the worst-case probe in the tens of
 * milliseconds while remaining far above any reasonable context value.
 *
 * The budget is shared across nested `RequestContext` probes within one
 * outermost probe (see `_probeBudgetRemaining`), so a shared-reference graph of
 * nested contexts is bounded too. One caveat remains: `Buffer.prototype.toJSON`
 * materializes a `{ type, data }` object before the replacer, so Buffers charge
 * one budget unit per byte rather than the arithmetic typed-array fast path — a
 * Buffer past the budget is filtered.
 */
const SERIALIZATION_PROBE_BUDGET = 1_000_000;

/**
 * The intrinsic `%TypedArray%.prototype.length` getter. Reads the element
 * count from internal slots, so it cannot be shadowed by an own `length`
 * property, works across realms, and throws `TypeError` for `DataView` —
 * which makes it double as the discriminator between typed arrays (intrinsic
 * indexed elements) and other `ArrayBuffer` views (plain-object semantics).
 */
const _typedArrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Int8Array.prototype), 'length')!.get!;

/**
 * Whether a value is a plain object (prototype `Object.prototype` or `null`)
 * or an array — i.e. structural data safe to hand to the span serializer to
 * walk. Class instances, functions, `Map`/`Set`, `Date`, etc. are excluded so
 * their internals aren't walked into traces.
 */
function isPlainObjectOrArray(value: unknown): boolean {
  try {
    if (Array.isArray(value)) return true;
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    // Some exotic values throw on classification — e.g. a revoked Proxy makes
    // Array.isArray/getPrototypeOf throw TypeError. Treat them as non-plain so
    // serializeForSpan collapses them to a type marker instead of throwing.
    return false;
  }
}

/**
 * Shared state for the serialization probe budget.
 *
 * The budget is drawn down by every `isSerializable` probe running within one
 * outermost probe — including the probes a nested `RequestContext.toJSON()`
 * runs, which `JSON.stringify` invokes *before* the outer replacer sees the
 * result. Sharing one budget across them keeps the probe's time bound holding
 * regardless of nesting; a fresh per-call budget (the earlier approach) let a
 * shared-reference graph of nested contexts re-run full-budget probes on every
 * visit and block for seconds. `_probeBudgetActive` marks that an outermost
 * probe owns the budget so nested probes draw down rather than reset it.
 */
let _probeBudgetActive = false;
let _probeBudgetRemaining = 0;

export class RequestContext<Values extends Record<string, any> | unknown = unknown> {
  private registry = new Map<string, unknown>();

  constructor(
    iterable?: Values extends Record<string, any>
      ? RecordToTuple<Partial<Values>>
      : Iterable<readonly [string, unknown]>,
  ) {
    if (iterable && typeof iterable === 'object' && typeof (iterable as any)[Symbol.iterator] !== 'function') {
      this.registry = new Map(Object.entries(iterable));
    } else {
      this.registry = new Map(iterable);
    }
  }

  /**
   * set a value with strict typing if `Values` is a Record and the key exists in it.
   *
   * Declared schema keys stay strictly typed. For runtime-only keys that are not part of
   * `Values` (for example reserved middleware keys), use {@link setRaw}.
   */
  public set<K extends (Values extends Record<string, any> ? keyof Values : string)>(
    key: K,
    value: Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : never) : unknown,
  ): void {
    // The type assertion `key as string` is safe because K always extends string ultimately.
    this.registry.set(key as string, value);
  }

  /**
   * Set a runtime-only key that is not part of the declared `Values` schema.
   *
   * The runtime store is an open map: schema validation checks declared keys and
   * passes undeclared keys through. Use this when writing infrastructure keys
   * (for example `mastra__resourceId`) or other values that intentionally omit
   * from `requestContextSchema`.
   */
  public setRaw(key: string, value: unknown): void {
    this.registry.set(key, value);
  }

  /**
   * Get a value with its type
   *
   * Declared schema keys stay strictly typed. For runtime-only keys that are not part of
   * `Values` (for example reserved middleware keys), use {@link getRaw}.
   */
  public get<
    K extends (Values extends Record<string, any> ? keyof Values : string),
    R = Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : never) : unknown,
  >(key: K): R {
    return this.registry.get(key as string) as R;
  }

  /**
   * Get a runtime-only key that is not part of the declared `Values` schema.
   *
   * Returns `unknown` because the schema does not describe these keys — narrow
   * the result at the call site.
   */
  public getRaw(key: string): unknown {
    return this.registry.get(key);
  }

  /**
   * Check if a key exists in the container
   *
   * Declared schema keys stay strictly typed. For runtime-only keys, use {@link hasRaw}.
   */
  public has<K extends (Values extends Record<string, any> ? keyof Values : string)>(key: K): boolean {
    return this.registry.has(key);
  }

  /**
   * Check whether a runtime-only key exists in the open map.
   */
  public hasRaw(key: string): boolean {
    return this.registry.has(key);
  }

  /**
   * Delete a value by key
   *
   * Declared schema keys stay strictly typed. For runtime-only keys, use {@link deleteRaw}.
   */
  public delete<K extends (Values extends Record<string, any> ? keyof Values : string)>(key: K): boolean {
    return this.registry.delete(key);
  }

  /**
   * Delete a runtime-only key from the open map.
   */
  public deleteRaw(key: string): boolean {
    return this.registry.delete(key);
  }

  /**
   * Clear all values from the container
   */
  public clear(): void {
    this.registry.clear();
  }

  /**
   * Get all keys in the container
   */
  public keys(): IterableIterator<Values extends Record<string, any> ? keyof Values : string> {
    return this.registry.keys() as IterableIterator<Values extends Record<string, any> ? keyof Values : string>;
  }

  /**
   * Get all values in the container
   */
  public values(): IterableIterator<Values extends Record<string, any> ? Values[keyof Values] : unknown> {
    return this.registry.values() as IterableIterator<
      Values extends Record<string, any> ? Values[keyof Values] : unknown
    >;
  }

  /**
   * Get all entries in the container.
   * Returns a discriminated union of tuples for proper type narrowing when iterating.
   */
  public entries(): IterableIterator<
    Values extends Record<string, any> ? { [K in keyof Values]: [K, Values[K]] }[keyof Values] : [string, unknown]
  > {
    return this.registry.entries() as IterableIterator<
      Values extends Record<string, any> ? { [K in keyof Values]: [K, Values[K]] }[keyof Values] : [string, unknown]
    >;
  }

  /**
   * Get the size of the container
   */
  public size(): number {
    return this.registry.size;
  }

  /**
   * Execute a function for each entry in the container.
   * The callback receives properly typed key-value pairs.
   */
  public forEach<K extends (Values extends Record<string, any> ? keyof Values : string)>(
    callbackfn: (
      value: Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : unknown) : unknown,
      key: K,
      map: Map<string, unknown>,
    ) => void,
  ): void {
    this.registry.forEach(callbackfn as (value: unknown, key: string, map: Map<string, unknown>) => void);
  }

  /**
   * Custom JSON serialization method.
   * Converts the internal Map to a plain object for proper JSON serialization.
   * Non-serializable values (functions, symbols, RPC proxies, in-value
   * circular references, and values whose serialization re-enters this
   * `toJSON` via cross-context back-references) are skipped to prevent
   * serialization errors when storing to database.
   *
   * Reentry safety: if a stored value's `isSerializable` probe re-enters
   * `toJSON()` on this same instance (through a chain of RequestContexts
   * holding references to each other), we throw `CyclicRequestContextToJSONError`.
   * Inner `isSerializable` calls re-throw the marker; the outermost
   * `isSerializable` swallows it and filters the offending key, the same
   * way it filters in-value circular references today.
   */
  public toJSON(): Record<string, any> {
    if (_toJSONInProgress.has(this)) {
      throw new CyclicRequestContextToJSONError(
        'RequestContext.toJSON: detected cyclic re-entry (a stored value transitively references this context)',
      );
    }
    _toJSONInProgress.add(this);
    _toJSONDepth++;
    try {
      const result: Record<string, any> = {};
      for (const [key, value] of this.registry.entries()) {
        if (this.isSerializable(value)) {
          result[key] = value;
        }
      }
      return result;
    } finally {
      _toJSONInProgress.delete(this);
      _toJSONDepth--;
    }
  }

  /**
   * Check if a value can be safely serialized to JSON.
   *
   * The probe is budgeted (see `SERIALIZATION_PROBE_BUDGET`): a value whose
   * serialization would visit an unbounded number of nodes — an acyclic
   * graph with layered shared references expands as 2^depth — is treated as
   * non-serializable and filtered instead of blocking the event loop for
   * the full expansion. The budget is shared across nested `RequestContext`
   * probes within one outermost probe (a nested `toJSON()` runs before the
   * replacer sees its result), so the bound holds even when the graph reaches
   * nested contexts through many shared paths.
   *
   * Re-throws `CyclicRequestContextToJSONError` when called from a nested
   * `toJSON()` (`_toJSONDepth > 1`), so the marker propagates up to the
   * outermost `toJSON()`'s `isSerializable`, which then swallows it and
   * filters the offending key. This is what lets the outermost call return
   * a clean JSON-safe dict for cross-context cycles.
   */
  private isSerializable(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'function') return false;
    if (typeof value === 'symbol') return false;
    if (typeof value !== 'object') return true;

    // The outermost probe owns the budget; nested probes (a nested
    // `RequestContext.toJSON()` invoked while this JSON.stringify runs) draw
    // down the same remaining budget instead of starting fresh, so total probe
    // time is bounded regardless of how many nested contexts the graph reaches.
    const outermostProbe = !_probeBudgetActive;
    if (outermostProbe) {
      _probeBudgetActive = true;
      _probeBudgetRemaining = SERIALIZATION_PROBE_BUDGET;
    }
    try {
      JSON.stringify(value, (_key, probed) => {
        if (--_probeBudgetRemaining < 0) {
          throw new RangeError('RequestContext.isSerializable: value expands past the serialization probe budget');
        }
        // Typed arrays serialize one element per index; charge them against
        // the budget arithmetically instead of materializing every element
        // through the replacer.
        if (ArrayBuffer.isView(probed)) {
          // The fast path is only sound for typed arrays, whose index-shaped
          // own keys are always intrinsic elements (out-of-bounds index
          // definition throws). `DataView` has no intrinsic elements — an
          // index-named own property on one is ordinary data that a real
          // serialization walks — so it must pass through with plain-object
          // semantics. The intrinsic length getter discriminates: it throws
          // for anything without typed-array internal slots.
          let elementCount: number;
          try {
            elementCount = _typedArrayLength.call(probed) as number;
          } catch {
            return probed;
          }
          // Detect BigInt element types by reading element 0 — integer-indexed
          // access on a typed array is unspoofable and realm-independent,
          // unlike `instanceof` (fails cross-realm) or the brand tag (an own
          // `Symbol.toStringTag` shadows it). Pass BigInt views through so the
          // engine still throws TypeError on their elements, matching the
          // unbudgeted probe's verdict. (An empty BigInt view has no elements
          // to throw on and stringifies to '{}' either way.)
          if (typeof (probed as unknown as ArrayLike<unknown>)[0] === 'bigint') {
            return probed;
          }
          // Charge the intrinsic element count — an own `length` data
          // property can shadow the prototype getter and lie.
          _probeBudgetRemaining -= elementCount;
          if (_probeBudgetRemaining < 0) {
            throw new RangeError('RequestContext.isSerializable: value expands past the serialization probe budget');
          }
          // Preserve probe semantics for non-index own enumerable properties
          // (a getter that throws, or a value that leads back into a cycle,
          // must still fail the probe the way it fails a real serialization):
          // stand in a surrogate carrying only those properties. Reading a
          // throwing getter here propagates into the catch below, exactly as
          // the engine's own property read would have. Null prototype so an
          // own enumerable `__proto__` key copies as data instead of hitting
          // the inherited setter.
          const surrogate: Record<string, unknown> = Object.create(null);
          for (const key of Object.keys(probed)) {
            const index = Number(key);
            if (!(Number.isInteger(index) && index >= 0 && String(index) === key)) {
              surrogate[key] = (probed as unknown as Record<string, unknown>)[key];
            }
          }
          return surrogate;
        }
        return probed;
      });
      return true;
    } catch (e) {
      if (e instanceof CyclicRequestContextToJSONError && _toJSONDepth > 1) {
        throw e;
      }
      return false;
    } finally {
      if (outermostProbe) {
        _probeBudgetActive = false;
      }
    }
  }

  /**
   * Custom span serialization. Exposes the registry *entries* (never the
   * instance's own private fields) so `deepClean` in `@mastra/observability`
   * doesn't walk the runtime-enumerable `registry` Map — which would
   * serialize its raw entries (including bearer tokens) into exported spans.
   *
   * Per stored value:
   * - The framework-managed auth token is redacted by key.
   * - Primitives are returned as-is.
   * - Plain objects and arrays are returned by reference so the downstream
   *   `deepClean` walks and bounds them — this keeps nested request-context
   *   data visible in traces instead of collapsing it to `[object]`.
   * - Every other type (class instances, functions, Map/Set, Date, etc.) is
   *   collapsed to `[${typeof value}]` rather than walked, so a class's
   *   internals never reach the trace serializer.
   *
   * The plain objects/arrays passed through here MUST still be bounded by a
   * downstream `deepClean` before export.
   */
  serializeForSpan(): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const [key, value] of this.registry.entries()) {
      if (key === MASTRA_AUTH_TOKEN_KEY) {
        safe[key] = '[REDACTED]';
      } else if (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        safe[key] = value;
      } else if (isPlainObjectOrArray(value)) {
        safe[key] = value;
      } else {
        safe[key] = `[${typeof value}]`;
      }
    }
    return safe;
  }

  /**
   * Get all values as a typed object for destructuring.
   * Returns Record<string, any> when untyped, or the Values type when typed.
   *
   * @example
   * ```typescript
   * const ctx = new RequestContext<{ userId: string; apiKey: string }>();
   * ctx.set('userId', 'user-123');
   * ctx.set('apiKey', 'key-456');
   * const { userId, apiKey } = ctx.all;
   * ```
   */
  public get all(): Values extends Record<string, any> ? Values : Record<string, any> {
    return Object.fromEntries(this.registry) as Values extends Record<string, any> ? Values : Record<string, any>;
  }
}
