import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { StorageDomains, CreateIndexOptions, StorageSupports } from '@mastra/core/storage';

import sql from 'mssql';
import { MemoryMSSQL } from './domains/memory';
import { ObservabilityMSSQL } from './domains/observability';
import { ScoresMSSQL } from './domains/scores';
import { WorkflowsMSSQL } from './domains/workflows';

/**
 * MSSQL configuration type.
 *
 * Accepts either:
 * - A pre-configured connection pool: `{ id, pool, schemaName? }`
 * - Connection string: `{ id, connectionString, ... }`
 * - Server/port config: `{ id, server, port, database, user, password, ... }`
 */
export type MSSQLConfigType = {
  id: string;
  schemaName?: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new MSSQLStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new MSSQLStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
  /**
   * When true, default indexes will not be created during initialization.
   * This is useful when:
   * 1. You want to manage indexes separately or use custom indexes only
   * 2. Default indexes don't match your query patterns
   * 3. You want to reduce initialization time in development
   *
   * @default false
   */
  skipDefaultIndexes?: boolean;
  /**
   * Custom indexes to create during initialization.
   * These indexes are created in addition to default indexes (unless skipDefaultIndexes is true).
   *
   * Each index must specify which table it belongs to. The store will route each index
   * to the appropriate domain based on the table name.
   *
   * @example
   * ```typescript
   * const store = new MSSQLStore({
   *   connectionString: '...',
   *   indexes: [
   *     { name: 'my_threads_type_idx', table: 'mastra_threads', columns: ['JSON_VALUE(metadata, \'$.type\')'] },
   *   ],
   * });
   * ```
   */
  indexes?: CreateIndexOptions[];
} & (
  | {
      /**
       * Pre-configured mssql ConnectionPool.
       * Use this when you need to configure the pool before initialization,
       * e.g., to add pool listeners or set connection-level settings.
       *
       * @example
       * ```typescript
       * import sql from 'mssql';
       *
       * const pool = new sql.ConnectionPool({
       *   server: 'localhost',
       *   database: 'mydb',
       *   user: 'user',
       *   password: 'password',
       * });
       *
       * // Custom setup before using
       * pool.on('connect', () => {
       *   console.log('Pool connected');
       * });
       *
       * const store = new MSSQLStore({ id: 'my-store', pool });
       * ```
       */
      pool: sql.ConnectionPool;
    }
  | {
      server: string;
      port: number;
      database: string;
      user: string;
      password: string;
      options?: sql.IOptions;
    }
  | {
      connectionString: string;
    }
);

export type MSSQLConfig = MSSQLConfigType;

/**
 * Type guard for pre-configured pool config
 */
const isPoolConfig = (config: MSSQLConfigType): config is MSSQLConfigType & { pool: sql.ConnectionPool } => {
  return 'pool' in config;
};

/**
 * MSSQL storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new MSSQLStore({ id: 'my-store', connectionString: '...' });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 *
 * // Access observability domain
 * const observability = await storage.getStore('observability');
 * await observability?.createSpan(span);
 * ```
 */
export class MSSQLStore extends MastraStorage {
  public pool: sql.ConnectionPool;
  private schema?: string;
  private isConnected: Promise<boolean> | null = null;
  stores: StorageDomains;

  constructor(config: MSSQLConfigType) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('MSSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: 'MSSQLStore', disableInit: config.disableInit });
    try {
      this.schema = config.schemaName || 'dbo';

      // Handle pre-configured pool vs creating new connection
      if (isPoolConfig(config)) {
        // User provided a pre-configured ConnectionPool
        this.pool = config.pool;
      } else if ('connectionString' in config) {
        if (
          !config.connectionString ||
          typeof config.connectionString !== 'string' ||
          config.connectionString.trim() === ''
        ) {
          throw new Error('MSSQLStore: connectionString must be provided and cannot be empty.');
        }
        this.pool = new sql.ConnectionPool(config.connectionString);
      } else {
        const required = ['server', 'database', 'user', 'password'];
        for (const key of required) {
          if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
            throw new Error(`MSSQLStore: ${key} must be provided and cannot be empty.`);
          }
        }
        this.pool = new sql.ConnectionPool({
          server: config.server,
          database: config.database,
          user: config.user,
          password: config.password,
          port: config.port,
          options: config.options || { encrypt: true, trustServerCertificate: true },
        });
      }

      const domainConfig = {
        pool: this.pool,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };
      const scores = new ScoresMSSQL(domainConfig);
      const workflows = new WorkflowsMSSQL(domainConfig);
      const memory = new MemoryMSSQL(domainConfig);
      const observability = new ObservabilityMSSQL(domainConfig);

      this.stores = {
        scores,
        workflows,
        memory,
        observability,
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isConnected === null) {
      this.isConnected = this._performInitializationAndStore();
    }
    try {
      await this.isConnected;
      // Each domain creates its own indexes during init()
      await super.init();
    } catch (error) {
      this.isConnected = null;
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async _performInitializationAndStore(): Promise<boolean> {
    try {
      await this.pool.connect();
      return true;
    } catch (err) {
      throw err;
    }
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
      agents: false,
    };
  }

  /**
   * Closes the MSSQL connection pool.
   *
   * This will close the connection pool, including pre-configured pools.
   */
  async close(): Promise<void> {
    await this.pool.close();
  }
}
