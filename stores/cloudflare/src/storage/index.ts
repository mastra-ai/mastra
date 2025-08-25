import type { KVNamespace } from '@cloudflare/workers-types';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2 } from '@mastra/core/memory';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_SCORERS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type {
  TABLE_NAMES,
  StorageColumn,
  StorageGetMessagesArg,
  EvalRow,
  WorkflowRuns,
  WorkflowRun,
  StorageGetTracesArg as _StorageGetTracesArg,
  StorageGetTracesPaginatedArg,
  PaginationInfo,
  StoragePagination,
  PaginationArgs,
  StorageDomains,
  StorageResourceType,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import Cloudflare from 'cloudflare';
import { LegacyEvalsStorageCloudflare } from './domains/legacy-evals';
import { MemoryStorageCloudflare } from './domains/memory';
import { StoreOperationsCloudflare } from './domains/operations';
import { ScoresStorageCloudflare } from './domains/scores';
import { TracesStorageCloudflare } from './domains/traces';
import { WorkflowsStorageCloudflare } from './domains/workflows';
import { isWorkersConfig } from './types';
import type { CloudflareStoreConfig, RecordTypes } from './types';

export class CloudflareStore extends MastraStorage {
  stores: StorageDomains;
  private client?: Cloudflare;
  private accountId?: string;
  private namespacePrefix: string;
  private bindings?: Record<TABLE_NAMES, KVNamespace>;

  private validateWorkersConfig(
    config: CloudflareStoreConfig,
  ): asserts config is { bindings: Record<TABLE_NAMES, KVNamespace>; keyPrefix?: string } {
    if (!isWorkersConfig(config)) {
      throw new Error('Invalid Workers API configuration');
    }
    if (!config.bindings) {
      throw new Error('KV bindings are required when using Workers Binding API');
    }

    // Validate all required table bindings exist
    const requiredTables = [
      TABLE_THREADS,
      TABLE_MESSAGES,
      TABLE_WORKFLOW_SNAPSHOT,
      TABLE_EVALS,
      TABLE_SCORERS,
      TABLE_TRACES,
    ] as const;

    for (const table of requiredTables) {
      if (!(table in config.bindings)) {
        throw new Error(`Missing KV binding for table: ${table}`);
      }
    }
  }

  private validateRestConfig(
    config: CloudflareStoreConfig,
  ): asserts config is { accountId: string; apiToken: string; namespacePrefix?: string } {
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

  constructor(config: CloudflareStoreConfig) {
    super({ name: 'Cloudflare' });

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

      const legacyEvals = new LegacyEvalsStorageCloudflare({
        operations,
      });

      const workflows = new WorkflowsStorageCloudflare({
        operations,
      });

      const traces = new TracesStorageCloudflare({
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
        legacyEvals,
        workflows,
        traces,
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

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    return this.stores.memory.getThreadsByResourceId({ resourceId });
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

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    return this.stores.memory.saveMessages(args);
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    return this.stores.memory.getMessages({ threadId, resourceId, selectBy, format });
  }

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

  async persistWorkflowSnapshot(params: {
    workflowName: string;
    runId: string;
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

  async getTraces({
    name,
    scope,
    page = 0,
    perPage = 100,
    attributes,
    fromDate,
    toDate,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any[]> {
    return this.stores.traces.getTraces({
      name,
      scope,
      page,
      perPage,
      attributes,
      fromDate,
      toDate,
    });
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
  }

  async getEvals(
    options: { agentName?: string; type?: 'test' | 'live'; dateRange?: { start?: Date; end?: Date } } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    return this.stores.legacyEvals.getEvals(options);
  }

  async getWorkflowRuns({
    workflowName,
    limit = 20,
    offset = 0,
    resourceId,
    fromDate,
    toDate,
  }: {
    workflowName?: string;
    limit?: number;
    offset?: number;
    resourceId?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<WorkflowRuns> {
    return this.stores.workflows.getWorkflowRuns({
      workflowName,
      limit,
      offset,
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

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return this.stores.traces.getTracesPaginated(args);
  }

  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    return this.stores.memory.getThreadsByResourceIdPaginated(args);
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg,
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    return this.stores.memory.getMessagesPaginated(args);
  }

  async updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    return this.stores.memory.updateMessages(args);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
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

  async getScoresByScorerId({
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
    return this.stores.scores.getScoresByScorerId({ scorerId, entityId, entityType, source, pagination });
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
