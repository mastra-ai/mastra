import type { MastraMessageContentV2, MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType } from '@mastra/core/memory';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
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
import pgPromise from 'pg-promise';
import { validateConfig, isCloudSqlConfig, isConnectionStringConfig, isHostConfig } from '../shared/config';
import type { PostgresStoreConfig } from '../shared/config';
import { MemoryPG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { StoreOperationsPG } from './domains/operations';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';

export type { CreateIndexOptions, IndexInfo } from '@mastra/core/storage';

/**
 * Connection cache entry for reusing pg-promise instances and database objects
 * across multiple PostgresStore instances with the same connection config.
 */
interface ConnectionCacheEntry {
  pgp: pgPromise.IMain;
  db: pgPromise.IDatabase<{}>;
  refCount: number;
}

/**
 * Module-level cache to store pg-promise instances and database objects by connection config.
 * This prevents the "duplicate database object" warning from pg-promise when multiple
 * PostgresStore instances use the same connection configuration.
 */
const connectionCache = new Map<string, ConnectionCacheEntry>();

/**
 * Generates a cache key from the connection config.
 * Normalizes the config to create a consistent key for the same connection.
 */
function getConnectionCacheKey(config: PostgresStoreConfig): string {
  if (isConnectionStringConfig(config)) {
    // Normalize connection string (remove whitespace, sort query params if any)
    const normalized = config.connectionString.trim();
    const sslKey = config.ssl ? JSON.stringify(config.ssl) : '';
    const maxKey = config.max ? String(config.max) : '';
    const idleKey = config.idleTimeoutMillis ? String(config.idleTimeoutMillis) : '';
    return `connstr:${normalized}:ssl:${sslKey}:max:${maxKey}:idle:${idleKey}`;
  } else if (isHostConfig(config)) {
    // Create key from host config (include password to ensure different credentials don't share connections)
    const sslKey = config.ssl ? JSON.stringify(config.ssl) : '';
    const maxKey = config.max ? String(config.max) : '';
    const idleKey = config.idleTimeoutMillis ? String(config.idleTimeoutMillis) : '';
    return `host:${config.host}:${config.port}:${config.database}:${config.user}:${config.password}:ssl:${sslKey}:max:${maxKey}:idle:${idleKey}`;
  } else if (isCloudSqlConfig(config)) {
    // For Cloud SQL configs, use a more complex key since they can have functions
    // Use a hash of the relevant properties
    const keyParts = [
      'cloudsql',
      config.host || '',
      config.port || '',
      config.database || '',
      config.user || '',
      config.max ? String(config.max) : '',
      config.idleTimeoutMillis ? String(config.idleTimeoutMillis) : '',
      'stream' in config ? 'stream' : '',
    ];
    return keyParts.join(':');
  }
  // Fallback - should not happen due to validation
  return JSON.stringify(config);
}

export class PostgresStore extends MastraStorage {
  #db?: pgPromise.IDatabase<{}>;
  #pgp?: pgPromise.IMain;
  #config: PostgresStoreConfig;
  private schema: string;
  private isConnected: boolean = false;
  private connectionCacheKey?: string;
  private isSharedConnection: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    // Validation: connectionString or host/database/user/password must not be empty
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore', disableInit: config.disableInit });
      this.schema = config.schemaName || 'public';
      if (isConnectionStringConfig(config)) {
        this.#config = {
          id: config.id,
          connectionString: config.connectionString,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
          ssl: config.ssl,
        };
      } else if (isCloudSqlConfig(config)) {
        // Cloud SQL connector config
        this.#config = {
          ...config,
          id: config.id,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        };
      } else if (isHostConfig(config)) {
        this.#config = {
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
          'PostgresStore: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with `stream`).',
        );
      }
      this.stores = {} as StorageDomains;
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
    if (this.isConnected) {
      return;
    }

    try {
      this.isConnected = true;
      
      // Generate cache key for this connection config
      this.connectionCacheKey = getConnectionCacheKey(this.#config);
      
      // Check if we have a cached connection for this config
      const cached = connectionCache.get(this.connectionCacheKey);
      
      if (cached) {
        // Reuse existing pg-promise instance and database object
        this.#pgp = cached.pgp;
        this.#db = cached.db;
        cached.refCount++;
        this.isSharedConnection = true;
      } else {
        // Create new pg-promise instance and database object
        this.#pgp = pgPromise();
        this.#db = this.#pgp(this.#config as any);
        
        // Cache the connection for reuse
        connectionCache.set(this.connectionCacheKey, {
          pgp: this.#pgp,
          db: this.#db,
          refCount: 1,
        });
        this.isSharedConnection = false;
      }

      const operations = new StoreOperationsPG({ client: this.#db, schemaName: this.schema });
      const scores = new ScoresPG({ client: this.#db, operations, schema: this.schema });
      const workflows = new WorkflowsPG({ client: this.#db, operations, schema: this.schema });
      const memory = new MemoryPG({ client: this.#db, schema: this.schema, operations });
      const observability = new ObservabilityPG({ client: this.#db, operations, schema: this.schema });

      this.stores = {
        operations,
        scores,
        workflows,
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
          id: createStorageErrorId('PG', 'INIT', 'FAILED'),
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
    if (!this.#pgp || !this.connectionCacheKey) {
      return;
    }

    const cached = connectionCache.get(this.connectionCacheKey);
    
    if (cached) {
      cached.refCount--;
      
      // Only close the connection if this is the last reference
      if (cached.refCount <= 0) {
        connectionCache.delete(this.connectionCacheKey);
        cached.pgp.end();
      }
      // If there are still references, don't close - other stores are using it
    } else {
      // Not in cache, close directly
      this.#pgp.end();
    }
    
    // Reset connection state
    this.isConnected = false;
    this.#db = undefined;
    this.#pgp = undefined;
    this.connectionCacheKey = undefined;
    this.isSharedConnection = false;
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
