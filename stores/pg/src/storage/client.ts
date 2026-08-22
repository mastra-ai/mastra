import type { Pool, PoolClient, QueryResult } from 'pg';
import { connectWithClientErrorHandler } from '../shared/client-error-guard';
import type { SchemaSnapshot, SchemaSnapshotHost } from './db/schema-snapshot';

// Re-export pg types for consumers
export type { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Values array for parameterized queries.
 */
export type QueryValues = unknown[];

/**
 * Common interface for database clients.
 * PoolAdapter implements this interface by wrapping a pg.Pool.
 */
export interface DbClient {
  /**
   * The underlying connection pool.
   */
  readonly $pool: Pool;

  /**
   * Acquire a client from the pool for manual query execution.
   * Remember to call client.release() when done.
   */
  connect(): Promise<PoolClient>;

  /**
   * Execute a query that returns no data.
   * Use for INSERT, UPDATE, DELETE without RETURNING.
   */
  none(query: string, values?: QueryValues): Promise<null>;

  /**
   * Execute a query that returns exactly one row.
   * @throws Error if zero or more than one row is returned
   */
  one<T = any>(query: string, values?: QueryValues): Promise<T>;

  /**
   * Execute a query that returns zero or one row.
   * @returns The row, or null if no rows returned
   * @throws Error if more than one row is returned
   */
  oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null>;

  /**
   * Execute a query that returns any number of rows (including zero).
   * Alias for manyOrNone.
   */
  any<T = any>(query: string, values?: QueryValues): Promise<T[]>;

  /**
   * Execute a query that returns zero or more rows.
   */
  manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]>;

  /**
   * Execute a query that returns at least one row.
   * @throws Error if no rows are returned
   */
  many<T = any>(query: string, values?: QueryValues): Promise<T[]>;

  /**
   * Execute a raw query, returning the full result object.
   */
  query(query: string, values?: QueryValues): Promise<QueryResult>;

  /**
   * Execute a function within a transaction.
   * Automatically handles BEGIN, COMMIT, and ROLLBACK.
   */
  tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T>;
}

/**
 * Transaction client interface for executing queries within a transaction.
 */
export interface TxClient {
  none(query: string, values?: QueryValues): Promise<null>;
  one<T = any>(query: string, values?: QueryValues): Promise<T>;
  oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null>;
  any<T = any>(query: string, values?: QueryValues): Promise<T[]>;
  manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]>;
  many<T = any>(query: string, values?: QueryValues): Promise<T[]>;
  query(query: string, values?: QueryValues): Promise<QueryResult>;
  /**
   * Await multiple query promises. Prefer collecting results from
   * TransactionClient methods (which serialize onto one PoolClient);
   * do not start raw `client.query` calls concurrently.
   */
  batch<T>(promises: Promise<T>[]): Promise<T[]>;
}

/**
 * Truncate a query string for error messages.
 */
function truncateQuery(query: string, maxLength = 100): string {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength) + '...';
}

/**
 * Adapter that wraps a pg.Pool to implement DbClient.
 */
export class PoolAdapter implements DbClient {
  constructor(public readonly $pool: Pool) {}

  connect(): Promise<PoolClient> {
    return connectWithClientErrorHandler(this.$pool);
  }

  async none(query: string, values?: QueryValues): Promise<null> {
    await this.$pool.query(query, values);
    return null;
  }

  async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    const result = await this.$pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0] as T;
  }

  async oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    const result = await this.$pool.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0] as T;
  }

  async any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.$pool.query(query, values);
    return result.rows as T[];
  }

  async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  async many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.$pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    return result.rows as T[];
  }

  async query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.$pool.query(query, values);
  }

  async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    const client = await connectWithClientErrorHandler(this.$pool);
    try {
      await client.query('BEGIN');
      const txClient = new TransactionClient(client);
      try {
        const result = await callback(txClient);
        // Drain before COMMIT so fire-and-forget / batch tails can't race it.
        await txClient.drain();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        // Drain before ROLLBACK: Promise.all in batch() rejects on the first
        // failure while later enqueued queries may still be running. Preserve
        // the callback/drain error that caused this catch.
        await txClient.drain().catch(() => undefined);
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Log rollback failure but throw original error
          console.error('Transaction rollback failed:', rollbackError);
        }
        throw error;
      }
    } finally {
      client.release();
    }
  }
}

