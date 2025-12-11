import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_TRACES,
  TABLE_SCORERS,
  TABLE_SPANS,
  getDefaultValue,
} from '@mastra/core/storage';
import type {
  StorageColumn,
  TABLE_NAMES,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import sql from 'mssql';
import { getSchemaName, getTableName } from './utils';

// Re-export the types for convenience
export type { CreateIndexOptions, IndexInfo, StorageIndexStats };

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing pool, db, and schema
 * 2. Config to create a new pool internally
 */
export type MssqlDomainConfig = MssqlDomainPoolConfig | MssqlDomainRestConfig;

/**
 * Pass an existing pool, db, and schema
 */
export interface MssqlDomainPoolConfig {
  pool: sql.ConnectionPool;
  db: MssqlDB;
  schema?: string;
}

/**
 * Pass config to create a new pool internally
 */
export interface MssqlDomainRestConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schemaName?: string;
  options?: sql.IOptions;
}

/**
 * Resolves MssqlDomainConfig to pool, db, and schema.
 * Handles creating a new pool and db if config is provided.
 *
 * @param config - Either an existing connected pool/db, or connection details to create a new pool
 * @returns Object containing pool, db, schema, and whether the pool needs connection
 *
 * @remarks
 * When using connection details (not an existing pool), the returned pool is NOT connected.
 * The caller must call `pool.connect()` before use, typically in an `init()` method.
 * The `needsConnect` flag indicates whether the pool was newly created and needs connecting.
 */
export function resolveMssqlConfig(config: MssqlDomainConfig): {
  pool: sql.ConnectionPool;
  db: MssqlDB;
  schema?: string;
  needsConnect: boolean;
} {
  // Existing pool and db - already connected by MSSQLStore
  if ('pool' in config && 'db' in config) {
    return { pool: config.pool, db: config.db, schema: config.schema, needsConnect: false };
  }

  // Config to create new pool - needs to be connected via init()
  const pool = new sql.ConnectionPool({
    server: config.server,
    database: config.database,
    user: config.user,
    password: config.password,
    port: config.port,
    options: config.options || { encrypt: true, trustServerCertificate: true },
  });

  const db = new MssqlDB({ pool, schemaName: config.schemaName });
  return { pool, db, schema: config.schemaName, needsConnect: true };
}

export class MssqlDB extends MastraBase {
  public pool: sql.ConnectionPool;
  public schemaName?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;

  /**
   * Columns that participate in composite indexes need smaller sizes (NVARCHAR(100)).
   * MSSQL has a 900-byte index key limit, so composite indexes with NVARCHAR(400) columns fail.
   * These are typically ID/type fields that don't need 400 chars.
   */
  private readonly COMPOSITE_INDEX_COLUMNS = [
    'traceId', // Used in: PRIMARY KEY (traceId, spanId), index (traceId, spanId, seq_id)
    'spanId', // Used in: PRIMARY KEY (traceId, spanId), index (traceId, spanId, seq_id)
    'parentSpanId', // Used in: index (parentSpanId, startedAt)
    'entityType', // Used in: (entityType, entityId), (entityType, entityName)
    'entityId', // Used in: (entityType, entityId)
    'entityName', // Used in: (entityType, entityName)
    'organizationId', // Used in: (organizationId, userId)
    'userId', // Used in: (organizationId, userId)
  ];

  /**
   * Columns that store large amounts of data and should use NVARCHAR(MAX).
   * Avoid listing columns that participate in indexes (resourceId, thread_id, agent_name, name, etc.)
   */
  private readonly LARGE_DATA_COLUMNS = [
    'workingMemory',
    'snapshot',
    'metadata',
    'content', // messages.content - can be very long conversation content
    'input', // evals.input - test input data
    'output', // evals.output - test output data
    'instructions', // evals.instructions - evaluation instructions
    'other', // traces.other - additional trace data
  ];

