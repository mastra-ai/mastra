import type { ConnectionOptions } from 'node:tls';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SPANS,
  TABLE_SCHEMAS,
  getSqlType,
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
import { Pool } from 'pg';
import type { DbClient } from '../client';
import { PoolAdapter } from '../client';
import { buildConstraintName } from './constraint-utils';

// Re-export DbClient for external use
export type { DbClient } from '../client';

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing database client (Pool or PoolAdapter)
 * 2. Config to create a new pool internally
 */
export type PgDomainConfig = PgDomainClientConfig | PgDomainPoolConfig | PgDomainRestConfig;

/**
 * Pass an existing database client (DbClient)
 */
export interface PgDomainClientConfig {
  /** The database client */
  client: DbClient;
  /** Optional schema name (defaults to 'public') */
  schemaName?: string;
  /** When true, default indexes will not be created during initialization */
  skipDefaultIndexes?: boolean;
  /** Custom indexes to create for this domain's tables */
  indexes?: CreateIndexOptions[];
}

/**
 * Pass an existing pg.Pool
 */
export interface PgDomainPoolConfig {
  /** Pre-configured pg.Pool */
  pool: Pool;
  /** Optional schema name (defaults to 'public') */
  schemaName?: string;
  /** When true, default indexes will not be created during initialization */
  skipDefaultIndexes?: boolean;
  /** Custom indexes to create for this domain's tables */
  indexes?: CreateIndexOptions[];
}

/**
 * Pass config to create a new pg.Pool internally
 */
export type PgDomainRestConfig = {
  /** Optional schema name (defaults to 'public') */
  schemaName?: string;
  /** When true, default indexes will not be created during initialization */
  skipDefaultIndexes?: boolean;
  /** Custom indexes to create for this domain's tables */
  indexes?: CreateIndexOptions[];
} & (
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean | ConnectionOptions;
    }
  | {
      connectionString: string;
      ssl?: boolean | ConnectionOptions;
    }
);

/**
 * Resolves PgDomainConfig to a database client and schema.
 * Handles creating a new pool if config is provided.
 */
export function resolvePgConfig(config: PgDomainConfig): {
  client: DbClient;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
  indexes?: CreateIndexOptions[];
} {
  // Existing client
  if ('client' in config) {
    return {
      client: config.client,
      schemaName: config.schemaName,
      skipDefaultIndexes: config.skipDefaultIndexes,
      indexes: config.indexes,
    };
  }

  // Existing pool
  if ('pool' in config) {
    return {
      client: new PoolAdapter(config.pool),
      schemaName: config.schemaName,
      skipDefaultIndexes: config.skipDefaultIndexes,
      indexes: config.indexes,
    };
  }

  // Config to create new pool
  let pool: Pool;
  if ('connectionString' in config) {
    pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl,
    });
  } else {
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
    });
  }

  return {
    client: new PoolAdapter(pool),
    schemaName: config.schemaName,
    skipDefaultIndexes: config.skipDefaultIndexes,
    indexes: config.indexes,
  };
}

export function getSchemaName(schema?: string) {
  return schema ? `"${parseSqlIdentifier(schema, 'schema name')}"` : '"public"';
}

export function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
  const quotedIndexName = `"${parsedIndexName}"`;
  const quotedSchemaName = schemaName;
  return quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName;
}

function mapToSqlType(type: StorageColumn['type']): string {
  switch (type) {
    case 'uuid':
      return 'UUID';
    case 'boolean':
      return 'BOOLEAN';
    default:
      return getSqlType(type);
  }
}

