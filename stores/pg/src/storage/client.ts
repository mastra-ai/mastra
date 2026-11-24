import type { Pool, PoolClient, QueryResult } from 'pg';
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
  tx<T>(callback: (t: TxClient) => Promise<T>, options?: TxOptions): Promise<T>;
}

/** @experimental */
export interface TxOptions {
  /**
   * Absolute time (epoch ms) by which the transaction's work must be done. It is checked before
   * BEGIN (after waiting for a pool connection, or for the pinned client's queue), before each
   * statement and again after setting that statement's timeouts, and before COMMIT. Each statement
   * runs with `statement_timeout` and `lock_timeout` set to the time left, so the server ends it
   * there. Not bounded: BEGIN, the `SET LOCAL` round trips, ROLLBACK, and COMMIT once sent. A
   * deadline therefore stops new work in time but can be overrun by those round trips; an expired
   * `pool.connect()` is abandoned and its late connection released.
   */
  deadlineAt?: number;
}

/** The transaction ran past its `deadlineAt` and was rolled back. Nothing in it was applied. */
export class TransactionDeadlineError extends Error {
  readonly retryable = true;
  constructor(options?: { cause?: unknown }) {
    super('The transaction ran past its deadline and was rolled back.', options);
    this.name = 'TransactionDeadlineError';
  }
}

/** `query_canceled` (statement_timeout) and `lock_not_available` (lock_timeout). */
const DEADLINE_SQLSTATES = new Set(['57014', '55P03']);

function remainingMs(deadlineAt: number): number {
  return Math.ceil(deadlineAt - Date.now());
}

