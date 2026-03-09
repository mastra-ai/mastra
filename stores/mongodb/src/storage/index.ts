import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageDomains } from '@mastra/core/storage';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { MongoDBConnector } from './connectors/MongoDBConnector';
import { resolveMongoDBConfig } from './db';
import { MongoDBAgentsStorage } from './domains/agents';
import { MongoDBBlobStore } from './domains/blobs';
import { MongoDBMCPClientsStorage } from './domains/mcp-clients';
import { MongoDBMCPServersStorage } from './domains/mcp-servers';
import { MemoryStorageMongoDB } from './domains/memory';
import { ObservabilityMongoDB } from './domains/observability';
import { MongoDBPromptBlocksStorage } from './domains/prompt-blocks';
import { MongoDBScorerDefinitionsStorage } from './domains/scorer-definitions';
import { ScoresStorageMongoDB } from './domains/scores';
import { MongoDBSkillsStorage } from './domains/skills';
import { WorkflowsStorageMongoDB } from './domains/workflows';
import { MongoDBWorkspacesStorage } from './domains/workspaces';
import type { MongoDBConfig } from './types';

// Export domain classes for direct use with MastraStorage composition
export {
  MongoDBAgentsStorage,
  MongoDBBlobStore,
  MongoDBMCPClientsStorage,
  MongoDBMCPServersStorage,
  MemoryStorageMongoDB,
  MongoDBPromptBlocksStorage,
  MongoDBScorerDefinitionsStorage,
  MongoDBSkillsStorage,
  MongoDBWorkspacesStorage,
  ObservabilityMongoDB,
  ScoresStorageMongoDB,
  WorkflowsStorageMongoDB,
};
export type { MongoDBDomainConfig } from './db';

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
export class MongoDBStore extends MastraCompositeStore {
  #connector: MongoDBConnector;

  stores: StorageDomains;

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

    const promptBlocks = new MongoDBPromptBlocksStorage(domainConfig);

    const scorerDefinitions = new MongoDBScorerDefinitionsStorage(domainConfig);

    const mcpClients = new MongoDBMCPClientsStorage(domainConfig);

    const mcpServers = new MongoDBMCPServersStorage(domainConfig);

    const workspaces = new MongoDBWorkspacesStorage(domainConfig);

    const skills = new MongoDBSkillsStorage(domainConfig);

    const blobs = new MongoDBBlobStore(domainConfig);

    this.stores = {
      memory,
      scores,
      workflows,
      observability,
      agents,
      promptBlocks,
      scorerDefinitions,
      mcpClients,
      mcpServers,
      workspaces,
      skills,
      blobs,
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