export function generateTableSQL({
  tableName,
  schema,
  schemaName,
  compositePrimaryKey,
  includeAllConstraints = false,
}: {
  tableName: TABLE_NAMES;
  schema: Record<string, StorageColumn>;
  schemaName?: string;
  compositePrimaryKey?: string[];
  /** When true, includes all constraints in the SQL (for exports). When false, some constraints are added at runtime after data migration. */
  includeAllConstraints?: boolean;
}): string {
  // Validate composite PK columns exist in schema
  if (compositePrimaryKey) {
    for (const col of compositePrimaryKey) {
      if (!(col in schema)) {
        throw new Error(`compositePrimaryKey column "${col}" does not exist in schema for table "${tableName}"`);
      }
    }
  }

  const compositePKSet = compositePrimaryKey ? new Set(compositePrimaryKey) : null;

  const timeZColumns = Object.entries(schema)
    .filter(([_, def]) => def.type === 'timestamp')
    .map(([name]) => {
      const parsedName = parseSqlIdentifier(name, 'column name');
      return `"${parsedName}Z" TIMESTAMPTZ DEFAULT NOW()`;
    });

  const columns = Object.entries(schema).map(([name, def]) => {
    const parsedName = parseSqlIdentifier(name, 'column name');
    const constraints = [];
    // Skip per-column PRIMARY KEY if column is part of composite PK
    if (def.primaryKey && !compositePKSet?.has(name)) constraints.push('PRIMARY KEY');
    if (!def.nullable) constraints.push('NOT NULL');
    return `"${parsedName}" ${mapToSqlType(def.type)} ${constraints.join(' ')}`;
  });

  const tableConstraints: string[] = [];
  if (compositePrimaryKey) {
    const pkCols = compositePrimaryKey.map(c => `"${parseSqlIdentifier(c, 'column name')}"`).join(', ');
    tableConstraints.push(`PRIMARY KEY (${pkCols})`);
  }

  const finalColumns = [...columns, ...timeZColumns, ...tableConstraints].join(',\n');
  // Sanitize schema name before using it in constraint names to ensure valid SQL identifiers
  const parsedSchemaName = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
  // Use the original (long) base name so existing databases that already have
  // the constraint under this name are detected by the IF NOT EXISTS check.
  // buildConstraintName will truncate only when a schema prefix pushes the
  // combined name past the 63-byte Postgres limit.
  const workflowSnapshotConstraint = buildConstraintName({
    baseName: 'mastra_workflow_snapshot_workflow_name_run_id_key',
    schemaName: parsedSchemaName || undefined,
  });
  const spansPrimaryKeyConstraint = buildConstraintName({
    baseName: 'mastra_ai_spans_traceid_spanid_pk',
    schemaName: parsedSchemaName || undefined,
  });
  const quotedSchemaName = getSchemaName(schemaName);
  const schemaFilter = parsedSchemaName || 'public';

  const sql = `
            CREATE TABLE IF NOT EXISTS ${getTableName({ indexName: tableName, schemaName: quotedSchemaName })} (
              ${finalColumns}
            );
            ${
              tableName === TABLE_WORKFLOW_SNAPSHOT
                ? `
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = lower('${workflowSnapshotConstraint}') AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schemaFilter}')
              ) AND NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = lower('${workflowSnapshotConstraint}') AND schemaname = '${schemaFilter}'
              ) THEN
                ALTER TABLE ${getTableName({ indexName: tableName, schemaName: quotedSchemaName })}
                ADD CONSTRAINT ${workflowSnapshotConstraint}
                UNIQUE (workflow_name, run_id);
              END IF;
              IF EXISTS (
                SELECT 1 FROM pg_index i
                JOIN pg_class c ON i.indexrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE c.relname = lower('${workflowSnapshotConstraint}')
                AND n.nspname = '${schemaFilter}'
                AND i.indisreplident = false
              ) THEN
                ALTER TABLE ${getTableName({ indexName: tableName, schemaName: quotedSchemaName })}
                REPLICA IDENTITY USING INDEX ${workflowSnapshotConstraint};
              END IF;
            END $$;
            `
                : ''
            }
          ${
            // For spans table: Include PRIMARY KEY in exports, but not in runtime (handled after deduplication)
            tableName === TABLE_SPANS && includeAllConstraints
              ? `
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = lower('${spansPrimaryKeyConstraint}') AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schemaFilter}')
              ) THEN
                ALTER TABLE ${getTableName({ indexName: tableName, schemaName: quotedSchemaName })}
                ADD CONSTRAINT ${spansPrimaryKeyConstraint}
                PRIMARY KEY ("traceId", "spanId");
              END IF;
            END $$;
            `
              : ''
          }
          `;
  // Note: At runtime, PRIMARY KEY for spans table is added separately after deduplication
  // See PgDB.addSpansPrimaryKey()

  return sql;
}

