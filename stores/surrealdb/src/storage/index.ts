import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageDomains } from '@mastra/core/storage';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { SurrealDBConnectionConfig } from '../shared/config';
import { SurrealDBConnector } from '../shared/connector';
import { MemoryStorageSurrealDB } from './domains/memory';
import { ObservabilityStorageSurrealDB } from './domains/observability';
import { ScoresStorageSurrealDB } from './domains/scores';
import { WorkflowsStorageSurrealDB } from './domains/workflows';
import { exportSchemas, MEMORY_SCHEMA, OBSERVABILITY_SCHEMA, SCORES_SCHEMA, WORKFLOWS_SCHEMA } from './schema';

// Export domain classes for direct use with MastraStorage composition
export { MemoryStorageSurrealDB, ObservabilityStorageSurrealDB, ScoresStorageSurrealDB, WorkflowsStorageSurrealDB };
export { exportSchemas };

export type SurrealDBStoreConfig = SurrealDBConnectionConfig & {
  id: string;
  /**
   * When true, automatic initialization (namespace, database and table definitions) is disabled.
   * Run `storage.init()` from a deployment script with a privileged user instead.
   */
  disableInit?: boolean;
};

/**
 * SurrealDB storage adapter for Mastra.
 *
 * Every domain shares one connection. Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new SurrealDBStore({
 *   id: 'surrealdb-storage',
 *   url: 'ws://localhost:8000',
 *   username: 'root',
 *   password: 'root',
 *   namespace: 'mastra',
 *   database: 'mastra',
 * });
 *
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 * ```
 */
export class SurrealDBStore extends MastraCompositeStore {
  #connector: SurrealDBConnector;
  #initPromise?: Promise<void>;
  stores: StorageDomains;

  constructor(config: SurrealDBStoreConfig) {
    super({ id: config.id, name: 'SurrealDBStore', disableInit: config.disableInit });

    try {
      this.#connector = new SurrealDBConnector(config);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SURREALDB', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: error instanceof Error ? error.message : String(error),
        },
        error,
      );
    }

    const domainConfig = { connector: this.#connector };
    this.stores = {
      memory: new MemoryStorageSurrealDB(domainConfig),
      workflows: new WorkflowsStorageSurrealDB(domainConfig),
      scores: new ScoresStorageSurrealDB(domainConfig),
      observability: new ObservabilityStorageSurrealDB(domainConfig),
    };
  }

  /** The underlying SurrealDB connection shared by every domain (and usable by a `SurrealVector`). */
  get connector(): SurrealDBConnector {
    return this.#connector;
  }

  /**
   * Connects and applies the schema of every domain in a single request. Domains are not
   * initialized concurrently, since concurrent schema definitions conflict in SurrealDB.
   */
  override async init(): Promise<void> {
    if (this.disableInit || process.env.MASTRA_DISABLE_STORAGE_INIT === 'true') return;
    this.#initPromise ??= (async () => {
      await this.#connector.ensureDatabase();
      await this.#connector.query([MEMORY_SCHEMA, WORKFLOWS_SCHEMA, SCORES_SCHEMA, OBSERVABILITY_SCHEMA].join('\n'));
    })().catch(error => {
      this.#initPromise = undefined;
      throw new MastraError(
        {
          id: createStorageErrorId('SURREALDB', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    });
    await this.#initPromise;
  }

  override async close(): Promise<void> {
    await this.#connector.close();
  }
}
