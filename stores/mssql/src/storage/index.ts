import type { MastraMessageContentV2, MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType } from '@mastra/core/memory';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';

export type MastraDBMessageWithTypedContent = Omit<MastraDBMessage, 'content'> & { content: MastraMessageContentV2 };
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
  UpdateSpanRecord,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import sql from 'mssql';
import { MemoryMSSQL } from './domains/memory';
import { ObservabilityMSSQL } from './domains/observability';
import { ScoresMSSQL } from './domains/scores';
import { WorkflowsMSSQL } from './domains/workflows';

/**
 * MSSQL configuration type.
 *
 * Accepts either:
 * - A pre-configured connection pool: `{ id, pool, schemaName? }`
 * - Connection string: `{ id, connectionString, ... }`
 * - Server/port config: `{ id, server, port, database, user, password, ... }`
 */
export type MSSQLConfigType = {
  id: string;
  schemaName?: string;
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
   * const storage = new MSSQLStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new MSSQLStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
  /**
   * When true, default indexes will not be created during initialization.
   * This is useful when:
   * 1. You want to manage indexes separately or use custom indexes only
   * 2. Default indexes don't match your query patterns
   * 3. You want to reduce initialization time in development
   *
   * @default false
   */
  skipDefaultIndexes?: boolean;
  /**
   * Custom indexes to create during initialization.
   * These indexes are created in addition to default indexes (unless skipDefaultIndexes is true).
   *
   * Each index must specify which table it belongs to. The store will route each index
   * to the appropriate domain based on the table name.
   *
   * @example
   * ```typescript
   * const store = new MSSQLStore({
   *   connectionString: '...',
   *   indexes: [
   *     { name: 'my_threads_type_idx', table: 'mastra_threads', columns: ['JSON_VALUE(metadata, \'$.type\')'] },
   *   ],
   * });
   * ```
   */
  indexes?: CreateIndexOptions[];
} & (
  | {
      /**
       * Pre-configured mssql ConnectionPool.
       * Use this when you need to configure the pool before initialization,
       * e.g., to add pool listeners or set connection-level settings.
       *
       * @example
       * ```typescript
       * import sql from 'mssql';
       *
       * const pool = new sql.ConnectionPool({
       *   server: 'localhost',
       *   database: 'mydb',
       *   user: 'user',
       *   password: 'password',
       * });
       *
       * // Custom setup before using
       * pool.on('connect', () => {
       *   console.log('Pool connected');
       * });
       *
       * const store = new MSSQLStore({ id: 'my-store', pool });
       * ```
       */
      pool: sql.ConnectionPool;
    }
  | {
      server: string;
      port: number;
      database: string;
      user: string;
      password: string;
      options?: sql.IOptions;
    }
  | {
      connectionString: string;
    }
);

export type MSSQLConfig = MSSQLConfigType;

/**
 * Type guard for pre-configured pool config
 */
const isPoolConfig = (config: MSSQLConfigType): config is MSSQLConfigType & { pool: sql.ConnectionPool } => {
  return 'pool' in config;
};

export class MSSQLStore extends MastraStorage {
  public pool: sql.ConnectionPool;
  private schema?: string;
  private isConnected: Promise<boolean> | null = null;
  stores: StorageDomains;

  constructor(config: MSSQLConfigType) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('MSSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: 'MSSQLStore', disableInit: config.disableInit });
    try {
      this.schema = config.schemaName || 'dbo';

      // Handle pre-configured pool vs creating new connection
      if (isPoolConfig(config)) {
        // User provided a pre-configured ConnectionPool
        this.pool = config.pool;
      } else if ('connectionString' in config) {
        if (
          !config.connectionString ||
          typeof config.connectionString !== 'string' ||
          config.connectionString.trim() === ''
        ) {
          throw new Error('MSSQLStore: connectionString must be provided and cannot be empty.');
        }
        this.pool = new sql.ConnectionPool(config.connectionString);
      } else {
        const required = ['server', 'database', 'user', 'password'];
        for (const key of required) {
          if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
            throw new Error(`MSSQLStore: ${key} must be provided and cannot be empty.`);
          }
        }
        this.pool = new sql.ConnectionPool({
          server: config.server,
          database: config.database,
          user: config.user,
          password: config.password,
          port: config.port,
          options: config.options || { encrypt: true, trustServerCertificate: true },
        });
      }

      const domainConfig = {
        pool: this.pool,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };
      const scores = new ScoresMSSQL(domainConfig);
      const workflows = new WorkflowsMSSQL(domainConfig);
      const memory = new MemoryMSSQL(domainConfig);
      const observability = new ObservabilityMSSQL(domainConfig);

      this.stores = {
        scores,
        workflows,
        memory,
        observability,
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isConnected === null) {
      this.isConnected = this._performInitializationAndStore();
    }
    try {
      await this.isConnected;
      // Each domain creates its own indexes during init()
      await super.init();
    } catch (error) {
      this.isConnected = null;
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async _performInitializationAndStore(): Promise<boolean> {
    try {
      await this.pool.connect();
      return true;
    } catch (err) {
      throw err;
    }
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      listScoresBySpan: true,
      observabilityInstance: true,
      indexManagement: true,
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
   * Closes the MSSQL connection pool.
   *
   * This will close the connection pool, including pre-configured pools.
   */
  async close(): Promise<void> {
    await this.pool.close();
  }

  /**
   * Tracing / Observability
   */
  private getObservabilityStore(): ObservabilityMSSQL {
    if (!this.stores.observability) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'OBSERVABILITY', 'NOT_INITIALIZED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Observability storage is not initialized',
      });
    }
    return this.stores.observability as ObservabilityMSSQL;
  }

  async createSpan(span: SpanRecord): Promise<void> {
    return this.getObservabilityStore().createSpan(span);
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
    return this.getObservabilityStore().updateSpan({ spanId, traceId, updates });
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    return this.getObservabilityStore().getTrace(traceId);
  }

  async getTracesPaginated(args: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    return this.getObservabilityStore().getTracesPaginated(args);
  }

  async batchCreateSpans(args: { records: SpanRecord[] }): Promise<void> {
    return this.getObservabilityStore().batchCreateSpans(args);
  }

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    return this.getObservabilityStore().batchUpdateSpans(args);
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    return this.getObservabilityStore().batchDeleteTraces(args);
  }

  /**
   * Scorers
   */
  async getScoreById({ id: _id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id: _id });
  }

  async listScoresByScorerId({
    scorerId: _scorerId,
    pagination: _pagination,
    entityId: _entityId,
    entityType: _entityType,
    source: _source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByScorerId({
      scorerId: _scorerId,
      pagination: _pagination,
      entityId: _entityId,
      entityType: _entityType,
      source: _source,
    });
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
  }

  async listScoresByRunId({
    runId: _runId,
    pagination: _pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByRunId({ runId: _runId, pagination: _pagination });
  }

  async listScoresByEntityId({
    entityId: _entityId,
    entityType: _entityType,
    pagination: _pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByEntityId({
      entityId: _entityId,
      entityType: _entityType,
      pagination: _pagination,
    });
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination: _pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresBySpan({ traceId, spanId, pagination: _pagination });
  }
}
