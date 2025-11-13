import type { MastraMessageContentV2, MastraDBMessage } from '../agent';
import { MastraBase } from '../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { StorageThreadType } from '../memory/types';
import type { TracingStorageStrategy } from '../observability';
import type { StepResult, WorkflowRunState } from '../workflows/types';

import type {
  ObservabilityStorageBase,
  WorkflowsStorageBase,
  EvalsStorageBase,
  MemoryStorageBase,
  IndexManagementBase,
} from './domains';
import type {
  PaginationInfo,
  StorageColumn,
  WorkflowRun,
  WorkflowRuns,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  UpdateSpanRecord,
  CreateSpanRecord,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListWorkflowRunsInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from './types';

export type StorageDomains = {
  workflows: WorkflowsStorageBase;
  evals: EvalsStorageBase;
  memory: MemoryStorageBase;
  observability?: ObservabilityStorageBase;
  indexManagement?: IndexManagementBase;
};

export function ensureDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date : new Date(date);
}

export function serializeDate(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  const dateObj = ensureDate(date);
  return dateObj?.toISOString();
}

/**
 * Normalizes perPage input for pagination queries.
 *
 * @param perPageInput - The raw perPage value from the user
 * @param defaultValue - The default perPage value to use when undefined (typically 40 for messages, 100 for threads)
 * @returns A numeric perPage value suitable for queries (false becomes MAX_SAFE_INTEGER, negative values fall back to default)
 */
export function normalizePerPage(perPageInput: number | false | undefined, defaultValue: number): number {
  if (perPageInput === false) {
    return Number.MAX_SAFE_INTEGER; // Get all results
  } else if (perPageInput === 0) {
    return 0; // Return zero results
  } else if (typeof perPageInput === 'number' && perPageInput > 0) {
    return perPageInput; // Valid positive number
  }
  // For undefined, negative, or other invalid values, use default
  return defaultValue;
}

/**
 * Calculates pagination offset and prepares perPage value for response.
 * When perPage is false (fetch all), offset is always 0 regardless of page.
 *
 * @param page - The page number (0-indexed)
 * @param perPageInput - The original perPage input (number, false for all, or undefined)
 * @param normalizedPerPage - The normalized perPage value (from normalizePerPage)
 * @returns Object with offset for query and perPage for response
 */
export function calculatePagination(
  page: number,
  perPageInput: number | false | undefined,
  normalizedPerPage: number,
): { offset: number; perPage: number | false } {
  return {
    offset: perPageInput === false ? 0 : page * normalizedPerPage,
    perPage: perPageInput === false ? false : normalizedPerPage,
  };
}

export function getDefaultValue(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
    case 'uuid':
      return "DEFAULT ''";
    case 'timestamp':
      return "DEFAULT '1970-01-01 00:00:00'";
    case 'integer':
    case 'float':
    case 'bigint':
      return 'DEFAULT 0';
    case 'jsonb':
      return "DEFAULT '{}'";
    default:
      return "DEFAULT ''";
  }
}

export function getSqlType(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'timestamp':
      return 'TIMESTAMP';
    case 'float':
      return 'FLOAT';
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'jsonb':
      return 'JSONB';
    default:
      return 'TEXT';
  }
}

