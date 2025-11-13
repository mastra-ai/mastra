import { connect } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { EvalsStorageLance } from './domains/evals';
import { MemoryStorageLance } from './domains/memory';
import { WorkflowsStorageLance } from './domains/workflows';

export class LanceStorage extends MastraStorage {
  stores: StorageDomains;
  private lanceClient!: Connection;
  /**
   * Creates a new instance of LanceStorage
   * @param id The unique identifier for this storage instance
   * @param name The name for this storage instance
   * @param uri The URI to connect to LanceDB
   * @param options connection options
   *
   * Usage:
   *
   * Connect to a local database
   * ```ts
   * const store = await LanceStorage.create('my-storage-id', 'MyStorage', '/path/to/db');
   * ```
   *
   * Connect to a LanceDB cloud database
   * ```ts
   * const store = await LanceStorage.create('my-storage-id', 'MyStorage', 'db://host:port');
   * ```
   *
   * Connect to a cloud database
   * ```ts
   * const store = await LanceStorage.create('my-storage-id', 'MyStorage', 's3://bucket/db', { storageOptions: { timeout: '60s' } });
   * ```
   */
  public static async create(
    id: string,
    name: string,
    uri: string,
    options?: ConnectionOptions,
  ): Promise<LanceStorage> {
    const instance = new LanceStorage(id, name);
    try {
      instance.lanceClient = await connect(uri, options);

      const workflows = await WorkflowsStorageLance.create({ client: instance.lanceClient });
      const evals = await EvalsStorageLance.create({ client: instance.lanceClient });
      const memory = await MemoryStorageLance.create({ client: instance.lanceClient });

      instance.stores = {
        workflows,
        evals,
        memory,
      };
      return instance;
    } catch (e: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_CONNECT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to connect to LanceDB: ${e.message || e}`,
          details: { uri, optionsProvided: !!options },
        },
        e,
      );
    }
  }

  /**
   * @internal
   * Private constructor to enforce using the create factory method
   */
  private constructor(id: string, name: string) {
    super({ id, name });
    // Stores will be initialized in the create factory method
    this.stores = {} as StorageDomains;
  }

  get supports() {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: true,
      deleteMessages: false,
      listScoresBySpan: false,
    };
  }
}
