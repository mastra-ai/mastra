import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type {
  TABLE_SCHEMAS,
  PaginationInfo,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  StoragePagination,
  StorageDomains,
  StorageResourceType,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { MemoryStorageClickhouse } from './domains/memory';
import { ObservabilityStorageClickhouse } from './domains/observability';
import { ScoresStorageClickhouse } from './domains/scores';
import { WorkflowsStorageClickhouse } from './domains/workflows';

type IntervalUnit =
  | 'NANOSECOND'
  | 'MICROSECOND'
  | 'MILLISECOND'
  | 'SECOND'
  | 'MINUTE'
  | 'HOUR'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR';

type ClickhouseTtlConfig = {
  [TableKey in TABLE_NAMES]?: {
    row?: { interval: number; unit: IntervalUnit; ttlKey?: string };
    columns?: Partial<{
      [ColumnKey in keyof (typeof TABLE_SCHEMAS)[TableKey]]: {
        interval: number;
        unit: IntervalUnit;
        ttlKey?: string;
      };
    }>;
  };
};

/**
 * ClickHouse configuration type.
 *
 * Accepts either:
 * - A pre-configured ClickHouse client: `{ id, client, ttl? }`
 * - URL/credentials config: `{ id, url, username, password, ttl? }`
 */
export type ClickhouseConfig = {
  id: string;
  ttl?: ClickhouseTtlConfig;
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
   * const storage = new ClickhouseStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new ClickhouseStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured ClickHouse client.
       * Use this when you need to configure the client before initialization,
       * e.g., to set custom connection settings or interceptors.
       *
       * @example
       * ```typescript
       * import { createClient } from '@clickhouse/client';
       *
       * const client = createClient({
       *   url: 'http://localhost:8123',
       *   username: 'default',
       *   password: '',
       *   // Custom settings
       *   request_timeout: 60000,
       * });
       *
       * const store = new ClickhouseStore({ id: 'my-store', client });
       * ```
       */
      client: ClickHouseClient;
    }
  | {
      url: string;
      username: string;
      password: string;
    }
);

/**
 * Type guard for pre-configured client config
 */
const isClientConfig = (config: ClickhouseConfig): config is ClickhouseConfig & { client: ClickHouseClient } => {
  return 'client' in config;
};

export class ClickhouseStore extends MastraStorage {
  protected db: ClickHouseClient;
  protected ttl: ClickhouseConfig['ttl'] = {};

  stores: StorageDomains;

  constructor(config: ClickhouseConfig) {
    super({ id: config.id, name: 'ClickhouseStore', disableInit: config.disableInit });

    // Handle pre-configured client vs creating new connection
    if (isClientConfig(config)) {
      // User provided a pre-configured ClickHouse client
      this.db = config.client;
    } else {
      // Validate URL before creating client
      if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
        throw new Error('ClickhouseStore: url is required and cannot be empty.');
      }
      // Validate username and password are strings (can be empty for default user)
      if (typeof config.username !== 'string') {
        throw new Error('ClickhouseStore: username must be a string.');
      }
      if (typeof config.password !== 'string') {
        throw new Error('ClickhouseStore: password must be a string.');
      }
      // Create client from credentials
      this.db = createClient({
        url: config.url,
        username: config.username,
        password: config.password,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso', // This is crucial
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    }

    this.ttl = config.ttl;

    const domainConfig = { client: this.db, ttl: this.ttl };
    const workflows = new WorkflowsStorageClickhouse(domainConfig);
    const scores = new ScoresStorageClickhouse(domainConfig);
    const memory = new MemoryStorageClickhouse(domainConfig);
    const observability = new ObservabilityStorageClickhouse(domainConfig);

    this.stores = {
      workflows,
      scores,
      memory,
      observability,
    };
  }

  get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    listScoresBySpan: boolean;
    observabilityInstance: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      listScoresBySpan: true,
      observabilityInstance: true,
    };
  }

  async optimizeTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.command({
        query: `OPTIMIZE TABLE ${tableName} FINAL`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'OPTIMIZE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async materializeTtl({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.command({
        query: `ALTER TABLE ${tableName} MATERIALIZE TTL;`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'MATERIALIZE_TTL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
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

  async listWorkflowRuns(args: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns(args);
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

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(args);
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.listMessagesById({ messageIds });
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
   * Closes the ClickHouse client connection.
   *
   * This will close the ClickHouse client, including pre-configured clients.
   * The store assumes ownership of all clients and manages their lifecycle.
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CLOSE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Observability methods

  async createSpan(span: CreateSpanRecord): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.createSpan(span);
  }

  async updateSpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.updateSpan(params);
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchCreateSpans(args);
  }

  async batchUpdateSpans(args: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('CLICKHOUSE', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchDeleteTraces(args);
  }
}
