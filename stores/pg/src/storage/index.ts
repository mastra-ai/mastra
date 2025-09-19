import type { MastraMessageContentV2, MastraMessageV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { MastraStorage } from '@mastra/core/storage';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  StorageGetTracesPaginatedArg,
  StorageResourceType,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  PaginationArgs,
  StoragePagination,
  StorageDomains,
  ThreadSortOptions,
  AISpanRecord,
  AITraceRecord,
  AITracesPaginatedArg,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { ClientConfig } from 'pg';
import pgPromise from 'pg-promise';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';
import { LegacyEvalsPG } from './domains/legacy-evals';
import { MemoryPG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { StoreOperationsPG } from './domains/operations';
import { ScoresPG } from './domains/scores';
import { TracesPG } from './domains/traces';
import { WorkflowsPG } from './domains/workflows';

export type { CreateIndexOptions, IndexInfo } from '@mastra/core/storage';

export type PostgresConfig = {
  schemaName?: string;
  max?: number;
  idleTimeoutMillis?: number;
} & (
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean | ISSLConfig;
    }
  | {
      connectionString: string;
    }
  // Support Cloud SQL Connector & pg ClientConfig
  | ClientConfig
);

export class PostgresStore extends MastraStorage {
  #db?: pgPromise.IDatabase<{}>;
  #pgp?: pgPromise.IMain;
  #config: PostgresConfig;
  private schema: string;
  private isConnected: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresConfig) {
    // Type guards for better type safety
    const isConnectionStringConfig = (cfg: PostgresConfig): cfg is PostgresConfig & { connectionString: string } => {
      return 'connectionString' in cfg;
    };

    const isHostConfig = (
      cfg: PostgresConfig,
    ): cfg is PostgresConfig & {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean | ISSLConfig;
    } => {
      return 'host' in cfg && 'database' in cfg && 'user' in cfg && 'password' in cfg;
    };

    const isCloudSqlConfig = (cfg: PostgresConfig): cfg is PostgresConfig & ClientConfig => {
      return 'stream' in cfg || ('password' in cfg && typeof cfg.password === 'function');
    };

    // Validation: connectionString or host/database/user/password must not be empty
    try {
      if (isConnectionStringConfig(config)) {
        if (
          !config.connectionString ||
          typeof config.connectionString !== 'string' ||
          config.connectionString.trim() === ''
        ) {
          throw new Error(
            'PostgresStore: connectionString must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.',
          );
        }
      } else if (isCloudSqlConfig(config)) {
        // valid connector config; no-op
      } else if (isHostConfig(config)) {
        const required = ['host', 'database', 'user', 'password'] as const;
        for (const key of required) {
          if (!config[key] || typeof config[key] !== 'string' || config[key].trim() === '') {
            throw new Error(
              `PostgresStore: ${key} must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`,
            );
          }
        }
      } else {
        throw new Error(
          'PostgresStore: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with `stream`).',
        );
      }
      super({ name: 'PostgresStore' });
      this.schema = config.schemaName || 'public';
      if (isConnectionStringConfig(config)) {
        this.#config = {
          connectionString: config.connectionString,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        } as any;
      } else if (isCloudSqlConfig(config)) {
        // Cloud SQL connector config
        this.#config = {
          ...config,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        } as any;
      } else if (isHostConfig(config)) {
        this.#config = {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        } as any;
      } else {
        // This should never happen due to validation above, but included for completeness
        this.#config = {
          ...(config as ClientConfig),
          max: (config as any).max,
          idleTimeoutMillis: (config as any).idleTimeoutMillis,
        } as any;
      }
      this.stores = {} as StorageDomains;
    } catch (e) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_INITIALIZATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.isConnected = true;
      this.#pgp = pgPromise();
      this.#db = this.#pgp(this.#config as any);

      const operations = new StoreOperationsPG({ client: this.#db, schemaName: this.schema });
      const scores = new ScoresPG({ client: this.#db, operations, schema: this.schema });
      const traces = new TracesPG({ client: this.#db, operations, schema: this.schema });
      const workflows = new WorkflowsPG({ client: this.#db, operations, schema: this.schema });
      const legacyEvals = new LegacyEvalsPG({ client: this.#db, schema: this.schema });
      const memory = new MemoryPG({ client: this.#db, schema: this.schema, operations });
      const observability = new ObservabilityPG({ client: this.#db, operations, schema: this.schema });

      this.stores = {
        operations,
        scores,
        traces,
        workflows,
        legacyEvals,
        memory,
        observability,
      };

      await super.init();

      // Create automatic performance indexes by default
      // This is done after table creation and is safe to run multiple times
      try {
        await operations.createAutomaticIndexes();
      } catch (indexError) {
        // Log the error but don't fail initialization
        // Indexes are performance optimizations, not critical for functionality
        console.warn('Failed to create indexes:', indexError);
      }
    } catch (error) {
      this.isConnected = false;
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_POSTGRES_STORE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  public get db() {
    if (!this.#db) {
      throw new Error(`PostgresStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#db;
  }

  public get pgp() {
    if (!this.#pgp) {
      throw new Error(`PostgresStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#pgp;
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      aiTracing: true,
      indexManagement: true,
    };
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    return this.stores.legacyEvals.getEvals(options);
  }

  /**
   * @deprecated use getTracesPaginated instead
   */
  public async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    return this.stores.traces.getTraces(args);
  }

  public async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return this.stores.traces.getTracesPaginated(args);
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    return this.stores.traces.batchTraceInsert({ records });
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

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.dropTable({ tableName });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.stores.operations.insert({ tableName, record });
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return this.stores.operations.batchInsert({ tableName, records });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.stores.operations.load({ tableName, keys });
  }

  /**
   * Memory
   */

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.stores.memory.getThreadById({ threadId });
  }

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  public async getThreadsByResourceId(args: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    return this.stores.memory.getThreadsByResourceId(args);
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    return this.stores.memory.getThreadsByResourceIdPaginated(args);
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

  /**
   * @deprecated use getMessagesPaginated instead
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    return this.stores.memory.getMessages(args);
  }

  async getMessagesById({ messageIds, format }: { messageIds: string[]; format: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessagesById({ messageIds, format }: { messageIds: string[]; format?: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    return this.stores.memory.getMessagesById({ messageIds, format });
  }

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    return this.stores.memory.getMessagesPaginated(args);
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraMessageV2[]> {
    return this.stores.memory.updateMessages({ messages });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
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
   * Workflows
   */
  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    runtimeContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    runtimeContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.stores.workflows.updateWorkflowResults({ workflowName, runId, stepId, result, runtimeContext });
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

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  } = {}): Promise<WorkflowRuns> {
    return this.stores.workflows.getWorkflowRuns({ workflowName, fromDate, toDate, limit, offset, resourceId });
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

  async close(): Promise<void> {
    this.pgp.end();
  }

  /**
   * AI Tracing / Observability
   */
  async createAISpan(span: AISpanRecord): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.createAISpan(span);
  }

  async updateAISpan({
    spanId,
    traceId,
    updates,
  }: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.updateAISpan({ spanId, traceId, updates });
  }

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.getAITrace(traceId);
  }

  async getAITracesPaginated(
    args: AITracesPaginatedArg,
  ): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.getAITracesPaginated(args);
  }

  async batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchCreateAISpans(args);
  }

  async batchUpdateAISpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchUpdateAISpans(args);
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'PG_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchDeleteAITraces(args);
  }

  /**
   * Scorers
   */
  async getScoreById({ id: _id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id: _id });
  }

  async getScoresByScorerId({
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
    return this.stores.scores.getScoresByScorerId({ scorerId, pagination, entityId, entityType, source });
  }

  async saveScore(_score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(_score);
  }

  async getScoresByRunId({
    runId: _runId,
    pagination: _pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByRunId({ runId: _runId, pagination: _pagination });
  }

  async getScoresByEntityId({
    entityId: _entityId,
    entityType: _entityType,
    pagination: _pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByEntityId({
      entityId: _entityId,
      entityType: _entityType,
      pagination: _pagination,
    });
  }
}