/**
 * Transaction client that wraps a PoolClient for executing queries within a transaction.
 *
 * Query methods are serialized through a tail promise (same pattern as
 * PinnedClientAdapter). Callers such as memory.updateMessages historically
 * did `queries.push(t.none(...))` then `await t.batch(queries)` — each
 * `t.none()` is async and starts `client.query` immediately, so by the time
 * batch runs, N queries are already in flight on one PoolClient. pg@8 queues
 * those internally and emits a DeprecationWarning; pg@9 will throw.
 * (#20820)
 */
class TransactionClient implements TxClient {
  /**
   * Serialization tail. Without this gate, concurrent t.none()/t.query()
   * from Promise.all / batch land on the same PoolClient at once.
   */
  #tail: Promise<void> = Promise.resolve();
  #error: { value: unknown } | undefined;

  constructor(private readonly client: PoolClient) {}

  #enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(fn);
    this.#tail = next.then(
      () => undefined,
      error => {
        this.#error ??= { value: error };
      },
    );
    return next;
  }

  /**
   * Wait until every enqueued query has settled and surface the first failure.
   * PoolAdapter / PinnedClientAdapter call this before COMMIT/ROLLBACK so
   * those control statements never overlap in-flight work on the same client.
   */
  async drain(): Promise<void> {
    await this.#tail;
    if (this.#error) {
      const { value } = this.#error;
      this.#error = undefined;
      throw value;
    }
  }

  none(query: string, values?: QueryValues): Promise<null> {
    return this.#enqueue(async () => {
      await this.client.query(query, values);
      return null;
    });
  }

  one<T = any>(query: string, values?: QueryValues): Promise<T> {
    return this.#enqueue(async () => {
      const result = await this.client.query(query, values);
      if (result.rows.length === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      if (result.rows.length > 1) {
        throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
      }
      return result.rows[0] as T;
    });
  }

  oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    return this.#enqueue(async () => {
      const result = await this.client.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      if (result.rows.length > 1) {
        throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
      }
      return result.rows[0] as T;
    });
  }

  any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.#enqueue(async () => {
      const result = await this.client.query(query, values);
      return result.rows as T[];
    });
  }

  manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.#enqueue(async () => {
      const result = await this.client.query(query, values);
      if (result.rows.length === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      return result.rows as T[];
    });
  }

  query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.#enqueue(() => this.client.query(query, values));
  }

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    // Promises are already enqueued (and thus serialized) by the query
    // methods above; awaiting them together is fine.
    return Promise.all(promises);
  }
}

/**
 * DbClient adapter that pins all queries to a single PoolClient.
 *
 * Used during PostgresStore.init() to funnel every domain's DDL through
 * one backend connection. This collapses ~200 per-statement pool checkouts
 * into a single connection acquisition, which:
 *   - removes connection-handshake RTT on remote/managed Postgres
 *   - makes the entire init look like one transaction to a transaction
 *     pooler (PgBouncer/Supabase), avoiding pooler-budget exhaustion
 *   - eliminates inter-statement lock contention by construction (a single
 *     backend serializes statements naturally)
 *
 * The wrapped client is the caller's responsibility to release.
 */
export class PinnedClientAdapter implements DbClient {
  /**
   * Serialization tail. Domain init() methods fire via Promise.all in
   * MastraCompositeStore.#runInit(), so without our own gate every domain's
   * query() lands on the same PoolClient concurrently. pg@8 queues those
   * internally and emits a deprecation warning; pg@9 will throw. Chaining
   * each new query off the previous one's settlement (success or failure)
   * gives us deterministic FIFO ordering at the adapter layer and removes
   * the reliance on pg's internal queue.
   */
  #tail: Promise<unknown> = Promise.resolve();

  constructor(
    public readonly $pool: Pool,
    private readonly pinnedClient: PoolClient,
  ) {}

