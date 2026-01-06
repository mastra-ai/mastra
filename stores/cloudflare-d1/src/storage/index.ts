import type { D1Database } from '@cloudflare/workers-types';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import Cloudflare from 'cloudflare';
import { MemoryStorageD1 } from './domains/memory';
import { ScoresStorageD1 } from './domains/scores';
import { WorkflowsStorageD1 } from './domains/workflows';

// Export domain classes for direct use with MastraStorage composition
export { MemoryStorageD1, ScoresStorageD1, WorkflowsStorageD1 };
export type { D1DomainConfig } from './db';

/**
 * Base configuration options shared across D1 configurations
 */
export interface D1BaseConfig {
  /** Storage instance ID */
  id: string;
  /** Optional prefix for table names */
  tablePrefix?: string;
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
   * const storage = new D1Store({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new D1Store({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
}

/**
 * Configuration for D1 using the REST API
 */
export interface D1Config extends D1BaseConfig {
  /** Cloudflare account ID */
  accountId: string;
  /** Cloudflare API token with D1 access */
  apiToken: string;
  /** D1 database ID */
  databaseId: string;
}

export interface D1ClientConfig extends D1BaseConfig {
  /** D1 Client */
  client: D1Client;
}

/**
 * Configuration for D1 using the Workers Binding API
 */
export interface D1WorkersConfig extends D1BaseConfig {
  /** D1 database binding from Workers environment */
  binding: D1Database; // D1Database binding from Workers
}

/**
 * Combined configuration type supporting both REST API and Workers Binding API
 */
export type D1StoreConfig = D1Config | D1WorkersConfig | D1ClientConfig;

export type D1QueryResult = Awaited<ReturnType<Cloudflare['d1']['database']['query']>>['result'];
export interface D1Client {
  query(args: { sql: string; params: string[] }): Promise<{ result: D1QueryResult }>;
}

/**
 * Cloudflare D1 storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new D1Store({ id: 'my-store', accountId: '...', apiToken: '...', databaseId: '...' });
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
export class D1Store extends MastraStorage {
  private client?: D1Client;
  private binding?: D1Database;
  private tablePrefix: string;

  stores: StorageDomains;

  /**
   * Creates a new D1Store instance
   * @param config Configuration for D1 access (either REST API or Workers Binding API)
   */
  constructor(config: D1StoreConfig) {
    try {
      super({ id: config.id, name: 'D1', disableInit: config.disableInit });

      if (config.tablePrefix && !/^[a-zA-Z0-9_]*$/.test(config.tablePrefix)) {
        throw new Error('Invalid tablePrefix: only letters, numbers, and underscores are allowed.');
      }

      this.tablePrefix = config.tablePrefix || '';

      // Determine which API to use based on provided config
      if ('binding' in config) {
        if (!config.binding) {
          throw new Error('D1 binding is required when using Workers Binding API');
        }
        this.binding = config.binding;
        this.logger.info('Using D1 Workers Binding API');
      } else if ('client' in config) {
        if (!config.client) {
          throw new Error('D1 client is required when using D1ClientConfig');
        }
        this.client = config.client;
        this.logger.info('Using D1 Client');
      } else {
        if (!config.accountId || !config.databaseId || !config.apiToken) {
          throw new Error('accountId, databaseId, and apiToken are required when using REST API');
        }
        const cfClient = new Cloudflare({
          apiToken: config.apiToken,
        });
        this.client = {
          query: ({ sql, params }) => {
            return cfClient.d1.database.query(config.databaseId, {
              account_id: config.accountId,
              sql,
              params,
            });
          },
        };

        this.logger.info('Using D1 REST API');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: 'Error initializing D1Store',
        },
        error,
      );
    }

    let scores: ScoresStorageD1;
    let workflows: WorkflowsStorageD1;
    let memory: MemoryStorageD1;

    if (this.binding) {
      const domainConfig = { binding: this.binding, tablePrefix: this.tablePrefix };
      scores = new ScoresStorageD1(domainConfig);
      workflows = new WorkflowsStorageD1(domainConfig);
      memory = new MemoryStorageD1(domainConfig);
    } else {
      const domainConfig = { client: this.client!, tablePrefix: this.tablePrefix };
      scores = new ScoresStorageD1(domainConfig);
      workflows = new WorkflowsStorageD1(domainConfig);
      memory = new MemoryStorageD1(domainConfig);
    }

    this.stores = {
      scores,
      workflows,
      memory,
    };
  }

  /**
   * Close the database connection
   * No explicit cleanup needed for D1 in either REST or Workers Binding mode
   */
  async close(): Promise<void> {
    this.logger.debug('Closing D1 connection');
    // No explicit cleanup needed for D1
  }
}
