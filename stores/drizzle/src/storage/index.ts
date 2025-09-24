import { MastraStorage } from '@mastra/core/storage';
import type {
  StorageDomains,
  StorageColumn,
  TABLE_NAMES,
  ThreadSortOptions,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  StorageGetTracesPaginatedArg,
  PaginationInfo,
  StoragePagination,
  EvalRow,
  PaginationArgs,
  WorkflowRuns,
  WorkflowRun,
} from '@mastra/core/storage';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2 } from '@mastra/core/memory';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { ScoreRowData, ValidatedSaveScorePayload, ScoringSource } from '@mastra/core/scores';

// Domain imports
import { MemoryDrizzle } from './domains/memory';
import { WorkflowsDrizzle } from './domains/workflows';
import { TracesDrizzle } from './domains/traces';
import { ScoresDrizzle } from './domains/scores';
import { OperationsDrizzle } from './domains/operations';
import { ObservabilityDrizzle } from './domains/observability';
import { LegacyEvalsDrizzle } from './domains/legacy-evals';

export interface DrizzleConfig {
  dialect: 'postgresql' | 'mysql' | 'sqlite';
  connectionString?: string;
  // Additional connection options can be added later
}

export class DrizzleStore extends MastraStorage {
  private db?: any; // Will be Drizzle instance
  private schema?: any; // Will be schema definitions
  private dialect: 'postgresql' | 'mysql' | 'sqlite';
  private isInitialized: boolean = false;

  stores: StorageDomains;

  constructor(config: DrizzleConfig) {
    super({ name: 'DrizzleStore' });
    this.dialect = config.dialect;

    // For SQLite in-memory databases, disable init caching
    // They need to recreate tables on each init
    if (config.dialect === 'sqlite' && config.connectionString === ':memory:') {
      this.shouldCacheInit = false;
    }

    // Initialize with empty stores - will be populated in init()
    this.stores = {} as StorageDomains;
  }

  async init(): Promise<void> {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      return;
    }

    // TODO: Initialize Drizzle connection based on dialect
    // For now, we'll just create the domain instances with null db/schema

    // Placeholder db and schema until we implement actual connection
    this.db = null;
    this.schema = null;

    // Initialize all domain stores
    const memory = new MemoryDrizzle({ db: this.db, schema: this.schema });
    const workflows = new WorkflowsDrizzle({ db: this.db, schema: this.schema });
    const traces = new TracesDrizzle({ db: this.db, schema: this.schema });
    const scores = new ScoresDrizzle({ db: this.db, schema: this.schema });
    const operations = new OperationsDrizzle({
      db: this.db,
      schema: this.schema,
      dialect: this.dialect,
    });
    const observability = new ObservabilityDrizzle({ db: this.db, schema: this.schema });
    const legacyEvals = new LegacyEvalsDrizzle({ db: this.db, schema: this.schema });

    this.stores = {
      memory,
      workflows,
      traces,
      scores,
      operations,
      observability,
      legacyEvals,
    };

    // Mark as initialized before calling super.init() to prevent concurrent initialization
    this.isInitialized = true;

    await super.init();
  }

  async close(): Promise<void> {
    // TODO: Close Drizzle connection when implemented
    // This will depend on the specific dialect and connection type
  }

  /**
   * Get the raw Drizzle database instance for advanced queries
   */
  getDb() {
    if (!this.db) {
      throw new Error('DrizzleStore: Database not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Get the schema definitions
   */
  getSchemas() {
    if (!this.schema) {
      throw new Error('DrizzleStore: Schema not initialized. Call init() first.');
    }
    return this.schema;
  }

  /**
   * Transaction wrapper
   */
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    // Using parameter to avoid unused variable warning
    void fn;
    // TODO: Implement with Drizzle transaction
    throw new Error('DrizzleStore.transaction not implemented');
  }

  /**
   * Check if the store supports specific features
   */
  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: false, // Tables should be created via migrations
      deleteMessages: true,
      aiTracing: true,
      indexManagement: false, // Indexes should be managed via migrations
    };
  }

  // Abstract method implementations - delegate to domain stores

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // Tables should be created via migrations, not runtime
    // Using parameters to avoid unused variable warnings
    void tableName;
    void schema;
    throw new Error('DrizzleStore: Tables should be created via migrations, not runtime');
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.clearTable({ tableName });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.dropTable({ tableName });
  }

  async alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    return this.stores.operations.alterTable(args);
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.stores.operations.insert({ tableName, record });
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return this.stores.operations.batchInsert({ tableName, records });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    return this.stores.operations.load({ tableName, keys });
  }

  // Memory domain methods
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.stores.memory.getThreadById({ threadId });
  }

  async getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    return this.stores.memory.getThreadsByResourceId({ resourceId, orderBy, sortDirection });
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

  async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    return this.stores.memory.getThreadsByResourceIdPaginated(args);
  }

  // Message methods with overloads
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessages(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    return this.stores.memory.getMessages(args as any);
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

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    return this.stores.memory.saveMessages(args as any);
  }

  async updateMessages(args: { messages: any[] }): Promise<MastraMessageV2[]> {
    return this.stores.memory.updateMessages(args);
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    return this.stores.memory.getMessagesPaginated(args);
  }

  // Traces domain methods
  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    return this.stores.traces.getTraces(args);
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return this.stores.traces.getTracesPaginated(args);
  }

  // Workflow domain methods
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

  async getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns> {
    return this.stores.workflows.getWorkflowRuns(args);
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById(args);
  }

  // Scores domain methods
  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: ValidatedSaveScorePayload): Promise<{ score: ScoreRowData }> {
    // ValidatedSaveScorePayload needs to be converted to the correct format for the scores domain
    // For now, pass it as-is and handle the conversion in the domain implementation
    return this.stores.scores.saveScore(score as any);
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

  async getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByRunId({ runId, pagination });
  }

  async getScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByEntityId({ entityId, entityType, pagination });
  }

  // Legacy Evals domain methods
  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    return this.stores.legacyEvals.getEvals(options);
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
  }
}