  protected getSqlType(
    type: StorageColumn['type'],
    isPrimaryKey = false,
    useLargeStorage = false,
    useSmallStorage = false,
  ): string {
    switch (type) {
      case 'text':
        // Use NVARCHAR(MAX) for columns that store large amounts of data (workingMemory, snapshot, metadata)
        if (useLargeStorage) {
          return 'NVARCHAR(MAX)';
        }
        // Use NVARCHAR(100) for columns that participate in composite indexes
        // MSSQL has a 900-byte index key limit, NVARCHAR(100) = 200 bytes
        // This allows up to 4 columns in a composite index (4 * 200 = 800 bytes < 900)
        if (useSmallStorage) {
          return 'NVARCHAR(100)';
        }
        // Use NVARCHAR(400) for regular columns to enable single-column indexing
        // MSSQL has a 900-byte index key limit, NVARCHAR(400) = 800 bytes
        // Primary keys use NVARCHAR(255) for consistency with common UUID/ID lengths
        return isPrimaryKey ? 'NVARCHAR(255)' : 'NVARCHAR(400)';
      case 'timestamp':
        return 'DATETIME2(7)';
      case 'uuid':
        return 'UNIQUEIDENTIFIER';
      case 'jsonb':
        return 'NVARCHAR(MAX)';
      case 'integer':
        return 'INT';
      case 'bigint':
        return 'BIGINT';
      case 'float':
        return 'FLOAT';
      case 'boolean':
        return 'BIT';
      default:
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'TYPE', 'NOT_SUPPORTED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        });
    }
  }