export class MastraStorage extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  id: string;
  stores?: StorageDomains;

  constructor({ id, name, stores }: { id: string; name: string; stores?: StorageDomains }) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(`${name}: id must be provided and cannot be empty.`);
    }
    super({
      component: 'STORAGE',
      name,
    });
    this.id = id;

    if (stores) {
      this.stores = stores;
    }
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    observabilityInstance?: boolean;
    indexManagement?: boolean;
    listScoresBySpan?: boolean;
  } {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: false,
      observabilityInstance: false,
      indexManagement: false,
      listScoresBySpan: false,
    };
  }

  protected ensureDate(date: Date | string | undefined): Date | undefined {
    return ensureDate(date);
  }

  protected serializeDate(date: Date | string | undefined): string | undefined {
    return serializeDate(date);
  }

  /**
   * Get access to the underlying storage domains for advanced operations
   */
  public async getStore<K extends keyof StorageDomains>(id: K): Promise<StorageDomains[K] | undefined> {
    return this.stores?.[id];
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'TEXT';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'float':
        return 'FLOAT';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'jsonb':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
      case 'uuid':
        return "DEFAULT ''";
      case 'timestamp':
        return "DEFAULT '1970-01-01 00:00:00'";
      case 'integer':
      case 'float':
      case 'bigint':
        return 'DEFAULT 0';
      case 'jsonb':
        return "DEFAULT '{}'";
      default:
        return "DEFAULT ''";
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    if (this.stores?.memory) {
      return this.stores.memory.saveThread({ thread });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_SAVE_THREAD_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Saving thread is not implemented by this storage adapter (${this.constructor.name})`,
    });
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
    if (this.stores?.memory) {
      return this.stores.memory.updateThread({ id, title, metadata });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_THREAD_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Updating thread is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    if (this.stores?.memory) {
      return this.stores.memory.deleteThread({ threadId });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_DELETE_THREAD_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Deleting thread is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (this.stores?.memory) {
      return this.stores.memory.saveMessages(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_SAVE_MESSAGES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Saving messages is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    if (this.stores?.memory) {
      return this.stores.memory.listMessages(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_MESSAGES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Listing messages is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    if (this.stores?.workflows) {
      return this.stores.workflows.listWorkflowRuns(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_WORKFLOW_RUNS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Listing workflow runs is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    if (this.stores?.memory) {
      return this.stores.memory.listThreadsByResourceId(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_THREADS_BY_RESOURCE_ID_PAGINATED_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Listing threads by resource ID paginated is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (this.stores?.memory) {
      const result = await this.stores.memory.listMessagesById({ messageIds });
      return result;
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_MESSAGES_BY_ID_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Listing messages by ID is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: Partial<MastraMessageContentV2>;
    })[];
  }): Promise<MastraDBMessage[]> {
    if (this.stores?.memory) {
      return this.stores.memory.updateMessages(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_MESSAGES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Updating messages is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async deleteMessages(_messageIds: string[]): Promise<void> {
    if (this.stores?.memory) {
      return this.stores.memory.deleteMessages(_messageIds);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_DELETE_MESSAGES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Deleting messages is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (this.shouldCacheInit && (await this.hasInitialized)) {
      return;
    }

    const initTasks: Promise<void>[] = [];

    // Initialize memory domain (threads, messages, resources)
    if (this.stores?.memory) {
      initTasks.push(this.stores.memory.init());
    }

    // Initialize workflows domain (workflow snapshots)
    if (this.stores?.workflows) {
      initTasks.push(this.stores.workflows.init());
    }

    // Initialize scores domain (evals)
    if (this.stores?.evals) {
      initTasks.push(this.stores.evals.init());
    }

    // Initialize observability domain (traces, spans)
    if (this.stores?.observability) {
      initTasks.push(this.stores.observability.init());
    }

    this.hasInitialized = Promise.all(initTasks).then(() => true);

    await this.hasInitialized;
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
    if (this.stores?.workflows) {
      return this.stores.workflows.updateWorkflowResults({ workflowId, runId, stepId, result, requestContext });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_WORKFLOW_RESULTS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Updating workflow results is not implemented by this storage adapter (${this.constructor.name})`,
    });
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
    if (this.stores?.workflows) {
      return this.stores.workflows.updateWorkflowState({ workflowId, runId, opts });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_WORKFLOW_STATE_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Updating workflow state is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    if (this.stores?.workflows) {
      return this.stores.workflows.getWorkflowSnapshot({ workflowId, runId });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_WORKFLOW_SNAPSHOT_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Getting workflow snapshot is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  async getWorkflowRunById(args: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    if (this.stores?.workflows) {
      return this.stores.workflows.getWorkflowRunById(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_WORKFLOW_RUN_BY_ID_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Getting workflow run by ID is not implemented by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * OBSERVABILITY
   */

  /**
   * Provides hints for tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   */
  get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    if (this.stores?.observability) {
      return this.stores.observability.tracingStrategy;
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_TRACING_STRATEGY_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Creates a single Span record in the storage provider.
   */
  async createSpan(span: CreateSpanRecord): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.createSpan(span);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_CREATE_AI_SPAN_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Updates a single Span with partial data. Primarily used for realtime trace creation.
   */
  async updateSpan(params: { spanId: string; traceId: string; updates: Partial<UpdateSpanRecord> }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.updateSpan(params);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_AI_SPAN_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Retrieves a single trace with all its associated spans.
   */
  async getTrace(traceId: string): Promise<TraceRecord | null> {
    if (this.stores?.observability) {
      return this.stores.observability.getTrace(traceId);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_TRACE_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Retrieves a paginated list of traces with optional filtering.
   */
  async getTracesPaginated(args: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    if (this.stores?.observability) {
      return this.stores.observability.getTracesPaginated(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_TRACES_PAGINATED_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Creates multiple Spans in a single batch.
   */
  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.batchCreateSpans(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_BATCH_CREATE_AI_SPANS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Updates multiple Spans in a single batch.
   */
  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.batchUpdateSpans(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_BATCH_UPDATE_AI_SPANS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Deletes multiple traces and all their associated spans in a single batch operation.
   */
  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.batchDeleteTraces(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_BATCH_DELETE_TRACES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }
}
