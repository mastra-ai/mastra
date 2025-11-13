import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageDomains } from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';
import { MongoDBConnector } from './connectors/MongoDBConnector';
import { EvalsStorageMongoDB } from './domains/evals';
import { MemoryStorageMongoDB } from './domains/memory';
import { ObservabilityMongoDB } from './domains/observability';
import { MongoDBOperations } from './domains/operations';
import { WorkflowsStorageMongoDB } from './domains/workflows';
import type { MongoDBConfig } from './types';

const loadConnector = (config: MongoDBConfig): MongoDBConnector => {
  try {
    if ('connectorHandler' in config) {
      return MongoDBConnector.fromConnectionHandler(config.connectorHandler);
    }
  } catch (error) {
    throw new MastraError(
      {
        id: 'STORAGE_MONGODB_STORE_CONSTRUCTOR_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { connectionHandler: true },
      },
      error,
    );
  }

  try {
    return MongoDBConnector.fromDatabaseConfig({
      id: config.id,
      options: config.options,
      url: config.url,
      dbName: config.dbName,
    });
  } catch (error) {
    throw new MastraError(
      {
        id: 'STORAGE_MONGODB_STORE_CONSTRUCTOR_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { url: config?.url, dbName: config?.dbName },
      },
      error,
    );
  }
};

export { MemoryStorageMongoDB as MemoryStorage } from './domains/memory';
export { ObservabilityMongoDB as ObservabilityStorage } from './domains/observability';
export { EvalsStorageMongoDB as EvalsStorage } from './domains/evals';
export { WorkflowsStorageMongoDB as WorkflowsStorage } from './domains/workflows';

export class MongoDBStore extends MastraStorage {
  #connector: MongoDBConnector;
  #operations: MongoDBOperations;

  stores: StorageDomains;

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    listScoresBySpan: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: false,
      listScoresBySpan: true,
    };
  }

  constructor(config: MongoDBConfig) {
    super({ id: config.id, name: 'MongoDBStore' });

    this.#connector = loadConnector(config);

    this.#operations = new MongoDBOperations({
      connector: this.#connector,
    });

    const memory = new MemoryStorageMongoDB({
      operations: this.#operations,
    });

    const evals = new EvalsStorageMongoDB({
      operations: this.#operations,
    });

    const workflows = new WorkflowsStorageMongoDB({
      operations: this.#operations,
    });

    const observability = new ObservabilityMongoDB({
      operations: this.#operations,
    });

    this.stores = {
      memory,
      evals,
      workflows,
      observability,
    };
  }
}
