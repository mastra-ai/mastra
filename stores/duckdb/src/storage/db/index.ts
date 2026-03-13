import { DuckDBInstance, DuckDBTimestampValue } from '@duckdb/node-api';
import type { DuckDBValue } from '@duckdb/node-api';
import { MastraBase } from '@mastra/core/base';

/** Convert DuckDB-specific return types to plain JS types */
function toJsValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  // DuckDBTimestampValue → Date (micros since epoch)
  if (val instanceof DuckDBTimestampValue) {
    return new Date(Number(val.micros / 1000n));
  }
  // BigInt → Number (safe for values we care about)
  if (typeof val === 'bigint') {
    return Number(val);
  }
  return val;
}

/** Configuration for the DuckDB database connection. */
export interface DuckDBStorageConfig {
  /** Path to the DuckDB file. Defaults to 'mastra.duckdb'. Use ':memory:' for ephemeral. */
  path?: string;
}

/**
 * Shared DuckDB connection management for Mastra storage.
 * Defaults to a local file (`mastra.duckdb`) when no path is provided.
 * Pass `path: ':memory:'` for an ephemeral in-memory database.
 */
export class DuckDBConnection extends MastraBase {
  private instance: DuckDBInstance | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private path: string;

  constructor(config: DuckDBStorageConfig = {}) {
    super({ component: 'STORAGE', name: 'DUCKDB' });
    this.path = config.path ?? 'mastra.duckdb';
  }

  private async initialize(): Promise<void> {
    if (this.initialized && this.instance) return;

    if (this.initPromise) {
      await this.initPromise;
      if (this.instance) return;
      this.initPromise = null;
      this.initialized = false;
    }

    this.initPromise = (async () => {
      try {
        this.instance = await DuckDBInstance.create(this.path);
        this.initialized = true;
      } catch (error) {
        this.instance = null;
        this.initialized = false;
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /** Create a new connection to the DuckDB instance, initializing if needed. */
  async getConnection() {
    await this.initialize();
    if (!this.instance) {
      throw new Error('DuckDB instance not initialized');
    }
    return this.instance.connect();
  }

  /**
   * Execute a SQL query and return results as objects.
   */
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const connection = await this.getConnection();
    if (params.length === 0) {
      const result = await connection.run(sql);
      const rows = await result.getRows();
      const columns = result.columnNames();
      return rows.map(row => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = toJsValue(row[i]);
        });
        return obj as T;
      });
    }

    let paramIndex = 0;
    const preparedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    const stmt = await connection.prepare(preparedSql);
    stmt.bind(params as DuckDBValue[]);
    const result = await stmt.run();
    const rows = await result.getRows();
    const columns = result.columnNames();
    return rows.map(row => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = toJsValue(row[i]);
      });
      return obj as T;
    });
  }

  /**
   * Execute a SQL statement without returning results.
   */
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const connection = await this.getConnection();
    if (params.length === 0) {
      await connection.run(sql);
      return;
    }
    let paramIndex = 0;
    const preparedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    const stmt = await connection.prepare(preparedSql);
    stmt.bind(params as DuckDBValue[]);
    await stmt.run();
  }

  /**
   * Escape a value for safe inline SQL use.
   * DuckDB prepared statements can't handle NULL for parameters typed as ANY,
   * so for complex INSERT/UPDATE operations we inline values safely.
   */
  static sqlValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 'NULL';
      return String(value);
    }
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'::TIMESTAMP`;
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    // Objects/arrays → JSON string
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  /** Release the DuckDB instance, allowing garbage collection. */
  async close(): Promise<void> {
    if (this.instance) {
      this.instance = null;
      this.initialized = false;
      this.initPromise = null;
    }
  }
}
