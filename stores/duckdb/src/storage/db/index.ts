import { DuckDBInstance, DuckDBTimestampValue, DuckDBTimestampTZValue } from '@duckdb/node-api';
import type { DuckDBPreparedStatement } from '@duckdb/node-api';
import { MastraBase } from '@mastra/core/base';

/**
 * Bind a single parameter to a prepared statement using explicit typed methods.
 * This avoids the "Cannot create values of type ANY" error that occurs when
 * DuckDB cannot infer parameter types from SQL context (e.g. json_extract_string).
 */
export function bindParam(stmt: DuckDBPreparedStatement, index: number, value: unknown): void {
  if (value === null || value === undefined) {
    stmt.bindNull(index);
  } else if (typeof value === 'string') {
    stmt.bindVarchar(index, value);
  } else if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
      stmt.bindInteger(index, value);
    } else {
      stmt.bindDouble(index, value);
    }
  } else if (typeof value === 'boolean') {
    stmt.bindBoolean(index, value);
  } else if (typeof value === 'bigint') {
    stmt.bindBigInt(index, value);
  } else if (value instanceof Date) {
    stmt.bindTimestamp(index, new DuckDBTimestampValue(BigInt(value.getTime()) * 1000n));
  } else if (value instanceof DuckDBTimestampValue) {
    stmt.bindTimestamp(index, value);
  } else if (value instanceof DuckDBTimestampTZValue) {
    stmt.bindTimestampTZ(index, value);
  } else {
    // Fallback: serialize to JSON string
    stmt.bindVarchar(index, JSON.stringify(value));
  }
}

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

/** Default idle timeout before the DuckDB instance is closed to release its file lock. */
const DEFAULT_IDLE_TIMEOUT_MS = 500;

/** Pattern that DuckDB uses for file-lock conflicts. */
const LOCK_ERROR_PATTERN = /Could not set lock on file|Conflicting lock is held/i;

function isDuckDBLockError(error: unknown): error is Error {
  return error instanceof Error && LOCK_ERROR_PATTERN.test(error.message);
}

function buildLockErrorMessage(originalMessage: string, dbPath: string): string {
  return (
    `\n` +
    `===========================================================================\n` +
    `DuckDB lock conflict: another process is using "${dbPath}"\n` +
    `===========================================================================\n` +
    `\n` +
    `${originalMessage}\n` +
    `\n` +
    `Common causes:\n` +
    `  • Another \`mastra dev\` is running in this directory\n` +
    `  • A previous process crashed without releasing the lock\n` +
    `\n` +
    `To fix this:\n` +
    `  1. Stop any other \`mastra dev\` processes for this project\n` +
    `  2. If the problem persists, kill the PID shown above and retry\n` +
    `  3. As a last resort, delete the .duckdb.wal file next to your database\n` +
    `===========================================================================\n`
  );
}

/** Configuration for the DuckDB database connection. */
export interface DuckDBStorageConfig {
  /** Path to the DuckDB file. Defaults to 'mastra.duckdb'. Use ':memory:' for ephemeral. */
  path?: string;
  /**
   * Milliseconds of inactivity before the DuckDB instance is closed to release
   * the file lock. Set to `0` to disable idle closing (keeps the lock for the
   * process lifetime). Defaults to 500.
   */
  idleTimeoutMs?: number;
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
  private idleTimeoutMs: number;
  private activeOps = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: DuckDBStorageConfig = {}) {
    super({ component: 'STORAGE', name: 'DUCKDB' });
    this.path = config.path ?? 'mastra.duckdb';
    // Idle close is destructive for in-memory databases — disable by default.
    this.idleTimeoutMs = config.idleTimeoutMs ?? (this.path === ':memory:' ? 0 : DEFAULT_IDLE_TIMEOUT_MS);
  }

  private cancelIdleClose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdleClose(): void {
    if (this.idleTimeoutMs <= 0 || this.activeOps > 0) return;
    this.cancelIdleClose();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.activeOps === 0) {
        this.releaseInstance();
      }
    }, this.idleTimeoutMs);
    // Don't let the timer prevent Node from exiting.
    if (this.idleTimer && typeof this.idleTimer === 'object' && 'unref' in this.idleTimer) {
      (this.idleTimer as NodeJS.Timeout).unref();
    }
  }

  private releaseInstance(): void {
    if (!this.instance) return;
    try {
      const inst = this.instance as unknown as { closeSync?: () => void; close?: () => void };
      if (typeof inst.closeSync === 'function') {
        inst.closeSync();
      } else if (typeof inst.close === 'function') {
        inst.close();
      }
    } catch {
      // Ignore close failures to allow cleanup of references.
    }
    this.instance = null;
    this.initialized = false;
    this.initPromise = null;
  }

  private async initialize(): Promise<void> {
    this.cancelIdleClose();

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
        if (isDuckDBLockError(error)) {
          const msg = buildLockErrorMessage(error.message, this.path);
          this.logger.error(msg);
          throw new Error(msg, { cause: error });
        }
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

  private closeConnection(connection: unknown): void {
    const conn = connection as {
      closeSync?: () => void;
      disconnectSync?: () => void;
      close?: () => void;
      disconnect?: () => void;
    };
    try {
      if (typeof conn?.closeSync === 'function') {
        conn.closeSync();
        return;
      }
      if (typeof conn?.disconnectSync === 'function') {
        conn.disconnectSync();
        return;
      }
      if (typeof conn?.close === 'function') {
        conn.close();
        return;
      }
      if (typeof conn?.disconnect === 'function') {
        conn.disconnect();
      }
    } catch {
      // Ignore close failures to avoid masking query/execute errors.
    }
  }

  /**
   * Execute a SQL query and return results as objects.
   */
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.activeOps++;
    const connection = await this.getConnection();
    try {
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
      for (let i = 0; i < params.length; i++) {
        bindParam(stmt, i + 1, params[i]);
      }
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
    } finally {
      this.closeConnection(connection);
      this.activeOps--;
      this.scheduleIdleClose();
    }
  }

  /**
   * Execute a SQL statement without returning results.
   */
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    this.activeOps++;
    const connection = await this.getConnection();
    try {
      if (params.length === 0) {
        await connection.run(sql);
        return;
      }
      let paramIndex = 0;
      const preparedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
      const stmt = await connection.prepare(preparedSql);
      for (let i = 0; i < params.length; i++) {
        bindParam(stmt, i + 1, params[i]);
      }
      await stmt.run();
    } finally {
      this.closeConnection(connection);
      this.activeOps--;
      this.scheduleIdleClose();
    }
  }

  /**
   * Execute multiple SQL statements in order using a single DuckDB connection.
   *
   * This is intended for schema setup/migrations where statements have no
   * parameters and must remain ordered, but opening a connection per statement
   * would dominate initialization cost. Blank statements are skipped. Like
   * calling execute() repeatedly, this does not wrap statements in a transaction,
   * so prior statements can remain applied if a later statement fails.
   */
  async executeBatch(sqlStatements: readonly string[]): Promise<void> {
    const statements = sqlStatements.map(statement => statement.trim()).filter(Boolean);
    if (statements.length === 0) return;

    this.activeOps++;
    const connection = await this.getConnection();
    try {
      const sql =
        statements.map((statement, i) => `-- executeBatch statement ${i + 1}\n${statement}`).join('\n;\n') + '\n;';
      await connection.run(sql);
    } finally {
      this.closeConnection(connection);
      this.activeOps--;
      this.scheduleIdleClose();
    }
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
    this.cancelIdleClose();
    this.releaseInstance();
  }
}
