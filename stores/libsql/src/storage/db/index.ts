import { createClient } from '@libsql/client';
import type { Client, InValue } from '@libsql/client';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  getSqlType,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SPANS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import {
  buildSelectColumns,
  createExecuteWriteOperationWithRetry,
  prepareDeleteStatement,
  prepareStatement,
  prepareUpdateStatement,
} from './utils';

/**
 * Base configuration options shared across LibSQL domain configurations
 */
export type LibSQLDomainBaseConfig = {
  /**
   * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
   * @default 5
   */
  maxRetries?: number;
  /**
   * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
   * The backoff time will double with each retry (exponential backoff).
   * @default 100
   */
  initialBackoffMs?: number;
};

/**
 * Configuration for LibSQL domains - accepts either credentials or an existing client
 */
export type LibSQLDomainConfig =
  | (LibSQLDomainBaseConfig & {
      /** The database connection URL (e.g., "file:local.db", "libsql://...", "file::memory:") */
      url: string;
      /** Optional authentication token for remote databases */
      authToken?: string;
    })
  | (LibSQLDomainBaseConfig & {
      /** An existing LibSQL client instance */
      client: Client;
    });

/**
 * Resolves a LibSQLDomainConfig to a Client instance.
 * Creates a new client if credentials are provided, or returns the existing client.
 *
 * @param config - The domain configuration
 * @returns The resolved LibSQL client
 */
export function resolveClient(config: LibSQLDomainConfig): Client {
  if ('client' in config) {
    return config.client;
  }
  return createClient({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  });
}

export class LibSQLDB extends MastraBase {
  private client: Client;
  maxRetries: number;
  initialBackoffMs: number;
  executeWriteOperationWithRetry: <T>(operationFn: () => Promise<T>, operationDescription: string) => Promise<T>;

