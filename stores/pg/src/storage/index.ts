import type { MastraMessageContentV2, MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType } from '@mastra/core/memory';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type {
  PaginationInfo,
  StorageResourceType,
  WorkflowRun,
  WorkflowRuns,
  StoragePagination,
  StorageDomains,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import {
  validateConfig,
  isCloudSqlConfig,
  isConnectionStringConfig,
  isHostConfig,
  isClientConfig,
} from '../shared/config';
import type { PostgresStoreConfig } from '../shared/config';
import type { PgDomainConfig } from './db';
import { AgentsPG } from './domains/agents';
import { MemoryPG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';

export class PostgresStore extends MastraStorage {
  #db: pgPromise.IDatabase<{}>;
  #pgp: pgPromise.IMain;
  private schema: string;
  private isInitialized: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    // Validation: connectionString or host/database/user/password must not be empty
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore', disableInit: config.disableInit });
      this.schema = config.schemaName || 'public';

      // Initialize pg-promise
      this.#pgp = pgPromise();

      // Handle pre-configured client vs creating new connection
      if (isClientConfig(config)) {
        // User provided a pre-configured pg-promise client
        this.#db = config.client;
      } else {
        // Create connection from config
        let pgConfig: PostgresStoreConfig;
        if (isConnectionStringConfig(config)) {
          pgConfig = {
            id: config.id,
            connectionString: config.connectionString,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
            ssl: config.ssl,
          };
        } else if (isCloudSqlConfig(config)) {
          // Cloud SQL connector config
          pgConfig = {
            ...config,
            id: config.id,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
          };
        } else if (isHostConfig(config)) {
          pgConfig = {
            id: config.id,
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
          };
        } else {
          // This should never happen due to validation above, but included for completeness
          throw new Error(
            'PostgresStore: invalid config. Provide either {client}, {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with `stream`).',
          );
        }

        // Note: pg-promise creates connections lazily when queries are executed,
        // so this is safe to do in the constructor
        this.#db = this.#pgp(pgConfig as any);
      }

      // Create all domain instances synchronously in the constructor
      // This is required for Memory to work correctly, as it checks for
      // stores.memory during getInputProcessors() before init() is called
      const skipDefaultIndexes = config.skipDefaultIndexes;
      const domainConfig: PgDomainConfig = { client: this.#db, schemaName: this.schema, skipDefaultIndexes };

      const scores = new ScoresPG(domainConfig);
      const workflows = new WorkflowsPG(domainConfig);
      const memory = new MemoryPG(domainConfig);
      const observability = new ObservabilityPG(domainConfig);
      const agents = new AgentsPG(domainConfig);

      this.stores = {
        scores,
        workflows,
        memory,
        observability,
        agents,
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.isInitialized = true;

      // Each domain creates its own indexes during init()
      await super.init();
    } catch (error) {
      this.isInitialized = false;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  public get db() {
    return this.#db;
  }

  public get pgp() {
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
      agents: true,
    };
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

  /**
   * Closes the pg-promise connection pool.
   *
   * This will close ALL connections in the pool, including pre-configured clients.
   */
  async close(): Promise<void> {
    this.pgp.end();
  }

  /**
   * Tracing / Observability
   */
  async createSpan(span: SpanRecord): Promise<void> {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
        id: createStorageErrorId('PG', 'OBSERVABILITY', 'NOT_INITIALIZED'),
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
