import {
  MastraStorage,
  TABLE_NAMES,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import { type StorageThreadType, type MessageType, type WorkflowRunState } from '@mastra/core';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Service } from 'electrodb';
import { getElectroDbService } from '../entities';
import type { EvalRow, StorageGetMessagesArg, WorkflowRun, WorkflowRuns } from '@mastra/core/storage';

interface DynamoDBStoreConfig {
  region?: string;
  tableName: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

// Define a type for our service that allows string indexing
type MastraService = Service<Record<string, any>> & {
  [key: string]: any;
};

export class DynamoDBStore extends MastraStorage {
  private tableName: string;
  private client: DynamoDBDocumentClient;
  private service: MastraService;

  constructor({ name, config }: { name: string; config: DynamoDBStoreConfig }) {
    super({ name });

    // Validate required config
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

    // We're using a single table design with ElectroDB,
    // so we don't need to create multiple tables
    this.shouldCacheInit = false;
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
      throw error;
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
      throw error;
    }
  }

  /**
   * Initialize storage, validating the externally managed table is accessible.
   * For the single-table design, we only validate once that we can access
   * the table that was created via CDK/CloudFormation.
   */
  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (this.shouldCacheInit && (await this.hasInitialized)) {
      return;
    }

    // For single-table design, we only need to verify the table exists once
    this.hasInitialized = this.validateTableExists().then(exists => {
      if (!exists) {
        throw new Error(
          `Table ${this.tableName} does not exist or is not accessible. Ensure it's created via CDK/CloudFormation before using this store.`,
        );
      }
      return true;
    });

