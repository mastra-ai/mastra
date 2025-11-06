import { connect } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions } from '@lancedb/lancedb';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MastraStorage } from '@mastra/core/storage';
import type {
  TABLE_NAMES,
  PaginationInfo,
  StorageColumn,
  WorkflowRuns,
  StoragePagination,
  StorageDomains,
  StorageResourceType,
  StorageListWorkflowRunsInput,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { StoreMemoryLance } from './domains/memory';
import { StoreOperationsLance } from './domains/operations';
import { StoreScoresLance } from './domains/scores';
import { StoreWorkflowsLance } from './domains/workflows';

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
      const operations = new StoreOperationsLance({ client: instance.lanceClient });
      instance.stores = {
        operations: new StoreOperationsLance({ client: instance.lanceClient }),
        workflows: new StoreWorkflowsLance({ client: instance.lanceClient }),
        scores: new StoreScoresLance({ client: instance.lanceClient }),
        memory: new StoreMemoryLance({ client: instance.lanceClient, operations }),
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
    const operations = new StoreOperationsLance({ client: this.lanceClient });

    this.stores = {
      operations: new StoreOperationsLance({ client: this.lanceClient }),
      workflows: new StoreWorkflowsLance({ client: this.lanceClient }),
      scores: new StoreScoresLance({ client: this.lanceClient }),
      memory: new StoreMemoryLance({ client: this.lanceClient, operations }),
    };
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    return this.stores.operations.createTable({ tableName, schema });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.dropTable({ tableName });
  }

  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    return this.stores.operations.alterTable({ tableName, schema, ifNotExists });
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.clearTable({ tableName });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.stores.operations.insert({ tableName, record });
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return this.stores.operations.batchInsert({ tableName, records });
  }

  async load({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<any> {
    return this.stores.operations.load({ tableName, keys });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.stores.memory.getThreadById({ threadId });
  }

  /**
   * Saves a thread to the database. This function doesn't overwrite existing threads.
   * @param thread - The thread to save
   * @returns The saved thread
   */
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return this.stores.memory.saveThread({ thread });
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
    return this.stores.memory.updateThread({ id, title, metadata });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    return this.stores.memory.deleteThread({ threadId });
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: false,
      listScoresBySpan: true,
    };
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    return this.stores.memory.getResourceById({ resourceId });
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    return this.stores.memory.saveResource({ resource });
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    return this.stores.memory.updateResource({ resourceId, workingMemory, metadata });
  }

  /**
   * Processes messages to include context messages based on withPreviousMessages and withNextMessages
   * @param records - The sorted array of records to process
   * @param include - The array of include specifications with context parameters
   * @returns The processed array with context messages included
   */
  private processMessagesWithContext(
    records: any[],
    include: { id: string; withPreviousMessages?: number; withNextMessages?: number }[],
  ): any[] {
    const messagesWithContext = include.filter(item => item.withPreviousMessages || item.withNextMessages);

    if (messagesWithContext.length === 0) {
      return records;
    }

    // Create a map of message id to index in the sorted array for quick lookup
    const messageIndexMap = new Map<string, number>();
    records.forEach((message, index) => {
      messageIndexMap.set(message.id, index);
    });

    // Keep track of additional indices to include
    const additionalIndices = new Set<number>();

    for (const item of messagesWithContext) {
      const messageIndex = messageIndexMap.get(item.id);

      if (messageIndex !== undefined) {
        // Add previous messages if requested
        if (item.withPreviousMessages) {
          const startIdx = Math.max(0, messageIndex - item.withPreviousMessages);
          for (let i = startIdx; i < messageIndex; i++) {
            additionalIndices.add(i);
          }
        }

        // Add next messages if requested
        if (item.withNextMessages) {
          const endIdx = Math.min(records.length - 1, messageIndex + item.withNextMessages);
          for (let i = messageIndex + 1; i <= endIdx; i++) {
            additionalIndices.add(i);
          }
        }
      }
    }

    // If we need to include additional messages, create a new set of records
    if (additionalIndices.size === 0) {
      return records;
    }

    // Get IDs of the records that matched the original query
    const originalMatchIds = new Set(include.map(item => item.id));

    // Create a set of all indices we need to include
    const allIndices = new Set<number>();

    // Add indices of originally matched messages
    records.forEach((record, index) => {
      if (originalMatchIds.has(record.id)) {
        allIndices.add(index);
      }
    });

    // Add the additional context message indices
    additionalIndices.forEach(index => {
      allIndices.add(index);
    });

    // Create a new filtered array with only the required messages
    // while maintaining chronological order
    return Array.from(allIndices)
      .sort((a, b) => a - b)
      .map(index => records[index]);
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.listMessagesById({ messageIds });
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages(_args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(_args);
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns(args);
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<{
    workflowName: string;
    runId: string;
    snapshot: any;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return this.stores.workflows.getWorkflowRunById(args);
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.stores.workflows.updateWorkflowResults({ workflowName, runId, stepId, result, requestContext });
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined> {
    return this.stores.workflows.updateWorkflowState({ workflowName, runId, opts });
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    return this.stores.workflows.persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.loadWorkflowSnapshot({ workflowName, runId });
  }

  async getScoreById({ id: _id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id: _id });
  }

  async listScoresByScorerId({
    scorerId,
    source,
    entityId,
    entityType,
    pagination,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    source?: ScoringSource;
    entityId?: string;
    entityType?: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByScorerId({ scorerId, source, pagination, entityId, entityType });
  }

  async saveScore(_score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(_score);
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByRunId({ runId, pagination });
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByEntityId({ entityId, entityType, pagination });
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresBySpan({ traceId, spanId, pagination });
  }
}
