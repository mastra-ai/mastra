import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  PaginationInfo,
  StorageDomains,
  StorageResourceType,
  WorkflowRun,
  WorkflowRuns,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  UpdateSpanRecord,
  StorageListWorkflowRunsInput,
} from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { MongoDBConnector } from './connectors/MongoDBConnector';
import { MemoryStorageMongoDB } from './domains/memory';
import { ObservabilityMongoDB } from './domains/observability';
import { MongoDBOperations } from './domains/operations';
import { EvalsStorageMongoDB } from './domains/scores';
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

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns(args);
  }

  async updateWorkflowResults({
    workflowId,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowId: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.stores.workflows.updateWorkflowResults({ workflowId, runId, stepId, result, requestContext });
  }

  async updateWorkflowState({
    workflowId,
    runId,
    opts,
  }: {
    workflowId: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined> {
    return this.stores.workflows.updateWorkflowState({ workflowId, runId, opts });
  }

  async createWorkflowSnapshot({
    workflowId,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    return this.stores.workflows.createWorkflowSnapshot({ workflowId, runId, resourceId, snapshot });
  }

  async getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.getWorkflowSnapshot({ workflowId, runId });
  }

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowId });
  }

  async close(): Promise<void> {
    try {
      await this.#connector.close();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_CLOSE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'MONGODB_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchDeleteTraces(args);
  }
}