    await this.hasInitialized;
  }

  /**
   * Clear all items from a logical "table" (entity type)
   */
  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.logger.debug('DynamoDB clearTable called', { tableName });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new Error(`No entity defined for ${tableName}`);
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
        // Construct the key based on the entity's primary index
        // This assumes primary keys are defined using 'id' or 'run_id' etc.
        // This part might need adjustment based on actual PK structure of each entity
        const key: any = { entity: entityName };
        if (item.id) key.id = item.id;
        if (item.run_id) key.run_id = item.run_id;
        if (item.workflow_name) key.workflow_name = item.workflow_name; // For workflow snapshot
        // Add other potential key components if needed
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
      this.logger.error('Failed to clear table', { tableName, error });
      throw error;
    }
  }

  /**
   * Insert a record into the specified "table" (entity)
   */
  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    this.logger.debug('DynamoDB insert called', { tableName });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new Error(`No entity defined for ${tableName}`);
    }

    try {
      // Add the entity type to the record before creating
      const dataToSave = { entity: entityName, ...record };
      await this.service.entities[entityName].create(dataToSave).go();
    } catch (error) {
      this.logger.error('Failed to insert record', { tableName, error });
      throw error;
    }
  }

  /**
   * Insert multiple records as a batch
   */
  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('DynamoDB batchInsert called', { tableName, count: records.length });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new Error(`No entity defined for ${tableName}`);
    }

    // Add entity type to each record
    const recordsToSave = records.map(rec => ({ entity: entityName, ...rec }));

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
      this.logger.error('Failed to batch insert records', { tableName, error });
      throw error;
    }
  }

  /**
   * Load a record by its keys
   */
  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.debug('DynamoDB load called', { tableName, keys });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new Error(`No entity defined for ${tableName}`);
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
          data.metadata = JSON.parse(data.metadata);
        } catch (e) {
          /* ignore parse error */
        }
      }
      // Add similar parsing for other JSON fields if needed based on entity type

      return data as R;
    } catch (error) {
      this.logger.error('Failed to load record', { tableName, keys, error });
      throw error;
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
        metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
      } as StorageThreadType;
    } catch (error) {
      this.logger.error('Failed to get thread by ID', { threadId, error });
      throw error;
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
        metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
      })) as StorageThreadType[];
    } catch (error) {
      this.logger.error('Failed to get threads by resource ID', { resourceId, error });
      throw error;
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
      this.logger.error('Failed to save thread', { threadId: thread.id, error });
      throw error;
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
      this.logger.error('Failed to update thread', { threadId: id, error });
      throw error;
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
      this.logger.error('Failed to delete thread', { threadId, error });
      throw error;
    }
  }

  // Message operations
  async getMessages(args: StorageGetMessagesArg): Promise<MessageType[]> {
    const { threadId, selectBy } = args;
    this.logger.debug('Getting messages', { threadId, selectBy });

    try {
      // Query messages by thread ID using the GSI
      // Provide *all* composite key components for the 'byThread' index ('entity', 'threadId')
      const query = this.service.entities.message.query.byThread({ entity: 'message', threadId });

      // Apply the 'last' limit if provided
      if (selectBy?.last && typeof selectBy.last === 'number') {
        // Use ElectroDB's limit parameter (descending sort assumed on GSI SK)
        // Ensure GSI sk (createdAt) is sorted descending for 'last' to work correctly
        // Assuming default sort is ascending on SK, use reverse: true for descending
        const results = await query.go({ limit: selectBy.last, reverse: true });
        // Use arrow function in map to preserve 'this' context for parseMessageData
        return results.data.map((data: any) => this.parseMessageData(data)) as MessageType[];
      }

      // If no limit specified, get all messages (potentially paginated by ElectroDB)
      // Consider adding default limit or handling pagination if needed
      const results = await query.go();
      // Use arrow function in map to preserve 'this' context for parseMessageData
      return results.data.map((data: any) => this.parseMessageData(data)) as MessageType[];
    } catch (error) {
      this.logger.error('Failed to get messages', { threadId, error });
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    this.logger.debug('Saving messages', { count: messages.length });

    if (!messages.length) {
      return [];
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
        toolCallArgs: msg.toolCallArgs ? JSON.stringify(msg.toolCallArgs) : undefined,
        toolCallIds: msg.toolCallIds ? JSON.stringify(msg.toolCallIds) : undefined,
        toolNames: msg.toolNames ? JSON.stringify(msg.toolNames) : undefined,
        createdAt: msg.createdAt?.toISOString() || now,
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

      // Process each batch
      for (const batch of batches) {
        // Try creating each item individually instead of passing the whole batch
        for (const messageData of batch) {
          // Ensure each item has the entity property before sending
          if (!messageData.entity) {
            this.logger.error('Missing entity property in message data for create', { messageData });
            throw new Error('Internal error: Missing entity property during saveMessages');
          }
          await this.service.entities.message.create(messageData).go();
        }
        // Original batch call: await this.service.entities.message.create(batch).go();
      }

      return messages; // Return original message objects
    } catch (error) {
      this.logger.error('Failed to save messages', { error });
      throw error;
    }
  }

  // Helper function to parse message data (handle JSON fields)
  private parseMessageData(data: any): MessageType {
    // Removed try/catch and JSON.parse logic - now handled by entity 'get' attributes
    // This function now primarily ensures correct typing and Date conversion.
    return {
      ...data,
      // Ensure dates are Date objects if needed (ElectroDB might return strings)
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      // Other fields like content, toolCallArgs etc. are assumed to be correctly
      // transformed by the ElectroDB entity getters.
    } as MessageType; // Add explicit type assertion
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
      this.logger.error('Failed to get traces', { error });
      throw error;
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
      this.logger.error('Failed to batch insert traces', { error });
      throw error;
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
      // Pass the data including 'entity'
      await this.service.entities.workflowSnapshot.create(data).go();
    } catch (error) {
      this.logger.error('Failed to persist workflow snapshot', { workflowName, runId, error });
      throw error;
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
      return JSON.parse(result.data.snapshot) as WorkflowRunState;
    } catch (error) {
      this.logger.error('Failed to load workflow snapshot', { workflowName, runId, error });
      throw error;
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

      // For workflow runs, we typically want all results for post-filtering
      // Using pages: "all" is simpler when we need to apply complex filters
      const results = await query.go({ pages: 'all' });

      if (!results.data.length) {
        return { runs: [], total: 0 };
      }

      // Apply filters to the full result set
      let filteredData = results.data;

      // Apply date filters if specified
      if (args?.fromDate || args?.toDate) {
        filteredData = filteredData.filter((snapshot: Record<string, any>) => {
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
        filteredData = filteredData.filter((snapshot: Record<string, any>) => {
          return snapshot.resourceId === args.resourceId;
        });
      }

      // Apply offset and limit to the filtered results
      const paginatedData = filteredData.slice(offset, offset + limit);

      // Format and return the results
      const runs = paginatedData.map((snapshot: Record<string, any>) => this.formatWorkflowRun(snapshot));

      return {
        runs,
        total: filteredData.length,
      };
    } catch (error) {
      this.logger.error('Failed to get workflow runs', { error });
      throw error;
    }
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    const { runId, workflowName } = args;
    this.logger.debug('Getting workflow run by ID', { runId, workflowName });

    try {
      // If we have a workflowName, we can do a direct get
      if (workflowName) {
        // Use .get which requires all PK components
        const result = await this.service.entities.workflowSnapshot
          .get({
            entity: 'workflow_snapshot', // Add entity type
            workflow_name: workflowName,
            run_id: runId,
          })
          .go();

        if (!result.data) {
          return null;
        }

        // ElectroDB handles the transformation with attribute getters
        const snapshot = JSON.parse(result.data.snapshot);

        return {
          workflowName: result.data.workflow_name,
          runId: result.data.run_id,
          snapshot,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          resourceId: result.data.resourceId,
        };
      }

      // Otherwise, we need to scan and filter
      // This is not efficient for production with large datasets
      this.logger.warn(
        'Performing a scan operation to find workflow run - consider providing workflowName for efficiency',
      );

      const query = this.service.entities.workflowSnapshot.scan;
      const result = await query.go();

      if (!result.data.length) {
        return null;
      }

      // Find the matching run
      const matchingRun = result.data.find((snapshot: Record<string, any>) => snapshot.run_id === runId);

      if (!matchingRun) {
        return null;
      }

      // ElectroDB handles the transformation with attribute getters
      const snapshot = JSON.parse(matchingRun.snapshot);

      return {
        workflowName: matchingRun.workflow_name,
        runId: matchingRun.run_id,
        snapshot,
        createdAt: new Date(matchingRun.createdAt),
        updatedAt: new Date(matchingRun.updatedAt),
        resourceId: matchingRun.resourceId,
      };
    } catch (error) {
      this.logger.error('Failed to get workflow run by ID', { runId, workflowName, error });
      throw error;
    }
  }

  // Helper function to format workflow run
  private formatWorkflowRun(snapshotData: Record<string, any>): WorkflowRun {
    return {
      workflowName: snapshotData.workflow_name,
      runId: snapshotData.run_id,
      snapshot: typeof snapshotData.snapshot === 'string' ? JSON.parse(snapshotData.snapshot) : snapshotData.snapshot,
      createdAt: new Date(snapshotData.createdAt),
      updatedAt: new Date(snapshotData.updatedAt),
      resourceId: snapshotData.resourceId,
    };
  }

  // Helper methods for entity/table mapping
  private getEntityNameForTable(tableName: TABLE_NAMES): string | null {
    const mapping: Record<TABLE_NAMES, string> = {
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
      this.logger.error('Failed to get evals by agent name', { agentName, type, error });
      throw error;
    }
  }
}
