import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType, MastraMessageV2, MastraMessageV1 } from '@mastra/core/memory';

import {
  MastraStorage,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type {
  EvalRow,
  StorageGetMessagesArg,
  WorkflowRun,
  WorkflowRuns,
  TABLE_NAMES,
  StorageGetTracesArg,
  PaginationInfo,
  StorageColumn,
  TABLE_RESOURCES,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { Service } from 'electrodb';
import { getElectroDbService } from '../entities';

export interface DynamoDBStoreConfig {
  region?: string;
  tableName: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

type SUPPORTED_TABLE_NAMES = Exclude<TABLE_NAMES, typeof TABLE_RESOURCES>;

// Define a type for our service that allows string indexing
type MastraService = Service<Record<string, any>> & {
  [key: string]: any;
};

// Define the structure for workflow snapshot items retrieved from DynamoDB
interface WorkflowSnapshotDBItem {
  entity: string; // Typically 'workflow_snapshot'
  workflow_name: string;
  run_id: string;
  snapshot: WorkflowRunState; // Should be WorkflowRunState after ElectroDB get attribute processing
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  resourceId?: string;
}

export class DynamoDBStore extends MastraStorage {
  private tableName: string;
  private client: DynamoDBDocumentClient;
  private service: MastraService;
  protected hasInitialized: Promise<boolean> | null = null;

  constructor({ name, config }: { name: string; config: DynamoDBStoreConfig }) {
    super({ name });

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

      const dynamoClient = new DynamoDBClient({
        region: config.region || 'us-east-1',
        endpoint: config.endpoint,
        credentials: config.credentials,
      });

      this.tableName = config.tableName;
      this.client = DynamoDBDocumentClient.from(dynamoClient);
      this.service = getElectroDbService(this.client, this.tableName) as MastraService;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_CONSTRUCTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }

    // We're using a single table design with ElectroDB,
    // so we don't need to create multiple tables
  }

  /**
   * This method is modified for DynamoDB with ElectroDB single-table design.
   * It assumes the table is created and managed externally via CDK/CloudFormation.
   *
   * This implementation only validates that the required table exists and is accessible.
   * No table creation is attempted - we simply check if we can access the table.
   */
  async createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, any> }): Promise<void> {
    this.logger.debug('Validating access to externally managed table', { tableName, physicalTable: this.tableName });

    // For single-table design, we just need to verify the table exists and is accessible
    try {
      const tableExists = await this.validateTableExists();

      if (!tableExists) {
        this.logger.error(
          `Table ${this.tableName} does not exist or is not accessible. It should be created via CDK/CloudFormation.`,
        );
        throw new Error(
          `Table ${this.tableName} does not exist or is not accessible. Ensure it's created via CDK/CloudFormation before using this store.`,
        );
      }

      this.logger.debug(`Table ${this.tableName} exists and is accessible`);
    } catch (error) {
      this.logger.error('Error validating table access', { tableName: this.tableName, error });
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_VALIDATE_TABLE_ACCESS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: this.tableName },
        },
        error,
      );
    }
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
          id: 'STORAGE_DYNAMODB_STORE_VALIDATE_TABLE_EXISTS_FAILED',
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
          id: 'STORAGE_DYNAMODB_STORE_INIT_FAILED',
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
   * Pre-processes a record to ensure Date objects are converted to ISO strings
   * This is necessary because ElectroDB validation happens before setters are applied
   */
  private preprocessRecord(record: Record<string, any>): Record<string, any> {
    const processed = { ...record };

    // Convert Date objects to ISO strings for date fields
    // This prevents ElectroDB validation errors that occur when Date objects are passed
    // to string-typed attributes, even when the attribute has a setter that converts dates
    if (processed.createdAt instanceof Date) {
      processed.createdAt = processed.createdAt.toISOString();
    }
    if (processed.updatedAt instanceof Date) {
      processed.updatedAt = processed.updatedAt.toISOString();
    }
    if (processed.created_at instanceof Date) {
      processed.created_at = processed.created_at.toISOString();
    }

    return processed;
  }

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // Nothing to do here, DynamoDB has a flexible schema and handles new attributes automatically upon insertion/update.
  }

  /**
   * Clear all items from a logical "table" (entity type)
   */
  async clearTable({ tableName }: { tableName: SUPPORTED_TABLE_NAMES }): Promise<void> {
    this.logger.debug('DynamoDB clearTable called', { tableName });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_CLEAR_TABLE_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    try {
      // Scan requires no key, just uses the entity handler
      const result = await this.service.entities[entityName].scan.go({ pages: 'all' }); // Get all pages

      if (!result.data.length) {
        this.logger.debug(`No records found to clear for ${tableName}`);
        return;
      }

      this.logger.debug(`Found ${result.data.length} records to delete for ${tableName}`);

      // ElectroDB batch delete expects the key components for each item
      const keysToDelete = result.data.map((item: any) => {
        const key: { entity: string; [key: string]: any } = { entity: entityName };

        // Construct the key based on the specific entity's primary key structure
        switch (entityName) {
          case 'thread':
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'thread'`);
            key.id = item.id;
            break;
          case 'message':
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'message'`);
            key.id = item.id;
            break;
          case 'workflowSnapshot':
            if (!item.workflow_name)
              throw new Error(`Missing required key 'workflow_name' for entity 'workflowSnapshot'`);
            if (!item.run_id) throw new Error(`Missing required key 'run_id' for entity 'workflowSnapshot'`);
            key.workflow_name = item.workflow_name;
            key.run_id = item.run_id;
            break;
          case 'eval':
            // Assuming 'eval' uses 'run_id' or another unique identifier as part of its PK
            // Adjust based on the actual primary key defined in getElectroDbService
            if (!item.run_id) throw new Error(`Missing required key 'run_id' for entity 'eval'`);
            // Add other key components if necessary for 'eval' PK
            key.run_id = item.run_id;
            // Example: if global_run_id is also part of PK:
            // if (!item.global_run_id) throw new Error(`Missing required key 'global_run_id' for entity 'eval'`);
            // key.global_run_id = item.global_run_id;
            break;
          case 'trace':
            // Assuming 'trace' uses 'id' as its PK
            // Adjust based on the actual primary key defined in getElectroDbService
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'trace'`);
            key.id = item.id;
            break;
          default:
            // Handle unknown entity types - log a warning or throw an error
            this.logger.warn(`Unknown entity type encountered during clearTable: ${entityName}`);
            // Optionally throw an error if strict handling is required
            throw new Error(`Cannot construct delete key for unknown entity type: ${entityName}`);
        }

        return key;
      });

      const batchSize = 25;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batchKeys = keysToDelete.slice(i, i + batchSize);
        // Pass the array of key objects to delete
        await this.service.entities[entityName].delete(batchKeys).go();
      }

      this.logger.debug(`Successfully cleared all records for ${tableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Insert a record into the specified "table" (entity)
   */
  async insert({
    tableName,
    record,
  }: {
    tableName: SUPPORTED_TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    this.logger.debug('DynamoDB insert called', { tableName });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_INSERT_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    try {
      // Add the entity type to the record and preprocess before creating
      const dataToSave = { entity: entityName, ...this.preprocessRecord(record) };
      await this.service.entities[entityName].create(dataToSave).go();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Insert multiple records as a batch
   */
  async batchInsert({
    tableName,
    records,
  }: {
    tableName: SUPPORTED_TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    this.logger.debug('DynamoDB batchInsert called', { tableName, count: records.length });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_BATCH_INSERT_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    // Add entity type and preprocess each record
    const recordsToSave = records.map(rec => ({ entity: entityName, ...this.preprocessRecord(rec) }));

    // ElectroDB has batch limits of 25 items, so we need to chunk
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < recordsToSave.length; i += batchSize) {
      const batch = recordsToSave.slice(i, i + batchSize);
      batches.push(batch);
    }

    try {
      // Process each batch
      for (const batch of batches) {
        // Create each item individually within the batch
        for (const recordData of batch) {
          if (!recordData.entity) {
            this.logger.error('Missing entity property in record data for batchInsert', { recordData, tableName });
            throw new Error(`Internal error: Missing entity property during batchInsert for ${tableName}`);
          }
          // Log the object just before the create call
          this.logger.debug('Attempting to create record in batchInsert:', { entityName, recordData });
          await this.service.entities[entityName].create(recordData).go();
        }
        // Original batch call: await this.service.entities[entityName].create(batch).go();
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Load a record by its keys
   */
  async load<R>({
    tableName,
    keys,
  }: {
    tableName: SUPPORTED_TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    this.logger.debug('DynamoDB load called', { tableName, keys });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_LOAD_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    try {
      // Add the entity type to the key object for the .get call
      const keyObject = { entity: entityName, ...keys };
      const result = await this.service.entities[entityName].get(keyObject).go();

      if (!result.data) {
        return null;
      }

      // Add parsing logic if necessary (e.g., for metadata)
      let data = result.data;
      if (data.metadata && typeof data.metadata === 'string') {
        try {
          // data.metadata = JSON.parse(data.metadata); // REMOVED by AI
        } catch {
          /* ignore parse error */
        }
      }
      // Add similar parsing for other JSON fields if needed based on entity type

      return data as R;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  // Thread operations
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    this.logger.debug('Getting thread by ID', { threadId });
    try {
      const result = await this.service.entities.thread.get({ entity: 'thread', id: threadId }).go();

      if (!result.data) {
        return null;
      }

      // ElectroDB handles the transformation with attribute getters
      const data = result.data;
      return {
        ...data,
        // Convert date strings back to Date objects for consistency
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
        // metadata: data.metadata ? JSON.parse(data.metadata) : undefined, // REMOVED by AI
        // metadata is already transformed by the entity's getter
      } as StorageThreadType;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    this.logger.debug('Getting threads by resource ID', { resourceId });
    try {
      const result = await this.service.entities.thread.query.byResource({ entity: 'thread', resourceId }).go();

      if (!result.data.length) {
        return [];
      }

      // ElectroDB handles the transformation with attribute getters
      return result.data.map((data: any) => ({
        ...data,
        // Convert date strings back to Date objects for consistency
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
        // metadata: data.metadata ? JSON.parse(data.metadata) : undefined, // REMOVED by AI
        // metadata is already transformed by the entity's getter
      })) as StorageThreadType[];
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.logger.debug('Saving thread', { threadId: thread.id });

    const now = new Date();

    const threadData = {
      entity: 'thread',
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title || `Thread ${thread.id}`,
      createdAt: thread.createdAt?.toISOString() || now.toISOString(),
      updatedAt: now.toISOString(),
      metadata: thread.metadata ? JSON.stringify(thread.metadata) : undefined,
    };

    try {
      await this.service.entities.thread.create(threadData).go();

      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: threadData.title,
        createdAt: thread.createdAt || now,
        updatedAt: now,
        metadata: thread.metadata,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: thread.id },
        },
        error,
      );
    }
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    this.logger.debug('Updating thread', { threadId: id });

    try {
      // First, get the existing thread to merge with updates
      const existingThread = await this.getThreadById({ threadId: id });

      if (!existingThread) {
        throw new Error(`Thread not found: ${id}`);
      }

      const now = new Date();

      // Prepare the update
      // Define type for only the fields we are actually updating
      type ThreadUpdatePayload = {
        updatedAt: string; // ISO String for DDB
        title?: string;
        metadata?: string; // Stringified JSON for DDB
      };
      const updateData: ThreadUpdatePayload = {
        updatedAt: now.toISOString(),
      };

      if (title) {
        updateData.title = title;
      }

      if (metadata) {
        updateData.metadata = JSON.stringify(metadata); // Stringify metadata for update
      }

      // Update the thread using the primary key
      await this.service.entities.thread.update({ entity: 'thread', id }).set(updateData).go();

      // Return the potentially updated thread object
      return {
        ...existingThread,
        title: title || existingThread.title,
        metadata: metadata || existingThread.metadata,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    this.logger.debug('Deleting thread', { threadId });

    try {
      // Delete the thread using the primary key
      await this.service.entities.thread.delete({ entity: 'thread', id: threadId }).go();

      // Note: In a production system, you might want to:
      // 1. Delete all messages associated with this thread
      // 2. Delete any vector embeddings related to this thread
      // These would be additional operations
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  // Message operations
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    this.logger.debug('Getting messages', { threadId, selectBy });

    try {
      // Query messages by thread ID using the GSI
      // Provide *all* composite key components for the 'byThread' index ('entity', 'threadId')
      const query = this.service.entities.message.query.byThread({ entity: 'message', threadId });

      const limit = this.resolveMessageLimit({ last: selectBy?.last, defaultLimit: Number.MAX_SAFE_INTEGER });
      // Apply the 'last' limit if provided
      if (limit !== Number.MAX_SAFE_INTEGER) {
        // Use ElectroDB's limit parameter
        // DDB GSIs are sorted in ascending order
        // Use ElectroDB's order parameter to sort in descending order to retrieve 'latest' messages
        const results = await query.go({ limit, order: 'desc' });
        // Use arrow function in map to preserve 'this' context for parseMessageData
        const list = new MessageList({ threadId, resourceId }).add(
          results.data.map((data: any) => this.parseMessageData(data)),
          'memory',
        );
        if (format === `v2`) return list.get.all.v2();
        return list.get.all.v1();
      }

      // If no limit specified, get all messages (potentially paginated by ElectroDB)
      // Consider adding default limit or handling pagination if needed
      const results = await query.go();
      const list = new MessageList({ threadId, resourceId }).add(
        results.data.map((data: any) => this.parseMessageData(data)),
        'memory',
      );
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    this.logger.debug('Saving messages', { count: messages.length });

    if (!messages.length) {
      return [];
    }

    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    // Ensure 'entity' is added and complex fields are handled
    const messagesToSave = messages.map(msg => {
      const now = new Date().toISOString();
      return {
        entity: 'message', // Add entity type
        id: msg.id,
        threadId: msg.threadId,
        role: msg.role,
        type: msg.type,
        resourceId: msg.resourceId,
        // Ensure complex fields are stringified if not handled by attribute setters
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        toolCallArgs: `toolCallArgs` in msg && msg.toolCallArgs ? JSON.stringify(msg.toolCallArgs) : undefined,
        toolCallIds: `toolCallIds` in msg && msg.toolCallIds ? JSON.stringify(msg.toolCallIds) : undefined,
        toolNames: `toolNames` in msg && msg.toolNames ? JSON.stringify(msg.toolNames) : undefined,
        createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt || now,
        updatedAt: now, // Add updatedAt
      };
    });

    try {
      // Process messages in batch
      const batchSize = 25; // DynamoDB batch limits
      const batches = [];

      for (let i = 0; i < messagesToSave.length; i += batchSize) {
        const batch = messagesToSave.slice(i, i + batchSize);
        batches.push(batch);
      }

      // Process each batch and update thread's updatedAt in parallel for better performance
      await Promise.all([
        // Process message batches
        ...batches.map(async batch => {
          for (const messageData of batch) {
            // Ensure each item has the entity property before sending
            if (!messageData.entity) {
              this.logger.error('Missing entity property in message data for create', { messageData });
              throw new Error('Internal error: Missing entity property during saveMessages');
            }
            await this.service.entities.message.put(messageData).go();
          }
        }),
        // Update thread's updatedAt timestamp
        this.service.entities.thread
          .update({ entity: 'thread', id: threadId })
          .set({
            updatedAt: new Date().toISOString(),
          })
          .go(),
      ]);

      const list = new MessageList().add(messages, 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
        },
        error,
      );
    }
  }

  // Helper function to parse message data (handle JSON fields)
  private parseMessageData(data: any): MastraMessageV2 | MastraMessageV1 {
    // Removed try/catch and JSON.parse logic - now handled by entity 'get' attributes
    // This function now primarily ensures correct typing and Date conversion.
    return {
      ...data,
      // Ensure dates are Date objects if needed (ElectroDB might return strings)
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      // Other fields like content, toolCallArgs etc. are assumed to be correctly
      // transformed by the ElectroDB entity getters.
    };
  }

  // Trace operations
  async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
  }): Promise<any[]> {
    const { name, scope, page, perPage } = args;
    this.logger.debug('Getting traces', { name, scope, page, perPage });

    try {
      let query;

      // Determine which index to use based on the provided filters
      // Provide *all* composite key components for the relevant index
      if (name) {
        query = this.service.entities.trace.query.byName({ entity: 'trace', name });
      } else if (scope) {
        query = this.service.entities.trace.query.byScope({ entity: 'trace', scope });
      } else {
        this.logger.warn('Performing a scan operation on traces - consider using a more specific query');
        query = this.service.entities.trace.scan;
      }

      let items: any[] = [];
      let cursor = null;
      let pagesFetched = 0;
      const startPage = page > 0 ? page : 1;

      do {
        const results: { data: any[]; cursor: string | null } = await query.go({ cursor, limit: perPage });
        pagesFetched++;
        if (pagesFetched === startPage) {
          items = results.data;
          break;
        }
        cursor = results.cursor;
        if (!cursor && results.data.length > 0 && pagesFetched < startPage) {
          break;
        }
      } while (cursor && pagesFetched < startPage);

      return items;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('Batch inserting traces', { count: records.length });

    if (!records.length) {
      return;
    }

    try {
      // Add 'entity' type to each record before passing to generic batchInsert
      const recordsToSave = records.map(rec => ({ entity: 'trace', ...rec }));
      await this.batchInsert({
        tableName: TABLE_TRACES,
        records: recordsToSave, // Pass records with 'entity' included
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_BATCH_TRACE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: records.length },
        },
        error,
      );
    }
  }

  // Workflow operations
  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    this.logger.debug('Persisting workflow snapshot', { workflowName, runId });

    try {
      const resourceId = 'resourceId' in snapshot ? snapshot.resourceId : undefined;
      const now = new Date().toISOString();
      // Prepare data including the 'entity' type
      const data = {
        entity: 'workflow_snapshot', // Add entity type
        workflow_name: workflowName,
        run_id: runId,
        snapshot: JSON.stringify(snapshot), // Stringify the snapshot object
        createdAt: now,
        updatedAt: now,
        resourceId,
      };
      // Use upsert instead of create to handle both create and update cases
      await this.service.entities.workflowSnapshot.upsert(data).go();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });

    try {
      // Provide *all* composite key components for the primary index ('entity', 'workflow_name', 'run_id')
      const result = await this.service.entities.workflowSnapshot
        .get({
          entity: 'workflow_snapshot', // Add entity type
          workflow_name: workflowName,
          run_id: runId,
        })
        .go();

      if (!result.data?.snapshot) {
        // Check snapshot exists
        return null;
      }

      // Parse the snapshot string
      return result.data.snapshot as WorkflowRunState;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns> {
    this.logger.debug('Getting workflow runs', { args });

    try {
      // Default values
      const limit = args?.limit || 10;
      const offset = args?.offset || 0;

      let query;

      if (args?.workflowName) {
        // Query by workflow name using the primary index
        // Provide *all* composite key components for the PK ('entity', 'workflow_name')
        query = this.service.entities.workflowSnapshot.query.primary({
          entity: 'workflow_snapshot', // Add entity type
          workflow_name: args.workflowName,
        });
      } else {
        // If no workflow name, we need to scan
        // This is not ideal for production with large datasets
        this.logger.warn('Performing a scan operation on workflow snapshots - consider using a more specific query');
        query = this.service.entities.workflowSnapshot.scan; // Scan still uses the service entity
      }

      const allMatchingSnapshots: WorkflowSnapshotDBItem[] = [];
      let cursor: string | null = null;
      const DYNAMODB_PAGE_SIZE = 100; // Sensible page size for fetching

      do {
        const pageResults: { data: WorkflowSnapshotDBItem[]; cursor: string | null } = await query.go({
          limit: DYNAMODB_PAGE_SIZE,
          cursor,
        });

        if (pageResults.data && pageResults.data.length > 0) {
          let pageFilteredData: WorkflowSnapshotDBItem[] = pageResults.data;

          // Apply date filters if specified
          if (args?.fromDate || args?.toDate) {
            pageFilteredData = pageFilteredData.filter((snapshot: WorkflowSnapshotDBItem) => {
              const createdAt = new Date(snapshot.createdAt);
              if (args.fromDate && createdAt < args.fromDate) {
                return false;
              }
              if (args.toDate && createdAt > args.toDate) {
                return false;
              }
              return true;
            });
          }

          // Filter by resourceId if specified
          if (args?.resourceId) {
            pageFilteredData = pageFilteredData.filter((snapshot: WorkflowSnapshotDBItem) => {
              return snapshot.resourceId === args.resourceId;
            });
          }
          allMatchingSnapshots.push(...pageFilteredData);
        }

        cursor = pageResults.cursor;
      } while (cursor);

      if (!allMatchingSnapshots.length) {
        return { runs: [], total: 0 };
      }

      // Apply offset and limit to the accumulated filtered results
      const total = allMatchingSnapshots.length;
      const paginatedData = allMatchingSnapshots.slice(offset, offset + limit);

      // Format and return the results
      const runs = paginatedData.map((snapshot: WorkflowSnapshotDBItem) => this.formatWorkflowRun(snapshot));

      return {
        runs,
        total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: args?.workflowName || '', resourceId: args?.resourceId || '' },
        },
        error,
      );
    }
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    const { runId, workflowName } = args;
    this.logger.debug('Getting workflow run by ID', { runId, workflowName });

    try {
      // If we have a workflowName, we can do a direct get using the primary key
      if (workflowName) {
        this.logger.debug('WorkflowName provided, using direct GET operation.');
        const result = await this.service.entities.workflowSnapshot
          .get({
            entity: 'workflow_snapshot', // Entity type for PK
            workflow_name: workflowName,
            run_id: runId,
          })
          .go();

        if (!result.data) {
          return null;
        }

        const snapshot = result.data.snapshot;
        return {
          workflowName: result.data.workflow_name,
          runId: result.data.run_id,
          snapshot,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          resourceId: result.data.resourceId,
        };
      }

      // Otherwise, if workflowName is not provided, use the GSI on runId.
      // This is more efficient than a full table scan.
      this.logger.debug(
        'WorkflowName not provided. Attempting to find workflow run by runId using GSI. Ensure GSI (e.g., "byRunId") is defined on the workflowSnapshot entity with run_id as its key and provisioned in DynamoDB.',
      );

      // IMPORTANT: This assumes a GSI (e.g., named 'byRunId') exists on the workflowSnapshot entity
      // with 'run_id' as its partition key. This GSI must be:
      // 1. Defined in your ElectroDB model (e.g., in stores/dynamodb/src/entities/index.ts).
      // 2. Provisioned in the actual DynamoDB table (e.g., via CDK/CloudFormation).
      // The query key object includes 'entity' as it's good practice with ElectroDB and single-table design,
      // aligning with how other GSIs are queried in this file.
      const result = await this.service.entities.workflowSnapshot.query
        .gsi2({ entity: 'workflow_snapshot', run_id: runId }) // Replace 'byRunId' with your actual GSI name
        .go();

      // If the GSI query returns multiple items (e.g., if run_id is not globally unique across all snapshots),
      // this will take the first one. The original scan logic also effectively took the first match found.
      // If run_id is guaranteed unique, result.data should contain at most one item.
      const matchingRunDbItem: WorkflowSnapshotDBItem | null =
        result.data && result.data.length > 0 ? result.data[0] : null;

      if (!matchingRunDbItem) {
        return null;
      }

      const snapshot = matchingRunDbItem.snapshot;
      return {
        workflowName: matchingRunDbItem.workflow_name,
        runId: matchingRunDbItem.run_id,
        snapshot,
        createdAt: new Date(matchingRunDbItem.createdAt),
        updatedAt: new Date(matchingRunDbItem.updatedAt),
        resourceId: matchingRunDbItem.resourceId,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName: args?.workflowName || '' },
        },
        error,
      );
    }
  }

  // Helper function to format workflow run
  private formatWorkflowRun(snapshotData: WorkflowSnapshotDBItem): WorkflowRun {
    return {
      workflowName: snapshotData.workflow_name,
      runId: snapshotData.run_id,
      snapshot: snapshotData.snapshot as WorkflowRunState,
      createdAt: new Date(snapshotData.createdAt),
      updatedAt: new Date(snapshotData.updatedAt),
      resourceId: snapshotData.resourceId,
    };
  }

  // Helper methods for entity/table mapping
  private getEntityNameForTable(tableName: SUPPORTED_TABLE_NAMES): string | null {
    const mapping: Record<SUPPORTED_TABLE_NAMES, string> = {
      [TABLE_THREADS]: 'thread',
      [TABLE_MESSAGES]: 'message',
      [TABLE_WORKFLOW_SNAPSHOT]: 'workflowSnapshot',
      [TABLE_EVALS]: 'eval',
      [TABLE_TRACES]: 'trace',
    };
    return mapping[tableName] || null;
  }

  // Eval operations
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    this.logger.debug('Getting evals for agent', { agentName, type });

    try {
      // Query evals by agent name using the GSI
      // Provide *all* composite key components for the 'byAgent' index ('entity', 'agent_name')
      const query = this.service.entities.eval.query.byAgent({ entity: 'eval', agent_name: agentName });

      // Fetch potentially all items in descending order, using the correct 'order' option
      const results = await query.go({ order: 'desc', limit: 100 }); // Use order: 'desc'

      if (!results.data.length) {
        return [];
      }

      // Filter by type if specified
      let filteredData = results.data;
      if (type) {
        filteredData = filteredData.filter((evalRecord: Record<string, any>) => {
          try {
            // Need to handle potential parse errors for test_info
            const testInfo =
              evalRecord.test_info && typeof evalRecord.test_info === 'string'
                ? JSON.parse(evalRecord.test_info)
                : undefined;

            if (type === 'test' && !testInfo) {
              return false;
            }
            if (type === 'live' && testInfo) {
              return false;
            }
          } catch (e) {
            this.logger.warn('Failed to parse test_info during filtering', { record: evalRecord, error: e });
            // Decide how to handle parse errors - exclude or include? Including for now.
          }
          return true;
        });
      }

      // Format the results - ElectroDB transforms most attributes, but we need to map/parse
      return filteredData.map((evalRecord: Record<string, any>) => {
        try {
          return {
            input: evalRecord.input,
            output: evalRecord.output,
            // Safely parse result and test_info
            result:
              evalRecord.result && typeof evalRecord.result === 'string' ? JSON.parse(evalRecord.result) : undefined,
            agentName: evalRecord.agent_name,
            createdAt: evalRecord.created_at, // Keep as string from DDB?
            metricName: evalRecord.metric_name,
            instructions: evalRecord.instructions,
            runId: evalRecord.run_id,
            globalRunId: evalRecord.global_run_id,
            testInfo:
              evalRecord.test_info && typeof evalRecord.test_info === 'string'
                ? JSON.parse(evalRecord.test_info)
                : undefined,
          } as EvalRow;
        } catch (parseError) {
          this.logger.error('Failed to parse eval record', { record: evalRecord, error: parseError });
          // Return a partial record or null/undefined on error?
          // Returning partial for now, might need adjustment based on requirements.
          return {
            agentName: evalRecord.agent_name,
            createdAt: evalRecord.created_at,
            runId: evalRecord.run_id,
            globalRunId: evalRecord.global_run_id,
          } as Partial<EvalRow> as EvalRow; // Cast needed for return type
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
    }
  }

  async getTracesPaginated(_args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    throw new MastraError(
      {
        id: 'STORAGE_DYNAMODB_STORE_GET_TRACES_PAGINATED_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
      },
      new Error('Method not implemented.'),
    );
  }

  async getThreadsByResourceIdPaginated(_args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    throw new MastraError(
      {
        id: 'STORAGE_DYNAMODB_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
      },
      new Error('Method not implemented.'),
    );
  }

  async getMessagesPaginated(
    _args: StorageGetMessagesArg,
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    throw new MastraError(
      {
        id: 'STORAGE_DYNAMODB_STORE_GET_MESSAGES_PAGINATED_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
      },
      new Error('Method not implemented.'),
    );
  }

  /**
   * Closes the DynamoDB client connection and cleans up resources.
   * Should be called when the store is no longer needed, e.g., at the end of tests or application shutdown.
   */
  public async close(): Promise<void> {
    this.logger.debug('Closing DynamoDB client for store:', { name: this.name });
    try {
      this.client.destroy();
      this.logger.debug('DynamoDB client closed successfully for store:', { name: this.name });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_CLOSE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateMessages(_args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    this.logger.error('updateMessages is not yet implemented in DynamoDBStore');
    throw new Error('Method not implemented');
  }
}
