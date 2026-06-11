import type { Pool, PoolClient, QueryResult } from 'pg';

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
  /** Execute multiple promises in parallel */
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
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Log rollback failure but throw original error
        console.error('Transaction rollback failed:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * Transaction client that wraps a PoolClient for executing queries within a transaction.
 */
class TransactionClient implements TxClient {
  constructor(private readonly client: PoolClient) {}

  async none(query: string, values?: QueryValues): Promise<null> {
    await this.client.query(query, values);
    return null;
  }

  async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    const result = await this.client.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0] as T;
  }

  async oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    const result = await this.client.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0] as T;
  }

  async any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.client.query(query, values);
    return result.rows as T[];
  }

  async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  async many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.client.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    return result.rows as T[];
  }

  async query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.client.query(query, values);
  }

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
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
  constructor(
    public readonly $pool: Pool,
    private readonly pinnedClient: PoolClient,
  ) {}

  connect(): Promise<PoolClient> {
    // Returning a wrapper around the pinned client would risk callers
    // releasing it prematurely. Domain init paths don't call connect(),
    // so we fall back to the pool here.
    return this.$pool.connect();
  }

  async none(query: string, values?: QueryValues): Promise<null> {
    await this.pinnedClient.query(query, values);
    return null;
  }

  async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    const result = await this.pinnedClient.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0] as T;
  }

  async oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    const result = await this.pinnedClient.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0] as T;
  }

  async any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.pinnedClient.query(query, values);
    return result.rows as T[];
  }

  async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  async many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.pinnedClient.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    return result.rows as T[];
  }

  async query(query: string, values?: QueryValues): Promise<QueryResult> {
    return this.pinnedClient.query(query, values);
  }

  async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    // Run BEGIN/COMMIT/ROLLBACK on the pinned client itself rather than
    // checking out a new one. Safe to use during init.
    await this.pinnedClient.query('BEGIN');
    try {
      const result = await callback(new TransactionClient(this.pinnedClient));
      await this.pinnedClient.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.pinnedClient.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Transaction rollback failed:', rollbackError);
      }
      throw error;
    }
  }
}

/**
 * DbClient wrapper that routes to an alternate client when one is pinned.
 *
 * Most of the time this just forwards to the underlying PoolAdapter.
 * During PostgresStore.init() we temporarily pin a single-client adapter
 * so every domain's DDL flows through one backend connection.
 */
export class RoutingDbClient implements DbClient {
  #base: DbClient;
  #pinned: DbClient | null = null;

  constructor(base: DbClient) {
    this.#base = base;
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
