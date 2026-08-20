import type { ConnectionOptions } from 'node:tls';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SPANS,
  TABLE_SCORERS,
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
import type { DbClient, QueryValues, TxClient } from '../client';
import { PoolAdapter } from '../client';
import { buildConstraintName } from './constraint-utils';
import { isDuplicateRelationError, isDuplicateSchemaError } from './pg-errors';
import { getSchemaSnapshot } from './schema-snapshot';
import type { SchemaSnapshot } from './schema-snapshot';

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

  // pg emits 'error' on the pool when an idle client's connection drops;
  // without a listener Node escalates the event to an uncaughtException and
  // crashes the process. No logger is threaded into this helper, so warn on
  // the console like COLLISION_WARNING does.
  pool.on('error', err => {
    console.warn(
      `resolvePgConfig: idle pool client error (pool discards the client and reconnects on next checkout): ${err instanceof Error ? err.message : String(err)}`,
    );
  });

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
  const parsedTriggerName = parseSqlIdentifier(`${tableName}_timestamps`, 'trigger name');
  const triggerName = `"${parsedTriggerName}"`;

  // Literals for the pg_trigger guard below. The identifiers are already
  // validated by parseSqlIdentifier, so they cannot carry a quote.
  const triggerNameLiteral = `'${parsedTriggerName}'`;
  const tableNameLiteral = `'${parseSqlIdentifier(tableName, 'table name')}'`;
  const schemaNameLiteral = schemaName ? `'${parseSqlIdentifier(schemaName, 'schema name')}'` : `'public'`;

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

DO $mastra_timestamps_trigger$
BEGIN
    -- Recreating the trigger unconditionally would take an ACCESS EXCLUSIVE
    -- lock on the table (DROP TRIGGER does, even when nothing changes), and
    -- init runs on every process start. Skip when the trigger is already
    -- exactly what the CREATE below would produce.
    --
    -- tgtype 23 = ROW (1) | BEFORE (2) | INSERT (4) | UPDATE (16), so a trigger
    -- whose timing or events differ still falls through and gets rebuilt. The
    -- behaviour itself lives in the function, which is replaced above on every
    -- init, so an upgraded function body lands without touching the trigger.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger tg
        JOIN pg_catalog.pg_class c ON c.oid = tg.tgrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE tg.tgname = ${triggerNameLiteral}
          AND c.relname = ${tableNameLiteral}
          AND n.nspname = ${schemaNameLiteral}
          AND NOT tg.tgisinternal
          AND tg.tgtype = 23
          AND tg.tgfoid = '${functionName}()'::regprocedure
    ) THEN
        DROP TRIGGER IF EXISTS ${triggerName} ON ${fullTableName};

        CREATE TRIGGER ${triggerName}
            BEFORE INSERT OR UPDATE ON ${fullTableName}
            FOR EACH ROW
            EXECUTE FUNCTION ${functionName}();
    END IF;
