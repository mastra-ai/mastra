import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  PaginationInfo,
  StorageDomains,
  StoragePagination,
  StorageResourceType,
  WorkflowRun,
  WorkflowRuns,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  UpdateSpanRecord,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { MongoDBConnector } from './connectors/MongoDBConnector';
import { resolveMongoDBConfig } from './db';
import { MongoDBAgentsStorage } from './domains/agents';
import { MemoryStorageMongoDB } from './domains/memory';
import { ObservabilityMongoDB } from './domains/observability';
import { ScoresStorageMongoDB } from './domains/scores';
import { WorkflowsStorageMongoDB } from './domains/workflows';
import type { MongoDBConfig } from './types';

export class MongoDBStore extends MastraStorage {
  #connector: MongoDBConnector;

  stores: StorageDomains;

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    listScoresBySpan: boolean;
    agents: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      listScoresBySpan: true,
      agents: true,
    };
  }

  constructor(config: MongoDBConfig) {
    super({ id: config.id, name: 'MongoDBStore', disableInit: config.disableInit });

    this.stores = {} as StorageDomains;

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

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.stores.memory.getThreadById({ threadId });
  }

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

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns(args);
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
    opts: UpdateWorkflowStateOptions;
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

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowName });
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    return this.stores.workflows.deleteWorkflowRunById({ runId, workflowName });
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
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  /**
   * SCORERS
   */
  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
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

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByScorerId({ scorerId, pagination, entityId, entityType, source });
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

  /**
   * RESOURCES
   */
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
    return this.stores.memory.updateResource({
      resourceId,
      workingMemory,
      metadata,
    });
  }

  /**
   * Tracing/Observability
   */
  async createSpan(span: CreateSpanRecord): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.createSpan(span);
  }

  async updateSpan({
    spanId,
    traceId,
    updates,
  }: {
    spanId: string;
    traceId: string;
    updates: Partial<UpdateSpanRecord>;
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.updateSpan({ spanId, traceId, updates });
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.getTrace(traceId);
  }

  async getTracesPaginated(args: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.getTracesPaginated(args);
  }

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchCreateSpans(args);
  }

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchUpdateSpans(args);
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchDeleteTraces(args);
  }
}
