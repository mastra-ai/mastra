import type { MastraMessageContentV2, MastraDBMessage } from '../agent';
import { MastraBase } from '../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '../evals';
import type { StorageThreadType } from '../memory/types';
import type { TracingStorageStrategy } from '../observability';
import type { StepResult, WorkflowRunState } from '../workflows/types';

import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  TABLE_SPANS,
  TABLE_AGENTS,
} from './constants';
import type { TABLE_NAMES } from './constants';
import type {
  AgentsStorage,
  ScoresStorage,
  StoreOperations,
  WorkflowsStorage,
  MemoryStorage,
  ObservabilityStorage,
} from './domains';
import type {
  PaginationInfo,
  StorageColumn,
  StorageResourceType,
  StoragePagination,
  WorkflowRun,
  WorkflowRuns,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
  UpdateSpanRecord,
  CreateSpanRecord,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListWorkflowRunsInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  UpdateWorkflowStateOptions,
} from './types';

export type StorageDomains = {
  operations: StoreOperations;
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
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

export abstract class MastraStorage extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  id: string;
  stores?: StorageDomains;

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
   * const storage = new PostgresStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new PostgresStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit: boolean = false;

  constructor({ id, name, disableInit }: { id: string; name: string; disableInit?: boolean }) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(`${name}: id must be provided and cannot be empty.`);
    }
    super({
      component: 'STORAGE',
      name,
    });
    this.id = id;
    this.disableInit = disableInit ?? false;
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
    agents?: boolean;
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
      agents: false,
    };
  }

  protected ensureDate(date: Date | string | undefined): Date | undefined {
    return ensureDate(date);
  }

  protected serializeDate(date: Date | string | undefined): string | undefined {
    return serializeDate(date);
  }

  abstract createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void>;

  abstract insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void>;

  abstract load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null>;

  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  abstract saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType>;

  abstract updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType>;

  abstract deleteThread({ threadId }: { threadId: string }): Promise<void>;

  async getResourceById(_: { resourceId: string }): Promise<StorageResourceType | null> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  async saveResource(_: { resource: StorageResourceType }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  async updateResource(_: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  abstract saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }>;

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

  abstract updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: Partial<MastraMessageContentV2>;
    })[];
  }): Promise<MastraDBMessage[]>;

  async deleteMessages(_messageIds: string[]): Promise<void> {
    throw new Error(
      `Message deletion is not supported by this storage adapter (${this.constructor.name}). ` +
        `The deleteMessages method needs to be implemented in the storage adapter.`,
    );
  }

  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (this.shouldCacheInit && (await this.hasInitialized)) {
      return;
    }

    const tableCreationTasks = [
      this.createTable({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      }),

      this.createTable({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
      }),

      this.createTable({
        tableName: TABLE_MESSAGES,
        schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      }),

      this.createTable({
        tableName: TABLE_TRACES,
        schema: TABLE_SCHEMAS[TABLE_TRACES],
      }),

      this.createTable({
        tableName: TABLE_SCORERS,
        schema: TABLE_SCHEMAS[TABLE_SCORERS],
      }),
    ];

    // Only create resources table for storage adapters that support it
    if (this.supports.resourceWorkingMemory) {
      tableCreationTasks.push(
        this.createTable({
          tableName: TABLE_RESOURCES,
          schema: TABLE_SCHEMAS[TABLE_RESOURCES],
        }),
      );
    }

    if (this.supports.observabilityInstance) {
      tableCreationTasks.push(
        this.createTable({
          tableName: TABLE_SPANS,
          schema: TABLE_SCHEMAS[TABLE_SPANS],
        }),
      );
    }

    // Create agents table for storage adapters that support dynamic agent storage
    if (this.supports.agents) {
      tableCreationTasks.push(
        this.createTable({
          tableName: TABLE_AGENTS,
          schema: TABLE_SCHEMAS[TABLE_AGENTS],
        }),
      );
    }

    this.hasInitialized = Promise.all(tableCreationTasks).then(() => true);

    await this.hasInitialized;

    await this?.alterTable?.({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });
    await this?.alterTable?.({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
    await this?.alterTable?.({
      tableName: TABLE_SCORERS,
      schema: TABLE_SCHEMAS[TABLE_SCORERS],
      ifNotExists: ['spanId', 'requestContext'],
    });
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
    await this.init();

    const data = {
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.logger.debug('Persisting workflow snapshot', { workflowName, runId, data });
    await this.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: data,
    });
  }

  abstract updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined>;

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    if (!this.hasInitialized) {
      await this.init();
    }
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    const d = await this.load<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    return d ? d.snapshot : null;
  }

  /**
   * SCORERS
   */

  abstract getScoreById({ id }: { id: string }): Promise<ScoreRowData | null>;

  abstract saveScore(score: ValidatedSaveScorePayload): Promise<{ score: ScoreRowData }>;

  abstract listScoresByScorerId({
    scorerId,
    source,
    entityId,
    entityType,
    pagination,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  async listScoresBySpan({
    traceId,
    spanId,
    pagination: _pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { traceId, spanId },
    });
  }

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string }): Promise<void>;

  /**
   * OBSERVABILITY
   */

  /**
   * Provides hints for tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   */
  public get tracingStrategy(): {
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

  /**
   * DATABASE INDEX MANAGEMENT
   * These methods delegate to the operations store for index management.
   * Storage adapters that support indexes should implement these in their operations class.
   */

  /**
   * Creates a database index on specified columns
   * @throws {MastraError} if not supported by the storage adapter
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    if (this.stores?.operations) {
      return this.stores.operations.createIndex(options);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_CREATE_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Drops a database index by name
   * @throws {MastraError} if not supported by the storage adapter
   */
  async dropIndex(indexName: string): Promise<void> {
    if (this.stores?.operations) {
      return this.stores.operations.dropIndex(indexName);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_DROP_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Lists database indexes for a table or all tables
   * @throws {MastraError} if not supported by the storage adapter
   */
  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    if (this.stores?.operations) {
      return this.stores.operations.listIndexes(tableName);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_INDEXES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Gets detailed statistics for a specific index
   * @throws {MastraError} if not supported by the storage adapter
   */
  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    if (this.stores?.operations) {
      return this.stores.operations.describeIndex(indexName);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_DESCRIBE_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * AGENTS STORAGE
   * These methods delegate to the agents store for agent CRUD operations.
   * This enables dynamic creation of agents via Mastra Studio.
   */

  /**
   * Retrieves an agent by its unique identifier.
   * @param id - The unique identifier of the agent
   * @returns The agent if found, null otherwise
   * @throws {MastraError} if not supported by the storage adapter
   */
  async getAgentById({ id }: { id: string }): Promise<StorageAgentType | null> {
    if (this.stores?.agents) {
      return this.stores.agents.getAgentById({ id });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_AGENT_BY_ID_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Agent storage is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Creates a new agent in storage.
   * @param agent - The agent data to create
   * @returns The created agent with timestamps
   * @throws {MastraError} if not supported by the storage adapter
   */
  async createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    if (this.stores?.agents) {
      return this.stores.agents.createAgent({ agent });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_CREATE_AGENT_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Agent storage is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Updates an existing agent in storage.
   * @param id - The unique identifier of the agent to update
   * @param updates - The fields to update
   * @returns The updated agent
   * @throws {MastraError} if not supported by the storage adapter
   */
  async updateAgent(args: StorageUpdateAgentInput): Promise<StorageAgentType> {
    if (this.stores?.agents) {
      return this.stores.agents.updateAgent(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_AGENT_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Agent storage is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Deletes an agent from storage.
   * @param id - The unique identifier of the agent to delete
   * @throws {MastraError} if not supported by the storage adapter
   */
  async deleteAgent({ id }: { id: string }): Promise<void> {
    if (this.stores?.agents) {
      return this.stores.agents.deleteAgent({ id });
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_DELETE_AGENT_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Agent storage is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Lists all agents with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of agents
   * @throws {MastraError} if not supported by the storage adapter
   */
  async listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    if (this.stores?.agents) {
      return this.stores.agents.listAgents(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_AGENTS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Agent storage is not supported by this storage adapter (${this.constructor.name})`,
    });
  }
}
