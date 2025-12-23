import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageDomains, StorageSupports } from '@mastra/core/storage';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';

import type { Service } from 'electrodb';
import { getElectroDbService } from '../entities';
import { MemoryStorageDynamoDB } from './domains/memory';
import { ScoresStorageDynamoDB } from './domains/scores';
import { WorkflowStorageDynamoDB } from './domains/workflows';

/**
 * DynamoDB configuration type.
 *
 * Accepts either:
 * - A pre-configured DynamoDB client: `{ id, client, tableName }`
 * - AWS config: `{ id, tableName, region?, endpoint?, credentials? }`
 */
export type DynamoDBStoreConfig = {
  id: string;
  tableName: string;
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
   * const storage = new DynamoDBStore({ name: 'my-store', config: { ...config, disableInit: false } });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new DynamoDBStore({ name: 'my-store', config: { ...config, disableInit: true } });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured DynamoDB Document client.
       * Use this when you need to configure the client before initialization,
       * e.g., to set custom middleware or retry strategies.
       *
       * @example
       * ```typescript
       * import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
       * import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
       *
       * const dynamoClient = new DynamoDBClient({
       *   region: 'us-east-1',
       *   // Custom settings
       *   maxAttempts: 5,
       * });
       *
       * const client = DynamoDBDocumentClient.from(dynamoClient, {
       *   marshallOptions: { removeUndefinedValues: true },
       * });
       *
       * const store = new DynamoDBStore({
       *   name: 'my-store',
       *   config: { id: 'my-id', client, tableName: 'my-table' }
       * });
       * ```
       */
      client: DynamoDBDocumentClient;
    }
  | {
      region?: string;
      endpoint?: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
    }
);

/**
 * Type guard for pre-configured client config
 */
const isClientConfig = (
  config: DynamoDBStoreConfig,
): config is DynamoDBStoreConfig & { client: DynamoDBDocumentClient } => {
  return 'client' in config;
};

// Define a type for our service that allows string indexing
type MastraService = Service<Record<string, any>> & {
  [key: string]: any;
};

/**
 * DynamoDB storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new DynamoDBStore({ name: 'my-store', config: { id: 'my-id', tableName: 'my-table' } });
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
export class DynamoDBStore extends MastraStorage {
  private tableName: string;
  private client: DynamoDBDocumentClient;
  private service: MastraService;
  protected hasInitialized: Promise<boolean> | null = null;
  stores: StorageDomains;

  constructor({ name, config }: { name: string; config: DynamoDBStoreConfig }) {
    super({ id: config.id, name, disableInit: config.disableInit });

    // Validate required config
    try {
      if (!config.tableName || typeof config.tableName !== 'string' || config.tableName.trim() === '') {
        throw new Error('DynamoDBStore: config.tableName must be provided and cannot be empty.');
      }
      // Validate tableName characters (basic check)
      if (!/^[a-zA-Z0-9_.-]{3,255}$/.test(config.tableName)) {
        throw new Error(
          `DynamoDBStore: config.tableName "${config.tableName}" contains invalid characters or is not between 3 and 255 characters long.`,
        );
      }

      this.tableName = config.tableName;

      // Handle pre-configured client vs creating new connection
      if (isClientConfig(config)) {
        // User provided a pre-configured DynamoDBDocumentClient
        this.client = config.client;
      } else {
        // Create client from AWS config
        const dynamoClient = new DynamoDBClient({
          region: config.region || 'us-east-1',
          endpoint: config.endpoint,
          credentials: config.credentials,
        });
        this.client = DynamoDBDocumentClient.from(dynamoClient);
      }

      this.service = getElectroDbService(this.client, this.tableName) as MastraService;

      const domainConfig = { service: this.service };
      const workflows = new WorkflowStorageDynamoDB(domainConfig);
      const memory = new MemoryStorageDynamoDB(domainConfig);
      const scores = new ScoresStorageDynamoDB(domainConfig);

      this.stores = {
        workflows,
        memory,
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'CONSTRUCTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }

    // We're using a single table design with ElectroDB,
    // so we don't need to create multiple tables
  }

  get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
    };
  }

  /**
   * Validates that the required DynamoDB table exists and is accessible.
   * This does not check the table structure - it assumes the table
   * was created with the correct structure via CDK/CloudFormation.
   */
  private async validateTableExists(): Promise<boolean> {
    try {
      const command = new DescribeTableCommand({
        TableName: this.tableName,
      });

      // If the table exists, this call will succeed
      // If the table doesn't exist, it will throw a ResourceNotFoundException
      await this.client.send(command);
      return true;
    } catch (error: any) {
      // If the table doesn't exist, DynamoDB returns a ResourceNotFoundException
      if (error.name === 'ResourceNotFoundException') {
        return false;
      }

      // For other errors (like permissions issues), we should throw
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'VALIDATE_TABLE_EXISTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: this.tableName },
        },
        error,
      );
    }
  }

  /**
   * Initialize storage, validating the externally managed table is accessible.
   * For the single-table design, we only validate once that we can access
   * the table that was created via CDK/CloudFormation.
   */
  async init(): Promise<void> {
    if (this.hasInitialized === null) {
      // If no initialization promise exists, create and store it.
      // This assignment ensures that even if multiple calls arrive here concurrently,
      // they will all eventually await the same promise instance created by the first one
      // to complete this assignment.
      this.hasInitialized = this._performInitializationAndStore();
    }

    try {
      // Await the stored promise.
      // If initialization was successful, this resolves.
      // If it failed, this will re-throw the error caught and re-thrown by _performInitializationAndStore.
      await this.hasInitialized;
    } catch (error) {
      // The error has already been handled by _performInitializationAndStore
      // (i.e., this.hasInitialized was reset). Re-throwing here ensures
      // the caller of init() is aware of the failure.
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: this.tableName },
        },
        error,
      );
    }
  }

  /**
   * Performs the actual table validation and stores the promise.
   * Handles resetting the stored promise on failure to allow retries.
   */
  private _performInitializationAndStore(): Promise<boolean> {
    return this.validateTableExists()
      .then(exists => {
        if (!exists) {
          throw new Error(
            `Table ${this.tableName} does not exist or is not accessible. Ensure it's created via CDK/CloudFormation before using this store.`,
          );
        }
        // Successfully initialized
        return true;
      })
      .catch(err => {
        // Initialization failed. Clear the stored promise to allow future calls to init() to retry.
        this.hasInitialized = null;
        // Re-throw the error so it can be caught by the awaiter in init()
        throw err;
      });
  }

  /**
   * Closes the DynamoDB client connection and cleans up resources.
   *
   * This will close the DynamoDB client, including pre-configured clients.
   */
  public async close(): Promise<void> {
    this.logger.debug('Closing DynamoDB client for store:', { name: this.name });
    try {
      this.client.destroy();
      this.logger.debug('DynamoDB client closed successfully for store:', { name: this.name });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'CLOSE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
