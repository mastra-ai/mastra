import type { MastraMessageContentV2, MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType } from '@mastra/core/memory';
import { MastraStorage } from '@mastra/core/storage';
import type {
  PaginationInfo,
  StorageColumn,
  StorageResourceType,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  StoragePagination,
  StorageDomains,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  StorageListWorkflowRunsInput,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { AuroraDSQLClient } from '@aws/aurora-dsql-node-postgres-connector';
import pgPromise from 'pg-promise';
import { validateDSQLConfig, getEffectiveRegion, DSQL_POOL_DEFAULTS } from '../shared/config';
import type { DSQLConfig } from '../shared/config';
import { MemoryDSQL } from './domains/memory';
import { ObservabilityDSQL } from './domains/observability';
import { StoreOperationsDSQL } from './domains/operations';
import { ScoresDSQL } from './domains/scores';
import { WorkflowsDSQL } from './domains/workflows';

export type { CreateIndexOptions, IndexInfo } from '@mastra/core/storage';

export class DSQLStore extends MastraStorage {
  #db?: pgPromise.IDatabase<{}>;
  #pgp?: pgPromise.IMain;
  #config: DSQLConfig;
  private schema: string;
  private isConnected: boolean = false;

  stores: StorageDomains;

  constructor(config: DSQLConfig) {
    try {
      validateDSQLConfig(config);
      super({ id: config.id, name: 'DSQLStore' });
      this.schema = config.schemaName || 'public';
      this.#config = config;
      this.stores = {} as StorageDomains;
    } catch (e) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_INITIALIZATION_FAILED',
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
      this.#pgp = pgPromise();

      // Build pg-promise connection config with AuroraDSQLClient for IAM authentication
      const region = getEffectiveRegion(this.#config);
      const pgConfig = {
        host: this.#config.host,
        user: this.#config.user ?? 'admin',
        database: this.#config.database ?? 'postgres',
        // Use AuroraDSQLClient for automatic IAM token generation
        Client: AuroraDSQLClient as any,
        // Pass region for IAM token generation
        region,
        // Custom credentials provider (optional)
        customCredentialsProvider: this.#config.customCredentialsProvider,
        // Pool settings optimized for Aurora DSQL
        max: this.#config.max ?? DSQL_POOL_DEFAULTS.max,
        min: this.#config.min ?? DSQL_POOL_DEFAULTS.min,
        idleTimeoutMillis: this.#config.idleTimeoutMillis ?? DSQL_POOL_DEFAULTS.idleTimeoutMillis,
        maxLifetimeSeconds: this.#config.maxLifetimeSeconds ?? DSQL_POOL_DEFAULTS.maxLifetimeSeconds,
        connectionTimeoutMillis: this.#config.connectionTimeoutMillis ?? DSQL_POOL_DEFAULTS.connectionTimeoutMillis,
        allowExitOnIdle: this.#config.allowExitOnIdle ?? DSQL_POOL_DEFAULTS.allowExitOnIdle,
      };

      this.#db = this.#pgp(pgConfig as any);

      const operations = new StoreOperationsDSQL({ client: this.#db, schemaName: this.schema });
      const scores = new ScoresDSQL({ client: this.#db, operations, schema: this.schema });
      const workflows = new WorkflowsDSQL({ client: this.#db, operations, schema: this.schema });
      const memory = new MemoryDSQL({ client: this.#db, schema: this.schema, operations });
      const observability = new ObservabilityDSQL({ client: this.#db, operations, schema: this.schema });

      this.stores = {
        operations,
        scores,
        workflows,
        memory,
        observability,
      };

      await super.init();

      this.isConnected = true;

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
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_DSQL_STORE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  public get db() {
    if (!this.#db) {
      throw new Error(`DSQLStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#db;
  }

  public get pgp() {
    if (!this.#pgp) {
      throw new Error(`DSQLStore: Store is not initialized, please call "init()" first.`);
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
      observabilityInstance: true,
      indexManagement: true,
      listScoresBySpan: true,
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

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraDBMessage[]> {
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

  async close(): Promise<void> {
    if (this.#pgp) {
      this.#pgp.end();
    }
    this.isConnected = false;
  }

  /**
   * Tracing / Observability
   */
  async createSpan(span: SpanRecord): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
    updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.getTracesPaginated(args);
  }

  async batchCreateSpans(args: { records: SpanRecord[] }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
      updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
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
        id: 'DSQL_STORE_OBSERVABILITY_NOT_INITIALIZED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability.batchDeleteTraces(args);
  }

  /**
   * Scorers
   */
  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
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

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
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
    return this.stores.scores.listScoresByEntityId({
      entityId,
      entityType,
      pagination,
    });
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
