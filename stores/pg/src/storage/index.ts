import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { StorageDomains, StorageSupports } from '@mastra/core/storage';
import pgPromise from 'pg-promise';
import {
  validateConfig,
  isCloudSqlConfig,
  isConnectionStringConfig,
  isHostConfig,
  isClientConfig,
} from '../shared/config';
import type { PostgresStoreConfig } from '../shared/config';
import type { PgDomainConfig } from './db';
import { AgentsPG } from './domains/agents';
import { MemoryPG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';

/**
 * PostgreSQL storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new PostgresStore({ connectionString: '...' });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 * ```
 */
export class PostgresStore extends MastraStorage {
  #db: pgPromise.IDatabase<{}>;
  #pgp: pgPromise.IMain;
  private schema: string;
  private isInitialized: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    // Validation: connectionString or host/database/user/password must not be empty
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore', disableInit: config.disableInit });
      this.schema = config.schemaName || 'public';

      // Initialize pg-promise
      this.#pgp = pgPromise();

      // Handle pre-configured client vs creating new connection
      if (isClientConfig(config)) {
        // User provided a pre-configured pg-promise client
        this.#db = config.client;
      } else {
        // Create connection from config
        let pgConfig: PostgresStoreConfig;
        if (isConnectionStringConfig(config)) {
          pgConfig = {
            id: config.id,
            connectionString: config.connectionString,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
            ssl: config.ssl,
          };
        } else if (isCloudSqlConfig(config)) {
          // Cloud SQL connector config
          pgConfig = {
            ...config,
            id: config.id,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
          };
        } else if (isHostConfig(config)) {
          pgConfig = {
            id: config.id,
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
          };
        } else {
          // This should never happen due to validation above, but included for completeness
          throw new Error(
            'PostgresStore: invalid config. Provide either {client}, {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with `stream`).',
          );
        }

        // Note: pg-promise creates connections lazily when queries are executed,
        // so this is safe to do in the constructor
        this.#db = this.#pgp(pgConfig as any);
      }

      // Create all domain instances synchronously in the constructor
      // This is required for Memory to work correctly, as it checks for
      // stores.memory during getInputProcessors() before init() is called
      const skipDefaultIndexes = config.skipDefaultIndexes;
      const indexes = config.indexes;
      const domainConfig: PgDomainConfig = { client: this.#db, schemaName: this.schema, skipDefaultIndexes, indexes };

      const scores = new ScoresPG(domainConfig);
      const workflows = new WorkflowsPG(domainConfig);
      const memory = new MemoryPG(domainConfig);
      const observability = new ObservabilityPG(domainConfig);
      const agents = new AgentsPG(domainConfig);

      this.stores = {
        scores,
        workflows,
        memory,
        observability,
        agents,
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

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.isInitialized = true;

      // Each domain creates its own indexes during init()
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

  public get db() {
    return this.#db;
  }

  public get pgp() {
    return this.#pgp;
  }

  public get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      observability: true,
      indexManagement: true,
      listScoresBySpan: true,
      agents: true,
    };
  }

  /**
   * Closes the pg-promise connection pool.
   *
   * This will close ALL connections in the pool, including pre-configured clients.
   */
  async close(): Promise<void> {
    this.pgp.end();
  }
}
