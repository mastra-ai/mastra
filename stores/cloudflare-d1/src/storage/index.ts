import type { D1Database } from '@cloudflare/workers-types';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType, MastraDBMessage } from '@mastra/core/memory';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type {
  PaginationInfo,
  StorageResourceType,
  WorkflowRun,
  StoragePagination,
  WorkflowRuns,
  StorageDomains,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import Cloudflare from 'cloudflare';
import { MemoryStorageD1 } from './domains/memory';
import { ScoresStorageD1 } from './domains/scores';
import { WorkflowsStorageD1 } from './domains/workflows';

/**
 * Base configuration options shared across D1 configurations
 */
export interface D1BaseConfig {
  /** Storage instance ID */
  id: string;
  /** Optional prefix for table names */
  tablePrefix?: string;
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
   * const storage = new D1Store({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new D1Store({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
}

/**
 * Configuration for D1 using the REST API
 */
export interface D1Config extends D1BaseConfig {
  /** Cloudflare account ID */
  accountId: string;
  /** Cloudflare API token with D1 access */
  apiToken: string;
  /** D1 database ID */
  databaseId: string;
}

export interface D1ClientConfig extends D1BaseConfig {
  /** D1 Client */
  client: D1Client;
}

/**
 * Configuration for D1 using the Workers Binding API
 */
export interface D1WorkersConfig extends D1BaseConfig {
  /** D1 database binding from Workers environment */
  binding: D1Database; // D1Database binding from Workers
}

/**
 * Combined configuration type supporting both REST API and Workers Binding API
 */
export type D1StoreConfig = D1Config | D1WorkersConfig | D1ClientConfig;

export type D1QueryResult = Awaited<ReturnType<Cloudflare['d1']['database']['query']>>['result'];
export interface D1Client {
  query(args: { sql: string; params: string[] }): Promise<{ result: D1QueryResult }>;
}

export class D1Store extends MastraStorage {
  private client?: D1Client;
  private binding?: D1Database;
  private tablePrefix: string;

  stores: StorageDomains;

  /**
   * Creates a new D1Store instance
   * @param config Configuration for D1 access (either REST API or Workers Binding API)
   */
  constructor(config: D1StoreConfig) {
    try {
      super({ id: config.id, name: 'D1', disableInit: config.disableInit });

      if (config.tablePrefix && !/^[a-zA-Z0-9_]*$/.test(config.tablePrefix)) {
        throw new Error('Invalid tablePrefix: only letters, numbers, and underscores are allowed.');
      }

      this.tablePrefix = config.tablePrefix || '';

      // Determine which API to use based on provided config
      if ('binding' in config) {
        if (!config.binding) {
          throw new Error('D1 binding is required when using Workers Binding API');
        }
        this.binding = config.binding;
        this.logger.info('Using D1 Workers Binding API');
      } else if ('client' in config) {
        if (!config.client) {
          throw new Error('D1 client is required when using D1ClientConfig');
        }
        this.client = config.client;
        this.logger.info('Using D1 Client');
      } else {
        if (!config.accountId || !config.databaseId || !config.apiToken) {
          throw new Error('accountId, databaseId, and apiToken are required when using REST API');
        }
        const cfClient = new Cloudflare({
          apiToken: config.apiToken,
        });
        this.client = {
          query: ({ sql, params }) => {
            return cfClient.d1.database.query(config.databaseId, {
              account_id: config.accountId,
              sql,
              params,
            });
          },
        };

        this.logger.info('Using D1 REST API');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: 'Error initializing D1Store',
        },
        error,
      );
    }

    const domainConfig = {
      client: this.client,
      binding: this.binding,
      tablePrefix: this.tablePrefix,
    };

    const scores = new ScoresStorageD1(domainConfig);
    const workflows = new WorkflowsStorageD1(domainConfig);
    const memory = new MemoryStorageD1(domainConfig);

    this.stores = {
      scores,
      workflows,
      memory,
    };
  }

  get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      listScoresBySpan: true,
    };
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

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.saveMessages(args);
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

  async loadWorkflowSnapshot(params: { workflowName: string; runId: string }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.loadWorkflowSnapshot(params);
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

  async updateMessages(_args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(_args);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
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

  async getScoreById({ id: _id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id: _id });
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
   * Close the database connection
   * No explicit cleanup needed for D1 in either REST or Workers Binding mode
   */
  async close(): Promise<void> {
    this.logger.debug('Closing D1 connection');
    // No explicit cleanup needed for D1
  }
}