/** Waits for a pooled connection no longer than the deadline; a late one goes back to the pool. */
async function connectBy(pool: Pool, deadlineAt: number | undefined): Promise<PoolClient> {
  if (deadlineAt === undefined) return pool.connect();
  const left = remainingMs(deadlineAt);
  if (left <= 0) throw new TransactionDeadlineError();
  const connecting = pool.connect();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TransactionDeadlineError()), left);
  });
  try {
    return await Promise.race([connecting, late]);
  } catch (error) {
    if (error instanceof TransactionDeadlineError)
      void connecting.then(
        client => client.release(),
        () => {},
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
  constructor(
    public readonly $pool: Pool,
    private readonly onRollbackError?: (error: unknown) => void | Promise<void>,
  ) {}

  connect(): Promise<PoolClient> {
    return this.$pool.connect();
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

  async tx<T>(callback: (t: TxClient) => Promise<T>, options?: TxOptions): Promise<T> {
    const deadlineAt = options?.deadlineAt;
    const client = await connectBy(this.$pool, deadlineAt);
    let destroyClient = false;
    try {
      try {
        await client.query('BEGIN');
      } catch (error) {
        destroyClient = true;
        throw error;
      }
      const txClient = new TransactionClient(client, deadlineAt);
      try {
        const result = await callback(txClient);
        // Drain before COMMIT so fire-and-forget / batch tails can't race it.
        await txClient.drain();
        txClient.assertWithinDeadline();
        assertCommitted(await client.query('COMMIT'));
        return result;
      } catch (error) {
        // Drain before ROLLBACK: Promise.all in batch() rejects on the first
        // failure while later enqueued queries may still be running. Preserve
        // the callback/drain error that caused this catch.
        await txClient.drain().catch(() => undefined);
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          destroyClient = true;
          try {
            if (this.onRollbackError) await this.onRollbackError(rollbackError);
            else console.error('Failed to rollback transaction:', rollbackError);
          } catch {
            // A diagnostic callback must not replace the transaction failure.
          }
        }
        throw error;
      }
    } finally {
      client.release(destroyClient || undefined);
    }
  }
}

/**
 * PostgreSQL answers COMMIT on an aborted transaction (a statement failed outside any savepoint, and
 * the caller caught it) with a ROLLBACK, not an error. Treat that as the failure it is, so the
 * caller never sees a commit that didn't happen.
 */
export class TransactionRolledBackError extends Error {
  constructor() {
    super('The transaction was rolled back at COMMIT: a statement in it failed earlier and the failure was caught.');
    this.name = 'TransactionRolledBackError';
  }
}

function assertCommitted(result: QueryResult | undefined): void {
  if (result?.command === 'ROLLBACK') throw new TransactionRolledBackError();
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
export class TransactionClient implements TxClient {
  /**
   * Serialization tail. Without this gate, concurrent t.none()/t.query()
   * from Promise.all / batch land on the same PoolClient at once.
   */
  #tail: Promise<void> = Promise.resolve();
  #error: { value: unknown } | undefined;

  constructor(
    private readonly client: PoolClient,
    private readonly deadlineAt?: number,
  ) {}

  /** Throws {@link TransactionDeadlineError} once the transaction's deadline has passed. */
  assertWithinDeadline(): void {
    if (this.deadlineAt !== undefined && remainingMs(this.deadlineAt) <= 0) throw new TransactionDeadlineError();
  }

  /** One statement, bounded by what is left of the deadline (statement time and lock waits). */
  async #run(query: string, values?: QueryValues): Promise<QueryResult> {
    if (this.deadlineAt === undefined) return this.client.query(query, values);
    const left = remainingMs(this.deadlineAt);
    if (left <= 0) throw new TransactionDeadlineError();
    await this.client.query(`SET LOCAL statement_timeout = ${left}; SET LOCAL lock_timeout = ${left}`);
    // Setting the timeouts is itself a round trip; don't send the statement if it used up the rest.
    this.assertWithinDeadline();
    try {
      return await this.client.query(query, values);
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (typeof code === 'string' && DEADLINE_SQLSTATES.has(code))
        throw new TransactionDeadlineError({ cause: error });
      throw error;
    }
  }

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

  /**
   * Runs `callback` inside a savepoint. When it fails, the transaction rolls back to the savepoint
   * and stays usable, so its failure isn't kept for COMMIT; the caller gets it.
   */
  async savepoint<T>(name: string, callback: () => Promise<T>): Promise<T> {
    await this.drain();
    await this.none(`SAVEPOINT ${name}`);
    try {
      const result = await callback();
      await this.drain();
      await this.none(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      await this.drain().catch(() => undefined);
      // Not bounded by the deadline: it takes no locks, and it keeps the caller's own error.
      await this.#enqueue(() => this.client.query(`ROLLBACK TO SAVEPOINT ${name}`));
      await this.#enqueue(() => this.client.query(`RELEASE SAVEPOINT ${name}`));
      throw error;
    }
  }

  none(query: string, values?: QueryValues): Promise<null> {
    return this.#enqueue(async () => {
      await this.#run(query, values);
      return null;
    });
  }

  one<T = any>(query: string, values?: QueryValues): Promise<T> {
    return this.#enqueue(async () => {
      const result = await this.#run(query, values);
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
      const result = await this.#run(query, values);
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
      const result = await this.#run(query, values);
      return result.rows as T[];
    });
  }

  manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.#enqueue(async () => {
      const result = await this.#run(query, values);
      if (result.rows.length === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      return result.rows as T[];
    });
  }

  query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.#enqueue(() => this.#run(query, values));
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
  #rollbackError: unknown;

  constructor(
    public readonly $pool: Pool,
    private readonly pinnedClient: PoolClient,
    private readonly onRollbackError?: (error: unknown) => void | Promise<void>,
  ) {}

  get shouldDestroyClient(): boolean {
    return this.#rollbackError !== undefined;
  }

  /**
   * Run `fn` after any previously enqueued work on this pinned client has
   * settled. Failures in earlier calls don't poison the queue — we always
   * resume on the next caller's turn.
   */
  #enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => {
      if (this.shouldDestroyClient) throw this.#rollbackError;
      return fn();
    };
    const next = this.#tail.then(run, run);
    // Swallow rejection on the chained tail so a failing call doesn't
    // leave an unhandled rejection on later enqueues.
    this.#tail = next.catch(() => undefined);
    return next;
  }

  async drain(): Promise<void> {
    await this.#tail;
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

  tx<T>(callback: (t: TxClient) => Promise<T>, options?: TxOptions): Promise<T> {
    // Enqueue the entire BEGIN/work/COMMIT block so concurrent callers
    // can't interleave statements inside someone else's transaction.
    return this.#enqueue(async () => {
      // The queue wait counts against the deadline, like a pool wait does for PoolAdapter.
      if (options?.deadlineAt !== undefined && remainingMs(options.deadlineAt) <= 0) {
        throw new TransactionDeadlineError();
      }
      try {
        await this.pinnedClient.query('BEGIN');
      } catch (error) {
        this.#rollbackError = error;
        throw error;
      }
      const txClient = new TransactionClient(this.pinnedClient, options?.deadlineAt);
      try {
        const result = await callback(txClient);
        await txClient.drain();
        txClient.assertWithinDeadline();
        assertCommitted(await this.pinnedClient.query('COMMIT'));
        return result;
      } catch (error) {
        await txClient.drain().catch(() => undefined);
        try {
          await this.pinnedClient.query('ROLLBACK');
        } catch (rollbackError) {
          this.#rollbackError = rollbackError;
          try {
            if (this.onRollbackError) await this.onRollbackError(rollbackError);
            else console.error('Failed to rollback transaction:', rollbackError);
          } catch {
            // A diagnostic callback must not replace the transaction failure.
          }
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

  tx<T>(callback: (t: TxClient) => Promise<T>, options?: TxOptions): Promise<T> {
    return this.active.tx<T>(callback, options);
  }
}
