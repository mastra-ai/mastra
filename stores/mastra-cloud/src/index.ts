import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

export interface CloudStorageConfig {
  /**
   * The URL of the Mastra Cloud storage database
   */
  url: string;
  /**
   * Authentication token for the database
   */
  authToken?: string;
  /**
   * ID for the storage instance
   * @default 'mastra-cloud-storage-libsql'
   */
  storageId?: string;
  /**
   * ID for the vector instance
   * @default 'mastra-cloud-storage-libsql-vector'
   */
  vectorId?: string;
}

export interface CloudStorageInstances {
  storage: LibSQLStore;
  vector: LibSQLVector;
}

/**
 * Creates storage and vector instances configured for Mastra Cloud
 *
 * @param config - Configuration options for the cloud storage
 * @returns Object containing initialized storage and vector instances
 *
 * @example
 * ```typescript
 * const { storage, vector } = createCloudStorage({
 *   url: process.env.MASTRA_STORAGE_URL!,
 *   authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
 * });
 *
 * await storage.init();
 * mastra.setStorage(storage);
 * ```
 */
export function createCloudStorage(config: CloudStorageConfig): CloudStorageInstances {
  const storage = new LibSQLStore({
    id: config.storageId || 'mastra-cloud-storage-libsql',
    url: config.url,
    authToken: config.authToken,
  });

  const vector = new LibSQLVector({
    id: config.vectorId || 'mastra-cloud-storage-libsql-vector',
    connectionUrl: config.url,
    authToken: config.authToken,
  });

  return {
    storage,
    vector,
  };
}
