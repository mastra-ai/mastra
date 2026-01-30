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
 * Interface for RequestContext without generics.
 * This allows any RequestContext<T> to be assignable to IRequestContext,
 * avoiding TypeScript variance issues with generic type parameters.
 *
 * Use this interface in internal APIs that don't need the specific type,
 * while keeping RequestContext<T> for user-facing APIs that need type safety.
 */
export interface IRequestContext {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  keys(): IterableIterator<string>;
  values(): IterableIterator<unknown>;
  entries(): IterableIterator<[string, unknown]>;
  size(): number;
  forEach(callbackfn: (value: unknown, key: string, map: Map<string, unknown>) => void): void;
  toJSON(): Record<string, unknown>;
  readonly all: Record<string, unknown>;
}

/**
 * RequestContext provides a type-safe container for request-scoped data.
 * It can be typed with a specific schema for full type safety, or used untyped.
 *
 * The generic parameter is used for type inference in method overloads,
 * but the class itself implements IRequestContext to ensure all RequestContext
 * instances are structurally compatible regardless of their type parameter.
 *
 * @example Typed usage
 * ```typescript
 * type MyContext = { userId: string; apiKey: string };
 * const ctx = new RequestContext<MyContext>();
 * ctx.set('userId', 'user-123'); // Type-safe
 * const id = ctx.get('userId'); // Type: string
 * ```
 *
 * @example Untyped usage
 * ```typescript
 * const ctx = new RequestContext();
 * ctx.set('anything', 'value'); // Accepts any string key
 * const val = ctx.get('anything'); // Type: unknown
 * ```
 */
export class RequestContext<
  Values extends Record<string, unknown> = Record<string, unknown>,
> implements IRequestContext {
  private registry = new Map<string, unknown>();

  constructor(iterable?: RecordToTuple<Partial<Values>> | Iterable<readonly [string, unknown]>) {
    this.registry = new Map(iterable as Iterable<readonly [string, unknown]>);
  }

  /**
   * Set a value with strict typing when Values is defined.
   * Overloaded to also accept any string key for IRequestContext compatibility.
   */
  public set<K extends keyof Values & string>(key: K, value: Values[K]): void;
  public set(key: string, value: unknown): void;
  public set(key: string, value: unknown): void {
    this.registry.set(key, value);
  }

  /**
   * Get a value with its type when Values is defined.
   * Overloaded to also accept any string key for IRequestContext compatibility.
   */
  public get<K extends keyof Values & string>(key: K): Values[K];
  public get(key: string): unknown;
  public get(key: string): unknown {
    return this.registry.get(key);
  }

  /**
   * Check if a key exists in the container
   */
  public has<K extends keyof Values & string>(key: K): boolean;
  public has(key: string): boolean;
  public has(key: string): boolean {
    return this.registry.has(key);
  }

  /**
   * Delete a value by key
   */
  public delete<K extends keyof Values & string>(key: K): boolean;
  public delete(key: string): boolean;
  public delete(key: string): boolean {
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
  public keys(): IterableIterator<string> {
    return this.registry.keys();
  }

  /**
   * Get all values in the container
   */
  public values(): IterableIterator<unknown> {
    return this.registry.values();
  }

  /**
   * Get all entries in the container.
   */
  public entries(): IterableIterator<[string, unknown]> {
    return this.registry.entries();
  }

  /**
   * Get the size of the container
   */
  public size(): number {
    return this.registry.size;
  }

  /**
   * Execute a function for each entry in the container.
   */
  public forEach(callbackfn: (value: unknown, key: string, map: Map<string, unknown>) => void): void {
    this.registry.forEach(callbackfn);
  }

  /**
   * Custom JSON serialization method.
   * Converts the internal Map to a plain object for proper JSON serialization.
   * Non-serializable values (e.g., RPC proxies, functions, circular references)
   * are skipped to prevent serialization errors when storing to database.
   */
  public toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.registry.entries()) {
      if (this.isSerializable(value)) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Check if a value can be safely serialized to JSON.
   */
  private isSerializable(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'function') return false;
    if (typeof value === 'symbol') return false;
    if (typeof value !== 'object') return true;

    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all values as a typed object for destructuring.
   *
   * @example
   * ```typescript
   * const ctx = new RequestContext<{ userId: string; apiKey: string }>();
   * ctx.set('userId', 'user-123');
   * ctx.set('apiKey', 'key-456');
   * const { userId, apiKey } = ctx.all;
   * ```
   */
  public get all(): Values {
    return Object.fromEntries(this.registry) as Values;
  }
}
