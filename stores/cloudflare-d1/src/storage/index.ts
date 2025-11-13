import type { D1Database } from '@cloudflare/workers-types';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import Cloudflare from 'cloudflare';
import { EvalsStorageD1 } from './domains/evals';
import { MemoryStorageD1 } from './domains/memory';
import { WorkflowsStorageD1 } from './domains/workflows';

export { EvalsStorageD1 } from './domains/evals';
export { MemoryStorageD1 } from './domains/memory';
export { WorkflowsStorageD1 } from './domains/workflows';

/**
 * Configuration for D1 using the REST API
 */
export interface D1Config {
  /** Storage instance ID */
  id: string;
  /** Cloudflare account ID */
  accountId: string;
  /** Cloudflare API token with D1 access */
  apiToken: string;
  /** D1 database ID */
  databaseId: string;
  /** Optional prefix for table names */
  tablePrefix?: string;
}

export interface D1ClientConfig {
  /** Storage instance ID */
  id: string;
  /** Optional prefix for table names */
  tablePrefix?: string;
  /** D1 Client */
  client: D1Client;
}

/**
 * Configuration for D1 using the Workers Binding API
 */
export interface D1WorkersConfig {
  /** Storage instance ID */
  id: string;
  /** D1 database binding from Workers environment */
  binding: D1Database; // D1Database binding from Workers
  /** Optional prefix for table names */
  tablePrefix?: string;
}

/**
 * Combined configuration type supporting both REST API and Workers Binding API
 */
export type D1StoreConfig = D1Config | D1WorkersConfig | D1ClientConfig;

export type D1QueryResult = Awaited<ReturnType<Cloudflare['d1']['database']['query']>>['result'];
export interface D1Client {
  query(args: { sql: string; params: string[] }): Promise<{ result: D1QueryResult }>;
}

export class D1Store extends MastraStorage {
  private client?: D1Client;
  private binding?: D1Database; // D1Database binding
  private tablePrefix: string;

  stores: StorageDomains;

  /**
   * Creates a new D1Store instance
   * @param config Configuration for D1 access (either REST API or Workers Binding API)
   */
  constructor(config: D1StoreConfig) {
    try {
      super({ id: config.id, name: 'D1' });

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
          id: 'CLOUDFLARE_D1_STORAGE_INITIALIZATION_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: 'Error initializing D1Store',
        },
        error,
      );
    }

    const scores = new EvalsStorageD1({
      client: this.client,
      binding: this.binding,
      tablePrefix: this.tablePrefix,
    });

    const workflows = new WorkflowsStorageD1({
      client: this.client,
      binding: this.binding,
      tablePrefix: this.tablePrefix,
    });

    const memory = new MemoryStorageD1({
      client: this.client,
      binding: this.binding,
      tablePrefix: this.tablePrefix,
    });

    this.stores = {
      evals: scores,
      workflows,
      memory,
    };
  }

  get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: false,
      listScoresBySpan: true,
    };
  }
}
