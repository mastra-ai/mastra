import { connect } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { StorageDomains, StorageSupports } from '@mastra/core/storage';
import { StoreMemoryLance } from './domains/memory';
import { StoreScoresLance } from './domains/scores';
import { StoreWorkflowsLance } from './domains/workflows';

export interface LanceStorageOptions {
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
   * const storage = await LanceStorage.create('id', 'name', '/path/to/db', undefined, { disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = await LanceStorage.create('id', 'name', '/path/to/db', undefined, { disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
}

export interface LanceStorageClientOptions extends LanceStorageOptions {
  /**
   * Pre-configured LanceDB connection.
   * Use this when you need to configure the connection before initialization.
   *
   * @example
   * ```typescript
   * import { connect } from '@lancedb/lancedb';
   *
   * const client = await connect('/path/to/db', {
   *   // Custom connection options
   * });
   *
   * const store = await LanceStorage.fromClient('my-id', 'MyStorage', client);
   * ```
   */
  client: Connection;
}

/**
 * LanceDB storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = await LanceStorage.create('my-id', 'MyStorage', '/path/to/db');
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
export class LanceStorage extends MastraStorage {
  stores: StorageDomains;
  private lanceClient!: Connection;
  /**
   * Creates a new instance of LanceStorage
   * @param id The unique identifier for this storage instance
   * @param name The name for this storage instance
   * @param uri The URI to connect to LanceDB
   * @param connectionOptions connection options for LanceDB
   * @param storageOptions storage options including disableInit
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
   *
   * Disable auto-init for runtime (after CI/CD has run migrations)
   * ```ts
   * const store = await LanceStorage.create('my-storage-id', 'MyStorage', '/path/to/db', undefined, { disableInit: true });
   * ```
   */
  public static async create(
    id: string,
    name: string,
    uri: string,
    connectionOptions?: ConnectionOptions,
    storageOptions?: LanceStorageOptions,
  ): Promise<LanceStorage> {
    const instance = new LanceStorage(id, name, storageOptions?.disableInit);
    try {
      instance.lanceClient = await connect(uri, connectionOptions);
      instance.stores = {
        workflows: new StoreWorkflowsLance({ client: instance.lanceClient }),
        scores: new StoreScoresLance({ client: instance.lanceClient }),
        memory: new StoreMemoryLance({ client: instance.lanceClient }),
      };
      return instance;
    } catch (e: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'CONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to connect to LanceDB: ${e.message || e}`,
          details: { uri, optionsProvided: !!connectionOptions },
        },
        e,
      );
    }
  }

  /**
   * Creates a new instance of LanceStorage from a pre-configured LanceDB connection.
   * Use this when you need to configure the connection before initialization.
   *
   * @param id The unique identifier for this storage instance
   * @param name The name for this storage instance
   * @param client Pre-configured LanceDB connection
   * @param options Storage options including disableInit
   *
   * @example
   * ```typescript
   * import { connect } from '@lancedb/lancedb';
   *
   * const client = await connect('/path/to/db', {
   *   // Custom connection options
   * });
   *
   * const store = LanceStorage.fromClient('my-id', 'MyStorage', client);
   * ```
   */
  public static fromClient(id: string, name: string, client: Connection, options?: LanceStorageOptions): LanceStorage {
    const instance = new LanceStorage(id, name, options?.disableInit);
    instance.lanceClient = client;
    instance.stores = {
      workflows: new StoreWorkflowsLance({ client }),
      scores: new StoreScoresLance({ client }),
      memory: new StoreMemoryLance({ client }),
    };
    return instance;
  }

  /**
   * @internal
   * Private constructor to enforce using the create factory method.
   * Note: stores is initialized in create() after the lanceClient is connected.
   */
  private constructor(id: string, name: string, disableInit?: boolean) {
    super({ id, name, disableInit });
    // stores will be initialized in create() after lanceClient is connected
    this.stores = {} as StorageDomains;
  }

  public get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
    };
  }
}
