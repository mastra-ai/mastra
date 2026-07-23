import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, getDefaultValue } from '@mastra/core/storage';
import type {
  StorageColumn,
  TABLE_NAMES,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { HANAPool } from './pool';
import type { HANAConnection, HANAPoolConfig } from './pool';
import { getSchemaName, getTableName, prepareValue, transformFromRow } from './utils';

export type { CreateIndexOptions, IndexInfo, StorageIndexStats };

/**
 * Configuration for standalone domain usage (bring your own pool or connection params).
 */
export type HANADomainConfig = HANADomainPoolConfig | HANADomainRestConfig;

export interface HANADomainPoolConfig {
  pool: HANAPool;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
  indexes?: CreateIndexOptions[];
}

export interface HANADomainRestConfig {
  host: string;
  port: number;
  uid: string;
  pwd: string;
  databaseName?: string;
  encrypt?: boolean;
  sslValidateCertificate?: boolean;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
  indexes?: CreateIndexOptions[];
  /** Pool min connections (default: 1). */
  poolMin?: number;
  /** Pool max connections (default: 10). */
  poolMax?: number;
}

/**
 * Resolves a HANADomainConfig into a pool, schemaName, and other settings.
 * When connection params are provided, the returned pool is NOT yet initialised.
 * The domain must call pool.initialize() (via HANAClient) before use.
 */
export function resolveHanaConfig(config: HANADomainConfig): {
  pool: HANAPool;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
  indexes?: CreateIndexOptions[];
  needsInit: boolean;
} {
  if ('pool' in config && !('host' in config)) {
    return {
      pool: config.pool,
      schemaName: config.schemaName,
      skipDefaultIndexes: config.skipDefaultIndexes,
      indexes: config.indexes,
      needsInit: false,
    };
  }

  const restConfig = config as HANADomainRestConfig;
  const poolConfig: HANAPoolConfig = {
    host: restConfig.host,
    port: restConfig.port,
    uid: restConfig.uid,
    pwd: restConfig.pwd,
    databaseName: restConfig.databaseName,
    encrypt: restConfig.encrypt,
    sslValidateCertificate: restConfig.sslValidateCertificate,
    min: restConfig.poolMin ?? 1,
    max: restConfig.poolMax ?? 10,
  };

  return {
    pool: new HANAPool(poolConfig),
    schemaName: restConfig.schemaName,
    skipDefaultIndexes: restConfig.skipDefaultIndexes,
    indexes: restConfig.indexes,
    needsInit: true,
  };
}

/**
 * Core DDL/DML helper for the SAP HANA storage adapter.
 *
 * Provides table creation, column detection, record insert/load/update,
 * batch operations, and index management — all using HANA SQL dialect.
 */
export class HANAClient extends MastraBase {
  public pool: HANAPool;
  public schemaName?: string;
  public skipDefaultIndexes?: boolean;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;

  /** Cache of actual table columns: tableName -> Set<columnName> */
  private tableColumnsCache = new Map<string, Set<string>>();

  /**
   * Columns that store large amounts of data (JSON/text blobs) — mapped to NCLOB.
   */
  private readonly LARGE_DATA_COLUMNS = [
    'workingMemory',
    'snapshot',
    'metadata',
    'content',
    'input',
    'output',
    'instructions',
    'other',
  ];

  protected getSqlType(type: StorageColumn['type'], isPrimaryKey = false, useLargeStorage = false): string {
    switch (type) {
      case 'text':
        if (useLargeStorage) return 'NCLOB';
        return isPrimaryKey ? 'NVARCHAR(255)' : 'NVARCHAR(5000)';
      case 'timestamp':
        // Store timestamps as ISO strings (NVARCHAR) to avoid HANA server-timezone
        // conversion that occurs with the native TIMESTAMP type.
        return 'NVARCHAR(30)';
      case 'uuid':
        return 'NVARCHAR(36)';
      case 'jsonb':
        return 'NCLOB';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'float':
        return 'DOUBLE';
      case 'boolean':
        // HANA has no native BOOLEAN column — use TINYINT (0/1)
        return 'TINYINT';
      default:
        throw new MastraError({
          id: createStorageErrorId('HANA', 'TYPE', 'NOT_SUPPORTED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        });
    }
  }

  constructor({
    pool,
    schemaName,
    skipDefaultIndexes,
  }: {
    pool: HANAPool;
    schemaName?: string;
    skipDefaultIndexes?: boolean;
  }) {
    super({ component: 'STORAGE', name: 'HANAClient' });
    this.pool = pool;
    this.schemaName = schemaName;
    this.skipDefaultIndexes = skipDefaultIndexes;
  }

  /** Fetch and cache the columns that exist in a table. */
  private async getTableColumns(tableName: TABLE_NAMES): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName);
    if (cached) return cached;

    const schemaParam = this.schemaName || null;
    const sql = schemaParam
      ? `SELECT COLUMN_NAME FROM SYS.TABLE_COLUMNS WHERE SCHEMA_NAME = ? AND TABLE_NAME = ?`
      : `SELECT COLUMN_NAME FROM SYS.TABLE_COLUMNS WHERE SCHEMA_NAME = CURRENT_USER AND TABLE_NAME = ?`;
    const params = schemaParam ? [schemaParam, tableName] : [tableName];
    const rows = await this.pool.withConnection(conn => conn.execPromise(sql, params));

    const columns = new Set((rows as Array<{ COLUMN_NAME: string }>).map(r => r.COLUMN_NAME));
    if (columns.size > 0) {
      this.tableColumnsCache.set(tableName, columns);
    }
    return columns;
  }

  /** Drop unknown columns from a record before DML to stay forward-compatible. */
  private async filterRecordToKnownColumns(
    tableName: TABLE_NAMES,
    record: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const knownColumns = await this.getTableColumns(tableName);
    if (knownColumns.size === 0) return record;

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (knownColumns.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  /** Check whether a column exists in a table. */
  async hasColumn(table: string, column: string): Promise<boolean> {
    // When schemaName is unset, fall back to CURRENT_USER (the connecting user's default schema)
    const schemaParam = this.schemaName || null;
    const sql = schemaParam
      ? `SELECT COUNT(*) AS CNT FROM SYS.TABLE_COLUMNS WHERE SCHEMA_NAME = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`
      : `SELECT COUNT(*) AS CNT FROM SYS.TABLE_COLUMNS WHERE SCHEMA_NAME = CURRENT_USER AND TABLE_NAME = ? AND COLUMN_NAME = ?`;
    const params = schemaParam ? [schemaParam, table, column] : [table, column];
    const rows = await this.pool.withConnection(conn => conn.execPromise(sql, params));
    return Number((rows as Array<{ CNT: number }>)[0]?.CNT) > 0;
  }

  /** Ensure the target schema exists, creating it if necessary. */
  private async setupSchema(): Promise<void> {
    if (!this.schemaName || this.schemaSetupComplete) return;

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          const rows = await this.pool.withConnection(conn =>
            conn.execPromise(`SELECT COUNT(*) AS CNT FROM SYS.SCHEMAS WHERE SCHEMA_NAME = ?`, [this.schemaName]),
          );
          const exists = Number((rows as Array<{ CNT: number }>)[0]?.CNT) > 0;

          if (!exists) {
            try {
              await this.pool.withConnection(conn =>
                conn.execPromise(`CREATE SCHEMA "${parseSqlIdentifier(this.schemaName!, 'schema name')}"`, []),
              );
              this.logger?.info?.(`Schema "${this.schemaName}" created`);
            } catch {
              // Schema creation may fail if the user lacks CREATE SCHEMA privilege.
              // Fall back to the connecting user's own schema (CURRENT_USER).
              const userRows = await this.pool.withConnection(conn =>
                conn.execPromise(`SELECT CURRENT_USER AS U FROM DUMMY`, []),
              );
              const currentUser = (userRows as Array<{ U: string }>)[0]?.U ?? undefined;
              this.logger?.warn?.(
                `Unable to create schema "${this.schemaName}" (insufficient privilege). ` +
                  `Falling back to user schema "${currentUser}".`,
              );
              this.schemaName = currentUser;
            }
          }
          this.schemaSetupComplete = true;
        } finally {
          this.setupSchemaPromise = null;
        }
      })();
    }

    await this.setupSchemaPromise;
  }

  /**
   * Create a table from the provided column schema if it doesn't already exist,
   * then call alterTable() to add any new columns.
   */
  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await this.setupSchema();

    const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });

    // Check whether the table already exists
    const schemaParam = this.schemaName || null;
    const tableCheckSql = schemaParam
      ? `SELECT COUNT(*) AS CNT FROM SYS.TABLES WHERE SCHEMA_NAME = ? AND TABLE_NAME = ?`
      : `SELECT COUNT(*) AS CNT FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_USER AND TABLE_NAME = ?`;
    const tableCheckParams = schemaParam ? [schemaParam, tableName] : [tableName];
    const checkRows = await this.pool.withConnection(conn => conn.execPromise(tableCheckSql, tableCheckParams));
    const tableExists = Number((checkRows as Array<{ CNT: number }>)[0]?.CNT) > 0;

    if (!tableExists) {
      const columnDefs = Object.entries(schema).map(([colName, colDef]) => {
        const isPk = colDef.primaryKey === true;
        const isLarge = this.LARGE_DATA_COLUMNS.includes(colName);
        const sqlType = this.getSqlType(colDef.type, isPk, isLarge);

        // seq_id auto-increment
        if (colName === 'seq_id' && colDef.type === 'integer') {
          return `"seq_id" INTEGER GENERATED ALWAYS AS IDENTITY`;
        }

        const nullable = colDef.nullable !== false ? '' : ' NOT NULL';
        // HANA does not support DEFAULT on LOB columns (NCLOB)
        const defaultVal = colDef.nullable === false && sqlType !== 'NCLOB' ? ` ${getDefaultValue(colDef.type)}` : '';

        return `"${parseSqlIdentifier(colName, 'column name')}" ${sqlType}${nullable}${defaultVal}`;
      });

      // Collect primary key columns
      const pkCols = Object.entries(schema)
        .filter(([, def]) => def.primaryKey)
        .map(([col]) => `"${parseSqlIdentifier(col, 'column name')}"`);

      if (pkCols.length > 0) {
        columnDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
      }

      const createSql = `CREATE COLUMN TABLE ${fullName} (\n  ${columnDefs.join(',\n  ')}\n)`;
      try {
        await this.pool.withConnection(conn => conn.execPromise(createSql, []));
      } catch (err: unknown) {
        // HANA error 288 = "table/view already exists" — safe to ignore (concurrent init)
        const code = (err as { code?: number })?.code;
        if (code !== 288) throw err;
      }
      // Invalidate column cache
      this.tableColumnsCache.delete(tableName);
    }

    // Ensure seq_id identity column exists for ordered queries (add if missing)
    const seqIdExists = await this.hasColumn(tableName, 'seq_id');
    if (!seqIdExists) {
      try {
        await this.pool.withConnection(conn =>
          conn.execPromise(`ALTER TABLE ${fullName} ADD ("seq_id" INTEGER GENERATED ALWAYS AS IDENTITY)`, []),
        );
        this.tableColumnsCache.delete(tableName);
      } catch (err) {
        this.logger?.warn?.(`Failed to add seq_id to ${tableName}:`, err);
      }
    }

    // Always run alterTable to pick up new columns in migrations
    await this.alterTable({ tableName, schema });
  }

  /**
   * Add new columns that exist in the schema but not yet in the live table.
   */
  async alterTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });

    for (const [colName, colDef] of Object.entries(schema)) {
      if (colName === 'seq_id') continue; // auto-generated, skip
      const exists = await this.hasColumn(tableName, colName);
      if (!exists) {
        const isLarge = this.LARGE_DATA_COLUMNS.includes(colName);
        const sqlType = this.getSqlType(colDef.type, false, isLarge);
        // HANA does not support DEFAULT on LOB columns (NCLOB)
        const defaultVal = colDef.nullable === false && sqlType !== 'NCLOB' ? ` ${getDefaultValue(colDef.type)}` : '';
        const nullable = colDef.nullable !== false ? '' : ' NOT NULL';
        try {
          await this.pool.withConnection(conn =>
            conn.execPromise(
              `ALTER TABLE ${fullName} ADD ("${parseSqlIdentifier(colName, 'column name')}" ${sqlType}${nullable}${defaultVal})`,
              [],
            ),
          );
          // Invalidate column cache
          this.tableColumnsCache.delete(tableName);
        } catch (err) {
          this.logger?.warn?.(`Failed to add column ${colName} to ${tableName}:`, err);
        }
      }
    }
  }

  /**
   * Delete all rows from a table (for tests / dangerous operations).
   */
  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    await this.pool.withConnection(conn => conn.execPromise(`DELETE FROM ${fullName}`, []));
  }

  /**
   * Insert a single record.
   * Unknown columns (not yet in DB) are silently dropped for forward compatibility.
   */
  async insert({
    tableName,
    record,
    conn: existingConn,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, unknown>;
    conn?: HANAConnection;
  }): Promise<void> {
    try {
      const filteredRecord = await this.filterRecordToKnownColumns(tableName, record);
      const columns = Object.keys(filteredRecord);
      if (columns.length === 0) return;

      const parsedCols = columns.map(c => `"${parseSqlIdentifier(c, 'column name')}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
      const sql = `INSERT INTO ${fullName} (${parsedCols}) VALUES (${placeholders})`;

      const params = columns.map(col => prepareValue(filteredRecord[col], col, tableName));

      if (existingConn) {
        await existingConn.execPromise(sql, params);
      } else {
        await this.pool.withConnection(conn => conn.execPromise(sql, params));
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Upsert a record using HANA's `UPSERT ... WITH PRIMARY KEY` syntax.
   */
  async upsert({
    tableName,
    record,
    conn: existingConn,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, unknown>;
    conn?: HANAConnection;
  }): Promise<void> {
    try {
      const filteredRecord = await this.filterRecordToKnownColumns(tableName, record);
      const columns = Object.keys(filteredRecord);
      if (columns.length === 0) return;

      const parsedCols = columns.map(c => `"${parseSqlIdentifier(c, 'column name')}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
      const sql = `UPSERT ${fullName} (${parsedCols}) VALUES (${placeholders}) WITH PRIMARY KEY`;

      const params = columns.map(col => prepareValue(filteredRecord[col], col, tableName));

      if (existingConn) {
        await existingConn.execPromise(sql, params);
      } else {
        await this.pool.withConnection(conn => conn.execPromise(sql, params));
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Load a single record by composite key.
   * Returns null if not found.
   */
  async load({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null> {
    try {
      const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
      const conditions = Object.keys(keys)
        .map(k => `"${parseSqlIdentifier(k, 'column name')}" = ?`)
        .join(' AND ');
      const params = Object.values(keys).map(v => (v instanceof Date ? v.toISOString() : v));
      const rows = await this.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${fullName} WHERE ${conditions}`, params),
      );

      if (!rows || (rows as unknown[]).length === 0) return null;
      const row = (rows as Array<Record<string, unknown>>)[0];
      if (!row) return null;
      return transformFromRow({ tableName, row });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LOAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Update a record identified by `keys`, setting the fields in `data`.
   */
  async update({
    tableName,
    keys,
    data,
    conn: existingConn,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, unknown>;
    data: Record<string, unknown>;
    conn?: HANAConnection;
  }): Promise<void> {
    try {
      const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
      const setClauses = Object.keys(data)
        .map(k => `"${parseSqlIdentifier(k, 'column name')}" = ?`)
        .join(', ');
      const whereClauses = Object.keys(keys)
        .map(k => `"${parseSqlIdentifier(k, 'column name')}" = ?`)
        .join(' AND ');
      const params = [
        ...Object.entries(data).map(([col, val]) => prepareValue(val, col, tableName)),
        ...Object.values(keys).map(v => (v instanceof Date ? v.toISOString() : v)),
      ];

      const sql = `UPDATE ${fullName} SET ${setClauses} WHERE ${whereClauses}`;
      if (existingConn) {
        await existingConn.execPromise(sql, params);
      } else {
        await this.pool.withConnection(conn => conn.execPromise(sql, params));
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Batch insert multiple records in a single transaction.
   */
  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Array<Record<string, unknown>>;
  }): Promise<void> {
    if (records.length === 0) return;
    await this.pool.withTransaction(async conn => {
      for (const record of records) {
        await this.insert({ tableName, record, conn });
      }
    });
  }

  /**
   * Batch upsert multiple records in a single transaction.
   */
  async batchUpsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Array<Record<string, unknown>>;
  }): Promise<void> {
    if (records.length === 0) return;
    await this.pool.withTransaction(async conn => {
      for (const record of records) {
        await this.upsert({ tableName, record, conn });
      }
    });
  }

  /**
   * Batch update multiple records in a single transaction.
   */
  async batchUpdate({
    tableName,
    updates,
  }: {
    tableName: TABLE_NAMES;
    updates: Array<{ keys: Record<string, unknown>; data: Record<string, unknown> }>;
  }): Promise<void> {
    await this.pool.withTransaction(async conn => {
      for (const { keys, data } of updates) {
        await this.update({ tableName, keys, data, conn });
      }
    });
  }

  /**
   * Batch delete multiple records in a single transaction.
   */
  async batchDelete({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Array<Record<string, unknown>>;
  }): Promise<void> {
    if (keys.length === 0) return;
    const fullName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });

    await this.pool.withTransaction(async conn => {
      for (const keySet of keys) {
        const conditions = Object.keys(keySet)
          .map(k => `"${parseSqlIdentifier(k, 'column name')}" = ?`)
          .join(' AND ');
        const params = Object.values(keySet).map(v => (v instanceof Date ? v.toISOString() : v));
        await conn.execPromise(`DELETE FROM ${fullName} WHERE ${conditions}`, params);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Index management
  // ---------------------------------------------------------------------------

  /**
   * Create an index if it doesn't already exist.
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const { name, table, columns, unique = false, where } = options;
      const indexNameSafe = parseSqlIdentifier(name, 'index name');
      const schemaParam = this.schemaName || null;

      // Check existence
      const existRows = await this.pool.withConnection(conn =>
        conn.execPromise(
          schemaParam
            ? `SELECT COUNT(*) AS CNT FROM SYS.INDEXES WHERE SCHEMA_NAME = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`
            : `SELECT COUNT(*) AS CNT FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          schemaParam ? [schemaParam, table, indexNameSafe] : [table, indexNameSafe],
        ),
      );
      if (Number((existRows as Array<{ CNT: number }>)[0]?.CNT) > 0) return;

      const fullTableName = getTableName({
        indexName: table as TABLE_NAMES,
        schemaName: getSchemaName(this.schemaName),
      });

      const uniqueStr = unique ? 'UNIQUE ' : '';
      const columnsStr = columns
        .map((col: string) => {
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const parts = col.split(' ');
            const colName = parts[0]!;
            const direction = parts.slice(1).join(' ');
            return `"${parseSqlIdentifier(colName, 'column name')}" ${direction}`;
          }
          return `"${parseSqlIdentifier(col, 'column name')}"`;
        })
        .join(', ');

      const whereStr = where ? ` WHERE ${where}` : '';
      const createSql = `CREATE ${uniqueStr}INDEX "${indexNameSafe}" ON ${fullTableName} (${columnsStr})${whereStr}`;
      await this.pool.withConnection(conn => conn.execPromise(createSql, []));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INDEX_CREATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName: options.name, tableName: options.table },
        },
        error,
      );
    }
  }

  /**
   * Drop an index if it exists.
   */
  async dropIndex(indexName: string): Promise<void> {
    try {
      const schemaParam = this.schemaName || null;
      const schemaSafe = schemaParam ? parseSqlIdentifier(schemaParam, 'schema name') : null;
      const indexNameSafe = parseSqlIdentifier(indexName, 'index name');

      const rows = await this.pool.withConnection(conn =>
        conn.execPromise(
          schemaParam
            ? `SELECT TABLE_NAME FROM SYS.INDEXES WHERE SCHEMA_NAME = ? AND INDEX_NAME = ?`
            : `SELECT TABLE_NAME FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER AND INDEX_NAME = ?`,
          schemaParam ? [schemaParam, indexNameSafe] : [indexNameSafe],
        ),
      );

      if (!rows || (rows as unknown[]).length === 0) return;

      if ((rows as unknown[]).length > 1) {
        const tables = (rows as Array<{ TABLE_NAME: string }>).map(r => r.TABLE_NAME).join(', ');
        throw new MastraError({
          id: createStorageErrorId('HANA', 'INDEX', 'AMBIGUOUS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Index "${indexNameSafe}" exists on multiple tables (${tables}). Drop manually.`,
        });
      }

      const dropSql = schemaSafe ? `DROP INDEX "${schemaSafe}"."${indexNameSafe}"` : `DROP INDEX "${indexNameSafe}"`;
      await this.pool.withConnection(conn => conn.execPromise(dropSql, []));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INDEX_DROP', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * List indexes for a table or all tables in the schema.
   */
  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    try {
      const schemaParam = this.schemaName || null;
      let rows: unknown[];

      if (tableName) {
        rows = await this.pool.withConnection(conn =>
          conn.execPromise(
            schemaParam
              ? `SELECT INDEX_NAME, TABLE_NAME, CONSTRAINT FROM SYS.INDEXES WHERE SCHEMA_NAME = ? AND TABLE_NAME = ?`
              : `SELECT INDEX_NAME, TABLE_NAME, CONSTRAINT FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER AND TABLE_NAME = ?`,
            schemaParam ? [schemaParam, tableName] : [tableName],
          ),
        );
      } else {
        rows = await this.pool.withConnection(conn =>
          conn.execPromise(
            schemaParam
              ? `SELECT INDEX_NAME, TABLE_NAME, CONSTRAINT FROM SYS.INDEXES WHERE SCHEMA_NAME = ?`
              : `SELECT INDEX_NAME, TABLE_NAME, CONSTRAINT FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER`,
            schemaParam ? [schemaParam] : [],
          ),
        );
      }

      const indexes: IndexInfo[] = [];
      for (const row of rows as Array<{ INDEX_NAME: string; TABLE_NAME: string; CONSTRAINT: string }>) {
        const colRows = await this.pool.withConnection(conn =>
          conn.execPromise(
            schemaParam
              ? `SELECT COLUMN_NAME FROM SYS.INDEX_COLUMNS WHERE SCHEMA_NAME = ? AND INDEX_NAME = ? ORDER BY POSITION`
              : `SELECT COLUMN_NAME FROM SYS.INDEX_COLUMNS WHERE SCHEMA_NAME = CURRENT_USER AND INDEX_NAME = ? ORDER BY POSITION`,
            schemaParam ? [schemaParam, row.INDEX_NAME] : [row.INDEX_NAME],
          ),
        );
        indexes.push({
          name: row.INDEX_NAME,
          table: row.TABLE_NAME,
          columns: (colRows as Array<{ COLUMN_NAME: string }>).map(r => r.COLUMN_NAME),
          unique: row.CONSTRAINT === 'UNIQUE',
          size: '0 MB',
          definition: '',
        });
      }
      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INDEX_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: tableName ? { tableName } : {},
        },
        error,
      );
    }
  }

  /**
   * Get statistics for a specific index.
   */
  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    try {
      const schemaParam = this.schemaName || null;
      const indexNameSafe = parseSqlIdentifier(indexName, 'index name');

      const rows = await this.pool.withConnection(conn =>
        conn.execPromise(
          schemaParam
            ? `SELECT INDEX_NAME, TABLE_NAME, CONSTRAINT, INDEX_TYPE FROM SYS.INDEXES WHERE SCHEMA_NAME = ? AND INDEX_NAME = ?`
            : `SELECT INDEX_NAME, TABLE_NAME, CONSTRAINT, INDEX_TYPE FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER AND INDEX_NAME = ?`,
          schemaParam ? [schemaParam, indexNameSafe] : [indexNameSafe],
        ),
      );

      if (!rows || (rows as unknown[]).length === 0) {
        throw new MastraError({
          id: createStorageErrorId('HANA', 'DESCRIBE_INDEX', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Index "${indexNameSafe}" not found in schema "${schemaParam ?? 'CURRENT_USER'}"`,
          details: { indexName },
        });
      }

      const row = (
        rows as Array<{ INDEX_NAME: string; TABLE_NAME: string; CONSTRAINT: string; INDEX_TYPE: string }>
      )[0];
      const colRows = await this.pool.withConnection(conn =>
        conn.execPromise(
          schemaParam
            ? `SELECT COLUMN_NAME FROM SYS.INDEX_COLUMNS WHERE SCHEMA_NAME = ? AND INDEX_NAME = ? ORDER BY POSITION`
            : `SELECT COLUMN_NAME FROM SYS.INDEX_COLUMNS WHERE SCHEMA_NAME = CURRENT_USER AND INDEX_NAME = ? ORDER BY POSITION`,
          schemaParam ? [schemaParam, indexNameSafe] : [indexNameSafe],
        ),
      );

      return {
        name: row!.INDEX_NAME,
        table: row!.TABLE_NAME,
        columns: (colRows as Array<{ COLUMN_NAME: string }>).map(r => r.COLUMN_NAME),
        unique: row!.CONSTRAINT === 'UNIQUE',
        size: '0 MB',
        definition: '',
        method: (row!.INDEX_TYPE ?? 'BTREE').toLowerCase(),
        scans: 0,
        tuples_read: 0,
        tuples_fetched: 0,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INDEX_DESCRIBE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }
}
