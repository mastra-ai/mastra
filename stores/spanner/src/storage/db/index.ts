import { Spanner } from '@google-cloud/spanner';
import type { Database, Transaction } from '@google-cloud/spanner';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_SPANS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  TABLE_CONFIGS,
  getDefaultValue,
} from '@mastra/core/storage';
import type {
  StorageColumn,
  TABLE_NAMES,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import { getColumnDef, getSpannerParamType, getSpannerType, isInOperator, quoteIdent } from './utils';

// Re-export the shared types for downstream consumers
export type { CreateIndexOptions, IndexInfo, StorageIndexStats };

/**
 * Controls whether `init()` is allowed to apply schema changes.
 *
 * - `'sync'` (default): the adapter creates missing tables, columns, and
 *   indexes during `init()`. This is the historical behavior.
 * - `'validate'`: the adapter applies no DDL during `init()` and instead
 *   verifies that every table, column (from `alterTable.ifNotExists`), and
 *   default/custom index it would have created already exists. Missing
 *   schema elements throw a typed user error.
 *
 * `'validate'` is intended for environments where another process (Terraform,
 * Liquibase, a release pipeline, etc.) owns the schema and Mastra should only
 * verify that the live database matches what the adapter expects.
 */
export type SpannerInitMode = 'sync' | 'validate';

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 *   1. A pre-configured `database` (the domain reuses it as-is), or
 *   2. Connection details from which the domain creates a Spanner client internally.
 */
export type SpannerDomainConfig = SpannerDomainDatabaseConfig | SpannerDomainConnectionConfig;

/**
 * Reuse an existing Spanner Database handle.
 */
export interface SpannerDomainDatabaseConfig {
  database: Database;
  /** Custom indexes to create for this domain's tables */
  indexes?: CreateIndexOptions[];
  /** When true, skips creation of default indexes */
  skipDefaultIndexes?: boolean;
  /** See {@link SpannerInitMode}. Defaults to `'sync'`. */
  initMode?: SpannerInitMode;
  /**
   * When true, versioned domains (agents / skills / prompt-blocks /
   * mcp-clients / mcp-servers / scorer-definitions) sweep orphaned draft
   * thin-row records during `init()`  i.e. drafts whose paired version row
   * was never written. Useful for cleaning up after process crashes that
   * pre-date the transactional `create()` rewrite, or for environments
   * where data integrity outweighs the small startup cost.
   * @default false
   */
  cleanupStaleDraftsOnStartup?: boolean;
  /**
   * Maximum acceptable staleness (in milliseconds) for read-only dashboard
   * queries in the observability domain (metrics list / aggregates /
   * breakdowns / time-series / percentiles / discovery). When > 0, these
   * reads are issued as single-use read-only transactions with
   * `maxStaleness`, which lets Spanner serve them from any replica that has
   * data at least that fresh — they stop contending with leader writes and
   * can be routed to a closer replica.
   *
   * Default is 0 (strong reads) for backwards compatibility and to keep
   * write-then-read paths in tests deterministic. For real dashboards,
   * 10000 (10 s) is a common sweet spot.
   * @default 0
   */
  dashboardStalenessMs?: number;
  /**
   * When true (the default), the observability domain's metric methods
   * (`batchCreateMetrics`, `listMetrics`, `getMetricAggregate`, etc.) throw
   * the base-class `*_NOT_IMPLEMENTED` errors and the metrics table is not
   * created during `init()`. The `MastraStorageExporter` treats these
   * errors as a signal to silently drop metric emissions, which is the
   * recommended default for Spanner deployments: Spanner is row-oriented
   * and OLTP-shaped, which makes it a poor fit for the high-volume,
   * write-heavy, scan-heavy metrics workload. Pair Spanner spans with a
   * dedicated OLAP store for metrics (BigQuery, DuckDB, ClickHouse) via a
   * `MastraCompositeStore`-level wrapper that fans out by signal.
   *
   * Set to `false` to opt back in to the Spanner metrics implementation.
   * It is correct and bounded at small scale (sustained < ~50 metrics/sec,
   * < 1 yr retention), but past that you will hit hot-tail write
   * contention on the leading-name index and analytical queries will start
   * competing with span writes for node CPU.
   * @default true
   */
  disableMetrics?: boolean;
}

/**
 * Create a Spanner client internally from connection details.
 */
export interface SpannerDomainConnectionConfig {
  projectId: string;
  instanceId: string;
  databaseId: string;
  /** Optional pass-through to the Spanner client constructor (auth, servicePath, etc.) */
  spannerOptions?: ConstructorParameters<typeof Spanner>[0];
  /** Custom indexes to create for this domain's tables */
  indexes?: CreateIndexOptions[];
  /** When true, skips creation of default indexes */
  skipDefaultIndexes?: boolean;
  /** See {@link SpannerInitMode}. Defaults to `'sync'`. */
  initMode?: SpannerInitMode;
  /** See {@link SpannerDomainDatabaseConfig.cleanupStaleDraftsOnStartup}. Defaults to `false`. */
  cleanupStaleDraftsOnStartup?: boolean;
  /** See {@link SpannerDomainDatabaseConfig.dashboardStalenessMs}. Defaults to `0`. */
  dashboardStalenessMs?: number;
  /** See {@link SpannerDomainDatabaseConfig.disableMetrics}. Defaults to `true`. */
  disableMetrics?: boolean;
}

/**
 * Resolves a SpannerDomainConfig into a concrete Database handle plus options.
 */
export function resolveSpannerConfig(config: SpannerDomainConfig): {
  database: Database;
  indexes?: CreateIndexOptions[];
  skipDefaultIndexes?: boolean;
  initMode?: SpannerInitMode;
  cleanupStaleDraftsOnStartup?: boolean;
  dashboardStalenessMs?: number;
  disableMetrics?: boolean;
  ownsClient: boolean;
} {
  if ('database' in config && config.database) {
    return {
      database: config.database,
      indexes: config.indexes,
      skipDefaultIndexes: config.skipDefaultIndexes,
      initMode: config.initMode,
      cleanupStaleDraftsOnStartup: config.cleanupStaleDraftsOnStartup,
      dashboardStalenessMs: config.dashboardStalenessMs,
      disableMetrics: config.disableMetrics,
      ownsClient: false,
    };
  }

  const connectionConfig = config as SpannerDomainConnectionConfig;
  const spanner = new Spanner({
    projectId: connectionConfig.projectId,
    ...(connectionConfig.spannerOptions ?? {}),
  });
  const database = spanner.instance(connectionConfig.instanceId).database(connectionConfig.databaseId);

  return {
    database,
    indexes: connectionConfig.indexes,
    skipDefaultIndexes: connectionConfig.skipDefaultIndexes,
    initMode: connectionConfig.initMode,
    cleanupStaleDraftsOnStartup: connectionConfig.cleanupStaleDraftsOnStartup,
    dashboardStalenessMs: connectionConfig.dashboardStalenessMs,
    disableMetrics: connectionConfig.disableMetrics,
    ownsClient: true,
  };
}

/**
 * Internal helper that performs all GoogleSQL Spanner work for the various domain
 * implementations (memory, workflows, scores, background-tasks).
 */
export class SpannerDB extends MastraBase {
  public database: Database;
  public skipDefaultIndexes?: boolean;
  /** See {@link SpannerInitMode}. Public so domains can branch on it for
   *  domain-specific schema work that doesn't go through this class
   *  (e.g. the workflows snapshotStatus generated column). */
  public readonly initMode: SpannerInitMode;
  /** Public so versioned domains can decide whether to call their
   *  cleanupStaleDrafts() helper during init(). Default false. */
  public readonly cleanupStaleDraftsOnStartup: boolean;

  /** Cache of actual table columns: tableName -> Set<columnName> */
  private tableColumnsCache = new Map<string, Set<string>>();

  constructor({
    database,
    skipDefaultIndexes,
    initMode,
    cleanupStaleDraftsOnStartup,
  }: {
    database: Database;
    skipDefaultIndexes?: boolean;
    initMode?: SpannerInitMode;
    cleanupStaleDraftsOnStartup?: boolean;
  }) {
    super({ component: 'STORAGE', name: 'SpannerDB' });
    this.database = database;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.initMode = initMode ?? 'sync';
    this.cleanupStaleDraftsOnStartup = cleanupStaleDraftsOnStartup ?? false;
  }

  /**
   * Builds a typed user-facing error for validate-mode schema mismatches so
   * operators get a clear signal that the externally-managed schema is out
   * of date relative to what the adapter expects.
   */
  private validateError(
    action: string,
    message: string,
    details: Record<string, string | number | boolean | null>,
  ): MastraError {
    return new MastraError({
      id: createStorageErrorId('SPANNER', action, 'VALIDATE_FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: message,
      details,
    });
  }

  /** Returns the set of column names that actually exist in the database table. */
  private async getTableColumns(tableName: TABLE_NAMES): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName);
    if (cached) return cached;

    const [rows] = await this.database.run({
      sql: `SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @tableName`,
      params: { tableName },
      json: true,
    });
    const columns = new Set((rows as Array<{ COLUMN_NAME: string }>).map(r => r.COLUMN_NAME));
    if (columns.size > 0) {
      this.tableColumnsCache.set(tableName, columns);
    }
    return columns;
  }

  /** Returns true if the named table exists. */
  private async tableExists(tableName: string): Promise<boolean> {
    const [rows] = await this.database.run({
      sql: `SELECT 1 AS found
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @tableName`,
      params: { tableName },
      json: true,
    });
    return (rows as unknown[]).length > 0;
  }

  /** Returns true if `column` exists on `table`. */
  async hasColumn(table: string, column: string): Promise<boolean> {
    const [rows] = await this.database.run({
      sql: `SELECT 1 AS found
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @table AND COLUMN_NAME = @column`,
      params: { table, column },
      json: true,
    });
    return (rows as unknown[]).length > 0;
  }

  /** Returns true if the named index exists. */
  private async indexExists(indexName: string): Promise<boolean> {
    const [rows] = await this.database.run({
      sql: `SELECT 1 AS found
            FROM INFORMATION_SCHEMA.INDEXES
            WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @indexName`,
      params: { indexName },
      json: true,
    });
    return (rows as unknown[]).length > 0;
  }

  /**
   * Filter a record to only contain columns that exist in the live database table.
   * Unknown columns are silently dropped to ensure forward compatibility with newer
   * code writing columns the database hasn't been migrated to yet.
   */
  private async filterRecordToKnownColumns(
    tableName: TABLE_NAMES,
    record: Record<string, any>,
  ): Promise<Record<string, any>> {
    const knownColumns = await this.getTableColumns(tableName);
    if (knownColumns.size === 0) return record;

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (knownColumns.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  protected getDefaultLiteral(type: StorageColumn['type']): string {
    switch (type) {
      case 'timestamp':
        // Spanner uses CURRENT_TIMESTAMP() rather than NOW()
        return 'DEFAULT (CURRENT_TIMESTAMP())';
      case 'jsonb':
        return "DEFAULT (JSON '{}')";
      case 'boolean':
        return 'DEFAULT (FALSE)';
      case 'integer':
      case 'bigint':
        return 'DEFAULT (0)';
      case 'float':
        return 'DEFAULT (0.0)';
      case 'text':
      case 'uuid':
        return getDefaultValue(type);
      default:
        return getDefaultValue(type);
    }
  }

  /** Build the column definition fragment for a CREATE TABLE statement. */
  private buildColumnDefinition(name: string, def: StorageColumn): string {
    const fragments = [`${quoteIdent(name, 'column name')} ${getSpannerType(def.type)}`];
    if (!def.nullable) {
      fragments.push('NOT NULL');
    }
    return fragments.join(' ');
  }

  /** Apply DDL statements via `database.updateSchema` and wait for the operation. */
  private async runDdl(statements: string[]): Promise<void> {
    if (statements.length === 0) return;
    const [operation] = await this.database.updateSchema(statements);
    await operation.promise();
  }

  /**
   * Run a single DML statement either inside the provided transaction or by
   * starting a new short-lived read-write transaction. Spanner's `Database`
   * surface exposes only `run` (read-only); DML must always go through a
   * transaction.
   *
   * Auto-retries on `ABORTED` (gRPC code 10)  Spanner aborts read-write
   * transactions when they conflict with another, and the official guidance is
   * to retry from the start. The emulator hits this much more often than
   * managed Spanner because it serializes all read-write work.
   */
  async runDml(
    request: { sql: string; params?: Record<string, any>; types?: Record<string, any> },
    transaction?: Transaction,
  ): Promise<number> {
    if (transaction) {
      const [count] = await transaction.runUpdate(request);
      return Number(count ?? 0);
    }
    return this.runWithAbortRetry(async () => {
      let count = 0;
      await this.database.runTransactionAsync(async (tx: Transaction) => {
        try {
          const [c] = await tx.runUpdate(request);
          count = Number(c ?? 0);
          await tx.commit();
        } catch (err) {
          // The Spanner client does NOT auto-rollback when the runFn throws
          // explicitly release the transaction so its row locks are freed.
          await tx.rollback().catch(() => {});
          throw err;
        }
      });
      return count;
    });
  }

  /**
   * Retries `fn` on Spanner ABORTED errors with exponential backoff.
   * Caps at 5 attempts (~1.5s total backoff) before surfacing the error.
   *
   * Public so domain implementations can wrap their own
   * `database.runTransactionAsync` calls when running concurrent writes.
   */
  async runWithAbortRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 5;
    let attempt = 0;
    let delay = 50;
    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        attempt++;
        const aborted = error && (error.code === 10 || /ABORTED/i.test(String(error?.message ?? '')));
        if (!aborted || attempt >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * delay));
        delay *= 2;
      }
    }
  }

  /**
   * Determine the primary-key column list for a table. Some core tables (like
   * `mastra_workflow_snapshot`) don't carry a single-column PK in the schema,
   * so we hardcode known composite PKs here.
   */
  private getPrimaryKeyColumns(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): string[] {
    if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      return ['workflow_name', 'run_id'];
    }
    if (tableName === TABLE_SPANS) {
      return ['traceId', 'spanId'];
    }
    // Tables with composite primary keys (e.g. mastra_favorites,
    // mastra_dataset_items) declare them in core's TABLE_CONFIGS rather than via
    // per-column `primaryKey: true` flags. Honor that first so the PRIMARY KEY
    // clause emitted by createTable matches what the domains expect.
    const compositePk = TABLE_CONFIGS[tableName]?.compositePrimaryKey;
    if (compositePk && compositePk.length > 0) {
      const missing = compositePk.filter(col => !schema[col]);
      if (missing.length > 0) {
        throw new Error(
          `Table ${tableName}: composite primary key references columns not present in schema: ${missing.join(', ')}`,
        );
      }
      return [...compositePk];
    }
    const pk = Object.entries(schema)
      .filter(([, col]) => col.primaryKey)
      .map(([name]) => name);
    if (pk.length > 0) return pk;
    const first = Object.keys(schema)[0];
    return first ? [first] : [];
  }

  private async validateTableSchema(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): Promise<void> {
    const [rows] = await this.database.run({
      sql: `SELECT COLUMN_NAME, SPANNER_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @tableName`,
      params: { tableName },
      json: true,
    });
    const actual = new Map<string, { type: string; nullable: boolean }>();
    for (const row of rows as Array<{
      COLUMN_NAME: string;
      SPANNER_TYPE: string;
      IS_NULLABLE: string | boolean;
    }>) {
      actual.set(row.COLUMN_NAME, {
        type: row.SPANNER_TYPE,
        nullable: row.IS_NULLABLE === true || row.IS_NULLABLE === 'YES',
      });
    }

    const missing: string[] = [];
    const wrongType: string[] = [];
    const wrongNullability: string[] = [];
    for (const [columnName, expected] of Object.entries(schema)) {
      const live = actual.get(columnName);
      if (!live) {
        missing.push(columnName);
        continue;
      }
      // Compare canonical Spanner types so STRING/STRING(MAX) etc. don't
      // false-positive. Reuse the same type generator that createTable would
      // emit; INFORMATION_SCHEMA reports STRING(MAX) as `STRING(MAX)` (and
      // similarly for BYTES/NUMERIC).
      const expectedType = getSpannerType(expected.type).toUpperCase();
      const actualType = live.type.toUpperCase();
      if (expectedType !== actualType) {
        wrongType.push(`${columnName} (expected ${expectedType}, actual ${live.type})`);
      }
      // Match buildColumnDefinition: a column is NOT NULL unless `nullable`
      // is explicitly true. Plain `undefined` defaults to NOT NULL, mirroring
      // the DDL we would have emitted.
      const expectedNullable = expected.nullable === true;
      if (expectedNullable !== live.nullable) {
        wrongNullability.push(
          `${columnName} (expected ${expectedNullable ? 'NULLABLE' : 'NOT NULL'}, actual ${live.nullable ? 'NULLABLE' : 'NOT NULL'})`,
        );
      }
    }

    if (missing.length === 0 && wrongType.length === 0 && wrongNullability.length === 0) return;

    const segments: string[] = [];
    if (missing.length > 0) segments.push(`missing columns: ${missing.join(', ')}`);
    if (wrongType.length > 0) segments.push(`type mismatch: ${wrongType.join('; ')}`);
    if (wrongNullability.length > 0) segments.push(`nullability mismatch: ${wrongNullability.join('; ')}`);
    throw this.validateError(
      'CREATE_TABLE',
      `Table ${tableName} does not match expected schema (${segments.join(' | ')})`,
      {
        tableName,
        missing: missing.join(','),
        wrongType: wrongType.join(';'),
        wrongNullability: wrongNullability.join(';'),
      },
    );
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const exists = await this.tableExists(tableName);
      if (this.initMode === 'validate') {
        if (!exists) {
          throw this.validateError(
            'CREATE_TABLE',
            `Table ${tableName} does not exist (initMode='validate' will not create it)`,
            { tableName },
          );
        }
        await this.validateTableSchema(tableName, schema);
        return;
      }
      if (exists) return;

      const columnFragments = Object.entries(schema).map(([name, def]) => this.buildColumnDefinition(name, def));
      const pkColumns = this.getPrimaryKeyColumns(tableName, schema);
      if (pkColumns.length === 0) {
        throw new Error(`Cannot create table ${tableName}: no primary key columns determined`);
      }

      const pkClause = `PRIMARY KEY (${pkColumns.map(c => quoteIdent(c, 'column name')).join(', ')})`;
      const ddl = `CREATE TABLE ${quoteIdent(tableName, 'table name')} (\n  ${columnFragments.join(',\n  ')}\n) ${pkClause}`;
      await this.runDdl([ddl]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    } finally {
      this.tableColumnsCache.delete(tableName);
    }
  }

  /**
   * Adds columns from `schema` that don't yet exist on the table.
   * Useful for forward-compatible schema migrations.
   */
  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    try {
      if (this.initMode === 'validate') {
        const missing: string[] = [];
        for (const columnName of ifNotExists) {
          // Only validate columns that actually appear in the schema.
          if (!schema[columnName]) continue;
          if (!(await this.hasColumn(tableName, columnName))) missing.push(columnName);
        }
        if (missing.length > 0) {
          throw this.validateError(
            'ALTER_TABLE',
            `Missing columns on ${tableName}: ${missing.join(', ')} (initMode='validate' will not add them)`,
            { tableName, missing: missing.join(',') },
          );
        }
        return;
      }
      const statements: string[] = [];
      for (const columnName of ifNotExists) {
        const columnDef = schema[columnName];
        if (!columnDef) continue;
        if (await this.hasColumn(tableName, columnName)) continue;
        // Spanner cannot add NOT NULL columns to existing tables without a default,
        // so newly-added columns are always nullable initially.
        const fragment = `${quoteIdent(columnName, 'column name')} ${getSpannerType(columnDef.type)}`;
        statements.push(`ALTER TABLE ${quoteIdent(tableName, 'table name')} ADD COLUMN ${fragment}`);
      }
      await this.runDdl(statements);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'ALTER_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    } finally {
      this.tableColumnsCache.delete(tableName);
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const exists = await this.tableExists(tableName);
      if (!exists) return;
      // Drop indexes first - Spanner refuses to drop tables with indexes attached.
      const indexes = await this.listIndexes(tableName);
      const dropIndexStmts = indexes
        // PRIMARY_KEY index is auto-managed and cannot be dropped via DROP INDEX.
        .filter(idx => idx.name && idx.name !== 'PRIMARY_KEY')
        .map(idx => `DROP INDEX ${quoteIdent(idx.name, 'index name')}`);
      const stmts = [...dropIndexStmts, `DROP TABLE ${quoteIdent(tableName, 'table name')}`];
      await this.runDdl(stmts);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DROP_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    } finally {
      this.tableColumnsCache.delete(tableName);
    }
  }

  /** Spanner has no TRUNCATE  fall back to `DELETE WHERE TRUE`. */
  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      // Skip if the table hasn't been created yet (e.g. during test teardown
      // after a failed init).
      if (!(await this.tableExists(tableName))) return;
      await this.runDml({ sql: `DELETE FROM ${quoteIdent(tableName, 'table name')} WHERE TRUE` });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CLEAR_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Converts a JS value into the form Spanner expects for the column.
   *  - jsonb: serialize to JSON string (caller must pass type 'json' in `types`).
   *  - integer/bigint: pass through (numbers are accepted; Spanner will coerce).
   *  - timestamp: ISO string when given a Date.
   *  - boolean: pass through as boolean.
   *  - text/uuid: stringify objects (legacy callers pass already-stringified JSON).
   */
  prepareValue(value: any, columnName: string, tableName: TABLE_NAMES): any {
    if (value === null || value === undefined) {
      return null;
    }

    const columnSchema = getColumnDef(tableName, columnName);

    if (columnSchema?.type === 'jsonb') {
      // Pass JSON values as serialized strings; the calling code attaches a
      // `json` param-type hint so Spanner stores them as native JSON.
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          try {
            // Validate by round-tripping through JSON.parse / JSON.stringify so we
            // emit canonical JSON to Spanner.
            return JSON.stringify(JSON.parse(trimmed));
          } catch {
            return JSON.stringify(value);
          }
        }
        return JSON.stringify(value);
      }
      if (typeof value === 'bigint') {
        return JSON.stringify(value.toString());
      }
      return JSON.stringify(value);
    }

    if (columnSchema?.type === 'timestamp') {
      if (value instanceof Date) return value.toISOString();
      return value;
    }

    if (columnSchema?.type === 'boolean') {
      return Boolean(value);
    }

    if (columnSchema?.type === 'integer' || columnSchema?.type === 'bigint') {
      if (typeof value === 'number') return value;
      if (typeof value === 'bigint') return value.toString();
      return value;
    }

    // Default: for text/uuid columns a stray object value is best-effort-stringified
    // to retain backwards compatibility with callers passing structured data.
    if (typeof value === 'object' && !(value instanceof Date)) {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Convert a value into the shape the Spanner Mutations API expects for the
   * given column. Mutations encoding differs from DML in three places:
   *
   *  - JSON columns: the codec serializes plain JS objects with
   *    `JSON.stringify`, but it encodes arrays as protobuf `list_value`,
   *    which the server rejects for JSON-typed columns
   *    ("Could not parse list_value … as JSON"). Pre-stringifying every
   *    JSON value sidesteps that fork.
   *  - FLOAT64 columns: whole-number JS values like `100` get either
   *    INT64-inferred or string-encoded by the client when sent as a bare
   *    number — the server then refuses them. `Spanner.float()` is the
   *    documented escape hatch.
   *  - TIMESTAMP columns: the codec already handles `Date` instances via
   *    `.toJSON()`, so we pass them through as-is (DML's `prepareValue`
   *    converts to an ISO string because DML wants `'timestamp'` type
   *    hints; mutations don't take per-row hints).
   *
   * Everything else (text/uuid/bool/int) goes through `prepareValue` for
   * parity with the DML path.
   */
  prepareValueForMutation(value: any, columnName: string, tableName: TABLE_NAMES): any {
    if (value === null || value === undefined) return null;
    const colType = getColumnDef(tableName, columnName)?.type;

    if (colType === 'jsonb') {
      // Reuse prepareValue's canonicalisation (round-trip strings through
      // parse/stringify so we don't double-encode pre-stringified payloads).
      return this.prepareValue(value, columnName, tableName);
    }
    if (colType === 'timestamp') {
      // Mutations API: Date pass-through (codec serializes via .toJSON()).
      if (value instanceof Date) return value;
      if (typeof value === 'string') return new Date(value);
      return value;
    }
    if (colType === 'float') {
      return Spanner.float(Number(value));
    }
    if (colType === 'boolean') return Boolean(value);
    if (colType === 'integer' || colType === 'bigint') {
      if (typeof value === 'number') return value;
      if (typeof value === 'bigint') return value.toString();
      return value;
    }
    // text / uuid / unknown — best-effort stringify objects same as
    // prepareValue does, so structured-data callers stay backwards compatible.
    if (typeof value === 'object' && !(value instanceof Date)) {
      return JSON.stringify(value);
    }
    return value;
  }

  async insert({
    tableName,
    record,
    transaction,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
    transaction?: Transaction;
  }): Promise<void> {
    try {
      const filtered = await this.filterRecordToKnownColumns(tableName, record);
      const columns = Object.keys(filtered);
      if (columns.length === 0) return;

      const sql = `INSERT INTO ${quoteIdent(tableName, 'table name')} (${columns
        .map(c => quoteIdent(c, 'column name'))
        .join(', ')}) VALUES (${columns.map(c => `@${c}`).join(', ')})`;

      const params: Record<string, any> = {};
      const types: Record<string, any> = {};
      for (const col of columns) {
        const value = this.prepareValue(filtered[col], col, tableName);
        params[col] = value;
        const colType = getColumnDef(tableName, col)?.type;
        if (value === null || colType === 'jsonb' || colType === 'timestamp') {
          types[col] = getSpannerParamType(colType);
        }
      }

      await this.runDml({ sql, params, types }, transaction);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * INSERT OR UPDATE upsert. Spanner cannot emit RETURNING-style results from
   * INSERT OR UPDATE so callers must re-load the row when they need the post-write
   * state.
   */
  async upsert({
    tableName,
    record,
    transaction,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
    transaction?: Transaction;
  }): Promise<void> {
    try {
      const filtered = await this.filterRecordToKnownColumns(tableName, record);
      const columns = Object.keys(filtered);
      if (columns.length === 0) return;

      const sql = `INSERT OR UPDATE INTO ${quoteIdent(tableName, 'table name')} (${columns
        .map(c => quoteIdent(c, 'column name'))
        .join(', ')}) VALUES (${columns.map(c => `@${c}`).join(', ')})`;

      const params: Record<string, any> = {};
      const types: Record<string, any> = {};
      for (const col of columns) {
        const value = this.prepareValue(filtered[col], col, tableName);
        params[col] = value;
        const colType = getColumnDef(tableName, col)?.type;
        if (value === null || colType === 'jsonb' || colType === 'timestamp') {
          types[col] = getSpannerParamType(colType);
        }
      }

      await this.runDml({ sql, params, types }, transaction);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async update({
    tableName,
    keys,
    data,
    transaction,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
    transaction?: Transaction;
  }): Promise<void> {
    try {
      if (!data || Object.keys(data).length === 0) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE', 'EMPTY_DATA'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Cannot update with empty data payload',
        });
      }
      if (!keys || Object.keys(keys).length === 0) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE', 'EMPTY_KEYS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Cannot update without keys to identify records',
        });
      }
      const filtered = await this.filterRecordToKnownColumns(tableName, data);
      if (Object.keys(filtered).length === 0) return;

      const setClauses: string[] = [];
      const params: Record<string, any> = {};
      const types: Record<string, any> = {};
      let i = 0;

      for (const [col, value] of Object.entries(filtered)) {
        const param = `set_${i++}`;
        setClauses.push(`${quoteIdent(col, 'column name')} = @${param}`);
        const prepared = this.prepareValue(value, col, tableName);
        params[param] = prepared;
        const colType = getColumnDef(tableName, col)?.type;
        if (prepared === null || colType === 'jsonb' || colType === 'timestamp') {
          types[param] = getSpannerParamType(colType);
        }
      }

      const whereClauses: string[] = [];
      for (const [col, value] of Object.entries(keys)) {
        const param = `where_${i++}`;
        whereClauses.push(`${quoteIdent(col, 'column name')} = @${param}`);
        const prepared = this.prepareValue(value, col, tableName);
        params[param] = prepared;
        const colType = getColumnDef(tableName, col)?.type;
        if (prepared === null || colType === 'jsonb' || colType === 'timestamp') {
          types[param] = getSpannerParamType(colType);
        }
      }

      const sql = `UPDATE ${quoteIdent(tableName, 'table name')} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

      await this.runDml({ sql, params, types }, transaction);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (records.length === 0) return;
    try {
      // Filter + encode all rows up front, before opening the transaction,
      // so we don't hold row locks while waiting on JSON.stringify of large
      // payloads. The column filter is per-call cached anyway.
      const encoded: Record<string, any>[] = [];
      for (const record of records) {
        const filtered = await this.filterRecordToKnownColumns(tableName, record);
        const row: Record<string, any> = {};
        for (const [col, value] of Object.entries(filtered)) {
          row[col] = this.prepareValueForMutation(value, col, tableName);
        }
        if (Object.keys(row).length > 0) encoded.push(row);
      }
      if (encoded.length === 0) return;

      await this.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async (tx: Transaction) => {
          try {
            tx.insert(tableName, encoded);
            await tx.commit();
          } catch (err) {
            // The Spanner client does NOT auto-rollback when the runFn throws
            // explicitly release the transaction so its row locks are freed.
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, numberOfRecords: records.length },
        },
        error,
      );
    }
  }

  async batchUpdate({
    tableName,
    updates,
  }: {
    tableName: TABLE_NAMES;
    updates: Array<{ keys: Record<string, any>; data: Record<string, any> }>;
  }): Promise<void> {
    if (updates.length === 0) return;
    try {
      await this.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async (tx: Transaction) => {
          try {
            for (const { keys, data } of updates) {
              await this.update({ tableName, keys, data, transaction: tx });
            }
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, numberOfRecords: updates.length },
        },
        error,
      );
    }
  }

  async batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any>[] }): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async (tx: Transaction) => {
          try {
            for (const keySet of keys) {
              const conditions: string[] = [];
              const params: Record<string, any> = {};
              const types: Record<string, any> = {};
              let i = 0;
              for (const [col, value] of Object.entries(keySet)) {
                i = this.aggregateParams(i, conditions, col, value, tableName, params, types);
              }
              if (conditions.length === 0) continue;
              const sql = `DELETE FROM ${quoteIdent(tableName, 'table name')} WHERE ${conditions.join(' AND ')}`;
              await tx.runUpdate({ sql, params, types });
            }
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, numberOfRecords: keys.length },
        },
        error,
      );
    }
  }

  /**
   * Binds a single (column, value) pair into the SQL conditions/params/types
   * accumulators and returns the next available parameter index.
   *
   * The previous version of this helper accepted `i` as a primitive argument
   * and used `i++` internally, which only mutated the local copy  every
   * call ended up emitting `@p0`. Returning the new counter value forces
   * callers to thread the index forward and makes that footgun impossible.
   */
  private aggregateParams(
    i: number,
    conditions: string[],
    col: string,
    value: any,
    tableName: TABLE_NAMES,
    params: Record<string, any>,
    types: Record<string, any>,
  ): number {
    const param = `p${i}`;
    conditions.push(`${quoteIdent(col, 'column name')} = @${param}`);
    const prepared = this.prepareValue(value, col, tableName);
    params[param] = prepared;
    const colType = getColumnDef(tableName, col)?.type;
    // Always emit a Spanner type hint for JSON and TIMESTAMP columns
    // (jsonb because prepareValue serialises to string and Spanner needs
    // the `json` type to round-trip; timestamp because prepareValue
    // serialises Date → ISO string and the client otherwise infers
    // `string`, which fails STRING → TIMESTAMP coercion in predicates).
    // For other column types we only emit a hint when the value is null.
    if (prepared === null || colType === 'jsonb' || colType === 'timestamp') {
      types[param] = getSpannerParamType(colType);
    }
    return i + 1;
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    try {
      if (!keys || Object.keys(keys).length === 0) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'LOAD', 'EMPTY_KEYS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Cannot load without keys to identify records',
        });
      }
      const conditions: string[] = [];
      const params: Record<string, any> = {};
      const types: Record<string, any> = {};
      let i = 0;
      for (const [col, value] of Object.entries(keys)) {
        i = this.aggregateParams(i, conditions, col, value, tableName, params, types);
      }
      const sql = `SELECT * FROM ${quoteIdent(tableName, 'table name')} WHERE ${conditions.join(' AND ')} LIMIT 1`;
      const [rows] = await this.database.run({ sql, params, types, json: true });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      const result = this.transformRow(tableName, row);
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = result as any;
        if (typeof snapshot.snapshot === 'string') {
          try {
            snapshot.snapshot = JSON.parse(snapshot.snapshot);
          } catch {
            // leave as-is if not valid JSON
          }
        }
        return snapshot;
      }
      return result as R;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LOAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Convert a raw Spanner JSON row into the storage layer's expected shape.
   * Handles JSON-string values, timestamp strings, and bigint integers returned
   * by the Spanner client.
   */
  transformRow<T = Record<string, any>>(tableName: TABLE_NAMES, row: Record<string, any>): T {
    const schema = TABLE_SCHEMAS[tableName];
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const colDef = schema?.[key];
      if (value === null || value === undefined) {
        result[key] = value;
        continue;
      }
      if (colDef?.type === 'jsonb') {
        if (typeof value === 'string') {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        } else {
          result[key] = value;
        }
      } else if (colDef?.type === 'timestamp') {
        if (value instanceof Date) {
          // Spanner returns PreciseDate which extends Date  normalize to a
          // plain Date so .toISOString() emits millisecond precision.
          result[key] = new Date(value.getTime());
        } else if (typeof value === 'string') {
          result[key] = new Date(value);
        } else if (typeof value === 'object' && typeof (value as any).value === 'string') {
          result[key] = new Date((value as any).value);
        } else {
          result[key] = value;
        }
      } else if (colDef?.type === 'integer' || colDef?.type === 'bigint') {
        if (typeof value === 'string') {
          const n = Number(value);
          result[key] = Number.isSafeInteger(n) ? n : value;
        } else if (typeof value === 'bigint') {
          const n = Number(value);
          result[key] = Number.isSafeInteger(n) ? n : value.toString();
        } else {
          result[key] = value;
        }
      } else if (colDef?.type === 'boolean') {
        result[key] = Boolean(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  /**
   * Build a parameterized WHERE fragment from a filter object.
   * Supports `_gte`/`_gt`/`_lte`/`_lt` suffixes, `$in` operator, array-as-IN,
   * and `null` IS NULL comparisons.
   */
  prepareWhereClause(
    filters: Record<string, any>,
    tableName?: TABLE_NAMES,
  ): { sql: string; params: Record<string, any>; types: Record<string, any> } {
    const conditions: string[] = [];
    const params: Record<string, any> = {};
    const types: Record<string, any> = {};
    let i = 0;
    const bind = (col: string, value: unknown): string => {
      const param = `w${i++}`;
      let prepared: any;
      if (value instanceof Date) {
        prepared = value.toISOString();
      } else if (tableName) {
        prepared = this.prepareValue(value, col, tableName);
      } else {
        prepared = value;
      }
      params[param] = prepared;
      const colType = tableName ? getColumnDef(tableName, col)?.type : undefined;
      // Always emit a Spanner type hint for JSON and TIMESTAMP columns
      // (see aggregateParams above for the rationale). Other types only
      // get a hint when the value is null.
      if (prepared === null || colType === 'jsonb' || colType === 'timestamp') {
        types[param] = tableName ? getSpannerParamType(colType) : 'string';
      }
      return param;
    };

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;

      const handleOp = (suffix: string, op: string) => {
        const fieldName = key.slice(0, -suffix.length);
        const param = bind(fieldName, value);
        conditions.push(`${quoteIdent(fieldName, 'field name')} ${op} @${param}`);
      };

      if (key.endsWith('_gte')) {
        handleOp('_gte', '>=');
      } else if (key.endsWith('_gt')) {
        handleOp('_gt', '>');
      } else if (key.endsWith('_lte')) {
        handleOp('_lte', '<=');
      } else if (key.endsWith('_lt')) {
        handleOp('_lt', '<');
      } else if (value === null) {
        conditions.push(`${quoteIdent(key, 'field name')} IS NULL`);
      } else if (isInOperator(value)) {
        const inValues = value.$in;
        if (inValues.length === 0) {
          conditions.push('1 = 0');
        } else if (inValues.length === 1) {
          const param = bind(key, inValues[0]);
          conditions.push(`${quoteIdent(key, 'field name')} = @${param}`);
        } else {
          const paramNames: string[] = [];
          for (const item of inValues) {
            paramNames.push(`@${bind(key, item)}`);
          }
          conditions.push(`${quoteIdent(key, 'field name')} IN (${paramNames.join(', ')})`);
        }
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          conditions.push('1 = 0');
        } else if (value.length === 1) {
          const param = bind(key, value[0]);
          conditions.push(`${quoteIdent(key, 'field name')} = @${param}`);
        } else {
          const paramNames: string[] = [];
          for (const item of value) {
            paramNames.push(`@${bind(key, item)}`);
          }
          conditions.push(`${quoteIdent(key, 'field name')} IN (${paramNames.join(', ')})`);
        }
      } else {
        const param = bind(key, value);
        conditions.push(`${quoteIdent(key, 'field name')} = @${param}`);
      }
    }

    return {
      sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
      params,
      types,
    };
  }

  /**
   * Reads an index from INFORMATION_SCHEMA and compares its table, column list
   * (with ordering), and unique flag against the expected definition. Throws a
   * typed VALIDATE_FAILED error when anything diverges so the operator can
   * reconcile their externally-managed schema.
   */
  private async validateIndexDefinition(expected: {
    name: string;
    table: string;
    columns: string[];
    unique: boolean;
  }): Promise<void> {
    const [indexRows] = await this.database.run({
      sql: `SELECT TABLE_NAME, IS_UNIQUE
            FROM INFORMATION_SCHEMA.INDEXES
            WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @indexName`,
      params: { indexName: expected.name },
      json: true,
    });
    const indexRow = (indexRows as Array<{ TABLE_NAME: string; IS_UNIQUE: boolean | string }>)[0];
    if (!indexRow) {
      throw this.validateError(
        'INDEX_CREATE',
        `Index ${expected.name} on ${expected.table} does not exist (initMode='validate' will not create it)`,
        { indexName: expected.name, tableName: expected.table },
      );
    }

    if (indexRow.TABLE_NAME !== expected.table) {
      throw this.validateError(
        'INDEX_CREATE',
        `Index ${expected.name} is on table ${indexRow.TABLE_NAME}, expected ${expected.table}`,
        {
          indexName: expected.name,
          expectedTable: expected.table,
          actualTable: indexRow.TABLE_NAME,
        },
      );
    }

    const actualUnique = indexRow.IS_UNIQUE === true || indexRow.IS_UNIQUE === 'YES';
    if (actualUnique !== expected.unique) {
      throw this.validateError(
        'INDEX_CREATE',
        `Index ${expected.name} unique flag mismatch (expected ${expected.unique}, actual ${actualUnique})`,
        {
          indexName: expected.name,
          tableName: expected.table,
          expectedUnique: expected.unique,
          actualUnique,
        },
      );
    }

    const [colRows] = await this.database.run({
      sql: `SELECT COLUMN_NAME, COLUMN_ORDERING
            FROM INFORMATION_SCHEMA.INDEX_COLUMNS
            WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @indexName
            ORDER BY ORDINAL_POSITION`,
      params: { indexName: expected.name },
      json: true,
    });
    // Spanner reports COLUMN_ORDERING as 'ASC' / 'DESC' for indexed columns and
    // NULL for STORING columns; we never declare STORING columns, so any null
    // ordering still represents an indexed column with default ASC ordering.
    const actualColumns = (colRows as Array<{ COLUMN_NAME: string; COLUMN_ORDERING: string | null }>).map(
      c => `${c.COLUMN_NAME}${c.COLUMN_ORDERING && c.COLUMN_ORDERING !== 'ASC' ? ` ${c.COLUMN_ORDERING}` : ''}`,
    );
    const normalisedExpected = expected.columns.map(col => {
      // Strip an explicit "ASC" so it round-trips against the schema's default.
      if (col.endsWith(' ASC')) return col.slice(0, -' ASC'.length);
      return col;
    });

    const matches =
      actualColumns.length === normalisedExpected.length && actualColumns.every((c, i) => c === normalisedExpected[i]);
    if (!matches) {
      throw this.validateError(
        'INDEX_CREATE',
        `Index ${expected.name} column list mismatch (expected [${normalisedExpected.join(', ')}], actual [${actualColumns.join(', ')}])`,
        {
          indexName: expected.name,
          tableName: expected.table,
          expectedColumns: normalisedExpected.join(','),
          actualColumns: actualColumns.join(','),
        },
      );
    }
  }

  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const { name, table, columns, unique = false } = options;
      const indexNameSafe = name; // parsed inside quoteIdent
      if (this.initMode === 'validate') {
        await this.validateIndexDefinition({ name: indexNameSafe, table, columns, unique });
        return;
      }
      if (await this.indexExists(indexNameSafe)) return;

      const columnsStr = columns
        .map(col => {
          if (col.endsWith(' DESC') || col.endsWith(' ASC')) {
            const idx = col.lastIndexOf(' ');
            const colName = col.slice(0, idx);
            const direction = col.slice(idx + 1);
            return `${quoteIdent(colName, 'column name')} ${direction}`;
          }
          return quoteIdent(col, 'column name');
        })
        .join(', ');

      const uniqueStr = unique ? 'UNIQUE ' : '';
      const ddl = `CREATE ${uniqueStr}INDEX ${quoteIdent(indexNameSafe, 'index name')} ON ${quoteIdent(table, 'table name')} (${columnsStr})`;
      await this.runDdl([ddl]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'INDEX_CREATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName: options.name, tableName: options.table },
        },
        error,
      );
    }
  }

  /**
   * Creates a batch of indexes, swallowing per-index failures with a logger
   * warning. Two classes of failure ALWAYS propagate:
   *
   *  - validate-mode mismatches, so the operator sees the missing-index
   *    error instead of a silent no-op;
   *  - failures on `unique: true` indexes, because a unique index encodes a
   *    data-integrity invariant (e.g. duplicate-version prevention). If we
   *    swallowed those failures the invariant would silently not be in
   *    force, so we surface the error and let init() abort.
   *
   * Non-unique indexes are best-effort: domains use this for both default
   * and custom index creation, and the swallow behavior keeps `init()`
   * resilient to transient races (another process creating the same index
   * concurrently, etc.).
   */
  async createIndexes(indexes: CreateIndexOptions[]): Promise<void> {
    for (const indexDef of indexes) {
      try {
        await this.createIndex(indexDef);
      } catch (error) {
        if (error instanceof MastraError && /VALIDATE_FAILED/.test(error.id)) {
          throw error;
        }
        if (indexDef.unique) {
          throw error;
        }
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async dropIndex(indexName: string): Promise<void> {
    try {
      if (!(await this.indexExists(indexName))) return;
      await this.runDdl([`DROP INDEX ${quoteIdent(indexName, 'index name')}`]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'INDEX_DROP', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    try {
      const sqlBase = `SELECT i.INDEX_NAME, i.TABLE_NAME, i.IS_UNIQUE
                       FROM INFORMATION_SCHEMA.INDEXES i
                       WHERE i.TABLE_SCHEMA = '' AND i.INDEX_TYPE = 'INDEX'`;
      const [rows] = tableName
        ? await this.database.run({
            sql: `${sqlBase} AND i.TABLE_NAME = @table`,
            params: { table: tableName },
            json: true,
          })
        : await this.database.run({ sql: sqlBase, json: true });

      const indexes: IndexInfo[] = [];
      for (const row of rows as Array<{ INDEX_NAME: string; TABLE_NAME: string; IS_UNIQUE: boolean | string }>) {
        const [colRows] = await this.database.run({
          sql: `SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.INDEX_COLUMNS
                WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @table AND INDEX_NAME = @index
                ORDER BY ORDINAL_POSITION`,
          params: { table: row.TABLE_NAME, index: row.INDEX_NAME },
          json: true,
        });
        indexes.push({
          name: row.INDEX_NAME,
          table: row.TABLE_NAME,
          columns: (colRows as Array<{ COLUMN_NAME: string }>).map(c => c.COLUMN_NAME),
          unique: Boolean(row.IS_UNIQUE === true || row.IS_UNIQUE === 'YES'),
          size: '0 MB',
          definition: '',
        });
      }
      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'INDEX_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: tableName ? { tableName } : {},
        },
        error,
      );
    }
  }

  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT INDEX_NAME, TABLE_NAME, IS_UNIQUE
              FROM INFORMATION_SCHEMA.INDEXES
              WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @index`,
        params: { index: indexName },
        json: true,
      });
      const row = (rows as Array<{ INDEX_NAME: string; TABLE_NAME: string; IS_UNIQUE: boolean | string }>)[0];
      if (!row) {
        throw new Error(`Index "${indexName}" not found`);
      }
      const [colRows] = await this.database.run({
        sql: `SELECT COLUMN_NAME
              FROM INFORMATION_SCHEMA.INDEX_COLUMNS
              WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @index
              ORDER BY ORDINAL_POSITION`,
        params: { index: indexName },
        json: true,
      });
      return {
        name: row.INDEX_NAME,
        table: row.TABLE_NAME,
        columns: (colRows as Array<{ COLUMN_NAME: string }>).map(c => c.COLUMN_NAME),
        unique: Boolean(row.IS_UNIQUE === true || row.IS_UNIQUE === 'YES'),
        size: '0 MB',
        definition: '',
        method: 'btree',
        scans: 0,
        tuples_read: 0,
        tuples_fetched: 0,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'INDEX_DESCRIBE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }
}