  /**
   * Run `fn` after any previously enqueued work on this pinned client has
   * settled. Failures in earlier calls don't poison the queue — we always
   * resume on the next caller's turn.
   */
  #enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(fn, fn);
    // Swallow rejection on the chained tail so a failing call doesn't
    // leave an unhandled rejection on later enqueues.
    this.#tail = next.catch(() => undefined);
    return next;
  }

  connect(): Promise<PoolClient> {
    // No domain init() currently calls connect(), and silently falling
    // back to the pool would bypass pinning. Throw so a future code path
    // that adds a connect()-based init fails loud instead of silently
    // re-introducing the parallel-DDL fan-out we're trying to prevent.
    throw new Error(
      'PinnedClientAdapter.connect() is not supported during PostgresStore.init(). ' +
        'All DDL must flow through the pinned client.',
    );
  }

  none(query: string, values?: QueryValues): Promise<null> {
    return this.#enqueue(async () => {
      await this.pinnedClient.query(query, values);
      return null;
    });
  }

  one<T = any>(query: string, values?: QueryValues): Promise<T> {
    return this.#enqueue(async () => {
      const result = await this.pinnedClient.query(query, values);
      if (result.rows.length === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      if (result.rows.length > 1) {
        throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
      }
      return result.rows[0] as T;
    });
  }

  oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    return this.#enqueue(async () => {
      const result = await this.pinnedClient.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      if (result.rows.length > 1) {
        throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
      }
      return result.rows[0] as T;
    });
  }

  any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.#enqueue(async () => {
      const result = await this.pinnedClient.query(query, values);
      return result.rows as T[];
    });
  }

  manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.#enqueue(async () => {
      const result = await this.pinnedClient.query(query, values);
      if (result.rows.length === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      return result.rows as T[];
    });
  }

  query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.#enqueue(() => this.pinnedClient.query(query, values));
  }

  tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    // Enqueue the entire BEGIN/work/COMMIT block so concurrent callers
    // can't interleave statements inside someone else's transaction.
    return this.#enqueue(async () => {
      await this.pinnedClient.query('BEGIN');
      const txClient = new TransactionClient(this.pinnedClient);
      try {
        const result = await callback(txClient);
        await txClient.drain();
        await this.pinnedClient.query('COMMIT');
        return result;
      } catch (error) {
        await txClient.drain().catch(() => undefined);
        try {
          await this.pinnedClient.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
        throw error;
      }
    });
  }
}

/**
 * DbClient wrapper that routes to an alternate client when one is pinned.
 *
 * Most of the time this just forwards to the underlying PoolAdapter.
 * During PostgresStore.init() we temporarily pin a single-client adapter
 * so every domain's DDL flows through one backend connection.
 */
export class RoutingDbClient implements DbClient, SchemaSnapshotHost {
  #base: DbClient;
  #pinned: DbClient | null = null;
  #schemaSnapshot: SchemaSnapshot | null = null;

  constructor(base: DbClient) {
    this.#base = base;
  }

  /**
   * Catalog snapshot for the current init window, or `null` outside it.
   *
   * It lives here rather than on `PgDB` because every storage domain builds its
   * own `PgDB` over this one shared client — hanging the snapshot off the
   * client means one load serves all of them, and its lifetime lines up exactly
   * with the pinned-init window that `pin()`/`unpin()` already delimit.
   */
  get schemaSnapshot(): SchemaSnapshot | null {
    return this.#schemaSnapshot;
  }

  /** Install (or clear, with `null`) the init-window catalog snapshot. */
  setSchemaSnapshot(snapshot: SchemaSnapshot | null): void {
    this.#schemaSnapshot = snapshot;
  }

  /** Returns the currently active client (pinned if set, otherwise base). */
  private get active(): DbClient {
    return this.#pinned ?? this.#base;
  }

  /**
   * Pin a DbClient so all subsequent calls route through it until unpinned.
   * Throws if a client is already pinned to avoid silent overrides.
   */
  pin(client: DbClient): void {
    if (this.#pinned) {
      throw new Error('RoutingDbClient already has a pinned client');
    }
    this.#pinned = client;
  }

  unpin(): void {
    this.#pinned = null;
  }

  get $pool(): Pool {
    return this.#base.$pool;
  }

  connect(): Promise<PoolClient> {
    return this.active.connect();
  }

  none(query: string, values?: QueryValues): Promise<null> {
    return this.active.none(query, values);
  }

  one<T = any>(query: string, values?: QueryValues): Promise<T> {
    return this.active.one<T>(query, values);
  }

  oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    return this.active.oneOrNone<T>(query, values);
  }

  any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.active.any<T>(query, values);
  }

  manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.active.manyOrNone<T>(query, values);
  }

  many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.active.many<T>(query, values);
  }

  query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.active.query(query, values);
  }

  tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    return this.active.tx<T>(callback);
  }
}
