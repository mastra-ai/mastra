import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
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
}
