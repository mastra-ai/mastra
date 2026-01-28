import type { SqlStorage } from '@cloudflare/workers-types';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';

import { MemoryStorageDO } from './storage/domains/memory';
import { ScoresStorageDO } from './storage/domains/scores';
import { WorkflowsStorageDO } from './storage/domains/workflows';

// Export domain classes for direct use with MastraStorage composition
export { MemoryStorageDO, ScoresStorageDO, WorkflowsStorageDO };
export type { DODomainConfig } from './storage/db';
export { DODB } from './storage/db';

/**
 * Configuration for CloudflareDOStorage using Durable Objects SqlStorage
 */
export interface CloudflareDOStorageConfig {
  /** SqlStorage instance from Durable Objects ctx.storage.sql */
  sql: SqlStorage;
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
   * const storage = new CloudflareDOStorage({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new CloudflareDOStorage({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
}

/**
 * Cloudflare Durable Objects storage adapter for Mastra.
 *
 * Uses the synchronous SqlStorage API available in Durable Objects
 * to provide thread-based memory storage, workflow persistence, and scoring.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * import { DurableObject } from "cloudflare:workers";
 * import { CloudflareDOStorage } from "@mastra/cloudflare/do";
 *
 * class AgentDurableObject extends DurableObject<Env> {
 *   private storage: CloudflareDOStorage;
 *
 *   constructor(ctx: DurableObjectState, env: Env) {
 *     super(ctx, env);
 *     this.storage = new CloudflareDOStorage({
 *       sql: ctx.storage.sql,
 *       tablePrefix: 'mastra_'
 *     });
 *   }
 *
 *   async run() {
 *     const memory = await this.storage.getStore('memory');
 *     await memory?.saveThread({ thread: { id: 'thread-1', ... } });
 *   }
 * }
 * ```
 */
export class CloudflareDOStorage extends MastraCompositeStore {
  stores: StorageDomains;

  /**
   * Creates a new CloudflareDOStorage instance
   * @param config Configuration for Durable Objects SqlStorage access
   */
  constructor(config: CloudflareDOStorageConfig) {
    try {
      super({ id: 'do-store', name: 'DO', disableInit: config.disableInit });

      if (config.tablePrefix && !/^[a-zA-Z0-9_]*$/.test(config.tablePrefix)) {
        throw new Error('Invalid tablePrefix: only letters, numbers, and underscores are allowed.');
      }

      const domainConfig = { sql: config.sql, tablePrefix: config.tablePrefix };

      this.stores = {
        memory: new MemoryStorageDO(domainConfig),
        workflows: new WorkflowsStorageDO(domainConfig),
        scores: new ScoresStorageDO(domainConfig),
      };

      this.logger.info('Using Durable Objects SqlStorage');
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: 'Error initializing CloudflareDOStorage',
        },
        error,
      );
    }
  }

  /**
   * Close the database connection
   * No explicit cleanup needed for DO storage
   */
  async close(): Promise<void> {
    this.logger.debug('Closing DO connection');
    // No explicit cleanup needed for DO storage
  }
}

/**
 * @deprecated Use CloudflareDOStorage instead
 */
export const DOStore = CloudflareDOStorage;

/**
 * @deprecated Use CloudflareDOStorageConfig instead
 */
export type DOStoreConfig = CloudflareDOStorageConfig;
