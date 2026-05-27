import { AuroraDSQLClient } from '@aws/aurora-dsql-node-postgres-connector';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { Pool } from 'pg';
import { validateConfig, getEffectiveRegion, DSQL_POOL_DEFAULTS, isHostConfig, isPoolConfig } from '../shared/config';
import type { DSQLStoreConfig } from '../shared/config';
import { PoolAdapter } from './client';
import type { DbClient } from './client';
import type { DsqlDomainClientConfig } from './db';
import { AgentsDSQL } from './domains/agents';
import { MemoryDSQL } from './domains/memory';
import { ObservabilityDSQL } from './domains/observability';
import { ScoresDSQL } from './domains/scores';
import { WorkflowsDSQL } from './domains/workflows';

export { AgentsDSQL, MemoryDSQL, ObservabilityDSQL, ScoresDSQL, WorkflowsDSQL };
export { PoolAdapter } from './client';
export type { DbClient, TxClient, QueryValues, Pool, PoolClient, QueryResult } from './client';
export type { DsqlDomainConfig, DsqlDomainClientConfig, DsqlDomainPoolConfig, DsqlDomainRestConfig } from './db';

export class DSQLStore extends MastraStorage {
  #pool: Pool;
  #db: DbClient;
  #ownsPool: boolean;
  private schema: string;
  private isInitialized: boolean = false;

  stores: StorageDomains;

  constructor(config: DSQLStoreConfig) {
    try {
      validateConfig(config);
      super({ id: config.id, name: 'DSQLStore', disableInit: config.disableInit });
      this.schema = config.schemaName || 'public';

      // Create or use provided pool
      if (isPoolConfig(config)) {
        this.#pool = config.pool;
        this.#ownsPool = false;
      } else {
        this.#pool = this.createPool(config);
        this.#ownsPool = true;
      }

      this.#db = new PoolAdapter(this.#pool);

      const domainConfig: DsqlDomainClientConfig = {
        client: this.#db,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };

      this.stores = {
        scores: new ScoresDSQL(domainConfig),
        workflows: new WorkflowsDSQL(domainConfig),
        memory: new MemoryDSQL(domainConfig),
        observability: new ObservabilityDSQL(domainConfig),
        agents: new AgentsDSQL(domainConfig),
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  /**
   * Creates a connection pool with AuroraDSQLClient for IAM authentication.
   */
  private createPool(config: DSQLStoreConfig): Pool {
    if (!isHostConfig(config)) {
      throw new Error('DSQLStore: Invalid configuration for creating pool.');
    }
    const region = getEffectiveRegion(config);
    const poolConfig = {
      host: config.host,
      user: config.user ?? 'admin',
      database: config.database ?? 'postgres',
      // Use AuroraDSQLClient for automatic IAM token generation
      Client: AuroraDSQLClient as any,
      // Pass region for IAM token generation
      region,
      // Custom credentials provider (optional)
      customCredentialsProvider: config.customCredentialsProvider,
      // Pool settings optimized for Aurora DSQL
      max: config.max ?? DSQL_POOL_DEFAULTS.max,
      min: config.min ?? DSQL_POOL_DEFAULTS.min,
      idleTimeoutMillis: config.idleTimeoutMillis ?? DSQL_POOL_DEFAULTS.idleTimeoutMillis,
      maxLifetimeSeconds: config.maxLifetimeSeconds ?? DSQL_POOL_DEFAULTS.maxLifetimeSeconds,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? DSQL_POOL_DEFAULTS.connectionTimeoutMillis,
      allowExitOnIdle: config.allowExitOnIdle ?? DSQL_POOL_DEFAULTS.allowExitOnIdle,
    };

    return new Pool(poolConfig as any);
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
          id: createStorageErrorId('DSQL', 'INIT', 'FAILED'),
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
    this.isInitialized = false;
  }
}
