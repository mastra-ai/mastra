import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage, TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { Pool } from 'pg';
import {
  validateConfig,
  isCloudSqlConfig,
  isConnectionStringConfig,
  isHostConfig,
  isPoolConfig,
} from '../shared/config';
import type { PostgresStoreConfig } from '../shared/config';
import { PoolAdapter } from './client';
import type { DbClient } from './client';
import type { PgDomainClientConfig } from './db';
import { AgentsPG } from './domains/agents';
import { MemoryPG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';

/** Default maximum number of connections in the pool */
const DEFAULT_MAX_CONNECTIONS = 20;
/** Default idle timeout in milliseconds */
const DEFAULT_IDLE_TIMEOUT_MS = 30000;

export { exportSchemas } from './db';
// Export domain classes for direct use with MastraStorage composition
export { AgentsPG, MemoryPG, ObservabilityPG, ScoresPG, WorkflowsPG };
export { PoolAdapter } from './client';
export type { DbClient, TxClient, QueryValues, Pool, PoolClient, QueryResult } from './client';
export type { PgDomainConfig, PgDomainClientConfig, PgDomainPoolConfig, PgDomainRestConfig } from './db';

/**
 * PostgreSQL storage adapter for Mastra.
 *
 * @example
 * ```typescript
 * // Option 1: Connection string
 * const store = new PostgresStore({
 *   id: 'my-store',
 *   connectionString: 'postgresql://...',
 * });
 *
 * // Option 2: Pre-configured pool
 * const pool = new Pool({ connectionString: 'postgresql://...' });
 * const store = new PostgresStore({ id: 'my-store', pool });
 *
 * // Access domain storage
 * const memory = await store.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Execute custom queries
 * const rows = await store.db.any('SELECT * FROM my_table');
 * ```
 */
export class PostgresStore extends MastraStorage {
  #pool: Pool;
  #db: DbClient;
  #ownsPool: boolean;
  private schema: string;
  private isInitialized: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore', disableInit: config.disableInit });
      this.schema = config.schemaName || 'public';

      if (isPoolConfig(config)) {
        this.#pool = config.pool;
        this.#ownsPool = false;
      } else {
        this.#pool = this.createPool(config);
        this.#ownsPool = true;
      }

      this.#db = new PoolAdapter(this.#pool);

      const domainConfig: PgDomainClientConfig = {
        client: this.#db,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };

      this.stores = {
        scores: new ScoresPG(domainConfig),
        workflows: new WorkflowsPG(domainConfig),
        memory: new MemoryPG(domainConfig),
        observability: new ObservabilityPG(domainConfig),
        agents: new AgentsPG(domainConfig),
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  private createPool(config: PostgresStoreConfig): Pool {
    if (isConnectionStringConfig(config)) {
      return new Pool({
        connectionString: config.connectionString,
        ssl: config.ssl,
        max: config.max ?? DEFAULT_MAX_CONNECTIONS,
        idleTimeoutMillis: config.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
      });
    }

    if (isHostConfig(config)) {
      return new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        max: config.max ?? DEFAULT_MAX_CONNECTIONS,
        idleTimeoutMillis: config.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
      });
    }

    if (isCloudSqlConfig(config)) {
      return new Pool(config as any);
    }

    throw new Error('PostgresStore: invalid config');
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.isInitialized = true;
      await super.init();
    } catch (error) {
      this.isInitialized = false;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Database client for executing queries.
   *
   * @example
   * ```typescript
   * const rows = await store.db.any('SELECT * FROM users WHERE active = $1', [true]);
   * const user = await store.db.one('SELECT * FROM users WHERE id = $1', [userId]);
   * ```
   */
  public get db(): DbClient {
    return this.#db;
  }

  /**
   * The underlying pg.Pool for direct database access or ORM integration.
   */
  public get pool(): Pool {
    return this.#pool;
  }

  /**
   * Closes the connection pool if it was created by this store.
   * If a pool was passed in via config, it will not be closed.
   */
  async close(): Promise<void> {
    if (this.#ownsPool) {
      await this.#pool.end();
    }
  }

  /**
   * Gets the current data type of a column in the database.
   * @returns The PostgreSQL data type (e.g., 'text', 'jsonb') or null if column doesn't exist
   */
  private async getColumnType(tableName: string, columnName: string): Promise<string | null> {
    const result = await this.#db.oneOrNone<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
      [this.schema, tableName, columnName],
    );
    return result?.data_type ?? null;
  }

  /**
   * Migrates a column from TEXT to JSONB.
   * @internal
   */
  private async migrateColumnToJsonb(
    tableName: string,
    columnName: string,
    errorId: string,
  ): Promise<{ migrated: boolean; previousType?: string }> {
    const fullTableName = this.schema === 'public' ? tableName : `"${this.schema}".${tableName}`;

    try {
      const currentType = await this.getColumnType(tableName, columnName);

      // Column doesn't exist - nothing to migrate
      if (!currentType) {
        return { migrated: false };
      }

      // Already JSONB - no migration needed
      if (currentType === 'jsonb') {
        return { migrated: false };
      }

      // Migrate TEXT to JSONB
      if (currentType === 'text') {
        await this.#db.none(
          `ALTER TABLE ${fullTableName}
           ALTER COLUMN "${columnName}" TYPE jsonb
           USING "${columnName}"::jsonb`,
        );
        return { migrated: true, previousType: currentType };
      }

      // Unexpected type - don't migrate, let user handle it
      return { migrated: false, previousType: currentType };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', errorId, 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, columnName },
        },
        error,
      );
    }
  }

  /**
   * Migrates the threads table metadata column from TEXT to JSONB.
   *
   * This migration is required for users upgrading from versions where
   * TABLE_THREADS.metadata was stored as TEXT. The migration converts
   * the column type and preserves all existing JSON data.
   *
   * @returns Object indicating migration status:
   *   - `migrated: true` if the column was converted from TEXT to JSONB
   *   - `migrated: false` if no migration was needed (already JSONB or column doesn't exist)
   *   - `previousType` the column type before migration (if migration occurred)
   *
   * @example
   * ```typescript
   * const store = new PostgresStore({ connectionString: '...' });
   * await store.init();
   *
   * const result = await store.migrateThreadsMetadataToJsonb();
   * if (result.migrated) {
   *   console.log(`Migrated metadata column from ${result.previousType} to JSONB`);
   * }
   * ```
   */
  async migrateThreadsMetadataToJsonb(): Promise<{ migrated: boolean; previousType?: string }> {
    return this.migrateColumnToJsonb(TABLE_THREADS, 'metadata', 'MIGRATE_THREADS_METADATA');
  }

  /**
   * Migrates the workflow_snapshot table snapshot column from TEXT to JSONB.
   *
   * This migration is required for users upgrading from versions where
   * TABLE_WORKFLOW_SNAPSHOT.snapshot was stored as TEXT. The migration converts
   * the column type and preserves all existing JSON data.
   *
   * @returns Object indicating migration status:
   *   - `migrated: true` if the column was converted from TEXT to JSONB
   *   - `migrated: false` if no migration was needed (already JSONB or column doesn't exist)
   *   - `previousType` the column type before migration (if migration occurred)
   *
   * @example
   * ```typescript
   * const store = new PostgresStore({ connectionString: '...' });
   * await store.init();
   *
   * const result = await store.migrateWorkflowSnapshotToJsonb();
   * if (result.migrated) {
   *   console.log(`Migrated snapshot column from ${result.previousType} to JSONB`);
   * }
   * ```
   */
  async migrateWorkflowSnapshotToJsonb(): Promise<{ migrated: boolean; previousType?: string }> {
    return this.migrateColumnToJsonb(TABLE_WORKFLOW_SNAPSHOT, 'snapshot', 'MIGRATE_WORKFLOW_SNAPSHOT');
  }
}
