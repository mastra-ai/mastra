import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  getSqlType,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SPANS,
  TABLE_SCHEMAS,
  getDefaultValue,
} from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { ClickhouseConfig } from './utils';
import { TABLE_ENGINES, transformRow } from './utils';

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing ClickHouse client with optional ttl config
 * 2. Config to create a new client internally
 */
export type ClickhouseDomainConfig = ClickhouseDomainClientConfig | ClickhouseDomainRestConfig;

/**
 * Pass an existing ClickHouse client
 */
export interface ClickhouseDomainClientConfig {
  client: ClickHouseClient;
  ttl?: ClickhouseConfig['ttl'];
}

/**
 * Pass config to create a new ClickHouse client internally
 */
export interface ClickhouseDomainRestConfig {
  url: string;
  username: string;
  password: string;
  ttl?: ClickhouseConfig['ttl'];
}

/**
 * Resolves ClickhouseDomainConfig to a ClickHouse client and ttl config.
 * Handles creating a new client if config is provided.
 */
export function resolveClickhouseConfig(config: ClickhouseDomainConfig): {
  client: ClickHouseClient;
  ttl?: ClickhouseConfig['ttl'];
} {
  // Existing client
  if ('client' in config) {
    return { client: config.client, ttl: config.ttl };
  }

  // Config to create new client
  const client = createClient({
    url: config.url,
    username: config.username,
    password: config.password,
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
      date_time_output_format: 'iso',
      use_client_time_zone: 1,
      output_format_json_quote_64bit_integers: 0,
    },
  });

  return { client, ttl: config.ttl };
}

export class ClickhouseDB extends MastraBase {
  protected ttl: ClickhouseConfig['ttl'];
  protected client: ClickHouseClient;

  /** Cache of actual table columns: tableName -> Promise<Set<columnName>> (stores in-flight promise to coalesce concurrent calls) */
  private tableColumnsCache = new Map<string, Promise<Set<string>>>();

  constructor({ client, ttl }: { client: ClickHouseClient; ttl: ClickhouseConfig['ttl'] }) {
    super({
      name: 'CLICKHOUSE_DB',
    });
    this.ttl = ttl;
    this.client = client;
  }

