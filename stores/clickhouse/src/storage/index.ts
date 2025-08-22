import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { MastraStorage } from '@mastra/core/storage';
import type {
  TABLE_SCHEMAS,
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  StorageGetTracesArg,
  StorageGetTracesPaginatedArg,
  StoragePagination,
  StorageDomains,
  PaginationArgs,
  StorageResourceType,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { LegacyEvalsStorageClickhouse } from './domains/legacy-evals';
import { MemoryStorageClickhouse } from './domains/memory';
import { StoreOperationsClickhouse } from './domains/operations';
import { ScoresStorageClickhouse } from './domains/scores';
import { TracesStorageClickhouse } from './domains/traces';
import { WorkflowsStorageClickhouse } from './domains/workflows';

type IntervalUnit =
  | 'NANOSECOND'
  | 'MICROSECOND'
  | 'MILLISECOND'
  | 'SECOND'
  | 'MINUTE'
  | 'HOUR'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR';

export type ClickhouseConfig = {
  url: string;
  username: string;
  password: string;
  ttl?: {
    [TableKey in TABLE_NAMES]?: {
      row?: { interval: number; unit: IntervalUnit; ttlKey?: string };
      columns?: Partial<{
        [ColumnKey in keyof (typeof TABLE_SCHEMAS)[TableKey]]: {
          interval: number;
          unit: IntervalUnit;
          ttlKey?: string;
        };
      }>;
    };
  };
};

export class ClickhouseStore extends MastraStorage {
  protected db: ClickHouseClient;
  protected ttl: ClickhouseConfig['ttl'] = {};

  stores: StorageDomains;

  constructor(config: ClickhouseConfig) {
    super({ name: 'ClickhouseStore' });

    this.db = createClient({
      url: config.url,
      username: config.username,
      password: config.password,
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        date_time_output_format: 'iso', // This is crucial
        use_client_time_zone: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });
    this.ttl = config.ttl;

    const operations = new StoreOperationsClickhouse({ client: this.db, ttl: this.ttl });
    const workflows = new WorkflowsStorageClickhouse({ client: this.db, operations });
    const scores = new ScoresStorageClickhouse({ client: this.db, operations });
    const legacyEvals = new LegacyEvalsStorageClickhouse({ client: this.db, operations });
    const traces = new TracesStorageClickhouse({ client: this.db, operations });
    const memory = new MemoryStorageClickhouse({ client: this.db, operations });

    this.stores = {
      operations,
      workflows,
      scores,
      legacyEvals,
      traces,
      memory,
    };
  }

  get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: false,
    };
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
  }

  async getEvals(
    options: { agentName?: string; type?: 'test' | 'live' } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    return this.stores.legacyEvals.getEvals(options);
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    await this.stores.operations.batchInsert({ tableName, records });
    // await this.optimizeTable({ tableName });
  }

  async optimizeTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.command({
        query: `OPTIMIZE TABLE ${tableName} FINAL`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_OPTIMIZE_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async materializeTtl({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.command({
        query: `ALTER TABLE ${tableName} MATERIALIZE TTL;`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_MATERIALIZE_TTL_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
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

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.stores.operations.dropTable({ tableName });
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

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.stores.operations.insert({ tableName, record });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.stores.operations.load({ tableName, keys });
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

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    return this.stores.workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
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

  async getTraces(args: StorageGetTracesArg): Promise<any[]> {
    return this.stores.traces.getTraces(args);
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return this.stores.traces.getTracesPaginated(args);
  }

  async batchTraceInsert(args: { records: Trace[] }): Promise<void> {
    return this.stores.traces.batchTraceInsert(args);
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

  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    return this.stores.memory.getThreadsByResourceIdPaginated(args);
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
    return this.stores.memory.saveMessages(args);
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    return this.stores.memory.getMessagesPaginated(args);
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraMessageV2[]> {
    return this.stores.memory.updateMessages(args);
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

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(_score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(_score);
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

  async close(): Promise<void> {
    await this.db.close();
  }
}