/**
 * Generates a CREATE INDEX SQL statement from index options.
 * Used by exportSchemas to produce index DDL without a database connection.
 */
export function generateIndexSQL(options: CreateIndexOptions, schemaName?: string): string {
  const { name, table, columns, unique = false, where, method = 'btree' } = options;

  const quotedSchemaName = getSchemaName(schemaName);
  const fullTableName = getTableName({ indexName: table, schemaName: quotedSchemaName });

  const uniqueStr = unique ? 'UNIQUE ' : '';
  const methodStr = method !== 'btree' ? `USING ${method} ` : '';

  const columnsStr = columns
    .map(col => {
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
  const quotedIndexName = `"${parseSqlIdentifier(name, 'index name')}"`;

  return `CREATE ${uniqueStr}INDEX IF NOT EXISTS ${quotedIndexName} ON ${fullTableName} ${methodStr}(${columnsStr})${whereStr};`;
}

/**
 * Generates the SQL for a timestamp trigger function and trigger on a table.
 * Returns the DDL string without executing it.
 */
export function generateTimestampTriggerSQL(tableName: string, schemaName?: string): string {
  const quotedSchemaName = getSchemaName(schemaName);
  const fullTableName = getTableName({ indexName: tableName, schemaName: quotedSchemaName });
  const functionName = `${quotedSchemaName}.trigger_set_timestamps`;
  const triggerName = `"${parseSqlIdentifier(`${tableName}_timestamps`, 'trigger name')}"`;

  return `CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW."createdAt" = NOW();
        NEW."updatedAt" = NOW();
        NEW."createdAtZ" = NOW();
        NEW."updatedAtZ" = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW."updatedAt" = NOW();
        NEW."updatedAtZ" = NOW();
        NEW."createdAt" = OLD."createdAt";
        NEW."createdAtZ" = OLD."createdAtZ";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ${triggerName} ON ${fullTableName};

CREATE TRIGGER ${triggerName}
    BEFORE INSERT OR UPDATE ON ${fullTableName}
    FOR EACH ROW
    EXECUTE FUNCTION ${functionName}();`;
}

/**
 * Internal config for PgDB - accepts already-resolved client
 */
export interface PgDBInternalConfig {
  client: DbClient;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
}

// Static map to track schema setup across all PgDB instances
// Key: schemaName, Value: { promise, complete }
// This prevents race conditions when multiple domains try to create the same schema concurrently
const schemaSetupRegistry = new Map<string, { promise: Promise<void> | null; complete: boolean }>();

export class PgDB extends MastraBase {
  public client: DbClient;
  public schemaName?: string;
  public skipDefaultIndexes?: boolean;

  constructor(config: PgDBInternalConfig) {
    super({
      component: 'STORAGE',
      name: 'PG_DB_LAYER',
    });

    this.client = config.client;
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const schema = this.schemaName || 'public';

    const result = await this.client.oneOrNone(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND (column_name = $3 OR column_name = $4)`,
      [schema, table, column, column.toLowerCase()],
    );

    return !!result;
  }

  /**
   * Prepares values for insertion, handling JSONB columns by stringifying them
   */
  private prepareValuesForInsert(record: Record<string, any>, tableName: TABLE_NAMES): any[] {
    return Object.entries(record).map(([key, value]) => {
      const schema = TABLE_SCHEMAS[tableName];
      const columnSchema = schema?.[key];

      if (columnSchema?.type === 'jsonb' && value !== null && value !== undefined) {
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
   * Prepares a value for database operations
   */
  private prepareValue(value: any, columnName: string, tableName: TABLE_NAMES): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const schema = TABLE_SCHEMAS[tableName];
    const columnSchema = schema?.[columnName];

    if (columnSchema?.type === 'jsonb') {
      return JSON.stringify(value);
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  private async setupSchema() {
    if (!this.schemaName) {
      return;
    }

    // Use static registry to coordinate schema setup across all PgDB instances
    let registryEntry = schemaSetupRegistry.get(this.schemaName);
    if (registryEntry?.complete) {
      return;
    }

    const quotedSchemaName = getSchemaName(this.schemaName);

    if (!registryEntry?.promise) {
      const schemaNameCapture = this.schemaName;
      const setupPromise = (async () => {
        try {
          const schemaExists = await this.client.oneOrNone(
            `
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.schemata
                  WHERE schema_name = $1
                )
              `,
            [schemaNameCapture],
          );

          if (!schemaExists?.exists) {
            try {
              await this.client.none(`CREATE SCHEMA IF NOT EXISTS ${quotedSchemaName}`);
              this.logger.info(`Schema "${schemaNameCapture}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${schemaNameCapture}"`, { error });
              throw new Error(
                `Unable to create schema "${schemaNameCapture}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          // Mark as complete in the registry
          const entry = schemaSetupRegistry.get(schemaNameCapture);
          if (entry) {
            entry.complete = true;
          }
          this.logger.debug(`Schema "${quotedSchemaName}" is ready for use`);
        } catch (error) {
          // On error, clear the registry entry so retry is possible
          schemaSetupRegistry.delete(schemaNameCapture);
          throw error;
        }
      })();

      // Register the promise immediately so concurrent callers can await it
      schemaSetupRegistry.set(this.schemaName, { promise: setupPromise, complete: false });
      registryEntry = schemaSetupRegistry.get(this.schemaName);
    }

    await registryEntry!.promise;
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'timestamp':
        return 'DEFAULT NOW()';
      case 'jsonb':
        return "DEFAULT '{}'::jsonb";
      default:
        return getDefaultValue(type);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      this.addTimestampZColumns(record);

      const schemaName = getSchemaName(this.schemaName);
      const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
      const values = this.prepareValuesForInsert(record, tableName);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const fullTableName = getTableName({ indexName: tableName, schemaName });
      const columnList = columns.map(c => `"${c}"`).join(', ');

      // For spans table, use ON CONFLICT to handle duplicate (traceId, spanId) gracefully
      if (tableName === TABLE_SPANS) {
        // Build update clause for all columns except the primary key columns
        const updateColumns = columns.filter(c => c !== 'traceId' && c !== 'spanId');

        if (updateColumns.length > 0) {
          const updateClause = updateColumns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
          await this.client.none(
            `INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})
             ON CONFLICT ("traceId", "spanId") DO UPDATE SET ${updateClause}`,
            values,
          );
        } else {
          // Only PK columns provided - use DO NOTHING to avoid invalid SQL
          await this.client.none(
            `INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})
             ON CONFLICT ("traceId", "spanId") DO NOTHING`,
            values,
          );
        }
      } else {
        await this.client.none(`INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})`, values);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INSERT', 'FAILED'),
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

      // Check if table exists before truncating (handles case where init failed)
      const tableExists = await this.client.oneOrNone<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        )`,
        [this.schemaName || 'public', tableName],
      );

      if (tableExists?.exists) {
        await this.client.none(`TRUNCATE TABLE ${tableNameWithSchema} CASCADE`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CLEAR_TABLE', 'FAILED'),
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

  async createTable({
    tableName,
    schema,
    compositePrimaryKey,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    compositePrimaryKey?: string[];
  }): Promise<void> {
    try {
      const timeZColumnNames = Object.entries(schema)
        .filter(([_, def]) => def.type === 'timestamp')
        .map(([name]) => name);

      if (this.schemaName) {
        await this.setupSchema();
      }

      const sql = generateTableSQL({ tableName, schema, schemaName: this.schemaName, compositePrimaryKey });

      await this.client.none(sql);

      await this.alterTable({
        tableName,
        schema,
        ifNotExists: timeZColumnNames,
      });

      // Set up timestamp triggers and run migrations for Spans table
      if (tableName === TABLE_SPANS) {
        await this.setupTimestampTriggers(tableName);
        await this.migrateSpansTable();

        // Check if PRIMARY KEY constraint already exists - if so, skip migration
        // This avoids running expensive queries on every init after migration is complete
        const pkExists = await this.spansPrimaryKeyExists();
        if (!pkExists) {
          // Check for duplicates before attempting to add PRIMARY KEY
          const duplicateInfo = await this.checkForDuplicateSpans();
          if (duplicateInfo.hasDuplicates) {
            // Duplicates exist - throw error requiring manual migration
            const errorMessage =
              `\n` +
              `===========================================================================\n` +
              `MIGRATION REQUIRED: Duplicate spans detected in ${duplicateInfo.tableName}\n` +
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
              id: createStorageErrorId('PG', 'MIGRATION_REQUIRED', 'DUPLICATE_SPANS'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: errorMessage,
            });
          } else {
            // No duplicates - safe to add PRIMARY KEY directly
            await this.addSpansPrimaryKey();
          }
        }
      }
    } catch (error) {
      // Rethrow MastraError directly to preserve structured error IDs (e.g., MIGRATION_REQUIRED::DUPLICATE_SPANS)
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_TABLE', 'FAILED'),
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

  private async setupTimestampTriggers(tableName: TABLE_NAMES): Promise<void> {
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });

    try {
      const triggerSQL = generateTimestampTriggerSQL(tableName, this.schemaName);
      await this.client.none(triggerSQL);
      this.logger?.debug?.(`Set up timestamp triggers for table ${fullTableName}`);
    } catch (error) {
      this.logger?.warn?.(`Failed to set up timestamp triggers for ${fullTableName}:`, error);
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
          const sqlType = mapToSqlType(columnDef.type);
          // Align with createTable: nullable columns omit NOT NULL, non-nullable columns include it
          const nullable = columnDef.nullable ? '' : 'NOT NULL';
          const defaultValue = !columnDef.nullable ? this.getDefaultValue(columnDef.type) : '';
          const alterSql =
            `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();
          await this.client.none(alterSql);
          this.logger?.debug?.(`Added column '${columnName}' to ${fullTableName}`);

          // For timestamp columns, also add the timezone-aware version
          // This matches the behavior in alterTable()
          if (sqlType === 'TIMESTAMP') {
            const timestampZSql =
              `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(timestampZSql);
            this.logger?.debug?.(`Added timezone column '${columnName}Z' to ${fullTableName}`);
          }
        }
      }

      // Also add timezone columns for any existing timestamp columns that don't have them yet
      // This handles the case where timestamp columns existed but their *Z counterparts don't
      for (const [columnName, columnDef] of Object.entries(schema)) {
        if (columnDef.type === 'timestamp') {
          const tzColumnName = `${columnName}Z`;
          const tzColumnExists = await this.hasColumn(TABLE_SPANS, tzColumnName);
          if (!tzColumnExists) {
            const parsedTzColumnName = parseSqlIdentifier(tzColumnName, 'column name');
            const timestampZSql =
              `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedTzColumnName}" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(timestampZSql);
            this.logger?.debug?.(`Added timezone column '${tzColumnName}' to ${fullTableName}`);
          }
        }
      }

      this.logger?.info?.(`Migration completed for ${fullTableName}`);
    } catch (error) {
      // Log warning but don't fail - migrations should be best-effort
      this.logger?.warn?.(`Failed to migrate spans table ${fullTableName}:`, error);
    }
  }

  /**
   * Deduplicates spans in the mastra_ai_spans table before adding the PRIMARY KEY constraint.
   * Keeps spans based on priority: completed (endedAt NOT NULL) > most recent updatedAt > most recent createdAt.
   *
   * Note: This prioritizes migration completion over perfect data preservation.
   * Old trace data may be lost, which is acceptable for this use case.
   */
  private async deduplicateSpans(): Promise<void> {
    const fullTableName = getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schemaName) });

    try {
      // Quick check: are there any duplicates at all? Use LIMIT 1 for speed on large tables.
      const duplicateCheck = await this.client.oneOrNone<{ has_duplicates: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM ${fullTableName}
          GROUP BY "traceId", "spanId"
          HAVING COUNT(*) > 1
          LIMIT 1
        ) as has_duplicates
      `);

      if (!duplicateCheck?.has_duplicates) {
        this.logger?.debug?.(`No duplicate spans found in ${fullTableName}`);
        return;
      }

      this.logger?.info?.(`Duplicate spans detected in ${fullTableName}, starting deduplication...`);

      // Delete duplicates directly without fetching details into memory.
      // This avoids OOM issues on large tables with many duplicates.
      // Priority: completed spans (endedAt NOT NULL) > most recent updatedAt > most recent createdAt
      // Uses ctid (physical row id) as final tiebreaker for deterministic results.
      const result = await this.client.query(`
        DELETE FROM ${fullTableName} t1
        USING ${fullTableName} t2
        WHERE t1."traceId" = t2."traceId"
          AND t1."spanId" = t2."spanId"
          AND (
            -- Keep completed spans over incomplete
            (t1."endedAt" IS NULL AND t2."endedAt" IS NOT NULL)
            OR
            -- If both have same completion status, keep more recent updatedAt
            (
              (t1."endedAt" IS NULL) = (t2."endedAt" IS NULL)
              AND (
                (t1."updatedAt" < t2."updatedAt")
                OR (t1."updatedAt" IS NULL AND t2."updatedAt" IS NOT NULL)
                OR
                -- If updatedAt is the same, keep more recent createdAt
                (
                  (t1."updatedAt" = t2."updatedAt" OR (t1."updatedAt" IS NULL AND t2."updatedAt" IS NULL))
                  AND (
                    (t1."createdAt" < t2."createdAt")
                    OR (t1."createdAt" IS NULL AND t2."createdAt" IS NOT NULL)
                    OR
                    -- If all else equal, use ctid as tiebreaker
                    (
                      (t1."createdAt" = t2."createdAt" OR (t1."createdAt" IS NULL AND t2."createdAt" IS NULL))
                      AND t1.ctid < t2.ctid
                    )
                  )
                )
              )
            )
          )
      `);

      this.logger?.info?.(
        `Deduplication complete: removed ${result.rowCount ?? 0} duplicate spans from ${fullTableName}`,
      );
    } catch (error) {
      // Re-throw deduplication errors so PRIMARY KEY addition will fail with a clear error
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DEDUPLICATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: TABLE_SPANS,
          },
        },
        error,
      );
    }
  }

  /**
   * Checks for duplicate (traceId, spanId) combinations in the spans table.
   * Returns information about duplicates for logging/CLI purposes.
   */
  private async checkForDuplicateSpans(): Promise<{
    hasDuplicates: boolean;
    duplicateCount: number;
    tableName: string;
  }> {
    const fullTableName = getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schemaName) });

    try {
      // Count duplicate (traceId, spanId) combinations
      const result = await this.client.oneOrNone<{ duplicate_count: string }>(`
        SELECT COUNT(*) as duplicate_count
        FROM (
          SELECT "traceId", "spanId"
          FROM ${fullTableName}
          GROUP BY "traceId", "spanId"
          HAVING COUNT(*) > 1
        ) duplicates
      `);

      const duplicateCount = parseInt(result?.duplicate_count ?? '0', 10);
      return {
        hasDuplicates: duplicateCount > 0,
        duplicateCount,
        tableName: fullTableName,
      };
    } catch (error) {
      // If table doesn't exist or other error, assume no duplicates
      this.logger?.debug?.(`Could not check for duplicates: ${error}`);
      return { hasDuplicates: false, duplicateCount: 0, tableName: fullTableName };
    }
  }

  /**
   * Checks if the PRIMARY KEY constraint on (traceId, spanId) already exists on the spans table.
   * Used to skip deduplication when the constraint already exists (migration already complete).
   */
  private async spansPrimaryKeyExists(): Promise<boolean> {
    const parsedSchemaName = this.schemaName ? parseSqlIdentifier(this.schemaName, 'schema name') : '';
    const constraintName = buildConstraintName({
      baseName: 'mastra_ai_spans_traceid_spanid_pk',
      schemaName: parsedSchemaName || undefined,
    });
    const schemaFilter = this.schemaName || 'public';

    const result = await this.client.oneOrNone<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = lower($1) AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)) as exists`,
      [constraintName, schemaFilter],
    );

    return result?.exists ?? false;
  }

  /**
   * Adds the PRIMARY KEY constraint on (traceId, spanId) to the spans table.
   * Should be called AFTER deduplication to ensure no duplicate key violations.
   */
  private async addSpansPrimaryKey(): Promise<void> {
    const fullTableName = getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schemaName) });
    const parsedSchemaName = this.schemaName ? parseSqlIdentifier(this.schemaName, 'schema name') : '';
    const constraintName = buildConstraintName({
      baseName: 'mastra_ai_spans_traceid_spanid_pk',
      schemaName: parsedSchemaName || undefined,
    });
    const schemaFilter = this.schemaName || 'public';

    try {
      // Check if the constraint already exists
      const constraintExists = await this.client.oneOrNone<{ exists: boolean }>(
        `
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = lower($1) AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)
        ) as exists
      `,
        [constraintName, schemaFilter],
      );

      if (constraintExists?.exists) {
        this.logger?.debug?.(`PRIMARY KEY constraint ${constraintName} already exists on ${fullTableName}`);
        return;
      }

      // Add the PRIMARY KEY constraint
      await this.client.none(`
        ALTER TABLE ${fullTableName}
        ADD CONSTRAINT ${constraintName}
        PRIMARY KEY ("traceId", "spanId")
      `);

      this.logger?.info?.(`Added PRIMARY KEY constraint ${constraintName} to ${fullTableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'ADD_SPANS_PRIMARY_KEY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: TABLE_SPANS,
            constraintName,
          },
        },
        error,
      );
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
    const fullTableName = getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schemaName) });

    // Check if already migrated
    const pkExists = await this.spansPrimaryKeyExists();
    if (pkExists) {
      return {
        success: true,
        alreadyMigrated: true,
        duplicatesRemoved: 0,
        message: `Migration already complete. PRIMARY KEY constraint exists on ${fullTableName}.`,
      };
    }

    // Check for duplicates
    const duplicateInfo = await this.checkForDuplicateSpans();

    if (duplicateInfo.hasDuplicates) {
      this.logger?.info?.(
        `Found ${duplicateInfo.duplicateCount} duplicate (traceId, spanId) combinations. Starting deduplication...`,
      );

      // Run deduplication
      await this.deduplicateSpans();
    } else {
      this.logger?.info?.(`No duplicate spans found.`);
    }

    // Add PRIMARY KEY constraint
    await this.addSpansPrimaryKey();

    return {
      success: true,
      alreadyMigrated: false,
      duplicatesRemoved: duplicateInfo.duplicateCount,
      message: duplicateInfo.hasDuplicates
        ? `Migration complete. Removed duplicates and added PRIMARY KEY constraint to ${fullTableName}.`
        : `Migration complete. Added PRIMARY KEY constraint to ${fullTableName}.`,
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
    const fullTableName = getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schemaName) });
    const pkExists = await this.spansPrimaryKeyExists();

    if (pkExists) {
      return {
        needsMigration: false,
        hasDuplicates: false,
        duplicateCount: 0,
        constraintExists: true,
        tableName: fullTableName,
      };
    }

    const duplicateInfo = await this.checkForDuplicateSpans();
    return {
      needsMigration: true,
      hasDuplicates: duplicateInfo.hasDuplicates,
      duplicateCount: duplicateInfo.duplicateCount,
      constraintExists: false,
      tableName: fullTableName,
    };
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
          const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
          const sqlType = mapToSqlType(columnDef.type);
          // Align with createTable: nullable columns omit NOT NULL, non-nullable columns include it
          const nullable = columnDef.nullable ? '' : 'NOT NULL';
          const defaultValue = !columnDef.nullable ? this.getDefaultValue(columnDef.type) : '';
          const alterSql =
            `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();

          await this.client.none(alterSql);

          if (sqlType === 'TIMESTAMP') {
            const timestampZSql =
              `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(timestampZSql);
          }

          this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'ALTER_TABLE', 'FAILED'),
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
          id: createStorageErrorId('PG', 'LOAD', 'FAILED'),
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
          id: createStorageErrorId('PG', 'BATCH_INSERT', 'FAILED'),
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
          id: createStorageErrorId('PG', 'DROP_TABLE', 'FAILED'),
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

  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const {
        name,
        table,
        columns,
        unique = false,
        concurrent = true,
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

      const indexExists = await this.client.oneOrNone(
        `SELECT 1 FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
        [name, schemaName],
      );

      if (indexExists) {
        return;
      }

      const uniqueStr = unique ? 'UNIQUE ' : '';
      const concurrentStr = concurrent ? 'CONCURRENTLY ' : '';
      const methodStr = method !== 'btree' ? `USING ${method} ` : '';

      const columnsStr = columns
        .map(col => {
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const [colName, ...modifiers] = col.split(' ');
            if (!colName) {
              throw new Error(`Invalid column specification: ${col}`);
            }
            const quotedCol = `"${parseSqlIdentifier(colName, 'column name')}" ${modifiers.join(' ')}`;
            return opclass ? `${quotedCol} ${opclass}` : quotedCol;
          }
          const quotedCol = `"${parseSqlIdentifier(col, 'column name')}"`;
          return opclass ? `${quotedCol} ${opclass}` : quotedCol;
        })
        .join(', ');

      const whereStr = where ? ` WHERE ${where}` : '';
      const tablespaceStr = tablespace ? ` TABLESPACE ${tablespace}` : '';

      let withStr = '';
      if (storage && Object.keys(storage).length > 0) {
        const storageParams = Object.entries(storage)
          .map(([key, value]) => `${key} = ${value}`)
          .join(', ');
        withStr = ` WITH (${storageParams})`;
      }

      const quotedIndexName = `"${parseSqlIdentifier(name, 'index name')}"`;
      const sql = `CREATE ${uniqueStr}INDEX ${concurrentStr}${quotedIndexName} ON ${fullTableName} ${methodStr}(${columnsStr})${withStr}${tablespaceStr}${whereStr}`;

      await this.client.none(sql);
    } catch (error) {
      if (error instanceof Error && error.message.includes('CONCURRENTLY')) {
        const retryOptions = { ...options, concurrent: false };
        return this.createIndex(retryOptions);
      }

      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INDEX_CREATE', 'FAILED'),
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

  async dropIndex(indexName: string): Promise<void> {
    try {
      const schemaName = this.schemaName || 'public';
      const indexExists = await this.client.oneOrNone(
        `SELECT 1 FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
        [indexName, schemaName],
      );

      if (!indexExists) {
        return;
      }

      const quotedIndexName = `"${parseSqlIdentifier(indexName, 'index name')}"`;
      const sql = `DROP INDEX IF EXISTS ${getSchemaName(this.schemaName)}.${quotedIndexName}`;
      await this.client.none(sql);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INDEX_DROP', 'FAILED'),
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
        let columns: string[] = [];
        if (typeof row.columns === 'string' && row.columns.startsWith('{') && row.columns.endsWith('}')) {
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
          id: createStorageErrorId('PG', 'INDEX_LIST', 'FAILED'),
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

  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    try {
      const schemaName = this.schemaName || 'public';

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

      let columns: string[] = [];
      if (typeof result.columns === 'string' && result.columns.startsWith('{') && result.columns.endsWith('}')) {
        const arrayContent = result.columns.slice(1, -1);
        columns = arrayContent ? arrayContent.split(',') : [];
      } else if (Array.isArray(result.columns)) {
        columns = result.columns;
      }

      return {
        name: result.name,
        table: result.table,
        columns,
        unique: result.is_unique || false,
        size: result.size || '0',
        definition: result.definition || '',
        method: result.method || 'btree',
        scans: parseInt(String(result.scans)) || 0,
        tuples_read: parseInt(String(result.tuples_read)) || 0,
        tuples_fetched: parseInt(String(result.tuples_fetched)) || 0,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INDEX_DESCRIBE', 'FAILED'),
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

  async update({
    tableName,
    keys,
    data,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
  }): Promise<void> {
    try {
      const setColumns: string[] = [];
      const setValues: any[] = [];
      let paramIndex = 1;

      Object.entries(data).forEach(([key, value]) => {
        const parsedKey = parseSqlIdentifier(key, 'column name');
        setColumns.push(`"${parsedKey}" = $${paramIndex++}`);
        setValues.push(this.prepareValue(value, key, tableName));
      });

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

      await this.client.none(sql, values);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE', 'FAILED'),
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
    try {
      await this.client.query('BEGIN');
      for (const { keys, data } of updates) {
        await this.update({ tableName, keys, data });
      }
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BATCH_UPDATE', 'FAILED'),
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

  async batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any>[] }): Promise<void> {
    try {
      if (keys.length === 0) {
        return;
      }

      const tableName_ = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName),
      });

      await this.client.tx(async t => {
        for (const keySet of keys) {
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
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BATCH_DELETE', 'FAILED'),
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
   * Delete all data from a table (alias for clearTable for consistency with other stores)
   */
  async deleteData({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.clearTable({ tableName });
  }
}