  /**
   * Gets the set of column names that actually exist in the database table.
   * Results are cached; the cache is invalidated when alterTable() adds new columns.
   */
  private async getTableColumns(tableName: TABLE_NAMES): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName);
    if (cached) return cached;

    // Store the in-flight promise so concurrent callers (e.g. Promise.all in batchInsert) await the same query
    const promise = (async () => {
      try {
        const result = await this.client.query({
          query: `DESCRIBE TABLE ${tableName}`,
          format: 'JSONEachRow',
        });
        const rows = (await result.json()) as Array<{ name: string }>;
        const columns = new Set(rows.map(r => r.name));
        if (columns.size === 0) {
          this.tableColumnsCache.delete(tableName);
        }
        return columns;
      } catch {
        // Table may not exist yet
        this.tableColumnsCache.delete(tableName);
        return new Set<string>();
      }
    })();
    this.tableColumnsCache.set(tableName, promise);

    return promise;
  }

  /**
   * Filters a record to only include columns that exist in the actual database table.
   * Unknown columns are silently dropped to ensure forward compatibility.
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

  async hasColumn(table: string, column: string): Promise<boolean> {
    const result = await this.client.query({
      query: `DESCRIBE TABLE ${table}`,
      format: 'JSONEachRow',
    });
    const columns = (await result.json()) as { name: string }[];
    return columns.some(c => c.name === column);
  }

  /**
   * Checks if a table exists in the database.
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.client.query({
        query: `EXISTS TABLE ${tableName}`,
        format: 'JSONEachRow',
      });
      const rows = (await result.json()) as Array<{ result: number }>;
      return rows[0]?.result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Gets the sorting key (ORDER BY columns) for a table.
   * Returns null if the table doesn't exist.
   */
  async getTableSortingKey(tableName: string): Promise<string | null> {
    try {
      const result = await this.client.query({
        query: `SELECT sorting_key FROM system.tables WHERE database = currentDatabase() AND name = {tableName:String}`,
        query_params: { tableName },
        format: 'JSONEachRow',
      });
      const rows = (await result.json()) as Array<{ sorting_key: string }>;
      return rows[0]?.sorting_key ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if migration is needed for the spans table.
   * Returns information about the current state.
   */
  async checkSpansMigrationStatus(tableName: string): Promise<{
    needsMigration: boolean;
    currentSortingKey: string | null;
  }> {
    // Check if table exists
    const exists = await this.tableExists(tableName);
    if (!exists) {
      return { needsMigration: false, currentSortingKey: null };
    }

    // Check current sorting key
    const currentSortingKey = await this.getTableSortingKey(tableName);
    if (!currentSortingKey) {
      return { needsMigration: false, currentSortingKey: null };
    }

    // Check if migration is needed - old key starts with createdAt
    const needsMigration = currentSortingKey.toLowerCase().startsWith('createdat');
    return { needsMigration, currentSortingKey };
  }

  /**
   * Checks for duplicate (traceId, spanId) combinations in the spans table.
   * Returns information about duplicates for logging/CLI purposes.
   */
  async checkForDuplicateSpans(tableName: string): Promise<{
    hasDuplicates: boolean;
    duplicateCount: number;
  }> {
    try {
      // Count duplicate (traceId, spanId) combinations
      const result = await this.client.query({
        query: `
          SELECT count() as duplicate_count
          FROM (
            SELECT traceId, spanId
            FROM ${tableName}
            GROUP BY traceId, spanId
            HAVING count() > 1
          )
        `,
        format: 'JSONEachRow',
      });
      const rows = (await result.json()) as Array<{ duplicate_count: string }>;
      const duplicateCount = parseInt(rows[0]?.duplicate_count ?? '0', 10);
      return {
        hasDuplicates: duplicateCount > 0,
        duplicateCount,
      };
    } catch (error) {
      // If table doesn't exist or other error, assume no duplicates
      this.logger?.debug?.(`Could not check for duplicates: ${error}`);
      return { hasDuplicates: false, duplicateCount: 0 };
    }
  }

  /**
   * Migrates the spans table from the old sorting key (createdAt, traceId, spanId)
   * to the new sorting key (traceId, spanId) for proper uniqueness enforcement.
   *
   * This migration:
   * 1. Renames the old table to a backup
   * 2. Creates a new table with the correct sorting key
   * 3. Copies all data from the backup to the new table, deduplicating by (traceId, spanId)
   *    using priority-based selection:
   *    - First, prefer completed spans (those with endedAt set)
   *    - Then prefer the most recently updated span (highest updatedAt)
   *    - Finally use creation time as tiebreaker (highest createdAt)
   * 4. Drops the backup table
   *
   * The deduplication strategy matches the PostgreSQL migration (PR #12073) to ensure
   * consistent behavior across storage backends.
   *
   * The migration is idempotent - it only runs if the old sorting key is detected.
   *
   * @returns true if migration was performed, false if not needed
   */
  async migrateSpansTableSortingKey({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<boolean> {
    // Only applies to spans table
    if (tableName !== TABLE_SPANS) {
      return false;
    }

    // Check if table exists
    const exists = await this.tableExists(tableName);
    if (!exists) {
      return false;
    }

    // Check current sorting key
    const currentSortingKey = await this.getTableSortingKey(tableName);
    if (!currentSortingKey) {
      return false;
    }

    // Check if migration is needed - old key starts with createdAt
    // Old format: "createdAt, traceId, spanId"
    // New format: "traceId, spanId"
    const needsMigration = currentSortingKey.toLowerCase().startsWith('createdat');
    if (!needsMigration) {
      this.logger?.debug?.(`Spans table already has correct sorting key: ${currentSortingKey}`);
      return false;
    }

    this.logger?.info?.(`Migrating spans table from sorting key "${currentSortingKey}" to "(traceId, spanId)"`);

    const backupTableName = `${tableName}_backup_${Date.now()}`;
    const rowTtl = this.ttl?.[tableName]?.row;

    try {
      // Step 1: Rename old table to backup
      await this.client.command({
        query: `RENAME TABLE ${tableName} TO ${backupTableName}`,
      });

      // Step 2: Create new table with correct sorting key
      const columns = Object.entries(schema)
        .map(([name, def]) => {
          let sqlType = this.getSqlType(def.type);
          let isNullable = def.nullable === true;

          // Special case: updatedAt must be non-nullable for TABLE_SPANS because
          // ReplacingMergeTree(updatedAt) requires a non-nullable version column.
          if (tableName === TABLE_SPANS && name === 'updatedAt') {
            isNullable = false;
          }

          if (isNullable) {
            sqlType = `Nullable(${sqlType})`;
          }
          const constraints = [];
          if (name === 'metadata' && (def.type === 'text' || def.type === 'jsonb') && isNullable) {
            constraints.push("DEFAULT '{}'");
          }
          const columnTtl = this.ttl?.[tableName]?.columns?.[name];
          return `"${name}" ${sqlType} ${constraints.join(' ')} ${columnTtl ? `TTL toDateTime(${columnTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${columnTtl.interval} ${columnTtl.unit}` : ''}`;
        })
        .join(',\n');

      const createSql = `
        CREATE TABLE ${tableName} (
          ${columns}
        )
        ENGINE = ${TABLE_ENGINES[tableName] ?? 'MergeTree()'}
        PRIMARY KEY (traceId, spanId)
        ORDER BY (traceId, spanId)
        ${rowTtl ? `TTL toDateTime(${rowTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${rowTtl.interval} ${rowTtl.unit}` : ''}
        SETTINGS index_granularity = 8192
      `;

      await this.client.command({
        query: createSql,
      });

      // Step 3: Copy data from backup to new table, deduplicating by (traceId, spanId)
      // Get the list of columns that exist in both tables
      const describeResult = await this.client.query({
        query: `DESCRIBE TABLE ${backupTableName}`,
        format: 'JSONEachRow',
      });
      const backupColumns = (await describeResult.json()) as Array<{ name: string }>;
      const backupColumnNames = new Set(backupColumns.map(c => c.name));

      // Only copy columns that exist in both tables
      const columnsToInsert = Object.keys(schema).filter(col => backupColumnNames.has(col));
      const columnList = columnsToInsert.map(c => `"${c}"`).join(', ');

      // Build SELECT expressions, using COALESCE for updatedAt to handle NULL values
      // (updatedAt must be non-nullable for ReplacingMergeTree version column)
      const selectExpressions = columnsToInsert
        .map(c => (c === 'updatedAt' ? `COALESCE("updatedAt", "createdAt") as "updatedAt"` : `"${c}"`))
        .join(', ');

      // Use LIMIT BY for deduplication with priority-based selection:
      // 1. Prefer completed spans (those with endedAt not null/empty)
      // 2. Then prefer the most recently updated (highest updatedAt)
      // 3. Then use creation time as final tiebreaker (highest createdAt)
      // This matches the PostgreSQL migration behavior from PR #12073
      await this.client.command({
        query: `INSERT INTO ${tableName} (${columnList})
                SELECT ${selectExpressions}
                FROM ${backupTableName}
                ORDER BY traceId, spanId,
                         (endedAt IS NOT NULL AND endedAt != '') DESC,
                         COALESCE(updatedAt, createdAt) DESC,
                         createdAt DESC
                LIMIT 1 BY traceId, spanId`,
      });

      // Step 4: Drop backup table
      await this.client.command({
        query: `DROP TABLE ${backupTableName}`,
      });

      this.logger?.info?.(`Successfully migrated spans table to new sorting key`);
      return true;
    } catch (error: any) {
      // Attempt to restore from backup if migration failed partway through
      this.logger?.error?.(`Migration failed: ${error.message}`);

      try {
        // Check if original table exists
        const originalExists = await this.tableExists(tableName);
        const backupExists = await this.tableExists(backupTableName);

        if (!originalExists && backupExists) {
          // Restore from backup
          this.logger?.info?.(`Restoring spans table from backup`);
          await this.client.command({
            query: `RENAME TABLE ${backupTableName} TO ${tableName}`,
          });
        } else if (originalExists && backupExists) {
          // Both exist - drop backup (new table was created successfully)
          await this.client.command({
            query: `DROP TABLE IF EXISTS ${backupTableName}`,
          });
        }
      } catch (restoreError) {
        this.logger?.error?.(`Failed to restore from backup: ${restoreError}`);
      }

      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'MIGRATE_SPANS_SORTING_KEY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, currentSortingKey },
        },
        error,
      );
    }
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
      case 'uuid':
      case 'jsonb':
        return 'String';
      case 'timestamp':
        return 'DateTime64(3)';
      case 'integer':
      case 'bigint':
        return 'Int64';
      case 'float':
        return 'Float64';
      case 'boolean':
        return 'Bool';
      default:
        return getSqlType(type); // fallback to base implementation
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
      const columns = Object.entries(schema)
        .map(([name, def]) => {
          let sqlType = this.getSqlType(def.type);
          // Only treat as nullable if explicitly set to true (default is NOT nullable)
          let isNullable = def.nullable === true;

          // Special case: updatedAt must be non-nullable for TABLE_SPANS because
          // ReplacingMergeTree(updatedAt) requires a non-nullable version column.
          // Application code already sets updatedAt = createdAt on insert.
          if (tableName === TABLE_SPANS && name === 'updatedAt') {
            isNullable = false;
          }

          // Wrap nullable columns in Nullable() to properly support NULL values
          if (isNullable) {
            sqlType = `Nullable(${sqlType})`;
          }
          const constraints = [];
          // Add DEFAULT '{}' for all metadata columns to prevent empty string issues
          // Support both 'text' and 'jsonb' types for backwards compatibility
          // Apply to all tables for consistent behavior and defense-in-depth
          if (name === 'metadata' && (def.type === 'text' || def.type === 'jsonb') && isNullable) {
            constraints.push("DEFAULT '{}'");
          }
          const columnTtl = this.ttl?.[tableName]?.columns?.[name];
          return `"${name}" ${sqlType} ${constraints.join(' ')} ${columnTtl ? `TTL toDateTime(${columnTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${columnTtl.interval} ${columnTtl.unit}` : ''}`;
        })
        .join(',\n');

      const rowTtl = this.ttl?.[tableName]?.row;
      let sql: string;

      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        sql = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
              ${['id String'].concat(columns)}
            )
            ENGINE = ${TABLE_ENGINES[tableName] ?? 'MergeTree()'}
            PRIMARY KEY (createdAt, run_id, workflow_name)
            ORDER BY (createdAt, run_id, workflow_name)
            ${rowTtl ? `TTL toDateTime(${rowTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${rowTtl.interval} ${rowTtl.unit}` : ''}
            SETTINGS index_granularity = 8192
              `;
      } else if (tableName === TABLE_SPANS) {
        // Spans table uses (traceId, spanId) as composite unique key.
        // ORDER BY must be (traceId, spanId) for ReplacingMergeTree to properly deduplicate
        // rows with the same traceId+spanId combination. The engine uses updatedAt as the
        // version column to keep the row with the highest updatedAt during deduplication.
        sql = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
              ${columns}
            )
            ENGINE = ${TABLE_ENGINES[tableName] ?? 'MergeTree()'}
            PRIMARY KEY (traceId, spanId)
            ORDER BY (traceId, spanId)
            ${rowTtl ? `TTL toDateTime(${rowTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${rowTtl.interval} ${rowTtl.unit}` : ''}
            SETTINGS index_granularity = 8192
          `;
      } else {
        sql = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
              ${columns}
            )
            ENGINE = ${TABLE_ENGINES[tableName] ?? 'MergeTree()'}
            PRIMARY KEY (createdAt, ${'id'})
            ORDER BY (createdAt, ${'id'})
            ${this.ttl?.[tableName]?.row ? `TTL toDateTime(createdAt) + INTERVAL ${this.ttl[tableName].row.interval} ${this.ttl[tableName].row.unit}` : ''}
            SETTINGS index_granularity = 8192
          `;
      }

      await this.client.query({
        query: sql,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CREATE_TABLE', 'FAILED'),
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
      // 1. Get existing columns
      const describeSql = `DESCRIBE TABLE ${tableName}`;
      const result = await this.client.query({
        query: describeSql,
      });
      const rows = await result.json();
      const existingColumnNames = new Set(rows.data.map((row: any) => row.name.toLowerCase()));

      // 2. Add missing columns
      for (const columnName of ifNotExists) {
        if (!existingColumnNames.has(columnName.toLowerCase()) && schema[columnName]) {
          const columnDef = schema[columnName];
          let sqlType = this.getSqlType(columnDef.type);
          if (columnDef.nullable !== false) {
            sqlType = `Nullable(${sqlType})`;
          }
          const defaultValue = columnDef.nullable === false ? getDefaultValue(columnDef.type) : '';
          // Use backticks or double quotes as needed for identifiers
          const alterSql =
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${columnName}" ${sqlType} ${defaultValue}`.trim();

          await this.client.query({
            query: alterSql,
          });
          this.logger?.debug?.(`Added column ${columnName} to table ${tableName}`);
        }
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'ALTER_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    } finally {
      // Invalidate cached columns after DDL completes so concurrent writers see the new schema
      this.tableColumnsCache.delete(tableName);
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      // Stop background merges before TRUNCATE. TRUNCATE acquires an exclusive
      // write lock that blocks until in-flight merges complete. Pausing merges
      // first avoids this lock contention.
      await this.client.command({ query: `SYSTEM STOP MERGES ${tableName}` });
      await this.client.command({
        query: `TRUNCATE TABLE ${tableName}`,
      });
      await this.client.command({ query: `SYSTEM START MERGES ${tableName}` });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CLEAR_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.client.query({
        query: `DROP TABLE IF EXISTS ${tableName}`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'DROP_TABLE', 'FAILED'),
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

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      // Filter out unknown columns from user-supplied data first
      const filteredRecord = await this.filterRecordToKnownColumns(tableName, record);
      if (Object.keys(filteredRecord).length === 0) return; // No known columns after filtering - skip insert

      // Inject timestamps only if those columns exist in the table (they survived filtering)
      const rawCreatedAt = filteredRecord.createdAt || filteredRecord.created_at || new Date();
      const rawUpdatedAt = filteredRecord.updatedAt || new Date();
      if ('createdAt' in filteredRecord || (await this.getTableColumns(tableName)).has('createdAt')) {
        filteredRecord.createdAt = rawCreatedAt instanceof Date ? rawCreatedAt.toISOString() : rawCreatedAt;
      }
      if ('updatedAt' in filteredRecord || (await this.getTableColumns(tableName)).has('updatedAt')) {
        filteredRecord.updatedAt = rawUpdatedAt instanceof Date ? rawUpdatedAt.toISOString() : rawUpdatedAt;
      }

      await this.client.insert({
        table: tableName,
        values: [filteredRecord],
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          output_format_json_quote_64bit_integers: 0,
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const processedRecords = records.map(record => ({
      ...Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
          key,
          // Only convert to Date if it's a timestamp column AND value is not null/undefined
          // new Date(null) returns epoch date, not null, so we must check first
          TABLE_SCHEMAS[tableName as TABLE_NAMES]?.[key]?.type === 'timestamp' && value != null
            ? new Date(value).toISOString()
            : value,
        ]),
      ),
    }));

    // Filter out columns that don't exist in the actual database table
    const recordsToBeInserted = await Promise.all(
      processedRecords.map(r => this.filterRecordToKnownColumns(tableName, r)),
    );
    // Skip records that have no known columns after filtering
    const nonEmptyRecords = recordsToBeInserted.filter(r => Object.keys(r).length > 0);
    if (nonEmptyRecords.length === 0) return;

    try {
      await this.client.insert({
        table: tableName,
        values: nonEmptyRecords,
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const engine = TABLE_ENGINES[tableName] ?? 'MergeTree()';
      const keyEntries = Object.entries(keys);
      const conditions = keyEntries
        .map(
          ([key]) =>
            `"${key}" = {var_${key}:${this.getSqlType(TABLE_SCHEMAS[tableName as TABLE_NAMES]?.[key]?.type ?? 'text')}}`,
        )
        .join(' AND ');
      const values = keyEntries.reduce((acc, [key, value]) => {
        return { ...acc, [`var_${key}`]: value };
      }, {});

      const hasUpdatedAt = TABLE_SCHEMAS[tableName as TABLE_NAMES]?.updatedAt;

      const selectClause = `SELECT *, toDateTime64(createdAt, 3) as createdAt${hasUpdatedAt ? ', toDateTime64(updatedAt, 3) as updatedAt' : ''}`;

      const result = await this.client.query({
        query: `${selectClause} FROM ${tableName} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''} WHERE ${conditions} ORDER BY createdAt DESC LIMIT 1`,
        query_params: values,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return null;
      }

      const rows = await result.json();
      // If this is a workflow snapshot, parse the snapshot field
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = rows.data[0] as any;
        if (!snapshot) {
          return null;
        }
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return transformRow(snapshot);
      }

      const data: R = transformRow(rows.data[0]);
      return data;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LOAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }
}
