import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageDomains, StorageSupports } from '@mastra/core/storage';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { MongoDBConnector } from './connectors/MongoDBConnector';
import { resolveMongoDBConfig } from './db';
import { MongoDBAgentsStorage } from './domains/agents';
import { MemoryStorageMongoDB } from './domains/memory';
import { ObservabilityMongoDB } from './domains/observability';
import { ScoresStorageMongoDB } from './domains/scores';
import { WorkflowsStorageMongoDB } from './domains/workflows';
import type { MongoDBConfig } from './types';

/**
 * MongoDB storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new MongoDBStore({ id: 'my-store', uri: 'mongodb://...' });
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
export class MongoDBStore extends MastraStorage {
  #connector: MongoDBConnector;

  stores: StorageDomains;

  public get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      indexManagement: false,
      listScoresBySpan: true,
    };
  }

  constructor(config: MongoDBConfig) {
    super({ id: config.id, name: 'MongoDBStore', disableInit: config.disableInit });

    this.#connector = resolveMongoDBConfig(config);

    const domainConfig = {
      connector: this.#connector,
      skipDefaultIndexes: config.skipDefaultIndexes,
      indexes: config.indexes,
    };

    const memory = new MemoryStorageMongoDB(domainConfig);

    const scores = new ScoresStorageMongoDB(domainConfig);

    const workflows = new WorkflowsStorageMongoDB(domainConfig);

    const observability = new ObservabilityMongoDB(domainConfig);

    const agents = new MongoDBAgentsStorage(domainConfig);

    this.stores = {
      memory,
      scores,
      workflows,
      observability,
      agents,
    };
  }

  /**
   * Closes the MongoDB client connection.
   *
   * This will close the MongoDB client, including pre-configured clients.
   */
  async close(): Promise<void> {
    try {
      await this.#connector.close();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CLOSE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
