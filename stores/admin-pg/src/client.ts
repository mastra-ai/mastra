import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Re-export pg types for consumers
export type { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Query parameter values
 */
export type QueryValues = unknown[] | Record<string, unknown>;

/**
 * Transaction client interface
 */
export interface TxClient {
  readonly $pool: Pool;
  none(query: string, values?: QueryValues): Promise<null>;
  one<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T>;
  oneOrNone<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T | null>;
  any<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]>;
  manyOrNone<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]>;
  many<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]>;
  query<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<QueryResult<T>>;
  batch<T>(promises: Promise<T>[]): Promise<T[]>;
}

/**
 * Database client interface
 */
export interface DbClient extends Omit<TxClient, 'batch'> {
  connect(): Promise<PoolClient>;
  tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T>;
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
 * Pool adapter implementing DbClient
 */
export class PoolAdapter implements DbClient {
  readonly $pool: Pool;

  constructor(pool: Pool) {
    this.$pool = pool;
  }

  async connect(): Promise<PoolClient> {
    return this.$pool.connect();
  }

  async none(query: string, values?: QueryValues): Promise<null> {
    await this.$pool.query(query, values as unknown[]);
    return null;
  }

  async one<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T> {
    const result = await this.$pool.query<T>(query, values as unknown[]);
    if (result.rowCount !== 1) {
      if (result.rowCount === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0]!;
  }

  async oneOrNone<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T | null> {
    const result = await this.$pool.query<T>(query, values as unknown[]);
    if (result.rowCount === 0) return null;
    if (result.rowCount === 1) return result.rows[0]!;
    throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
  }

  async any<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.$pool.query<T>(query, values as unknown[]);
    return result.rows;
  }

  async manyOrNone<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  async many<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.$pool.query<T>(query, values as unknown[]);
    if (result.rowCount === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    return result.rows;
  }

  async query<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<QueryResult<T>> {
    return this.$pool.query<T>(query, values as unknown[]);
  }

  async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    const client = await this.$pool.connect();
    try {
      await client.query('BEGIN');
      const txClient = new TransactionClient(client, this.$pool);
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
 * Transaction client implementation
 */
class TransactionClient implements TxClient {
  readonly $pool: Pool;
  private client: PoolClient;

  constructor(client: PoolClient, pool: Pool) {
    this.client = client;
    this.$pool = pool;
  }

  async none(query: string, values?: QueryValues): Promise<null> {
    await this.client.query(query, values as unknown[]);
    return null;
  }

  async one<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T> {
    const result = await this.client.query<T>(query, values as unknown[]);
    if (result.rowCount !== 1) {
      if (result.rowCount === 0) {
        throw new Error(`No data returned from query: ${truncateQuery(query)}`);
      }
      throw new Error(`Multiple rows returned when one was expected: ${truncateQuery(query)}`);
    }
    return result.rows[0]!;
  }

  async oneOrNone<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T | null> {
    const result = await this.client.query<T>(query, values as unknown[]);
    if (result.rowCount === 0) return null;
    if (result.rowCount === 1) return result.rows[0]!;
    throw new Error(`Multiple rows returned when one or none was expected: ${truncateQuery(query)}`);
  }

  async any<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.client.query<T>(query, values as unknown[]);
    return result.rows;
  }

  async manyOrNone<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]> {
    return this.any<T>(query, values);
  }

  async many<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<T[]> {
    const result = await this.client.query<T>(query, values as unknown[]);
    if (result.rowCount === 0) {
      throw new Error(`No data returned from query: ${truncateQuery(query)}`);
    }
    return result.rows;
  }

  async query<T extends QueryResultRow>(query: string, values?: QueryValues): Promise<QueryResult<T>> {
    return this.client.query<T>(query, values as unknown[]);
  }

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }
}
