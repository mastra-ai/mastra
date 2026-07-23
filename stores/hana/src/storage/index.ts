import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains, CreateIndexOptions } from '@mastra/core/storage';

import { HANAPool } from './db/pool';
import { AgentsHANA } from './domains/agents';
import { BackgroundTasksHANA } from './domains/background-tasks';
import { MemoryHANA } from './domains/memory';
import { ObservabilityHANA } from './domains/observability';
import { ScoresHANA } from './domains/scores';
import { WorkflowsHANA } from './domains/workflows';

// Export domain classes for direct use with MastraStorage composition
export { AgentsHANA, BackgroundTasksHANA, MemoryHANA, ObservabilityHANA, ScoresHANA, WorkflowsHANA };
export type { HANADomainConfig } from './db';

/**
 * SAP HANA storage adapter configuration.
 *
 * Accepts either:
 * - A pre-configured HANAPool: `{ id, pool, schemaName? }`
 * - Connection parameters: `{ id, host, port, uid, pwd, databaseName?, encrypt? }`
 */
export type HANAConfigType = {
  id: string;
  schemaName?: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * Useful for CI/CD pipelines where you run migrations explicitly during deployment.
   */
  disableInit?: boolean;
  /**
   * When true, default indexes will not be created during initialization.
   */
  skipDefaultIndexes?: boolean;
  /**
   * Custom indexes to create during initialization.
   */
  indexes?: CreateIndexOptions[];
} & (
  | {
      /**
       * Pre-configured HANAPool.
       * Use this when you need to configure the pool before initialization.
       *
       * @example
       * ```typescript
       * import { HANAPool } from '@mastra/hana';
       *
       * const pool = new HANAPool({ host: 'myhost', port: 443, uid: 'USER', pwd: 'PASS' });
       * const store = new HANAStore({ id: 'my-store', pool });
       * ```
       */
      pool: HANAPool;
    }
  | {
      /** HANA host (e.g. abc123.hanacloud.ondemand.com) */
      host: string;
      /** HANA port (typically 443 for HANA Cloud) */
      port: number;
      /** Database user */
      uid: string;
      /** Database password */
      pwd: string;
      /** Optional database name */
      databaseName?: string;
      /** Enable TLS (default: true) */
      encrypt?: boolean;
      /** Validate TLS certificate (default: true) */
      sslValidateCertificate?: boolean;
      /** Minimum pool connections (default: 1) */
      minConnections?: number;
      /** Maximum pool connections (default: 10) */
      maxConnections?: number;
    }
);

export type HANAConfig = HANAConfigType;

const isPoolConfig = (config: HANAConfigType): config is HANAConfigType & { pool: HANAPool } => {
  return 'pool' in config;
};

/**
 * SAP HANA storage adapter for Mastra.
 *
 * @example
 * ```typescript
 * const storage = new HANAStore({
 *   id: 'my-store',
 *   host: 'abc123.hanacloud.ondemand.com',
 *   port: 443,
 *   uid: 'MASTRA_USER',
 *   pwd: process.env.HANA_PASSWORD!,
 *   encrypt: true,
 * });
 * await storage.init();
 * ```
 */
export class HANAStore extends MastraCompositeStore {
  public pool: HANAPool;
  private schema?: string;
  stores: StorageDomains;

  constructor(config: HANAConfigType) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('HANAStore: id must be provided and cannot be empty.');
    }
    if (!isPoolConfig(config)) {
      const serverConfig = config as { host?: string; uid?: string; pwd?: string };
      for (const key of ['host', 'uid', 'pwd'] as const) {
        if (!serverConfig[key] || typeof serverConfig[key] !== 'string' || serverConfig[key]!.trim() === '') {
          throw new Error(`HANAStore: ${key} must be provided and cannot be empty.`);
        }
      }
    }
    super({ id: config.id, name: 'HANAStore', disableInit: config.disableInit });
    try {
      this.schema = config.schemaName;

      if (isPoolConfig(config)) {
        this.pool = config.pool;
      } else {
        const serverConfig = config as HANAConfigType & {
          host: string;
          port: number;
          uid: string;
          pwd: string;
          databaseName?: string;
          encrypt?: boolean;
          sslValidateCertificate?: boolean;
          minConnections?: number;
          maxConnections?: number;
        };
        this.pool = new HANAPool({
          host: serverConfig.host,
          port: serverConfig.port ?? 443,
          uid: serverConfig.uid,
          pwd: serverConfig.pwd,
          databaseName: serverConfig.databaseName,
          encrypt: serverConfig.encrypt ?? true,
          sslValidateCertificate: serverConfig.sslValidateCertificate ?? true,
          min: serverConfig.minConnections,
          max: serverConfig.maxConnections,
        });
      }

      const domainConfig = {
        pool: this.pool,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };

      this.stores = {
        memory: new MemoryHANA(domainConfig),
        workflows: new WorkflowsHANA(domainConfig),
        observability: new ObservabilityHANA(domainConfig),
        scores: new ScoresHANA(domainConfig),
        backgroundTasks: new BackgroundTasksHANA(domainConfig),
        agents: new AgentsHANA(domainConfig),
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    try {
      await this.pool.initialize();
      await super.init();
      // Sync effective schema after domain init (may differ if CREATE SCHEMA fell back to CURRENT_USER)
      const effectiveSchema = (this.stores.memory as any)?.db?.schemaName;
      if (effectiveSchema !== undefined) this.schema = effectiveSchema;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Closes all connections in the HANAPool.
   */
  async close(): Promise<void> {
    await this.pool.destroy();
  }
}
