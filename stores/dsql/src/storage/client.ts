import type { Pool, PoolClient, QueryResult } from 'pg';

// Re-export pg types for consumers
export type { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Values array for parameterized queries.
 */
export type QueryValues = unknown[];

/**
 * Common interface for database clients.
 * DsqlPoolAdapter implements this interface by wrapping a pg.Pool.
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

  async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    const client = await this.$pool.connect();
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
   * PoolAdapter calls this before COMMIT/ROLLBACK so those control
   * statements never overlap in-flight work on the same client.
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