  constructor({ pool, schemaName }: { pool: sql.ConnectionPool; schemaName?: string }) {
    super({ component: 'STORAGE', name: 'MssqlDB' });
    this.pool = pool;
    this.schemaName = schemaName;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const schema = this.schemaName || 'dbo';
    const request = this.pool.request();
    request.input('schema', schema);
    request.input('table', table);
    request.input('column', column);
    request.input('columnLower', column.toLowerCase());
    const result = await request.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table AND (COLUMN_NAME = @column OR COLUMN_NAME = @columnLower)`,
    );
    return result.recordset.length > 0;
  }

  private async setupSchema() {
    if (!this.schemaName || this.schemaSetupComplete) {
      return;
    }

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          const checkRequest = this.pool.request();
          checkRequest.input('schemaName', this.schemaName);
          const checkResult = await checkRequest.query(`
            SELECT 1 AS found FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = @schemaName
          `);
          const schemaExists = Array.isArray(checkResult.recordset) && checkResult.recordset.length > 0;

          if (!schemaExists) {
            try {
              await this.pool.request().query(`CREATE SCHEMA [${this.schemaName}]`);
              this.logger?.info?.(`Schema "${this.schemaName}" created successfully`);
            } catch (error) {
              this.logger?.error?.(`Failed to create schema "${this.schemaName}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schemaName}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          this.schemaSetupComplete = true;
          this.logger?.debug?.(`Schema "${this.schemaName}" is ready for use`);
        } catch (error) {
          this.schemaSetupComplete = undefined;
          this.setupSchemaPromise = null;
          throw error;
        } finally {
          this.setupSchemaPromise = null;
        }
      })();
    }

    await this.setupSchemaPromise;
  }

  async insert({
    tableName,
    record,
    transaction,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
    transaction?: sql.Transaction;
  }): Promise<void> {
    try {
      const columns = Object.keys(record);
      const parsedColumns = columns.map(col => parseSqlIdentifier(col, 'column name'));
      const paramNames = columns.map((_, i) => `@param${i}`);
      const insertSql = `INSERT INTO ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (${parsedColumns.map(c => `[${c}]`).join(', ')}) VALUES (${paramNames.join(', ')})`;
      const request = transaction ? transaction.request() : this.pool.request();

      columns.forEach((col, i) => {
        const value = record[col];
        const preparedValue = this.prepareValue(value, col, tableName);

        if (preparedValue instanceof Date) {
          request.input(`param${i}`, sql.DateTime2, preparedValue);
        } else if (preparedValue === null || preparedValue === undefined) {
          request.input(`param${i}`, this.getMssqlType(tableName, col), null);
        } else {
          request.input(`param${i}`, preparedValue);
        }
      });

      await request.query(insertSql);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    try {
      // First try TRUNCATE for better performance
      try {
        await this.pool.request().query(`TRUNCATE TABLE ${fullTableName}`);
      } catch (truncateError: any) {
        // If TRUNCATE fails due to FK constraints (error 4712), fall back to DELETE
        if (truncateError?.number === 4712) {
          await this.pool.request().query(`DELETE FROM ${fullTableName}`);
        } else {
          throw truncateError;
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CLEAR_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'timestamp':
        return 'DEFAULT SYSUTCDATETIME()';
      case 'jsonb':
        return "DEFAULT N'{}'";
      case 'boolean':
        return 'DEFAULT 0';
      default:
        return getDefaultValue(type);
    }
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const uniqueConstraintColumns = tableName === TABLE_WORKFLOW_SNAPSHOT ? ['workflow_name', 'run_id'] : [];

      const columns = Object.entries(schema)
        .map(([name, def]) => {
          const parsedName = parseSqlIdentifier(name, 'column name');
          const constraints = [];
          if (def.primaryKey) constraints.push('PRIMARY KEY');
          if (!def.nullable) constraints.push('NOT NULL');
          const isIndexed = !!def.primaryKey || uniqueConstraintColumns.includes(name);
          const useLargeStorage = this.LARGE_DATA_COLUMNS.includes(name);
          const useSmallStorage = this.COMPOSITE_INDEX_COLUMNS.includes(name);
          return `[${parsedName}] ${this.getSqlType(def.type, isIndexed, useLargeStorage, useSmallStorage)} ${constraints.join(' ')}`.trim();
        })
        .join(',\n');

      if (this.schemaName) {
        await this.setupSchema();
      }

      const checkTableRequest = this.pool.request();
      checkTableRequest.input(
        'tableName',
        getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })
          .replace(/[[\]]/g, '')
          .split('.')
          .pop(),
      );
      const checkTableSql = `SELECT 1 AS found FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName`;
      checkTableRequest.input('schema', this.schemaName || 'dbo');
      const checkTableResult = await checkTableRequest.query(checkTableSql);
      const tableExists = Array.isArray(checkTableResult.recordset) && checkTableResult.recordset.length > 0;

      if (!tableExists) {
        const createSql = `CREATE TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (\n${columns}\n)`;
        await this.pool.request().query(createSql);
      }

      const columnCheckSql = `
        SELECT 1 AS found
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName AND COLUMN_NAME = 'seq_id'
      `;
      const checkColumnRequest = this.pool.request();
      checkColumnRequest.input('schema', this.schemaName || 'dbo');
      checkColumnRequest.input(
        'tableName',
        getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })
          .replace(/[[\]]/g, '')
          .split('.')
          .pop(),
      );
      const columnResult = await checkColumnRequest.query(columnCheckSql);
      const columnExists = Array.isArray(columnResult.recordset) && columnResult.recordset.length > 0;

      if (!columnExists) {
        const alterSql = `ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} ADD seq_id BIGINT IDENTITY(1,1)`;
        await this.pool.request().query(alterSql);
      }

      // Use schema prefix for constraint names to avoid collisions across schemas
      const schemaPrefix = this.schemaName ? `${this.schemaName}_` : '';

      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const constraintName = `${schemaPrefix}mastra_workflow_snapshot_workflow_name_run_id_key`;
        const checkConstraintSql = `SELECT 1 AS found FROM sys.key_constraints WHERE name = @constraintName`;
        const checkConstraintRequest = this.pool.request();
        checkConstraintRequest.input('constraintName', constraintName);
        const constraintResult = await checkConstraintRequest.query(checkConstraintSql);
        const constraintExists = Array.isArray(constraintResult.recordset) && constraintResult.recordset.length > 0;
        if (!constraintExists) {
          const addConstraintSql = `ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} ADD CONSTRAINT [${constraintName}] UNIQUE ([workflow_name], [run_id])`;
          await this.pool.request().query(addConstraintSql);
        }
      }

      // Run migrations and add composite primary key for Spans table
      if (tableName === TABLE_SPANS) {
        await this.migrateSpansTable();

        // Add composite primary key for spans table (traceId, spanId)
        const pkConstraintName = `${schemaPrefix}mastra_ai_spans_traceid_spanid_pk`;
        const checkPkRequest = this.pool.request();
        checkPkRequest.input('constraintName', pkConstraintName);
        const pkResult = await checkPkRequest.query(
          `SELECT 1 AS found FROM sys.key_constraints WHERE name = @constraintName`,
        );
        const pkExists = Array.isArray(pkResult.recordset) && pkResult.recordset.length > 0;
        if (!pkExists) {
          try {
            const addPkSql = `ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} ADD CONSTRAINT [${pkConstraintName}] PRIMARY KEY ([traceId], [spanId])`;
            await this.pool.request().query(addPkSql);
          } catch (pkError) {
            // Log warning but don't fail - existing tables might have data issues
            this.logger?.warn?.(`Failed to add composite primary key to spans table:`, pkError);
          }
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CREATE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  /**
   * Migrates the spans table schema from OLD_SPAN_SCHEMA to current SPAN_SCHEMA.
   * This adds new columns that don't exist in old schema.
   */
  private async migrateSpansTable(): Promise<void> {
    const fullTableName = getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schemaName) });
    const schema = TABLE_SCHEMAS[TABLE_SPANS];

    try {
      // Add any columns from current schema that don't exist in the database
      for (const [columnName, columnDef] of Object.entries(schema)) {
        const columnExists = await this.hasColumn(TABLE_SPANS, columnName);
        if (!columnExists) {
          const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
          const useLargeStorage = this.LARGE_DATA_COLUMNS.includes(columnName);
          const useSmallStorage = this.COMPOSITE_INDEX_COLUMNS.includes(columnName);
          const isIndexed = !!columnDef.primaryKey;
          const sqlType = this.getSqlType(columnDef.type, isIndexed, useLargeStorage, useSmallStorage);
          // Align with createTable: nullable columns omit NOT NULL, non-nullable columns include it
          const nullable = columnDef.nullable ? '' : 'NOT NULL';
          const defaultValue = !columnDef.nullable ? this.getDefaultValue(columnDef.type) : '';
          const alterSql =
            `ALTER TABLE ${fullTableName} ADD [${parsedColumnName}] ${sqlType} ${nullable} ${defaultValue}`.trim();
          await this.pool.request().query(alterSql);
          this.logger?.debug?.(`Added column '${columnName}' to ${fullTableName}`);
        }
      }

      this.logger?.info?.(`Migration completed for ${fullTableName}`);
    } catch (error) {
      // Log warning but don't fail - migrations should be best-effort
      this.logger?.warn?.(`Failed to migrate spans table ${fullTableName}:`, error);
    }
  }

  /**
   * Alters table schema to add columns if they don't exist
   * @param tableName Name of the table
   * @param schema Schema of the table
   * @param ifNotExists Array of column names to add if they don't exist
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
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    try {
      for (const columnName of ifNotExists) {
        if (schema[columnName]) {
          const columnCheckRequest = this.pool.request();
          columnCheckRequest.input('tableName', fullTableName.replace(/[[\]]/g, '').split('.').pop());
          columnCheckRequest.input('columnName', columnName);
          columnCheckRequest.input('schema', this.schemaName || 'dbo');
          const checkSql = `SELECT 1 AS found FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName AND COLUMN_NAME = @columnName`;
          const checkResult = await columnCheckRequest.query(checkSql);
          const columnExists = Array.isArray(checkResult.recordset) && checkResult.recordset.length > 0;
          if (!columnExists) {
            const columnDef = schema[columnName];
            const useLargeStorage = this.LARGE_DATA_COLUMNS.includes(columnName);
            const useSmallStorage = this.COMPOSITE_INDEX_COLUMNS.includes(columnName);
            const isIndexed = !!columnDef.primaryKey;
            const sqlType = this.getSqlType(columnDef.type, isIndexed, useLargeStorage, useSmallStorage);
            // Align with createTable: nullable columns omit NOT NULL, non-nullable columns include it
            const nullable = columnDef.nullable ? '' : 'NOT NULL';
            const defaultValue = !columnDef.nullable ? this.getDefaultValue(columnDef.type) : '';
            const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
            const alterSql =
              `ALTER TABLE ${fullTableName} ADD [${parsedColumnName}] ${sqlType} ${nullable} ${defaultValue}`.trim();
            await this.pool.request().query(alterSql);
            this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
          }
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'ALTER_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys).map(([key, value]) => [parseSqlIdentifier(key, 'column name'), value]);
      const conditions = keyEntries.map(([key], i) => `[${key}] = @param${i}`).join(' AND ');
      const sqlQuery = `SELECT * FROM ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} WHERE ${conditions}`;
      const request = this.pool.request();
      keyEntries.forEach(([key, value], i) => {
        const preparedValue = this.prepareValue(value, key, tableName);
        if (preparedValue === null || preparedValue === undefined) {
          request.input(`param${i}`, this.getMssqlType(tableName, key), null);
        } else {
          request.input(`param${i}`, preparedValue);
        }
      });
      const resultSet = await request.query(sqlQuery);
      const result = resultSet.recordset[0] || null;
      if (!result) {
        return null;
      }
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = result as any;
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return snapshot;
      }
      return result;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LOAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();
      for (const record of records) {
        await this.insert({ tableName, record, transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'BATCH_INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: records.length,
          },
        },
        error,
      );
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
      await this.pool.request().query(`DROP TABLE IF EXISTS ${tableNameWithSchema}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'DROP_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  /**
   * Prepares a value for database operations, handling Date objects and JSON serialization
   */
  private prepareValue(value: any, columnName: string, tableName: TABLE_NAMES): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    // Get the schema for this table to determine column types
    const schema = TABLE_SCHEMAS[tableName];
    const columnSchema = schema?.[columnName];

    // Handle boolean type - convert to 0/1 for BIT column
    if (columnSchema?.type === 'boolean') {
      return value ? 1 : 0;
    }

    // If the column is JSONB, stringify the value
    if (columnSchema?.type === 'jsonb') {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          try {
            JSON.parse(trimmed);
            return trimmed;
          } catch {}
        }
        return JSON.stringify(value);
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return JSON.stringify(value);
    }

    // For non-JSONB columns with object values, stringify them (for backwards compatibility)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  /**
   * Maps TABLE_SCHEMAS types to mssql param types (used when value is null)
   */
  private getMssqlType(tableName: TABLE_NAMES, columnName: string): any {
    const col = TABLE_SCHEMAS[tableName]?.[columnName];
    switch (col?.type) {
      case 'text':
        return sql.NVarChar;
      case 'timestamp':
        return sql.DateTime2;
      case 'uuid':
        return sql.UniqueIdentifier;
      case 'jsonb':
        return sql.NVarChar;
      case 'integer':
        return sql.Int;
      case 'bigint':
        return sql.BigInt;
      case 'float':
        return sql.Float;
      case 'boolean':
        return sql.Bit;
      default:
        return sql.NVarChar;
    }
  }

  /**
   * Update a single record in the database
   */
  async update({
    tableName,
    keys,
    data,
    transaction,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
    transaction?: sql.Transaction;
  }): Promise<void> {
    try {
      if (!data || Object.keys(data).length === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'UPDATE', 'EMPTY_DATA'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Cannot update with empty data payload',
        });
      }
      if (!keys || Object.keys(keys).length === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'UPDATE', 'EMPTY_KEYS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Cannot update without keys to identify records',
        });
      }

      const setClauses: string[] = [];
      const request = transaction ? transaction.request() : this.pool.request();
      let paramIndex = 0;

      // Build SET clause
      Object.entries(data).forEach(([key, value]) => {
        const parsedKey = parseSqlIdentifier(key, 'column name');
        const paramName = `set${paramIndex++}`;
        setClauses.push(`[${parsedKey}] = @${paramName}`);
        const preparedValue = this.prepareValue(value, key, tableName);
        if (preparedValue === null || preparedValue === undefined) {
          request.input(paramName, this.getMssqlType(tableName, key), null);
        } else {
          request.input(paramName, preparedValue);
        }
      });

      // Build WHERE clause
      const whereConditions: string[] = [];

      Object.entries(keys).forEach(([key, value]) => {
        const parsedKey = parseSqlIdentifier(key, 'column name');
        const paramName = `where${paramIndex++}`;
        whereConditions.push(`[${parsedKey}] = @${paramName}`);
        const preparedValue = this.prepareValue(value, key, tableName);
        if (preparedValue === null || preparedValue === undefined) {
          request.input(paramName, this.getMssqlType(tableName, key), null);
        } else {
          request.input(paramName, preparedValue);
        }
      });

      const tableName_ = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName),
      });

      const updateSql = `UPDATE ${tableName_} SET ${setClauses.join(', ')} WHERE ${whereConditions.join(' AND ')}`;

      await request.query(updateSql);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  /**
   * Update multiple records in a single batch transaction
   */
  async batchUpdate({
    tableName,
    updates,
  }: {
    tableName: TABLE_NAMES;
    updates: Array<{
      keys: Record<string, any>;
      data: Record<string, any>;
    }>;
  }): Promise<void> {
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();

      for (const { keys, data } of updates) {
        await this.update({ tableName, keys, data, transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'BATCH_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: updates.length,
          },
        },
        error,
      );
    }
  }

  /**
   * Delete multiple records by keys
   */
  async batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any>[] }): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const tableName_ = getTableName({
      indexName: tableName,
      schemaName: getSchemaName(this.schemaName),
    });

    const transaction = this.pool.transaction();
    try {
      await transaction.begin();

      for (const keySet of keys) {
        const conditions: string[] = [];
        const request = transaction.request();
        let paramIndex = 0;

        Object.entries(keySet).forEach(([key, value]) => {
          const parsedKey = parseSqlIdentifier(key, 'column name');
          const paramName = `p${paramIndex++}`;
          conditions.push(`[${parsedKey}] = @${paramName}`);
          const preparedValue = this.prepareValue(value, key, tableName);
          if (preparedValue === null || preparedValue === undefined) {
            request.input(paramName, this.getMssqlType(tableName, key), null);
          } else {
            request.input(paramName, preparedValue);
          }
        });

        const deleteSql = `DELETE FROM ${tableName_} WHERE ${conditions.join(' AND ')}`;
        await request.query(deleteSql);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'BATCH_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: keys.length,
          },
        },
        error,
      );
    }
  }

  /**
   * Create a new index on a table
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const { name, table, columns, unique = false, where } = options;

      const schemaName = this.schemaName || 'dbo';
      const fullTableName = getTableName({
        indexName: table as TABLE_NAMES,
        schemaName: getSchemaName(this.schemaName),
      });

      // Check if index already exists
      const indexNameSafe = parseSqlIdentifier(name, 'index name');
      const checkRequest = this.pool.request();
      checkRequest.input('indexName', indexNameSafe);
      checkRequest.input('schemaName', schemaName);
      checkRequest.input('tableName', table);

      const indexExists = await checkRequest.query(`
        SELECT 1 as found
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE i.name = @indexName
          AND s.name = @schemaName
          AND t.name = @tableName
      `);

      if (indexExists.recordset && indexExists.recordset.length > 0) {
        // Index already exists, skip creation
        return;
      }

      // Build index creation SQL
      const uniqueStr = unique ? 'UNIQUE ' : '';
      const columnsStr = columns
        .map((col: string) => {
          // Handle columns with DESC/ASC modifiers
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const [colName, ...modifiers] = col.split(' ');
            if (!colName) {
              throw new Error(`Invalid column specification: ${col}`);
            }
            return `[${parseSqlIdentifier(colName, 'column name')}] ${modifiers.join(' ')}`;
          }
          return `[${parseSqlIdentifier(col, 'column name')}]`;
        })
        .join(', ');

      const whereStr = where ? ` WHERE ${where}` : '';

      const createIndexSql = `CREATE ${uniqueStr}INDEX [${indexNameSafe}] ON ${fullTableName} (${columnsStr})${whereStr}`;

      await this.pool.request().query(createIndexSql);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INDEX_CREATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName: options.name,
            tableName: options.table,
          },
        },
        error,
      );
    }
  }

  /**
   * Drop an existing index
   */
  async dropIndex(indexName: string): Promise<void> {
    try {
      const schemaName = this.schemaName || 'dbo';
      const indexNameSafe = parseSqlIdentifier(indexName, 'index name');

      // Check if index exists first
      const checkRequest = this.pool.request();
      checkRequest.input('indexName', indexNameSafe);
      checkRequest.input('schemaName', schemaName);

      const result = await checkRequest.query(`
        SELECT t.name as table_name
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE i.name = @indexName
          AND s.name = @schemaName
      `);

      if (!result.recordset || result.recordset.length === 0) {
        // Index doesn't exist, nothing to drop
        return;
      }

      // In MSSQL, index names are unique per table, not per schema
      // If multiple tables have the same index name, throw an error
      if (result.recordset.length > 1) {
        const tables = result.recordset.map((r: any) => r.table_name).join(', ');
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'INDEX', 'AMBIGUOUS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Index "${indexNameSafe}" exists on multiple tables (${tables}) in schema "${schemaName}". Please drop indexes manually or ensure unique index names.`,
        });
      }

      const tableName = result.recordset[0].table_name;
      const fullTableName = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName),
      });

      const dropSql = `DROP INDEX [${indexNameSafe}] ON ${fullTableName}`;
      await this.pool.request().query(dropSql);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INDEX_DROP', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * List indexes for a specific table or all tables
   */
  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    try {
      const schemaName = this.schemaName || 'dbo';

      let query: string;
      const request = this.pool.request();
      request.input('schemaName', schemaName);

      if (tableName) {
        query = `
          SELECT
            i.name as name,
            o.name as [table],
            i.is_unique as is_unique,
            CAST(SUM(s.used_page_count) * 8 / 1024.0 AS VARCHAR(50)) + ' MB' as size
          FROM sys.indexes i
          INNER JOIN sys.objects o ON i.object_id = o.object_id
          INNER JOIN sys.schemas sch ON o.schema_id = sch.schema_id
          LEFT JOIN sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
          WHERE sch.name = @schemaName
          AND o.name = @tableName
          AND i.name IS NOT NULL
          GROUP BY i.name, o.name, i.is_unique
        `;
        request.input('tableName', tableName);
      } else {
        query = `
          SELECT
            i.name as name,
            o.name as [table],
            i.is_unique as is_unique,
            CAST(SUM(s.used_page_count) * 8 / 1024.0 AS VARCHAR(50)) + ' MB' as size
          FROM sys.indexes i
          INNER JOIN sys.objects o ON i.object_id = o.object_id
          INNER JOIN sys.schemas sch ON o.schema_id = sch.schema_id
          LEFT JOIN sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
          WHERE sch.name = @schemaName
          AND i.name IS NOT NULL
          GROUP BY i.name, o.name, i.is_unique
        `;
      }

      const result = await request.query(query);

      // For each index, get its columns
      const indexes: IndexInfo[] = [];
      for (const row of result.recordset) {
        const colRequest = this.pool.request();
        colRequest.input('indexName', row.name);
        colRequest.input('schemaName', schemaName);

        const colResult = await colRequest.query(`
          SELECT c.name as column_name
          FROM sys.indexes i
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          INNER JOIN sys.objects o ON i.object_id = o.object_id
          INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
          WHERE i.name = @indexName
          AND s.name = @schemaName
          ORDER BY ic.key_ordinal
        `);

        indexes.push({
          name: row.name,
          table: row.table,
          columns: colResult.recordset.map((c: any) => c.column_name),
          unique: row.is_unique || false,
          size: row.size || '0 MB',
          definition: '', // MSSQL doesn't store definition like PG
        });
      }

      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INDEX_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: tableName
            ? {
                tableName,
              }
            : {},
        },
        error,
      );
    }
  }

  /**
   * Get detailed statistics for a specific index
   */
  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    try {
      const schemaName = this.schemaName || 'dbo';

      const request = this.pool.request();
      request.input('indexName', indexName);
      request.input('schemaName', schemaName);

      const query = `
        SELECT
          i.name as name,
          o.name as [table],
          i.is_unique as is_unique,
          CAST(SUM(s.used_page_count) * 8 / 1024.0 AS VARCHAR(50)) + ' MB' as size,
          i.type_desc as method,
          ISNULL(us.user_scans, 0) as scans,
          ISNULL(us.user_seeks + us.user_scans, 0) as tuples_read,
          ISNULL(us.user_lookups, 0) as tuples_fetched
        FROM sys.indexes i
        INNER JOIN sys.objects o ON i.object_id = o.object_id
        INNER JOIN sys.schemas sch ON o.schema_id = sch.schema_id
        LEFT JOIN sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
        LEFT JOIN sys.dm_db_index_usage_stats us ON i.object_id = us.object_id AND i.index_id = us.index_id
        WHERE i.name = @indexName
        AND sch.name = @schemaName
        GROUP BY i.name, o.name, i.is_unique, i.type_desc, us.user_seeks, us.user_scans, us.user_lookups
      `;

      const result = await request.query(query);

      if (!result.recordset || result.recordset.length === 0) {
        throw new Error(`Index "${indexName}" not found in schema "${schemaName}"`);
      }

      const row = result.recordset[0];

      // Get columns for this index
      const colRequest = this.pool.request();
      colRequest.input('indexName', indexName);
      colRequest.input('schemaName', schemaName);

      const colResult = await colRequest.query(`
        SELECT c.name as column_name
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.objects o ON i.object_id = o.object_id
        INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE i.name = @indexName
        AND s.name = @schemaName
        ORDER BY ic.key_ordinal
      `);

      return {
        name: row.name,
        table: row.table,
        columns: colResult.recordset.map((c: any) => c.column_name),
        unique: row.is_unique || false,
        size: row.size || '0 MB',
        definition: '',
        method: row.method?.toLowerCase() || 'nonclustered',
        scans: Number(row.scans) || 0,
        tuples_read: Number(row.tuples_read) || 0,
        tuples_fetched: Number(row.tuples_fetched) || 0,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INDEX_DESCRIBE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * Returns definitions for automatic performance indexes
   * IMPORTANT: Uses seq_id DESC instead of createdAt DESC for MSSQL due to millisecond accuracy limitations
   * NOTE: Using NVARCHAR(400) for text columns (800 bytes) leaves room for composite indexes
   */
  protected getAutomaticIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schemaName ? `${this.schemaName}_` : '';
    return [
      // Composite indexes for optimal filtering + sorting performance
      // NVARCHAR(400) = 800 bytes, plus BIGINT (8 bytes) = 808 bytes total (under 900-byte limit)
      {
        name: `${schemaPrefix}mastra_threads_resourceid_seqid_idx`,
        table: TABLE_THREADS,
        columns: ['resourceId', 'seq_id DESC'],
      },
      {
        name: `${schemaPrefix}mastra_messages_thread_id_seqid_idx`,
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'seq_id DESC'],
      },
      {
        name: `${schemaPrefix}mastra_traces_name_seqid_idx`,
        table: TABLE_TRACES,
        columns: ['name', 'seq_id DESC'],
      },
      {
        name: `${schemaPrefix}mastra_scores_trace_id_span_id_seqid_idx`,
        table: TABLE_SCORERS,
        columns: ['traceId', 'spanId', 'seq_id DESC'],
      },
      // Spans indexes for optimal trace querying
      {
        name: `${schemaPrefix}mastra_ai_spans_traceid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_name_idx`,
        table: TABLE_SPANS,
        columns: ['name'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt DESC'],
      },
      // Root spans filtered index - every listTraces query filters parentSpanId IS NULL
      {
        name: `${schemaPrefix}mastra_ai_spans_root_spans_idx`,
        table: TABLE_SPANS,
        columns: ['startedAt DESC'],
        where: '[parentSpanId] IS NULL',
      },
      // Entity identification indexes - common filtering patterns
      {
        name: `${schemaPrefix}mastra_ai_spans_entitytype_entityid_idx`,
        table: TABLE_SPANS,
        columns: ['entityType', 'entityId'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_entitytype_entityname_idx`,
        table: TABLE_SPANS,
        columns: ['entityType', 'entityName'],
      },
      // Multi-tenant filtering - organizationId + userId
      {
        name: `${schemaPrefix}mastra_ai_spans_orgid_userid_idx`,
        table: TABLE_SPANS,
        columns: ['organizationId', 'userId'],
      },
      // Note: MSSQL doesn't support GIN indexes for JSONB/array containment queries
      // Metadata and tags filtering will use full table scans on NVARCHAR(MAX) columns
    ];
  }

  /**
   * Creates automatic indexes for optimal query performance
   * Uses getAutomaticIndexDefinitions() to determine which indexes to create
   */
  async createAutomaticIndexes(): Promise<void> {
    try {
      const indexes = this.getAutomaticIndexDefinitions();

      for (const indexOptions of indexes) {
        try {
          await this.createIndex(indexOptions);
        } catch (error) {
          // Log but continue with other indexes
          this.logger?.warn?.(`Failed to create index ${indexOptions.name}:`, error);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CREATE_PERFORMANCE_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