  constructor({
    client,
    maxRetries,
    initialBackoffMs,
  }: {
    client: Client;
    maxRetries?: number;
    initialBackoffMs?: number;
  }) {
    super({
      component: 'STORAGE',
      name: 'LIBSQL_DB_LAYER',
    });

    this.client = client;
    this.maxRetries = maxRetries ?? 5;
    this.initialBackoffMs = initialBackoffMs ?? 100;

    this.executeWriteOperationWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });
  }

  /**
   * Checks if a column exists in the specified table.
   *
   * @param table - The name of the table to check
   * @param column - The name of the column to look for
   * @returns `true` if the column exists in the table, `false` otherwise
   */
  async hasColumn(table: string, column: string): Promise<boolean> {
    const sanitizedTable = parseSqlIdentifier(table, 'table name');
    const result = await this.client.execute({
      sql: `PRAGMA table_info("${sanitizedTable}")`,
    });
    return result.rows?.some((row: any) => row.name === column);
  }

  /**
   * Internal insert implementation without retry logic.
   */
  private async doInsert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    await this.client.execute(
      prepareStatement({
        tableName,
        record,
      }),
    );
  }

  /**
   * Inserts or replaces a record in the specified table with automatic retry on lock errors.
   *
   * @param args - The insert arguments
   * @param args.tableName - The name of the table to insert into
   * @param args.record - The record to insert (key-value pairs)
   */
  public insert(args: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.executeWriteOperationWithRetry(() => this.doInsert(args), `insert into table ${args.tableName}`);
  }

  /**
   * Internal update implementation without retry logic.
   */
  private async doUpdate({
    tableName,
    keys,
    data,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
  }): Promise<void> {
    await this.client.execute(prepareUpdateStatement({ tableName, updates: data, keys }));
  }

  /**
   * Updates a record in the specified table with automatic retry on lock errors.
   *
   * @param args - The update arguments
   * @param args.tableName - The name of the table to update
   * @param args.keys - The key(s) identifying the record to update
   * @param args.data - The fields to update (key-value pairs)
   */
  public update(args: { tableName: TABLE_NAMES; keys: Record<string, any>; data: Record<string, any> }): Promise<void> {
    return this.executeWriteOperationWithRetry(() => this.doUpdate(args), `update table ${args.tableName}`);
  }

  /**
   * Internal batch insert implementation without retry logic.
   */
  private async doBatchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    if (records.length === 0) return;
    const batchStatements = records.map(r => prepareStatement({ tableName, record: r }));
    await this.client.batch(batchStatements, 'write');
  }

  /**
   * Inserts multiple records in a single batch transaction with automatic retry on lock errors.
   *
   * @param args - The batch insert arguments
   * @param args.tableName - The name of the table to insert into
   * @param args.records - Array of records to insert
   * @throws {MastraError} When the batch insert fails after retries
   */
  public async batchInsert(args: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return this.executeWriteOperationWithRetry(
      () => this.doBatchInsert(args),
      `batch insert into table ${args.tableName}`,
    ).catch(error => {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BATCH_INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: args.tableName,
          },
        },
        error,
      );
    });
  }

  /**
   * Internal batch update implementation without retry logic.
   * Each record can be updated based on single or composite keys.
   */
  private async doBatchUpdate({
    tableName,
    updates,
  }: {
    tableName: TABLE_NAMES;
    updates: Array<{
      keys: Record<string, any>;
      data: Record<string, any>;
    }>;
  }): Promise<void> {
    if (updates.length === 0) return;

    const batchStatements = updates.map(({ keys, data }) =>
      prepareUpdateStatement({
        tableName,
        updates: data,
        keys,
      }),
    );

    await this.client.batch(batchStatements, 'write');
  }

  /**
   * Updates multiple records in a single batch transaction with automatic retry on lock errors.
   * Each record can be updated based on single or composite keys.
   *
   * @param args - The batch update arguments
   * @param args.tableName - The name of the table to update
   * @param args.updates - Array of update operations, each containing keys and data
   * @throws {MastraError} When the batch update fails after retries
   */
  public async batchUpdate(args: {
    tableName: TABLE_NAMES;
    updates: Array<{
      keys: Record<string, any>;
      data: Record<string, any>;
    }>;
  }): Promise<void> {
    return this.executeWriteOperationWithRetry(
      () => this.doBatchUpdate(args),
      `batch update in table ${args.tableName}`,
    ).catch(error => {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BATCH_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: args.tableName,
          },
        },
        error,
      );
    });
  }

  /**
   * Internal batch delete implementation without retry logic.
   * Each record can be deleted based on single or composite keys.
   */
  private async doBatchDelete({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Array<Record<string, any>>;
  }): Promise<void> {
    if (keys.length === 0) return;

    const batchStatements = keys.map(keyObj =>
      prepareDeleteStatement({
        tableName,
        keys: keyObj,
      }),
    );

    await this.client.batch(batchStatements, 'write');
  }

  /**
   * Deletes multiple records in a single batch transaction with automatic retry on lock errors.
   * Each record can be deleted based on single or composite keys.
   *
   * @param args - The batch delete arguments
   * @param args.tableName - The name of the table to delete from
   * @param args.keys - Array of key objects identifying records to delete
   * @throws {MastraError} When the batch delete fails after retries
   */
  public async batchDelete({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Array<Record<string, any>>;
  }): Promise<void> {
    return this.executeWriteOperationWithRetry(
      () => this.doBatchDelete({ tableName, keys }),
      `batch delete from table ${tableName}`,
    ).catch(error => {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BATCH_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    });
  }

  /**
   * Internal single-record delete implementation without retry logic.
   */
  private async doDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<void> {
    await this.client.execute(prepareDeleteStatement({ tableName, keys }));
  }

  /**
   * Deletes a single record from the specified table with automatic retry on lock errors.
   *
   * @param args - The delete arguments
   * @param args.tableName - The name of the table to delete from
   * @param args.keys - The key(s) identifying the record to delete
   * @throws {MastraError} When the delete fails after retries
   */
  public async delete(args: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<void> {
    return this.executeWriteOperationWithRetry(() => this.doDelete(args), `delete from table ${args.tableName}`).catch(
      error => {
        throw new MastraError(
          {
            id: createStorageErrorId('LIBSQL', 'DELETE', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              tableName: args.tableName,
            },
          },
          error,
        );
      },
    );
  }

  /**
   * Selects a single record from the specified table by key(s).
   * Returns the most recently created record if multiple matches exist.
   * Automatically parses JSON string values back to objects/arrays.
   *
   * @typeParam R - The expected return type of the record
   * @param args - The select arguments
   * @param args.tableName - The name of the table to select from
   * @param args.keys - The key(s) identifying the record to select
   * @returns The matching record or `null` if not found
   */
  async select<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    const columns = buildSelectColumns(tableName);

    const parsedKeys = Object.keys(keys).map(key => parseSqlIdentifier(key, 'column name'));

    const conditions = parsedKeys.map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(keys);

    const result = await this.client.execute({
      sql: `SELECT ${columns} FROM ${parsedTableName} WHERE ${conditions} ORDER BY createdAt DESC LIMIT 1`,
      args: values,
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Checks whether the string looks like a JSON object ({}) or array ([])
    // If the string starts with { or [, it assumes it's JSON and parses it
    // Otherwise, it just returns, preventing unintended number conversions
    const parsed = Object.fromEntries(
      Object.entries(row || {}).map(([k, v]) => {
        try {
          return [k, typeof v === 'string' ? (v.startsWith('{') || v.startsWith('[') ? JSON.parse(v) : v) : v];
        } catch {
          return [k, v];
        }
      }),
    );

    return parsed as R;
  }

  /**
   * Selects multiple records from the specified table with optional filtering, ordering, and pagination.
   *
   * @typeParam R - The expected return type of each record
   * @param args - The select arguments
   * @param args.tableName - The name of the table to select from
   * @param args.whereClause - Optional WHERE clause with SQL string and arguments
   * @param args.orderBy - Optional ORDER BY clause (e.g., "createdAt DESC")
   * @param args.offset - Optional offset for pagination
   * @param args.limit - Optional limit for pagination
   * @param args.args - Optional additional query arguments
   * @returns Array of matching records
   */
  async selectMany<R>({
    tableName,
    whereClause,
    orderBy,
    offset,
    limit,
    args,
  }: {
    tableName: TABLE_NAMES;
    whereClause?: { sql: string; args: InValue[] };
    orderBy?: string;
    offset?: number;
    limit?: number;
    args?: any[];
  }): Promise<R[]> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    const columns = buildSelectColumns(tableName);

    let statement = `SELECT ${columns} FROM ${parsedTableName}`;

    if (whereClause?.sql) {
      statement += ` ${whereClause.sql}`;
    }

    if (orderBy) {
      statement += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      statement += ` LIMIT ${limit}`;
    }

    if (offset) {
      statement += ` OFFSET ${offset}`;
    }

    const result = await this.client.execute({
      sql: statement,
      args: [...(whereClause?.args ?? []), ...(args ?? [])],
    });

    // Parse JSON columns (same as select())
    return (result.rows ?? []).map(row => {
      return Object.fromEntries(
        Object.entries(row || {}).map(([k, v]) => {
          try {
            return [k, typeof v === 'string' ? (v.startsWith('{') || v.startsWith('[') ? JSON.parse(v) : v) : v];
          } catch {
            return [k, v];
          }
        }),
      );
    }) as R[];
  }

  /**
   * Returns the total count of records matching the optional WHERE clause.
   *
   * @param args - The count arguments
   * @param args.tableName - The name of the table to count from
   * @param args.whereClause - Optional WHERE clause with SQL string and arguments
   * @returns The total count of matching records
   */
  async selectTotalCount({
    tableName,
    whereClause,
  }: {
    tableName: TABLE_NAMES;
    whereClause?: { sql: string; args: InValue[] };
  }): Promise<number> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    const statement = `SELECT COUNT(*) as count FROM ${parsedTableName} ${whereClause ? `${whereClause.sql}` : ''}`;

    const result = await this.client.execute({
      sql: statement,
      args: whereClause?.args ?? [],
    });

    if (!result.rows || result.rows.length === 0) {
      return 0;
    }

    return (result.rows[0]?.count as number) ?? 0;
  }

  /**
   * Maps a storage column type to its SQLite equivalent.
   */

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'bigint':
        return 'INTEGER'; // SQLite uses INTEGER for all integer sizes
      case 'timestamp':
        return 'TEXT'; // Store timestamps as ISO strings in SQLite
      case 'float':
        return 'REAL'; // SQLite's floating point type
      case 'boolean':
        return 'INTEGER'; // SQLite uses 0/1 for booleans
      case 'jsonb':
        return 'TEXT'; // SQLite: column stores TEXT, we use jsonb()/json() functions for binary optimization
      default:
        return getSqlType(type); // text, integer, uuid all map correctly
    }
  }

  /**
   * Creates a table if it doesn't exist based on the provided schema.
   *
   * @param args - The create table arguments
   * @param args.tableName - The name of the table to create
   * @param args.schema - The schema definition for the table columns
   */
  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const parsedTableName = parseSqlIdentifier(tableName, 'table name');

      // Build column definitions
      const columnDefinitions = Object.entries(schema).map(([colName, colDef]) => {
        const type = this.getSqlType(colDef.type);
        const nullable = colDef.nullable === false ? 'NOT NULL' : '';
        const primaryKey = colDef.primaryKey ? 'PRIMARY KEY' : '';
        return `"${colName}" ${type} ${nullable} ${primaryKey}`.trim();
      });

      // Add table-level constraints
      const tableConstraints: string[] = [];
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        tableConstraints.push('UNIQUE (workflow_name, run_id)');
      }
      if (tableName === TABLE_SPANS) {
        tableConstraints.push('UNIQUE (spanId, traceId)');
      }

      const allDefinitions = [...columnDefinitions, ...tableConstraints].join(',\n  ');

      const sql = `CREATE TABLE IF NOT EXISTS ${parsedTableName} (\n  ${allDefinitions}\n)`;

      await this.client.execute(sql);
      this.logger.debug(`LibSQLDB: Created table ${tableName}`);

      // Run migrations for Spans table to add any new columns
      if (tableName === TABLE_SPANS) {
        await this.migrateSpansTable();
      }
    } catch (error) {
      // Rethrow MastraError (especially for migration required errors) - these must stop init
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Migrates the spans table schema from OLD_SPAN_SCHEMA to current SPAN_SCHEMA.
   * This adds new columns that don't exist in old schema and ensures required indexes exist.
   */
  private async migrateSpansTable(): Promise<void> {
    const schema = TABLE_SCHEMAS[TABLE_SPANS];

    try {
      // Add any columns from current schema that don't exist in the database
      for (const [columnName, columnDef] of Object.entries(schema)) {
        const columnExists = await this.hasColumn(TABLE_SPANS, columnName);
        if (!columnExists) {
          const sqlType = this.getSqlType(columnDef.type);
          // For new columns, use nullable (no default needed) since existing rows will have NULL
          const alterSql = `ALTER TABLE "${TABLE_SPANS}" ADD COLUMN "${columnName}" ${sqlType}`;
          await this.client.execute(alterSql);
          this.logger.debug(`LibSQLDB: Added column '${columnName}' to ${TABLE_SPANS}`);
        }
      }

      // Check if unique index already exists - if so, skip migration
      // This avoids running expensive queries on every init after migration is complete
      const indexExists = await this.spansUniqueIndexExists();
      if (!indexExists) {
        // Check for duplicates before attempting to create unique index
        const duplicateInfo = await this.checkForDuplicateSpans();
        if (duplicateInfo.hasDuplicates) {
          // Duplicates exist - throw error requiring manual migration
          const errorMessage =
            `\n` +
            `===========================================================================\n` +
            `MIGRATION REQUIRED: Duplicate spans detected in ${TABLE_SPANS}\n` +
            `===========================================================================\n` +
            `\n` +
            `Found ${duplicateInfo.duplicateCount} duplicate (traceId, spanId) combinations.\n` +
            `\n` +
            `The spans table requires a unique constraint on (traceId, spanId), but your\n` +
            `database contains duplicate entries that must be resolved first.\n` +
            `\n` +
            `To fix this, run the manual migration command:\n` +
            `\n` +
            `  npx mastra migrate\n` +
            `\n` +
            `This command will:\n` +
            `  1. Remove duplicate spans (keeping the most complete/recent version)\n` +
            `  2. Add the required unique constraint\n` +
            `\n` +
            `Note: This migration may take some time for large tables.\n` +
            `===========================================================================\n`;

          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'MIGRATION_REQUIRED', 'DUPLICATE_SPANS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: errorMessage,
          });
        } else {
          // No duplicates - safe to create unique index directly
          await this.client.execute(
            `CREATE UNIQUE INDEX IF NOT EXISTS "mastra_ai_spans_spanid_traceid_idx" ON "${TABLE_SPANS}" ("spanId", "traceId")`,
          );
          this.logger.debug(`LibSQLDB: Created unique index on (spanId, traceId) for ${TABLE_SPANS}`);
        }
      }

      this.logger.info(`LibSQLDB: Migration completed for ${TABLE_SPANS}`);
    } catch (error) {
      // Rethrow MastraError (especially for migration required errors) - these must stop init
      if (error instanceof MastraError) {
        throw error;
      }
      // Log warning but don't fail for other errors - schema migrations should be best-effort
      this.logger.warn(`LibSQLDB: Failed to migrate spans table ${TABLE_SPANS}:`, error);
    }
  }

  /**
   * Checks if the unique index on (spanId, traceId) already exists on the spans table.
   * Used to skip deduplication when the index already exists (migration already complete).
   */
  private async spansUniqueIndexExists(): Promise<boolean> {
    try {
      const result = await this.client.execute(
        `SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'mastra_ai_spans_spanid_traceid_idx'`,
      );
      return (result.rows?.length ?? 0) > 0;
    } catch {
      // If we can't check indexes (e.g., table doesn't exist), assume index doesn't exist
      return false;
    }
  }

  /**
   * Checks for duplicate (traceId, spanId) combinations in the spans table.
   * Returns information about duplicates for logging/CLI purposes.
   */
  private async checkForDuplicateSpans(): Promise<{
    hasDuplicates: boolean;
    duplicateCount: number;
  }> {
    try {
      const result = await this.client.execute(`
        SELECT COUNT(*) as duplicate_count FROM (
          SELECT "spanId", "traceId"
          FROM "${TABLE_SPANS}"
          GROUP BY "spanId", "traceId"
          HAVING COUNT(*) > 1
        )
      `);

      const duplicateCount = Number(result.rows?.[0]?.duplicate_count ?? 0);
      return {
        hasDuplicates: duplicateCount > 0,
        duplicateCount,
      };
    } catch (error) {
      // If table doesn't exist or other error, assume no duplicates
      this.logger.debug(`LibSQLDB: Could not check for duplicates: ${error}`);
      return { hasDuplicates: false, duplicateCount: 0 };
    }
  }

  /**
   * Manually run the spans migration to deduplicate and add the unique constraint.
   * This is intended to be called from the CLI when duplicates are detected.
   *
   * @returns Migration result with status and details
   */
  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    // Check if already migrated
    const indexExists = await this.spansUniqueIndexExists();
    if (indexExists) {
      return {
        success: true,
        alreadyMigrated: true,
        duplicatesRemoved: 0,
        message: `Migration already complete. Unique index exists on ${TABLE_SPANS}.`,
      };
    }

    // Check for duplicates
    const duplicateInfo = await this.checkForDuplicateSpans();

    if (duplicateInfo.hasDuplicates) {
      this.logger.info(
        `Found ${duplicateInfo.duplicateCount} duplicate (traceId, spanId) combinations. Starting deduplication...`,
      );

      // Run deduplication
      await this.deduplicateSpans();
    } else {
      this.logger.info(`No duplicate spans found.`);
    }

    // Add unique index
    await this.client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "mastra_ai_spans_spanid_traceid_idx" ON "${TABLE_SPANS}" ("spanId", "traceId")`,
    );

    return {
      success: true,
      alreadyMigrated: false,
      duplicatesRemoved: duplicateInfo.duplicateCount,
      message: duplicateInfo.hasDuplicates
        ? `Migration complete. Removed duplicates and added unique index to ${TABLE_SPANS}.`
        : `Migration complete. Added unique index to ${TABLE_SPANS}.`,
    };
  }

  /**
   * Check migration status for the spans table.
   * Returns information about whether migration is needed.
   */
  async checkSpansMigrationStatus(): Promise<{
    needsMigration: boolean;
    hasDuplicates: boolean;
    duplicateCount: number;
    constraintExists: boolean;
    tableName: string;
  }> {
    const indexExists = await this.spansUniqueIndexExists();

    if (indexExists) {
      return {
        needsMigration: false,
        hasDuplicates: false,
        duplicateCount: 0,
        constraintExists: true,
        tableName: TABLE_SPANS,
      };
    }

    const duplicateInfo = await this.checkForDuplicateSpans();
    return {
      needsMigration: true,
      hasDuplicates: duplicateInfo.hasDuplicates,
      duplicateCount: duplicateInfo.duplicateCount,
      constraintExists: false,
      tableName: TABLE_SPANS,
    };
  }

  /**
   * Deduplicates spans table by removing duplicate (spanId, traceId) combinations.
   * Keeps the "best" record for each duplicate group based on:
   * 1. Completed spans (endedAt IS NOT NULL) over incomplete ones
   * 2. Most recently updated (updatedAt DESC)
   * 3. Most recently created (createdAt DESC) as tiebreaker
   */
  private async deduplicateSpans(): Promise<void> {
    try {
      // Check if there are any duplicates first
      const duplicateCheck = await this.client.execute(`
        SELECT COUNT(*) as duplicate_count FROM (
          SELECT "spanId", "traceId"
          FROM "${TABLE_SPANS}"
          GROUP BY "spanId", "traceId"
          HAVING COUNT(*) > 1
        )
      `);

      const duplicateCount = Number(duplicateCheck.rows?.[0]?.duplicate_count ?? 0);
      if (duplicateCount === 0) {
        this.logger.debug(`LibSQLDB: No duplicate spans found, skipping deduplication`);
        return;
      }

      this.logger.warn(`LibSQLDB: Found ${duplicateCount} duplicate (spanId, traceId) combinations, deduplicating...`);

      // Delete duplicate spans, keeping the "best" record for each (spanId, traceId) pair.
      // Priority: completed spans > most recently updated > most recently created
      // Uses rowid for SQLite's internal row identifier to delete specific rows
      const deleteResult = await this.client.execute(`
        DELETE FROM "${TABLE_SPANS}"
        WHERE rowid NOT IN (
          SELECT MIN(best_rowid) FROM (
            SELECT
              rowid as best_rowid,
              "spanId",
              "traceId",
              ROW_NUMBER() OVER (
                PARTITION BY "spanId", "traceId"
                ORDER BY
                  CASE WHEN "endedAt" IS NOT NULL THEN 0 ELSE 1 END,
                  "updatedAt" DESC,
                  "createdAt" DESC
              ) as rn
            FROM "${TABLE_SPANS}"
          ) ranked
          WHERE rn = 1
          GROUP BY "spanId", "traceId"
        )
        AND ("spanId", "traceId") IN (
          SELECT "spanId", "traceId"
          FROM "${TABLE_SPANS}"
          GROUP BY "spanId", "traceId"
          HAVING COUNT(*) > 1
        )
      `);

      const deletedCount = deleteResult.rowsAffected ?? 0;
      this.logger.warn(`LibSQLDB: Deleted ${deletedCount} duplicate span records`);
    } catch (error) {
      // Log but continue - deduplication should be best-effort
      this.logger.warn(`LibSQLDB: Failed to deduplicate spans:`, error);
    }
  }

  /**
   * Gets a default value for a column type (used when adding NOT NULL columns).
   */
  private getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
      case 'uuid':
        return "DEFAULT ''";
      case 'integer':
      case 'bigint':
      case 'float':
        return 'DEFAULT 0';
      case 'boolean':
        return 'DEFAULT 0';
      case 'jsonb':
        return "DEFAULT '{}'";
      case 'timestamp':
        return 'DEFAULT CURRENT_TIMESTAMP';
      default:
        return "DEFAULT ''";
    }
  }

  /**
   * Alters an existing table to add missing columns.
   * Used for schema migrations when new columns are added.
   *
   * @param args - The alter table arguments
   * @param args.tableName - The name of the table to alter
   * @param args.schema - The full schema definition for the table
   * @param args.ifNotExists - Array of column names to add if they don't exist
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
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    try {
      // Get existing columns
      const tableInfo = await this.client.execute({
        sql: `PRAGMA table_info("${parsedTableName}")`,
      });
      const existingColumns = new Set((tableInfo.rows || []).map((row: any) => row.name?.toLowerCase()));

      // Add missing columns
      for (const columnName of ifNotExists) {
        if (!existingColumns.has(columnName.toLowerCase()) && schema[columnName]) {
          const columnDef = schema[columnName];
          const sqlType = this.getSqlType(columnDef.type);
          const defaultValue = this.getDefaultValue(columnDef.type);

          // SQLite doesn't support ADD COLUMN IF NOT EXISTS, but we checked above
          const alterSql = `ALTER TABLE ${parsedTableName} ADD COLUMN "${columnName}" ${sqlType} ${defaultValue}`;
          await this.client.execute(alterSql);
          this.logger.debug(`LibSQLDB: Added column ${columnName} to table ${tableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'ALTER_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Deletes all records from the specified table.
   * Errors are logged but not thrown.
   *
   * @param args - The delete arguments
   * @param args.tableName - The name of the table to clear
   */
  async deleteData({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    try {
      await this.client.execute(`DELETE FROM ${parsedTableName}`);
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CLEAR_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        e,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
    }
  }
}
