import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MastraStorage } from '@mastra/core/storage';
import type {
  TABLE_SCHEMAS,
  PaginationInfo,
  StorageColumn,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  StoragePagination,
  StorageDomains,
  StorageResourceType,
  StorageListWorkflowRunsInput,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { MemoryStorageClickhouse } from './domains/memory';
import { StoreOperationsClickhouse } from './domains/operations';
import { ScoresStorageClickhouse } from './domains/scores';
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
  id: string;
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
    super({ id: config.id, name: 'ClickhouseStore' });

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
    const memory = new MemoryStorageClickhouse({ client: this.db, operations });

    this.stores = {
      operations,
      workflows,
      scores,
      memory,
    };
  }

  get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    listScoresBySpan: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: false,
      listScoresBySpan: true,
    };
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

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns({ workflowName, fromDate, toDate, perPage, page, resourceId });
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

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
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

  async close(): Promise<void> {
    await this.db.close();
  }
}
