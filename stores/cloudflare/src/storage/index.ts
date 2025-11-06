import type { KVNamespace } from '@cloudflare/workers-types';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StorageThreadType, MastraDBMessage } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type {
  TABLE_NAMES,
  StorageColumn,
  WorkflowRuns,
  WorkflowRun,
  PaginationInfo,
  StoragePagination,
  StorageDomains,
  StorageResourceType,
  StorageListWorkflowRunsInput,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import Cloudflare from 'cloudflare';
import { MemoryStorageCloudflare } from './domains/memory';
import { StoreOperationsCloudflare } from './domains/operations';
import { ScoresStorageCloudflare } from './domains/scores';
import { WorkflowsStorageCloudflare } from './domains/workflows';
import { isWorkersConfig } from './types';
import type { CloudflareStoreConfig, CloudflareWorkersConfig, CloudflareRestConfig, RecordTypes } from './types';

export class CloudflareStore extends MastraStorage {
  stores: StorageDomains;
  private client?: Cloudflare;
  private accountId?: string;
  private namespacePrefix: string;
  private bindings?: Record<TABLE_NAMES, KVNamespace>;

  private validateWorkersConfig(config: CloudflareStoreConfig): asserts config is CloudflareWorkersConfig {
    if (!isWorkersConfig(config)) {
      throw new Error('Invalid Workers API configuration');
    }
    if (!config.bindings) {
      throw new Error('KV bindings are required when using Workers Binding API');
    }

    // Validate all required table bindings exist
    const requiredTables = [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_SCORERS] as const;

    for (const table of requiredTables) {
      if (!(table in config.bindings)) {
        throw new Error(`Missing KV binding for table: ${table}`);
      }
    }
  }

  private validateRestConfig(config: CloudflareStoreConfig): asserts config is CloudflareRestConfig {
    if (isWorkersConfig(config)) {
      throw new Error('Invalid REST API configuration');
    }
    if (!config.accountId?.trim()) {
      throw new Error('accountId is required for REST API');
    }
    if (!config.apiToken?.trim()) {
      throw new Error('apiToken is required for REST API');
    }
  }

  public get supports() {
    const supports = super.supports;
    supports.listScoresBySpan = true;
    supports.resourceWorkingMemory = true;
    supports.selectByIncludeResourceScope = true;
    return supports;
  }

  constructor(config: CloudflareStoreConfig) {
    super({ id: config.id, name: 'Cloudflare' });

    try {
      if (isWorkersConfig(config)) {
        this.validateWorkersConfig(config);
        this.bindings = config.bindings;
        this.namespacePrefix = config.keyPrefix?.trim() || '';
        this.logger.info('Using Cloudflare KV Workers Binding API');
      } else {
        this.validateRestConfig(config);
        this.accountId = config.accountId.trim();
        this.namespacePrefix = config.namespacePrefix?.trim() || '';
        this.client = new Cloudflare({
          apiToken: config.apiToken.trim(),
        });
        this.logger.info('Using Cloudflare KV REST API');
      }

      const operations = new StoreOperationsCloudflare({
        accountId: this.accountId,
        client: this.client,
        namespacePrefix: this.namespacePrefix,
        bindings: this.bindings,
      });

      const workflows = new WorkflowsStorageCloudflare({
        operations,
      });

      const memory = new MemoryStorageCloudflare({
        operations,
      });

      const scores = new ScoresStorageCloudflare({
        operations,
      });

      this.stores = {
        operations,
        workflows,
        memory,
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
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

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    return this.stores.operations.alterTable(_args);
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.clearTable({ tableName });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.dropTable({ tableName });
  }

  async insert<T extends TABLE_NAMES>({
    tableName,
    record,
  }: {
    tableName: T;
    record: Record<string, any>;
  }): Promise<void> {
    return this.stores.operations.insert({ tableName, record });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.stores.operations.load({ tableName, keys });
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

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.listMessagesById({ messageIds });
  }

  async persistWorkflowSnapshot(params: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    return this.stores.workflows.persistWorkflowSnapshot(params);
  }

  async loadWorkflowSnapshot(params: { workflowName: string; runId: string }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.loadWorkflowSnapshot(params);
  }

  async batchInsert<T extends TABLE_NAMES>(input: { tableName: T; records: Partial<RecordTypes[T]>[] }): Promise<void> {
    return this.stores.operations.batchInsert(input);
  }

  async listWorkflowRuns({
    workflowName,
    perPage = 20,
    page = 0,
    resourceId,
    fromDate,
    toDate,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns({
      workflowName,
      perPage,
      page,
      resourceId,
      fromDate,
      toDate,
    });
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName: string;
  }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowName });
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(args);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
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
    return this.stores.scores.listScoresByEntityId({ entityId, entityType, pagination });
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

  async close(): Promise<void> {
    // No explicit cleanup needed
  }
}
