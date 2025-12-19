import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoreOperations,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_TRACES,
  TABLE_SCORERS,
  TABLE_SPANS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageColumn,
  TABLE_NAMES,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { IDatabase } from 'pg-promise';
import { splitIntoBatches, DEFAULT_MAX_ROWS_PER_BATCH } from '../../../shared/batch';
import { withRetry } from '../../../shared/retry';
import { getSchemaName, getTableName } from '../utils';

// Re-export the types for convenience
export type { CreateIndexOptions, IndexInfo, StorageIndexStats };

export class StoreOperationsDSQL extends StoreOperations {
  public client: IDatabase<{}>;
  public schemaName?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;

  constructor({ client, schemaName }: { client: IDatabase<{}>; schemaName?: string }) {
    super();
    this.client = client;
    this.schemaName = schemaName;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    // Use this.schema to scope the check
    const schema = this.schemaName || 'public';

    const result = await this.client.oneOrNone(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND (column_name = $3 OR column_name = $4)`,
      [schema, table, column, column.toLowerCase()],
    );

    return !!result;
  }

  /**
   * Prepares values for insertion, handling TEXT columns storing JSON by stringifying them.
   * Aurora DSQL does not support JSONB natively, so we store JSON as TEXT.
   */
  private prepareValuesForInsert(record: Record<string, any>, tableName: TABLE_NAMES): any[] {
    return Object.entries(record).map(([key, value]) => {
      // Get the schema for this table to determine column types
      const schema = TABLE_SCHEMAS[tableName];
      const columnSchema = schema?.[key];

      // If the column is TEXT (storing JSON) or was previously JSONB, stringify objects
      // Aurora DSQL: We use TEXT instead of JSONB and cast to ::jsonb when filtering
      if (columnSchema?.type === 'jsonb' && value !== null && value !== undefined && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    });
  }

  /**
   * Adds timestamp Z columns to a record if timestamp columns exist
   */
  private addTimestampZColumns(record: Record<string, any>): void {
    if (record.createdAt) {
      record.createdAtZ = record.createdAt;
    }
    if (record.created_at) {
      record.created_atZ = record.created_at;
    }
    if (record.updatedAt) {
      record.updatedAtZ = record.updatedAt;
    }
  }

  /**
   * Prepares a value for database operations, handling Date objects and JSON serialization.
   * This is schema-aware and stringifies objects for TEXT columns storing JSON.
   * Aurora DSQL: We use TEXT instead of JSONB and cast to ::jsonb when filtering.
   */
  private prepareValue(value: any, columnName: string, tableName: TABLE_NAMES): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    // Get the schema for this table to determine column types
    const schema = TABLE_SCHEMAS[tableName];
    const columnSchema = schema?.[columnName];

    // If the column is TEXT (storing JSON) or was previously JSONB, stringify objects
    // Aurora DSQL: We store JSON as TEXT and cast to ::jsonb only when filtering
    if (columnSchema?.type === 'jsonb') {
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
    }

    // For other columns with object values, stringify them (for backwards compatibility)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  private async setupSchema() {
    if (!this.schemaName || this.schemaSetupComplete) {
      return;
    }

    const schemaName = getSchemaName(this.schemaName);

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          // First check if schema exists and we have usage permission
          const schemaExists = await this.client.oneOrNone(
            `
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.schemata
                  WHERE schema_name = $1
                )
              `,
            [this.schemaName],
          );

          if (!schemaExists?.exists) {
            try {
              await this.client.none(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
              this.logger.info(`Schema "${this.schemaName}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${this.schemaName}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schemaName}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          // If we got here, schema exists and we can use it
          this.schemaSetupComplete = true;
          this.logger.debug(`Schema "${schemaName}" is ready for use`);
        } catch (error) {
          // Reset flags so we can retry
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

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    this.addTimestampZColumns(record);

    const schemaName = getSchemaName(this.schemaName);
    const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
    const values = this.prepareValuesForInsert(record, tableName);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    await withRetry(
      async () => {
        await this.client.none(
          `INSERT INTO ${getTableName({ indexName: tableName, schemaName })} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
          values,
        );
      },
      {
        onRetry: (error, attempt, delay) => {
          this.logger?.warn?.(`insert retry ${attempt} for table ${tableName} after ${delay}ms: ${error.message}`);
        },
      },
    ).catch(error => {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_INSERT_FAILED',
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

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await withRetry(
        async () => {
          const schemaName = getSchemaName(this.schemaName);
          const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
          // Aurora DSQL does not support TRUNCATE, use DELETE FROM instead
          await this.client.none(`DELETE FROM ${tableNameWithSchema}`);
        },
        {
          onRetry: (error, attempt, delay) => {
            this.logger?.warn?.(`clearTable retry ${attempt} for ${tableName} after ${delay}ms: ${error.message}`);
          },
        },
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_CLEAR_TABLE_FAILED',
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
   * Override getSqlType to map JSONB to TEXT for Aurora DSQL compatibility.
   * Aurora DSQL does not fully support native JSONB, so we store JSON as TEXT
   * and cast to ::jsonb only when filtering/querying.
   */
  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'jsonb':
        // Aurora DSQL: Store JSON data as TEXT instead of JSONB
        return 'TEXT';
      default:
        return super.getSqlType(type);
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'timestamp':
        return 'DEFAULT NOW()';
      case 'jsonb':
        // Aurora DSQL: JSONB columns are stored as TEXT with JSON content
        // We use TEXT with a default empty JSON object string
        return "DEFAULT '{}'";
      case 'text':
        // For TEXT columns that might store JSON, use empty string or null
        return '';
      default:
        return super.getDefaultValue(type);
    }
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await withRetry(
      async () => {
        const timeZColumnNames = Object.entries(schema)
          .filter(([_, def]) => def.type === 'timestamp')
          .map(([name]) => name);

        const timeZColumns = Object.entries(schema)
          .filter(([_, def]) => def.type === 'timestamp')
          .map(([name]) => {
            const parsedName = parseSqlIdentifier(name, 'column name');
            return `"${parsedName}Z" TIMESTAMPTZ DEFAULT NOW()`;
          });

        const columns = Object.entries(schema).map(([name, def]) => {
          const parsedName = parseSqlIdentifier(name, 'column name');
          const constraints = [];
          if (def.primaryKey) constraints.push('PRIMARY KEY');
          if (!def.nullable) constraints.push('NOT NULL');
          // Use getSqlType to convert JSONB to TEXT for Aurora DSQL compatibility
          const sqlType = this.getSqlType(def.type);
          return `"${parsedName}" ${sqlType} ${constraints.join(' ')}`;
        });

        // Create schema if it doesn't exist
        if (this.schemaName) {
          await this.setupSchema();
        }

        const finalColumns = [...columns, ...timeZColumns].join(',\n');

        // Constraints are global to a database, ensure schemas do not conflict with each other
        const constraintPrefix = this.schemaName ? `${this.schemaName}_` : '';
        const createTableSql = `
          CREATE TABLE IF NOT EXISTS ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (
            ${finalColumns}
          );
        `;

        await this.client.none(createTableSql);

        // Aurora DSQL: Use CREATE UNIQUE INDEX ASYNC instead of UNIQUE constraint
        // DSQL doesn't support DO $$ blocks or PL/pgSQL
        if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
          const indexName = `${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key`;
          const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });

          try {
            // Check if index already exists
            const indexExists = await this.client.oneOrNone(`SELECT 1 FROM pg_indexes WHERE indexname = $1`, [
              indexName,
            ]);

            if (!indexExists) {
              // Create async unique index for eventual consistency
              const result = await this.client.oneOrNone<{ job_uuid: string }>(
                `CREATE UNIQUE INDEX ASYNC "${indexName}" ON ${fullTableName} ("workflow_name", "run_id")`,
              );
              if (result?.job_uuid) {
                await this.waitForDSQLJob(result.job_uuid);
              }
              this.logger?.debug?.(`Created unique index ${indexName} on ${fullTableName}`);
            }
          } catch (error) {
            // Log warning but don't fail - the index creation is async and may take time
            this.logger?.warn?.(`Failed to create unique index ${indexName}:`, error);
          }
        }

        await this.alterTable({
          tableName,
          schema,
          ifNotExists: timeZColumnNames,
        });

        // Set up timestamp triggers for Spans table
        if (tableName === TABLE_SPANS) {
          await this.setupTimestampTriggers(tableName);
        }
      },
      {
        onRetry: (error, attempt, delay) => {
          this.logger?.warn?.(`createTable retry ${attempt} for ${tableName} after ${delay}ms: ${error.message}`);
        },
      },
    ).catch(error => {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_CREATE_TABLE_FAILED',
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
   * Set up timestamp triggers for a table to automatically manage createdAt/updatedAt
   * Note: Aurora DSQL doesn't support triggers, PL/pgSQL, or CREATE FUNCTION.
   * Timestamps are managed at the application level in insert/update operations.
   * This method is kept as a no-op for API compatibility.
   */
  private async setupTimestampTriggers(_tableName: TABLE_NAMES): Promise<void> {
    // Aurora DSQL doesn't support triggers, PL/pgSQL, or CREATE FUNCTION.
    // Timestamps (createdAt, updatedAt, createdAtZ, updatedAtZ) are managed:
    // - DEFAULT NOW() on column definition for createdAt/createdAtZ
    // - Application-level setting in update operations for updatedAt/updatedAtZ
    // See: addTimestampZColumns() and prepareValuesForInsert() methods
    return;
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
          const columnDef = schema[columnName];
          const sqlType = this.getSqlType(columnDef.type);
          // Aurora DSQL: ALTER TABLE ADD COLUMN with constraints (NOT NULL, DEFAULT) is not supported
          // We can only add nullable columns without constraints
          const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
          const alterSql = `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}" ${sqlType}`;

          await this.client.none(alterSql);

          if (sqlType === 'TIMESTAMP') {
            // Add the Z column as well (nullable, no default - DSQL limitation)
            const alterSqlZ = `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ`;
            await this.client.none(alterSqlZ);
          }

          this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_ALTER_TABLE_FAILED',
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

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys).map(([key, value]) => [parseSqlIdentifier(key, 'column name'), value]);
      const conditions = keyEntries.map(([key], index) => `"${key}" = $${index + 1}`).join(' AND ');
      const values = keyEntries.map(([_, value]) => value);

      const result = await this.client.oneOrNone(
        `SELECT * FROM ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} WHERE ${conditions} ORDER BY "createdAt" DESC LIMIT 1`,
        values,
      );

      if (!result) {
        return null;
      }

      // If this is a workflow snapshot, parse the snapshot field
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = result as any;
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return snapshot as R;
      }

      return result as R;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_LOAD_FAILED',
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
    if (records.length === 0) {
      return;
    }

    try {
      // Split records into DSQL-compatible batches (max 3000 rows per transaction)
      const { batches } = splitIntoBatches(records, { maxRows: DEFAULT_MAX_ROWS_PER_BATCH });

      // Process each batch with retry support
      for (const batch of batches) {
        await withRetry(
          async () => {
            await this.client.tx(async t => {
              for (const record of batch) {
                this.addTimestampZColumns(record);
                const schemaName = getSchemaName(this.schemaName);
                const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
                const values = this.prepareValuesForInsert(record, tableName);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                await t.none(
                  `INSERT INTO ${getTableName({ indexName: tableName, schemaName })} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
                  values,
                );
              }
            });
          },
          {
            onRetry: (error, attempt, delay) => {
              this.logger?.warn?.(
                `Batch insert retry ${attempt} for table ${tableName} after ${delay}ms: ${error.message}`,
              );
            },
          },
        );
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_BATCH_INSERT_FAILED',
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
      const schemaName = getSchemaName(this.schemaName);
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
      await this.client.none(`DROP TABLE IF EXISTS ${tableNameWithSchema}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_DROP_TABLE_FAILED',
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
   * Wait for an asynchronous DSQL job to complete.
   * Aurora DSQL requires CREATE INDEX ASYNC and sys.wait_for_job() to wait for completion.
   */
  private async waitForDSQLJob(jobUuid: string, timeoutMs: number = 60000): Promise<void> {
    const pollIntervalMs = 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.client.oneOrNone<{ status: string }>(`SELECT sys.wait_for_job($1, 1) as status`, [
        jobUuid,
      ]);

      if (result?.status === 'COMPLETED') {
        return;
      }

      if (result?.status === 'FAILED') {
        throw new Error(`DSQL async job ${jobUuid} failed`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`DSQL async job ${jobUuid} timed out after ${timeoutMs}ms`);
  }

  /**
   * Create a new index on a table
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const {
        name,
        table,
        columns,
        unique = false,
        // Note: 'concurrent' option is ignored in DSQL - always uses ASYNC
        where,
        method = 'btree',
        opclass,
        storage,
        tablespace,
      } = options;

      const schemaName = this.schemaName || 'public';
      const fullTableName = getTableName({
        indexName: table as TABLE_NAMES,
        schemaName: getSchemaName(this.schemaName),
      });

      // Check if index already exists
      const indexExists = await this.client.oneOrNone<{ exists: number }>(
        `SELECT 1 as exists FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
        [name, schemaName],
      );

      if (indexExists) {
        // Index already exists, skip creation
        return;
      }

      // Build index creation SQL
      // Aurora DSQL uses CREATE INDEX ASYNC instead of CONCURRENTLY
      const uniqueStr = unique ? 'UNIQUE ' : '';
      const methodStr = method !== 'btree' ? `USING ${method} ` : '';

      // Handle columns with optional operator class
      // Aurora DSQL: Strip ASC/DESC sort order specifiers (not supported)
      // B-tree indexes support bidirectional scanning, so ORDER BY ... DESC
      // queries still work efficiently without explicit sort order in the index.
      const columnsStr = columns
        .map(col => {
          // Strip ASC/DESC modifiers for Aurora DSQL compatibility
          const colName = col.replace(/\s+(DESC|ASC)$/i, '').trim();
          const quotedCol = `"${parseSqlIdentifier(colName, 'column name')}"`;
          return opclass ? `${quotedCol} ${opclass}` : quotedCol;
        })
        .join(', ');

      const whereStr = where ? ` WHERE ${where}` : '';
      const tablespaceStr = tablespace ? ` TABLESPACE ${tablespace}` : '';

      // Build storage parameters string
      let withStr = '';
      if (storage && Object.keys(storage).length > 0) {
        const storageParams = Object.entries(storage)
          .map(([key, value]) => `${key} = ${value}`)
          .join(', ');
        withStr = ` WITH (${storageParams})`;
      }

      // Aurora DSQL: Use ASYNC instead of CONCURRENTLY
      const sql = `CREATE ${uniqueStr}INDEX ASYNC ${name} ON ${fullTableName} ${methodStr}(${columnsStr})${withStr}${tablespaceStr}${whereStr}`;

      // Execute and get the job UUID
      const result = await this.client.oneOrNone<{ job_uuid: string }>(sql);

      // If ASYNC returns a job UUID, wait for completion
      if (result?.job_uuid) {
        await this.waitForDSQLJob(result.job_uuid);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_INDEX_CREATE_FAILED',
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
    const schemaName = this.schemaName || 'public';

    await withRetry(
      async () => {
        // Check if index exists first
        const indexExists = await this.client.oneOrNone(
          `SELECT 1 FROM pg_indexes
           WHERE indexname = $1
           AND schemaname = $2`,
          [indexName, schemaName],
        );

        if (!indexExists) {
          // Index doesn't exist, nothing to drop
          return;
        }

        const sql = `DROP INDEX IF EXISTS ${getSchemaName(this.schemaName)}.${indexName}`;
        await this.client.none(sql);
      },
      {
        onRetry: (error, attempt, delay) => {
          this.logger?.warn?.(`dropIndex retry ${attempt} for ${indexName} after ${delay}ms: ${error.message}`);
        },
      },
    ).catch(error => {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_INDEX_DROP_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    });
  }

  /**
   * List indexes for a specific table or all tables
   */
  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    try {
      const schemaName = this.schemaName || 'public';

      let query: string;
      let params: any[];

      if (tableName) {
        query = `
          SELECT
            i.indexname as name,
            i.tablename as table,
            i.indexdef as definition,
            ix.indisunique as is_unique,
            pg_size_pretty(pg_relation_size(c.oid)) as size,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
          FROM pg_indexes i
          JOIN pg_class c ON c.relname = i.indexname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
          JOIN pg_index ix ON ix.indexrelid = c.oid
          JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
          WHERE i.schemaname = $1
          AND i.tablename = $2
          GROUP BY i.indexname, i.tablename, i.indexdef, ix.indisunique, c.oid
        `;
        params = [schemaName, tableName];
      } else {
        query = `
          SELECT
            i.indexname as name,
            i.tablename as table,
            i.indexdef as definition,
            ix.indisunique as is_unique,
            pg_size_pretty(pg_relation_size(c.oid)) as size,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
          FROM pg_indexes i
          JOIN pg_class c ON c.relname = i.indexname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
          JOIN pg_index ix ON ix.indexrelid = c.oid
          JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
          WHERE i.schemaname = $1
          GROUP BY i.indexname, i.tablename, i.indexdef, ix.indisunique, c.oid
        `;
        params = [schemaName];
      }

      const results = await this.client.manyOrNone(query, params);

      return results.map(row => {
        // Parse PostgreSQL array format {col1,col2} to ['col1','col2']
        let columns: string[] = [];
        if (typeof row.columns === 'string' && row.columns.startsWith('{') && row.columns.endsWith('}')) {
          // Remove braces and split by comma, handling empty arrays
          const arrayContent = row.columns.slice(1, -1);
          columns = arrayContent ? arrayContent.split(',') : [];
        } else if (Array.isArray(row.columns)) {
          columns = row.columns;
        }

        return {
          name: row.name,
          table: row.table,
          columns,
          unique: row.is_unique || false,
          size: row.size || '0',
          definition: row.definition || '',
        };
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_INDEX_LIST_FAILED',
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
   * Returns definitions for automatic performance indexes
   * These composite indexes cover both filtering and sorting in single index
   */
  protected getAutomaticIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schemaName ? `${this.schemaName}_` : '';
    return [
      // Composite index for threads (filter + sort)
      {
        name: `${schemaPrefix}mastra_threads_resourceid_createdat_idx`,
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt'],
      },
      // Composite index for messages (filter + sort)
      {
        name: `${schemaPrefix}mastra_messages_thread_id_createdat_idx`,
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt'],
      },
      // Composite index for traces (filter + sort)
      {
        name: `${schemaPrefix}mastra_traces_name_starttime_idx`,
        table: TABLE_TRACES,
        columns: ['name', 'startTime'],
      },
      // Composite index for scores (filter + sort)
      {
        name: `${schemaPrefix}mastra_scores_trace_id_span_id_created_at_idx`,
        table: TABLE_SCORERS,
        columns: ['traceId', 'spanId', 'createdAt'],
      },
      // Spans indexes for optimal trace querying
      {
        name: `${schemaPrefix}mastra_ai_spans_traceid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_name_idx`,
        table: TABLE_SPANS,
        columns: ['name'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt'],
      },
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
          id: 'MASTRA_STORAGE_DSQL_STORE_CREATE_PERFORMANCE_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const schemaName = this.schemaName || 'public';

      // First get basic index info and stats
      const query = `
        SELECT
          i.indexname as name,
          i.tablename as table,
          i.indexdef as definition,
          ix.indisunique as is_unique,
          pg_size_pretty(pg_relation_size(c.oid)) as size,
          array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
          am.amname as method,
          s.idx_scan as scans,
          s.idx_tup_read as tuples_read,
          s.idx_tup_fetch as tuples_fetched
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
        JOIN pg_index ix ON ix.indexrelid = c.oid
        JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
        JOIN pg_am am ON c.relam = am.oid
        LEFT JOIN pg_stat_user_indexes s ON s.indexrelname = i.indexname AND s.schemaname = i.schemaname
        WHERE i.schemaname = $1
        AND i.indexname = $2
        GROUP BY i.indexname, i.tablename, i.indexdef, ix.indisunique, c.oid, am.amname, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
      `;

      const result = await this.client.oneOrNone(query, [schemaName, indexName]);

      if (!result) {
        throw new Error(`Index "${indexName}" not found in schema "${schemaName}"`);
      }

      // Parse PostgreSQL array format
      let columns: string[] = [];
      if (typeof result.columns === 'string' && result.columns.startsWith('{') && result.columns.endsWith('}')) {
        const arrayContent = result.columns.slice(1, -1);
        columns = arrayContent ? arrayContent.split(',') : [];
      } else if (Array.isArray(result.columns)) {
        columns = result.columns;
      }

      // Aurora DSQL returns 'btree_index' instead of 'btree', normalize for API consistency
      const normalizedMethod = result.method === 'btree_index' ? 'btree' : result.method || 'btree';

      return {
        name: result.name,
        table: result.table,
        columns,
        unique: result.is_unique || false,
        size: result.size || '0',
        definition: result.definition || '',
        method: normalizedMethod,
        scans: parseInt(result.scans) || 0,
        tuples_read: parseInt(result.tuples_read) || 0,
        tuples_fetched: parseInt(result.tuples_fetched) || 0,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_INDEX_DESCRIBE_FAILED',
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
   * Update a single record in the database
   */
  async update({
    tableName,
    keys,
    data,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
  }): Promise<void> {
    const setColumns: string[] = [];
    const setValues: any[] = [];
    let paramIndex = 1;

    // Aurora DSQL: Set updatedAt/updatedAtZ since triggers are not supported
    const now = new Date().toISOString();
    const dataWithTimestamp = {
      ...data,
      updatedAt: now,
      updatedAtZ: now,
    };

    // Build SET clause
    Object.entries(dataWithTimestamp).forEach(([key, value]) => {
      const parsedKey = parseSqlIdentifier(key, 'column name');
      setColumns.push(`"${parsedKey}" = $${paramIndex++}`);
      setValues.push(this.prepareValue(value, key, tableName));
    });

    // Build WHERE clause
    const whereConditions: string[] = [];
    const whereValues: any[] = [];

    Object.entries(keys).forEach(([key, value]) => {
      const parsedKey = parseSqlIdentifier(key, 'column name');
      whereConditions.push(`"${parsedKey}" = $${paramIndex++}`);
      whereValues.push(this.prepareValue(value, key, tableName));
    });

    const tableName_ = getTableName({
      indexName: tableName,
      schemaName: getSchemaName(this.schemaName),
    });

    const sql = `UPDATE ${tableName_} SET ${setColumns.join(', ')} WHERE ${whereConditions.join(' AND ')}`;
    const values = [...setValues, ...whereValues];

    await withRetry(
      async () => {
        await this.client.none(sql, values);
      },
      {
        onRetry: (error, attempt, delay) => {
          this.logger?.warn?.(`update retry ${attempt} for table ${tableName} after ${delay}ms: ${error.message}`);
        },
      },
    ).catch(error => {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_UPDATE_FAILED',
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
   * Update multiple records in a single batch transaction.
   * Uses batch splitting and retry to handle DSQL's transaction limits (max 3000 rows).
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
    if (updates.length === 0) {
      return;
    }

    try {
      // Split updates into DSQL-compatible batches (max 3000 rows per transaction)
      const { batches } = splitIntoBatches(updates, { maxRows: DEFAULT_MAX_ROWS_PER_BATCH });

      // Process each batch with retry support
      for (const batch of batches) {
        await withRetry(
          async () => {
            await this.client.tx(async t => {
              for (const { keys, data } of batch) {
                // Prepare update data
                const setClauses: string[] = [];
                const whereConditions: string[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                // Aurora DSQL: Set updatedAt/updatedAtZ since triggers are not supported
                const now = new Date().toISOString();
                const dataWithTimestamp = {
                  ...data,
                  updatedAt: now,
                  updatedAtZ: now,
                };

                // Build SET clause
                Object.entries(dataWithTimestamp).forEach(([key, value]) => {
                  const parsedKey = parseSqlIdentifier(key, 'column name');
                  const preparedValue = this.prepareValue(value, key, tableName);
                  setClauses.push(`"${parsedKey}" = $${paramIndex++}`);
                  values.push(preparedValue);
                });

                // Build WHERE clause
                Object.entries(keys).forEach(([key, value]) => {
                  const parsedKey = parseSqlIdentifier(key, 'column name');
                  whereConditions.push(`"${parsedKey}" = $${paramIndex++}`);
                  values.push(value);
                });

                const tableName_ = getTableName({
                  indexName: tableName,
                  schemaName: getSchemaName(this.schemaName),
                });

                const sql = `UPDATE ${tableName_} SET ${setClauses.join(', ')} WHERE ${whereConditions.join(' AND ')}`;
                await t.none(sql, values);
              }
            });
          },
          {
            onRetry: (error, attempt, delay) => {
              this.logger?.warn?.(
                `Batch update retry ${attempt} for table ${tableName} after ${delay}ms: ${error.message}`,
              );
            },
          },
        );
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_BATCH_UPDATE_FAILED',
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
   * Delete multiple records by keys.
   * Uses batch splitting and retry to handle DSQL's transaction limits (max 3000 rows).
   */
  async batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any>[] }): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    try {
      const tableName_ = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName),
      });

      // Split keys into DSQL-compatible batches (max 3000 rows per transaction)
      const { batches } = splitIntoBatches(keys, { maxRows: DEFAULT_MAX_ROWS_PER_BATCH });

      // Process each batch with retry support
      for (const batch of batches) {
        await withRetry(
          async () => {
            await this.client.tx(async t => {
              for (const keySet of batch) {
                const conditions: string[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                Object.entries(keySet).forEach(([key, value]) => {
                  const parsedKey = parseSqlIdentifier(key, 'column name');
                  conditions.push(`"${parsedKey}" = $${paramIndex++}`);
                  values.push(value);
                });

                const sql = `DELETE FROM ${tableName_} WHERE ${conditions.join(' AND ')}`;
                await t.none(sql, values);
              }
            });
          },
          {
            onRetry: (error, attempt, delay) => {
              this.logger?.warn?.(
                `Batch delete retry ${attempt} for table ${tableName} after ${delay}ms: ${error.message}`,
              );
            },
          },
        );
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_BATCH_DELETE_FAILED',
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
}
