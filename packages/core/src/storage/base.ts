import type { MastraMessageContentV2, MastraDBMessage } from '../agent';
import { MastraBase } from '../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '../evals';
import type { StorageThreadType } from '../memory/types';
import type { StepResult, WorkflowRunState } from '../workflows/types';

import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  GetTraceResponse,
  UpdateSpanArgs,
  CreateSpanArgs,
  GetTraceArgs,
  WorkflowsStorage,
  ScoresStorage,
  MemoryStorage,
  ObservabilityStorage,
  AgentsStorage,
  TracingStorageStrategy,
  ListTracesResponse,
  ListTracesArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
} from './domains';
import type {
  StorageResourceType,
  StoragePagination,
  WorkflowRun,
  WorkflowRuns,
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
  StorageSupports,
} from './types';
import { createStorageErrorId } from './utils';

export type StorageDomains = {
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
};

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

  public get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: false,
      observability: false,
      indexManagement: false,
      listScoresBySpan: false,
      agents: false,
    };
  }

  async getStore<K extends keyof StorageDomains>(storeName: K): Promise<StorageDomains[K] | undefined> {
    return this.stores?.[storeName];
  }
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

    // Initialize all domain stores
    const initTasks: Promise<void>[] = [];

    if (this.stores?.memory) {
      initTasks.push(this.stores.memory.init());
    }

    if (this.stores?.workflows) {
      initTasks.push(this.stores.workflows.init());
    }

    if (this.stores?.scores) {
      initTasks.push(this.stores.scores.init());
    }

    if (this.stores?.observability) {
      initTasks.push(this.stores.observability.init());
    }

    if (this.stores?.agents) {
      initTasks.push(this.stores.agents.init());
    }

    this.hasInitialized = Promise.all(initTasks).then(() => true);

    await this.hasInitialized;
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

    if (this.stores?.workflows) {
      return this.stores.workflows.persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot });
    }

    throw new MastraError({
      id: 'MASTRA_STORAGE_PERSIST_WORKFLOW_SNAPSHOT_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Workflow storage is not configured for this storage adapter (${this.constructor.name})`,
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

    if (this.stores?.workflows) {
      return this.stores.workflows.loadWorkflowSnapshot({ workflowName, runId });
    }

    throw new MastraError({
      id: 'MASTRA_STORAGE_LOAD_WORKFLOW_SNAPSHOT_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Workflow storage is not configured for this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * SCORERS
   */

  abstract getScoreById({ id }: { id: string }): Promise<ScoreRowData | null>;

  abstract saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }>;

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
  }): Promise<ListScoresResponse>;

  abstract listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse>;

  abstract listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<ListScoresResponse>;

  async listScoresBySpan({
    traceId,
    spanId,
    pagination: _pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
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
    this.#throwObservabilityError('TRACING_STRATEGY');
  }

  /**
   * Throws an appropriate error for observability operations.
   * Distinguishes between "not initialized" (provider supports it) and "not supported" (provider doesn't support it).
   */
  #throwObservabilityError(operation: string): never {
    const storeName = this.name ?? 'UNKNOWN';
    if (this.supports.observability) {
      throw new MastraError({
        id: createStorageErrorId(storeName, 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: `Observability storage is not initialized for ${storeName}`,
      });
    }
    throw new MastraError({
      id: createStorageErrorId(storeName, operation, 'NOT_SUPPORTED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Observability is not supported by this storage adapter (${storeName})`,
    });
  }

  /**
   * Creates a single Span record in the storage provider.
   */
  async createSpan(args: CreateSpanArgs): Promise<void> {
    if (this.stores?.observability) {
      return await this.stores.observability.createSpan(args);
    }
    this.#throwObservabilityError('CREATE_SPAN');
  }

  /**
   * Updates a single Span with partial data. Primarily used for realtime trace creation.
   */
  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    if (this.stores?.observability) {
      return await this.stores.observability.updateSpan(args);
    }
    this.#throwObservabilityError('UPDATE_SPAN');
  }

  /**
   * Retrieves a single span.
   */
  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    if (this.stores?.observability) {
      return await this.stores.observability.getSpan(args);
    }
    this.#throwObservabilityError('GET_SPAN');
  }

  /**
   * Retrieves a single root span.
   */
  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    if (this.stores?.observability) {
      return await this.stores.observability.getRootSpan(args);
    }
    this.#throwObservabilityError('GET_ROOT_SPAN');
  }

  /**
   * Retrieves a single trace with all its associated spans.
   */
  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    if (this.stores?.observability) {
      return await this.stores.observability.getTrace(args);
    }
    this.#throwObservabilityError('GET_TRACE');
  }

  /**
   * Retrieves a list of traces with optional filtering.
   */
  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    if (this.stores?.observability) {
      return await this.stores.observability.listTraces(args);
    }
    this.#throwObservabilityError('LIST_TRACES');
  }

  /**
   * Creates multiple Spans in a single batch.
   */
  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    if (this.stores?.observability) {
      return await this.stores.observability.batchCreateSpans(args);
    }
    this.#throwObservabilityError('BATCH_CREATE_SPANS');
  }

  /**
   * Updates multiple Spans in a single batch.
   */
  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    if (this.stores?.observability) {
      return await this.stores.observability.batchUpdateSpans(args);
    }
    this.#throwObservabilityError('BATCH_UPDATE_SPANS');
  }

  /**
   * Deletes multiple traces and all their associated spans in a single batch operation.
   */
  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    if (this.stores?.observability) {
      return await this.stores.observability.batchDeleteTraces(args);
    }
    this.#throwObservabilityError('BATCH_DELETE_TRACES');
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