END
$mastra_timestamps_trigger$;`;
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

/**
 * Guard prune batch limits: a non-positive limit deletes nothing while callers'
 * drain checks (`affected < limit`) never fire, which turns the prune loop into
 * an infinite spin. Fail loudly instead.
 */
function assertPositiveLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error(`prune limit must be a positive integer; received ${limit}`);
  }
}

export class PgDB extends MastraBase {
  public client: DbClient;
  public schemaName?: string;
  public skipDefaultIndexes?: boolean;

  /** Cache of actual table columns: tableName -> Set<columnName> */
  private tableColumnsCache = new Map<string, Set<string>>();

  /** Cache of column Postgres data types: tableName -> columnName -> data_type */
  private columnTypeCache = new Map<string, Map<string, string>>();

  constructor(config: PgDBInternalConfig) {
    super({
      component: 'STORAGE',
      name: 'PG_DB_LAYER',
    });

    this.client = config.client;
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
  }

  /**
   * Catalog snapshot for the current init window, or `null` outside it.
   *
   * When non-null, the init-path methods below answer existence questions from
   * it instead of round-tripping to the server, and record the objects they
   * create so later callers in the same init see them. See
   * {@link SchemaSnapshot} for why it is scoped to init only.
   */
  private get schemaSnapshot(): SchemaSnapshot | null {
    return getSchemaSnapshot(this.client, this.schemaName);
  }

  /**
   * Whether the snapshot proves `generateTableSQL` would be a no-op for this
   * table — i.e. the CREATE statement can be skipped.
   *
   * For most tables that is just "the table exists". `workflow_snapshot` is the
   * exception: its generated SQL also carries a DO block that back-fills the
   * `(workflow_name, run_id)` unique constraint and promotes it to the table's
   * replica identity, so a table created by an older version still needs the
   * statement to run.
   */
  private snapshotShowsTableConverged(snapshot: SchemaSnapshot, tableName: TABLE_NAMES): boolean {
    if (!snapshot.tables.has(tableName)) return false;

    if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      const constraintName = buildConstraintName({
        baseName: 'mastra_workflow_snapshot_workflow_name_run_id_key',
        schemaName: this.schemaName ? parseSqlIdentifier(this.schemaName, 'schema name') : undefined,
      }).toLowerCase();
      return snapshot.indexes.has(constraintName) && snapshot.replicaIdentityIndexes.has(constraintName);
    }

    return true;
  }

  /** Column set for `tableName` in the snapshot, created empty if absent. */
  private snapshotColumns(snapshot: SchemaSnapshot, tableName: string): Set<string> {
    let columns = snapshot.columns.get(tableName);
    if (!columns) {
      columns = new Set<string>();
      snapshot.columns.set(tableName, columns);
    }
    return columns;
  }

  /**
   * Records an out-of-band `ALTER TABLE … RENAME TO` in the init snapshot.
   *
   * Init-time migrations that issue raw DDL on `this.client` (instead of going
   * through createTable/alterTable/createIndex, which maintain the snapshot
   * themselves) MUST report it through these `note*` methods. A snapshot that
   * still lists a renamed-away table makes a later createTable() in the same
   * init skip the rebuild the migration depends on — stranding data. No-op
   * outside the init window.
   *
   * Indexes riding along with a rename keep their names, so the snapshot's
   * index set stays accurate without changes here.
   */
  noteTableRenamed(oldName: string, newName: string): void {
    const snapshot = this.schemaSnapshot;
    if (snapshot) {
      if (snapshot.tables.delete(oldName)) snapshot.tables.add(newName);
      const columns = snapshot.columns.get(oldName);
      if (columns) {
        snapshot.columns.delete(oldName);
        snapshot.columns.set(newName, columns);
      }
    }
    this.tableColumnsCache.delete(oldName);
    this.columnTypeCache.delete(oldName);
    this.tableColumnsCache.delete(newName);
    this.columnTypeCache.delete(newName);
  }

  /**
   * Records an out-of-band `DROP TABLE` in the init snapshot. See
   * {@link noteTableRenamed} for why raw-DDL migrations must call this.
   *
   * The dropped table's indexes vanish with it, but the snapshot's flat index
   * set cannot map names back to tables. Stale entries only make a later
   * createIndex() skip a recreate until the next init re-reads the catalog —
   * the same self-healing bound the rest of the snapshot design accepts.
   */
  noteTableDropped(tableName: string): void {
    const snapshot = this.schemaSnapshot;
    if (snapshot) {
      snapshot.tables.delete(tableName);
      snapshot.columns.delete(tableName);
      snapshot.columnTypes.delete(tableName);
    }
    this.tableColumnsCache.delete(tableName);
    this.columnTypeCache.delete(tableName);
  }

  /**
   * Records an out-of-band `ALTER TABLE … ADD COLUMN` in the init snapshot.
   * See {@link noteTableRenamed} for why raw-DDL migrations must call this.
   */
  noteColumnAdded(tableName: string, column: string): void {
    const snapshot = this.schemaSnapshot;
    if (snapshot) this.snapshotColumns(snapshot, tableName).add(column);
    this.tableColumnsCache.delete(tableName);
    this.columnTypeCache.delete(tableName);
  }

  /**
   * Gets the set of column names that actually exist in the database table.
   * Results are cached; the cache is invalidated when alterTable() adds new columns.
   */
  private async getTableColumns(tableName: TABLE_NAMES): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName);
    if (cached) return cached;

    const schema = this.schemaName || 'public';
    const rows = await this.client.manyOrNone<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [schema, tableName],
    );

    const columns = new Set(rows.map(r => r.column_name));
    if (columns.size > 0) {
      this.tableColumnsCache.set(tableName, columns);
    }
    return columns;
  }

  /**
   * Filters a record to only include columns that exist in the actual database table.
   * Unknown columns are silently dropped to ensure forward compatibility when newer
   * domain packages add fields that haven't been migrated yet.
   */
  private async filterRecordToKnownColumns(
    tableName: TABLE_NAMES,
    record: Record<string, any>,
  ): Promise<Record<string, any>> {
    const knownColumns = await this.getTableColumns(tableName);
    if (knownColumns.size === 0) return record; // Table may not exist yet

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (knownColumns.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const schema = this.schemaName || 'public';

    const snapshot = this.schemaSnapshot;
    if (snapshot) {
      const columns = snapshot.columns.get(table);
      if (!columns) return false;
      return columns.has(column) || columns.has(column.toLowerCase());
    }

    const result = await this.client.oneOrNone(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND (column_name = $3 OR column_name = $4)`,
      [schema, table, column, column.toLowerCase()],
    );

    return !!result;
  }

  /**
   * Returns the Postgres data type of a column (e.g. `jsonb`, `json`, `text`),
   * or null when the table or column does not exist.
   *
   * Answered from the init snapshot when one is installed, so a warm `init()`
   * issues no catalog probe. Outside init, results are cached per instance and
   * the cache is invalidated alongside {@link tableColumnsCache} whenever DDL
   * changes a table.
   */
  async getColumnType(table: string, column: string): Promise<string | null> {
    const snapshot = this.schemaSnapshot;
    if (snapshot) {
      const types = snapshot.columnTypes.get(table);
      const known = types?.get(column) ?? types?.get(column.toLowerCase());
      if (known) return known;
      // The table exists in the snapshot but the column does not: nothing to probe for.
      // A table created during this init has no snapshot types yet, so fall through.
      if (types) return null;
    }

    const cached = this.columnTypeCache.get(table)?.get(column);
    if (cached !== undefined) return cached;

    const schema = this.schemaName || 'public';
    const result = await this.client.oneOrNone<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND (column_name = $3 OR column_name = $4)`,
      [schema, table, column, column.toLowerCase()],
    );

    const dataType = result?.data_type ?? null;
    if (dataType) {
      if (snapshot) {
        let snapshotTypes = snapshot.columnTypes.get(table);
        if (!snapshotTypes) {
          snapshotTypes = new Map<string, string>();
          snapshot.columnTypes.set(table, snapshotTypes);
        }
        snapshotTypes.set(column, dataType);
      }
      let types = this.columnTypeCache.get(table);
      if (!types) {
        types = new Map();
        this.columnTypeCache.set(table, types);
      }
      types.set(column, dataType);
    }
    return dataType;
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

    // During the init window, a snapshot holding tables for this schema proves
    // the schema exists (the snapshot queries are scoped to it), so the
    // `information_schema.schemata` probe below would be a warm init's one
    // remaining per-process round trip. Skip it and mark setup complete. A
    // cold schema yields an empty snapshot and falls through to the probe.
    const snapshot = this.schemaSnapshot;
    if (snapshot && snapshot.tables.size > 0) {
      schemaSetupRegistry.set(this.schemaName, { promise: null, complete: true });
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
              // `CREATE SCHEMA IF NOT EXISTS` is not atomic; a concurrent
              // backend can race past the existence probe and create the
              // schema first. Treat duplicate-schema errors as success.
              if (isDuplicateSchemaError(error)) {
                this.logger.debug(`Schema "${schemaNameCapture}" was created by another process`);
              } else {
                this.logger.error(`Failed to create schema "${schemaNameCapture}"`, { error });
                throw new Error(
                  `Unable to create schema "${schemaNameCapture}". This requires CREATE privilege on the database. ` +
                    `Either create the schema manually or grant CREATE privilege to the user.`,
                );
              }
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

  private async executeInsert(
    client: Pick<DbClient, 'none'> | Pick<TxClient, 'none'>,
    { tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> },
  ): Promise<void> {
    this.addTimestampZColumns(record);

    // Filter out columns that don't exist in the actual database table
    const filteredRecord = await this.filterRecordToKnownColumns(tableName, record);

    const schemaName = getSchemaName(this.schemaName);
    const columns = Object.keys(filteredRecord).map(col => parseSqlIdentifier(col, 'column name'));
    if (columns.length === 0) return; // No known columns after filtering - skip insert
    const values = this.prepareValuesForInsert(filteredRecord, tableName);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const fullTableName = getTableName({ indexName: tableName, schemaName });
    const columnList = columns.map(c => `"${c}"`).join(', ');

    // For spans table, use ON CONFLICT to handle duplicate (traceId, spanId) gracefully
    if (tableName === TABLE_SPANS) {
      // Build update clause for all columns except the primary key columns
      const updateColumns = columns.filter(c => c !== 'traceId' && c !== 'spanId');

      if (updateColumns.length > 0) {
        const updateClause = updateColumns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
        await client.none(
          `INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})
             ON CONFLICT ("traceId", "spanId") DO UPDATE SET ${updateClause}`,
          values,
        );
      } else {
        // Only PK columns provided - use DO NOTHING to avoid invalid SQL
        await client.none(
          `INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})
             ON CONFLICT ("traceId", "spanId") DO NOTHING`,
          values,
        );
      }
    } else if (tableName === TABLE_SCORERS) {
      // Scores support idempotent ingestion by caller-supplied ID: replace the
      // row on conflict (last write wins) but preserve the original createdAt.
      const updateColumns = columns.filter(c => c !== 'id' && c !== 'createdAt' && c !== 'createdAtZ');
      const updateClause = updateColumns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
      await client.none(
        `INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})
           ON CONFLICT ("id") DO UPDATE SET ${updateClause}`,
        values,
      );
    } else {
      await client.none(`INSERT INTO ${fullTableName} (${columnList}) VALUES (${placeholders})`, values);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      await this.executeInsert(this.client, { tableName, record });
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

      const snapshot = this.schemaSnapshot;
      // Skipping the statement when everything it would create is already there
      // is not only a saved round trip: `CREATE TABLE IF NOT EXISTS` requires
      // CREATE on the schema, so on a converged schema this is also what lets a
      // least-privilege role finish init instead of failing with
      // "permission denied".
      if (!snapshot || !this.snapshotShowsTableConverged(snapshot, tableName)) {
        const sql = generateTableSQL({ tableName, schema, schemaName: this.schemaName, compositePrimaryKey });

        try {
          await this.client.none(sql);
        } catch (error) {
          // `CREATE TABLE IF NOT EXISTS` is not atomic across concurrent
          // backends. Two processes can both pass the existence probe and one
          // surfaces a catalog duplicate error. Treat it as "already created".
          if (!isDuplicateRelationError(error)) throw error;
        }

        if (snapshot) {
          snapshot.tables.add(tableName);
          // generateTableSQL emits the declared columns plus a `Z` twin for
          // every timestamp column; record both so the alterTable pass below
          // and later domains don't re-probe for them.
          const created = this.snapshotColumns(snapshot, tableName);
          for (const [name, def] of Object.entries(schema)) {
            const parsedName = parseSqlIdentifier(name, 'column name');
            created.add(parsedName);
            if (def.type === 'timestamp') {
              created.add(`${parsedName}Z`);
            }
          }
        }
      }

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
    } finally {
      // Clear cached columns so subsequent inserts see the fresh schema
      this.tableColumnsCache.delete(tableName);
      this.columnTypeCache.delete(tableName);
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
          this.noteColumnAdded(TABLE_SPANS, columnName);
          this.logger?.debug?.(`Added column '${columnName}' to ${fullTableName}`);

          // For timestamp columns, also add the timezone-aware version
          // This matches the behavior in alterTable()
          if (sqlType === 'TIMESTAMP') {
            const timestampZSql =
              `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(timestampZSql);
            this.noteColumnAdded(TABLE_SPANS, `${columnName}Z`);
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
            this.noteColumnAdded(TABLE_SPANS, tzColumnName);
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

    // A primary key is always backed by an index of the same name, so the init
    // snapshot already answers this without a round trip.
    const snapshot = this.schemaSnapshot;
    if (snapshot) return snapshot.primaryKeyIndexes.has(constraintName.toLowerCase());

    return this.spansPrimaryKeyExistsLive(constraintName, schemaFilter);
  }

  /** Live-catalog variant of {@link spansPrimaryKeyExists}, bypassing the snapshot. */
  private async spansPrimaryKeyExistsLive(constraintName: string, schemaFilter: string): Promise<boolean> {
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
      this.schemaSnapshot?.primaryKeyIndexes.add(constraintName.toLowerCase());

      this.logger?.info?.(`Added PRIMARY KEY constraint ${constraintName} to ${fullTableName}`);
    } catch (error) {
      // Another process may have added the same constraint concurrently
      // (TOCTOU between the EXISTS check and the ALTER TABLE). Treat the
      // resulting duplicate-relation / duplicate-object error as success,
      // but only after confirming the PRIMARY KEY is actually present.
      // isDuplicateRelationError can also match on unrelated name collisions
      // (e.g. a stale index with the same name), so the post-check prevents
      // silently swallowing errors when the constraint is still missing.
      //
      // The confirm must hit the live catalog: in this path the init snapshot
      // (if live) just said the constraint was ABSENT — that is why the ALTER
      // ran — so re-asking it would deterministically contradict the
      // concurrent creator and turn a benign race into a thrown error.
      if (isDuplicateRelationError(error)) {
        const confirmed = await this.spansPrimaryKeyExistsLive(constraintName, schemaFilter);
        if (confirmed) {
          this.schemaSnapshot?.primaryKeyIndexes.add(constraintName.toLowerCase());
          this.logger?.debug?.(`PRIMARY KEY constraint ${constraintName} was created by another process`);
          return;
        }
      }
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
    const snapshot = this.schemaSnapshot;
    // Every ALTER below is `ADD COLUMN IF NOT EXISTS`, so on a converged schema
    // they are all no-ops the server still has to parse and acknowledge. When a
    // snapshot is live, only issue the ones that will actually change something.
    const knownColumns = snapshot ? this.snapshotColumns(snapshot, tableName) : null;

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

          if (!knownColumns?.has(parsedColumnName)) {
            await this.client.none(alterSql);
            knownColumns?.add(parsedColumnName);
          }

          if (sqlType === 'TIMESTAMP') {
            const tzColumnName = `${parsedColumnName}Z`;
            if (!knownColumns?.has(tzColumnName)) {
              const timestampZSql =
                `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${tzColumnName}" TIMESTAMPTZ DEFAULT NOW()`.trim();
              await this.client.none(timestampZSql);
              knownColumns?.add(tzColumnName);
            }
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
    } finally {
      // Invalidate cached columns after DDL completes so concurrent writers see the new schema
      this.tableColumnsCache.delete(tableName);
      this.columnTypeCache.delete(tableName);
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
      await this.client.tx(async tx => {
        for (const record of records) {
          await this.executeInsert(tx, { tableName, record });
        }
      });
    } catch (error) {
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
    } finally {
      // Clear cached columns so subsequent createTable+insert sees the fresh schema
      this.tableColumnsCache.delete(tableName);
      this.columnTypeCache.delete(tableName);
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

      const snapshot = this.schemaSnapshot;
      if (snapshot) {
        if (snapshot.indexes.has(name)) return;
      } else {
        const indexExists = await this.client.oneOrNone(
          `SELECT 1 FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
          [name, schemaName],
        );

        if (indexExists) {
          return;
        }
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
      snapshot?.indexes.add(name);
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

  /**
   * Runs a caller-built `CREATE INDEX IF NOT EXISTS` statement, unless the init
   * snapshot already proves `indexName` exists.
   *
   * `createIndex` covers the indexes described by {@link CreateIndexOptions};
   * this is for the two init paths that hand-write their statement (a partial
   * or otherwise non-standard index) and would otherwise send a no-op DDL on
   * every warm init.
   */
  async createIndexFromStatement(indexName: string, sql: string): Promise<void> {
    const snapshot = this.schemaSnapshot;
    if (snapshot?.indexes.has(indexName)) return;

    await this.client.none(sql);
    snapshot?.indexes.add(indexName);
  }

  async dropIndex(indexName: string): Promise<void> {
    try {
      const schemaName = this.schemaName || 'public';
      const snapshot = this.schemaSnapshot;
      if (snapshot) {
        if (!snapshot.indexes.has(indexName)) return;
      } else {
        const indexExists = await this.client.oneOrNone(
          `SELECT 1 FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
          [indexName, schemaName],
        );

        if (!indexExists) {
          return;
        }
      }

      const quotedIndexName = `"${parseSqlIdentifier(indexName, 'index name')}"`;
      const sql = `DROP INDEX IF EXISTS ${getSchemaName(this.schemaName)}.${quotedIndexName}`;
      await this.client.none(sql);
      snapshot?.indexes.delete(indexName);
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
      await this.executeUpdate(this.client, { tableName, keys, data });
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
      await this.client.tx(async tx => {
        for (const { keys, data } of updates) {
          await this.executeUpdate(tx, { tableName, keys, data });
        }
      });
    } catch (error) {
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

  // ---------------------------------------------------------------------------
  // Retention helpers (prune)
  // ---------------------------------------------------------------------------

  /**
   * Deletes up to `limit` rows from `tableName` whose `column` value is strictly
   * older than `cutoff`, in a single bounded statement. Returns the number of
   * rows deleted so the caller's batch loop can decide whether the table is
   * drained.
   *
   * PostgreSQL has no `DELETE ... LIMIT`, so this targets a bounded set of
   * physical rows via the `ctid` system column (PG's row identity, analogous to
   * SQLite's `rowid`). `cutoff` is bound as a parameter — a `Date`/ISO-8601
   * string compared against a `timestamptz` anchor column, or a `number`
   * compared against a `bigint` epoch-ms anchor column.
   */
  async pruneBatch({
    tableName,
    column,
    cutoff,
    limit,
  }: {
    tableName: TABLE_NAMES;
    column: string;
    cutoff: Date | string | number;
    limit: number;
  }): Promise<number> {
    assertPositiveLimit(limit);
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    const parsedColumn = `"${parseSqlIdentifier(column, 'column name')}"`;

    const sql = `
      DELETE FROM ${fullTableName}
      WHERE ctid IN (
        SELECT ctid FROM ${fullTableName}
        WHERE ${parsedColumn} < $1
        LIMIT $2
      )
    `;

    const result = await this.client.query(sql, [cutoff, limit]);
    return result.rowCount ?? 0;
  }

  /**
   * Deletes up to `limit` aged parent rows *and* their child rows together, in
   * a single transaction (used by whole-unit pruning such as experiments →
   * experiment_results). The aged parent IDs are selected first and both
   * deletes target that exact ID set, so a bound or abort between batches never
   * leaves a parent hollow (kept, but with its children gone) or children
   * orphaned.
   */
  async pruneUnitsBatch({
    parentTable,
    parentKey,
    parentColumn,
    childTable,
    childForeignKey,
    cutoff,
    limit,
  }: {
    parentTable: TABLE_NAMES;
    parentKey: string;
    parentColumn: string;
    childTable: TABLE_NAMES;
    childForeignKey: string;
    cutoff: Date | string | number;
    limit: number;
  }): Promise<{ parents: number; children: number }> {
    assertPositiveLimit(limit);
    const schemaName = getSchemaName(this.schemaName);
    const fullChildTable = getTableName({ indexName: childTable, schemaName });
    const fullParentTable = getTableName({ indexName: parentTable, schemaName });
    const childFk = `"${parseSqlIdentifier(childForeignKey, 'column name')}"`;
    const parentPk = `"${parseSqlIdentifier(parentKey, 'column name')}"`;
    const parentCol = `"${parseSqlIdentifier(parentColumn, 'column name')}"`;

    return this.client.tx(async t => {
      const rows = await t.manyOrNone<{ id: unknown }>(
        `SELECT ${parentPk} AS id FROM ${fullParentTable} WHERE ${parentCol} < $1 LIMIT $2 FOR UPDATE SKIP LOCKED`,
        [cutoff, limit],
      );
      const ids = rows.map(r => r.id);
      if (ids.length === 0) return { parents: 0, children: 0 };

      const childResult = await t.query(`DELETE FROM ${fullChildTable} WHERE ${childFk} = ANY($1)`, [ids]);
      const parentResult = await t.query(`DELETE FROM ${fullParentTable} WHERE ${parentPk} = ANY($1)`, [ids]);
      return {
        parents: parentResult.rowCount ?? 0,
        children: childResult.rowCount ?? 0,
      };
    });
  }

  /**
   * Creates a btree index on `column` for `tableName` if it does not already
   * exist, so age-based prune deletes stay fast. Delegates to {@link createIndex}
   * (which is a no-op when the index is present).
   *
   * The name is lowercased and truncated to Postgres' 63-byte identifier limit
   * (schema-prefixed names can exceed it), mirroring {@link buildConstraintName}.
   */
  async ensureIndex({
    indexName,
    tableName,
    column,
  }: {
    indexName: string;
    tableName: TABLE_NAMES;
    column: string;
  }): Promise<void> {
    const name = buildConstraintName({ baseName: indexName });
    await this.createIndex({ name, table: tableName, columns: [column] });
  }

  private async executeUpdate(
    client: Pick<DbClient, 'none'> | Pick<TxClient, 'none'>,
    {
      tableName,
      keys,
      data,
    }: {
      tableName: TABLE_NAMES;
      keys: Record<string, any>;
      data: Record<string, any>;
    },
  ): Promise<void> {
    // Filter out columns that don't exist in the actual database table
    const filteredData = await this.filterRecordToKnownColumns(tableName, data);
    if (Object.keys(filteredData).length === 0) return; // Nothing to update after filtering

    const setColumns: string[] = [];
    const setValues: QueryValues = [];
    let paramIndex = 1;

    Object.entries(filteredData).forEach(([key, value]) => {
      const parsedKey = parseSqlIdentifier(key, 'column name');
      setColumns.push(`"${parsedKey}" = $${paramIndex++}`);
      setValues.push(this.prepareValue(value, key, tableName));
    });

    const whereConditions: string[] = [];
    const whereValues: QueryValues = [];

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

    await client.none(sql, values);
  }
}
