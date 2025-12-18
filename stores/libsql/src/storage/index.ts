import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import type { MastraMessageContentV2, MastraDBMessage } from '@mastra/core/agent';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType } from '@mastra/core/memory';
import { MastraStorage } from '@mastra/core/storage';
import type {
  PaginationInfo,
  StoragePagination,
  StorageResourceType,
  WorkflowRun,
  WorkflowRuns,
  StorageDomains,
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';

import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { AgentsLibSQL } from './domains/agents';
import { MemoryLibSQL } from './domains/memory';
import { ObservabilityLibSQL } from './domains/observability';
import { ScoresLibSQL } from './domains/scores';
import { WorkflowsLibSQL } from './domains/workflows';

/**
 * Base configuration options shared across LibSQL configurations
 */
export type LibSQLBaseConfig = {
  id: string;
  /**
   * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
   * @default 5
   */
  maxRetries?: number;
  /**
   * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
   * The backoff time will double with each retry (exponential backoff).
   * @default 100
   */
  initialBackoffMs?: number;
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
   * const storage = new LibSQLStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new LibSQLStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
};

export type LibSQLConfig =
  | (LibSQLBaseConfig & {
    url: string;
    authToken?: string;
  })
  | (LibSQLBaseConfig & {
    client: Client;
  });

export class LibSQLStore extends MastraStorage {
  private client: Client;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  stores: StorageDomains;

  constructor(config: LibSQLConfig) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('LibSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: `LibSQLStore`, disableInit: config.disableInit });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;

    if ('url' in config) {
      // need to re-init every time for in memory dbs or the tables might not exist
      if (config.url.endsWith(':memory:')) {
        this.shouldCacheInit = false;
      }

      this.client = createClient({
        url: config.url,
        ...(config.authToken ? { authToken: config.authToken } : {}),
      });

      // Set PRAGMAs for better concurrency, especially for file-based databases
      if (config.url.startsWith('file:') || config.url.includes(':memory:')) {
        this.client
          .execute('PRAGMA journal_mode=WAL;')
          .then(() => this.logger.debug('LibSQLStore: PRAGMA journal_mode=WAL set.'))
          .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA journal_mode=WAL.', err));
        this.client
          .execute('PRAGMA busy_timeout = 5000;') // 5 seconds
          .then(() => this.logger.debug('LibSQLStore: PRAGMA busy_timeout=5000 set.'))
          .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA busy_timeout.', err));
      }
    } else {
      this.client = config.client;
    }

    const domainConfig = {
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    };

    const scores = new ScoresLibSQL(domainConfig);
    const workflows = new WorkflowsLibSQL(domainConfig);
    const memory = new MemoryLibSQL(domainConfig);
    const observability = new ObservabilityLibSQL(domainConfig);
    const agents = new AgentsLibSQL(domainConfig);

    this.stores = {
      scores,
      workflows,
      memory,
      observability,
      agents,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      observabilityInstance: true,
      listScoresBySpan: true,
      agents: true,
    };
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
    const result = await this.stores.memory.saveMessages({ messages: args.messages });
    return { messages: result.messages };
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages({ messages });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
  }

  async listScoresByScorerId({
    scorerId,
    entityId,
    entityType,
    source,
    pagination,
  }: {
    scorerId: string;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.listScoresByScorerId({ scorerId, entityId, entityType, source, pagination });
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

  /**
   * WORKFLOWS
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

  async createSpan(span: SpanRecord): Promise<void> {
    return this.stores.observability!.createSpan(span);
  }

  async updateSpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    return this.stores.observability!.updateSpan(params);
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    return this.stores.observability!.getTrace(traceId);
  }

  async getTracesPaginated(args: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    return this.stores.observability!.getTracesPaginated(args);
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

  async batchCreateSpans(args: { records: SpanRecord[] }): Promise<void> {
    return this.stores.observability!.batchCreateSpans(args);
  }

  async batchUpdateSpans(args: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    return this.stores.observability!.batchUpdateSpans(args);
  }
}

export { LibSQLStore as DefaultStorage };
