/**
 * PgPoolAdapter - Wraps a pg.Pool with a pg-promise-compatible interface
 *
 * This adapter enables BYOC (Bring Your Own Client) support for PostgresStore,
 * allowing users to provide their own pg.Pool (including HTTP-based drivers like
 * @neondatabase/serverless) while maintaining compatibility with the existing
 * pg-promise-based query interface.
 */
import type { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Interface matching the subset of pg-promise's IDatabase that we use
 */
export interface IPgPromiseCompatible {
  none(query: string, values?: any[]): Promise<void>;
  one<T = any>(query: string, values?: any[]): Promise<T>;
  oneOrNone<T = any>(query: string, values?: any[]): Promise<T | null>;
  any<T = any>(query: string, values?: any[]): Promise<T[]>;
  many<T = any>(query: string, values?: any[]): Promise<T[]>;
  manyOrNone<T = any>(query: string, values?: any[]): Promise<T[]>;
  result(query: string, values?: any[]): Promise<QueryResult<any>>;
  query<T = any>(query: string, values?: any[]): Promise<T[]>;
  tx<T>(callback: (t: IPgPromiseCompatible) => Promise<T>): Promise<T>;
  batch<T>(promises: Promise<T>[]): Promise<T[]>;
}

/**
 * Transaction context for pg.Pool - wraps a PoolClient to provide
 * the same interface as the main adapter
 */
class PgPoolTransactionContext implements IPgPromiseCompatible {
  constructor(private client: PoolClient) {}

  async none(query: string, values?: any[]): Promise<void> {
    await this.client.query(query, values);
  }

  async one<T = any>(query: string, values?: any[]): Promise<T> {
    const result = await this.client.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('No data returned from query that expected exactly one row');
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned from query that expected exactly one row`);
    }
    return result.rows[0] as T;
  }

  async oneOrNone<T = any>(query: string, values?: any[]): Promise<T | null> {
    const result = await this.client.query(query, values);
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned from query that expected at most one row`);
    }
    return (result.rows[0] as T) || null;
  }

  async any<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.client.query(query, values);
    return result.rows as T[];
  }

  async many<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.client.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('No data returned from query that expected at least one row');
    }
    return result.rows as T[];
  }

  async manyOrNone<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.client.query(query, values);
    return result.rows as T[];
  }

  async result(query: string, values?: any[]): Promise<QueryResult<any>> {
    return this.client.query(query, values);
  }

  async query<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.client.query(query, values);
    return result.rows as T[];
  }

  async tx<T>(callback: (t: IPgPromiseCompatible) => Promise<T>): Promise<T> {
    // Nested transactions - pg doesn't support true nested transactions,
    // but we can use savepoints. For simplicity, we just run the callback
    // on the same client (single transaction context).
    return callback(this);
  }

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }
}

/**
 * Adapter that wraps a pg.Pool with a pg-promise-compatible interface
 *
 * This allows PostgresStore to work with any pg.Pool-compatible driver,
 * including HTTP-based drivers like @neondatabase/serverless.
 */
export class PgPoolAdapter implements IPgPromiseCompatible {
  constructor(private pool: Pool) {}

  async none(query: string, values?: any[]): Promise<void> {
    await this.pool.query(query, values);
  }

  async one<T = any>(query: string, values?: any[]): Promise<T> {
    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('No data returned from query that expected exactly one row');
    }
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned from query that expected exactly one row`);
    }
    return result.rows[0] as T;
  }

  async oneOrNone<T = any>(query: string, values?: any[]): Promise<T | null> {
    const result = await this.pool.query(query, values);
    if (result.rows.length > 1) {
      throw new Error(`Multiple rows returned from query that expected at most one row`);
    }
    return (result.rows[0] as T) || null;
  }

  async any<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.pool.query(query, values);
    return result.rows as T[];
  }

  async many<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('No data returned from query that expected at least one row');
    }
    return result.rows as T[];
  }

  async manyOrNone<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.pool.query(query, values);
    return result.rows as T[];
  }

  async result(query: string, values?: any[]): Promise<QueryResult<any>> {
    return this.pool.query(query, values);
  }

  async query<T = any>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.pool.query(query, values);
    return result.rows as T[];
  }

  /**
   * Execute a callback within a transaction
   */
  async tx<T>(callback: (t: IPgPromiseCompatible) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txContext = new PgPoolTransactionContext(client);
      const result = await callback(txContext);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple promises in parallel (pg-promise compatibility)
   */
  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }
}
