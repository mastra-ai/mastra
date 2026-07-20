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
   */
  public set<K extends (Values extends Record<string, any> ? keyof Values : string)>(
    key: K,
    value: Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : never) : unknown,
  ): void {
    // The type assertion `key as string` is safe because K always extends string ultimately.
    this.registry.set(key as string, value);
  }

  /**
   * Get a value with its type
   */
  public get<
    K extends (Values extends Record<string, any> ? keyof Values : string),
    R = Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : never) : unknown,
  >(key: K): R {
    return this.registry.get(key as string) as R;
  }

  /**
   * Check if a key exists in the container
   */
  public has<K extends (Values extends Record<string, any> ? keyof Values : string)>(key: K): boolean {
    return this.registry.has(key);
  }

  /**
   * Delete a value by key
   */
  public delete<K extends (Values extends Record<string, any> ? keyof Values : string)>(key: K): boolean {
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

    try {
      JSON.stringify(value);
      return true;
    } catch (e) {
      if (e instanceof CyclicRequestContextToJSONError && _toJSONDepth > 1) {
        throw e;
      }
      return false;
    }
  }

  /**
   * Custom span serialization to prevent leaking internal state (like auth
   * tokens stored in the private `registry` Map) into observability spans.
   *
   * `deepClean` in `@mastra/observability` calls this method before falling
   * back to `Object.keys()` — which would walk the runtime-enumerable
   * `registry` field and serialize its raw Map entries (including any
   * bearer tokens) into exported spans.
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
