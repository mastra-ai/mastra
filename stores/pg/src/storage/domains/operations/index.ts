import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoreOperations,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_TRACES,
  TABLE_EVALS,
} from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES, CreateIndexOptions, IndexInfo } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { IDatabase } from 'pg-promise';
import { getSchemaName, getTableName } from '../utils';

// Re-export the types for convenience
export type { CreateIndexOptions, IndexInfo };

export class StoreOperationsPG extends StoreOperations {
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
    try {
      if (record.createdAt) {
        record.createdAtZ = record.createdAt;
      }

      if (record.created_at) {
        record.created_atZ = record.created_at;
      }

      if (record.updatedAt) {
        record.updatedAtZ = record.updatedAt;
      }

      const schemaName = getSchemaName(this.schemaName);
      const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
      const values = Object.values(record);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      await this.client.none(
        `INSERT INTO ${getTableName({ indexName: tableName, schemaName })} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
        values,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_INSERT_FAILED',
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
    try {
      const schemaName = getSchemaName(this.schemaName);
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
      await this.client.none(`TRUNCATE TABLE ${tableNameWithSchema} CASCADE`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_CLEAR_TABLE_FAILED',
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
        return 'DEFAULT NOW()';
      case 'jsonb':
        return "DEFAULT '{}'::jsonb";
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
    try {
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
        return `"${parsedName}" ${def.type.toUpperCase()} ${constraints.join(' ')}`;
      });

      // Create schema if it doesn't exist
      if (this.schemaName) {
        await this.setupSchema();
      }

      const finalColumns = [...columns, ...timeZColumns].join(',\n');

      // Constraints are global to a database, ensure schemas do not conflict with each other
      const constraintPrefix = this.schemaName ? `${this.schemaName}_` : '';
      const sql = `
            CREATE TABLE IF NOT EXISTS ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (
              ${finalColumns}
            );
            ${
              tableName === TABLE_WORKFLOW_SNAPSHOT
                ? `
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = '${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key'
              ) AND NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = '${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key'
              ) THEN
                ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })}
                ADD CONSTRAINT ${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key
                UNIQUE (workflow_name, run_id);
              END IF;
            END $$;
            `
                : ''
            }
          `;

      await this.client.none(sql);

      await this.alterTable({
        tableName,
        schema,
        ifNotExists: timeZColumnNames,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_CREATE_TABLE_FAILED',
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
          const nullable = columnDef.nullable === false ? 'NOT NULL' : '';
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
          const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
          const alterSql =
            `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();

          await this.client.none(alterSql);

          if (sqlType === 'TIMESTAMP') {
            const alterSql =
              `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(alterSql);
          }

          this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_ALTER_TABLE_FAILED',
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

      const result = await this.client.oneOrNone<R>(
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
        return snapshot;
      }

      return result;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_LOAD_FAILED',
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
    try {
      await this.client.query('BEGIN');
      for (const record of records) {
        await this.insert({ tableName, record });
      }
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_BATCH_INSERT_FAILED',
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
          id: 'MASTRA_STORAGE_PG_STORE_DROP_TABLE_FAILED',
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
   * Create a new index on a table
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const { name, table, columns, unique = false, concurrent = true, where, method = 'btree' } = options;

      const schemaName = this.schemaName || 'public';
      const fullTableName = getTableName({
        indexName: table as TABLE_NAMES,
        schemaName: getSchemaName(this.schemaName),
      });

      // Check if index already exists
      const indexExists = await this.client.oneOrNone(
        `SELECT 1 FROM pg_indexes 
         WHERE indexname = $1 
         AND schemaname = $2`,
        [name, schemaName],
      );

      if (indexExists) {
        // Index already exists, skip creation
        return;
      }

      // Build index creation SQL
      const uniqueStr = unique ? 'UNIQUE ' : '';
      const concurrentStr = concurrent ? 'CONCURRENTLY ' : '';
      const methodStr = method !== 'btree' ? `USING ${method} ` : '';
      const columnsStr = columns
        .map(col => {
          // Handle columns with DESC/ASC modifiers
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const [colName, ...modifiers] = col.split(' ');
            if (!colName) {
              throw new Error(`Invalid column specification: ${col}`);
            }
            return `"${parseSqlIdentifier(colName, 'column name')}" ${modifiers.join(' ')}`;
          }
          return `"${parseSqlIdentifier(col, 'column name')}"`;
        })
        .join(', ');
      const whereStr = where ? ` WHERE ${where}` : '';

      const sql = `CREATE ${uniqueStr}INDEX ${concurrentStr}${name} ON ${fullTableName} ${methodStr}(${columnsStr})${whereStr}`;

      await this.client.none(sql);
    } catch (error) {
      // Check if error is due to concurrent index creation on a table that doesn't support it
      if (error instanceof Error && error.message.includes('CONCURRENTLY')) {
        // Retry without CONCURRENTLY
        const retryOptions = { ...options, concurrent: false };
        return this.createIndex(retryOptions);
      }

      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_INDEX_CREATE_FAILED',
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
      // Check if index exists first
      const schemaName = this.schemaName || 'public';
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
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_INDEX_DROP_FAILED',
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
          id: 'MASTRA_STORAGE_PG_INDEX_LIST_FAILED',
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
   * Creates automatic indexes for optimal query performance
   * These composite indexes cover both filtering and sorting in single index
   */
  async createAutomaticIndexes(): Promise<void> {
    try {
      const schemaPrefix = this.schemaName ? `${this.schemaName}_` : '';
      const indexes: CreateIndexOptions[] = [
        // Composite index for threads (filter + sort)
        {
          name: `${schemaPrefix}mastra_threads_resourceid_createdat_idx`,
          table: TABLE_THREADS,
          columns: ['resourceId', 'createdAt DESC'],
        },
        // Composite index for messages (filter + sort)
        {
          name: `${schemaPrefix}mastra_messages_thread_id_createdat_idx`,
          table: TABLE_MESSAGES,
          columns: ['thread_id', 'createdAt DESC'],
        },
        // Composite index for traces (filter + sort)
        {
          name: `${schemaPrefix}mastra_traces_name_starttime_idx`,
          table: TABLE_TRACES,
          columns: ['name', 'startTime DESC'],
        },
        // Composite index for evals (filter + sort)
        {
          name: `${schemaPrefix}mastra_evals_agent_name_created_at_idx`,
          table: TABLE_EVALS,
          columns: ['agent_name', 'created_at DESC'],
        },
      ];

      for (const indexOptions of indexes) {
        try {
          await this.createIndex(indexOptions);
        } catch (error) {
          // Log but continue with other indexes
          console.warn(`Failed to create index ${indexOptions.name}:`, error);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_CREATE_PERFORMANCE_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
