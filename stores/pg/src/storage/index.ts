import type { MastraMessageContentV2, MastraMessageV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import type { ScoreRowData } from '@mastra/core/scores';
import { MastraStorage } from '@mastra/core/storage';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  StorageGetTracesPaginatedArg,
  StorageResourceType,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  PaginationArgs,
  StoragePagination,
  StorageDomains,
  ThreadSortOptions,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';
import { LegacyEvalsPG } from './domains/legacy-evals';
import { MemoryPG } from './domains/memory';
import { StoreOperationsPG } from './domains/operations';
import { ScoresPG } from './domains/scores';
import { TracesPG } from './domains/traces';
import { WorkflowsPG } from './domains/workflows';

export type PostgresConfig = {
  schemaName?: string;
} & (
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean | ISSLConfig;
    }
  | {
      connectionString: string;
    }
);

export class PostgresStore extends MastraStorage {
  public db: pgPromise.IDatabase<{}>;
  public pgp: pgPromise.IMain;
  private client: pgPromise.IDatabase<{}>;
  private schema?: string;

  stores: StorageDomains;

  constructor(config: PostgresConfig) {
    // Validation: connectionString or host/database/user/password must not be empty
    try {
      if ('connectionString' in config) {
        if (
          !config.connectionString ||
          typeof config.connectionString !== 'string' ||
          config.connectionString.trim() === ''
        ) {
          throw new Error(
            'PostgresStore: connectionString must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.',
          );
        }
      } else {
        const required = ['host', 'database', 'user', 'password'];
        for (const key of required) {
          if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
            throw new Error(
              `PostgresStore: ${key} must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`,
            );
          }
        }
      }
      super({ name: 'PostgresStore' });
      this.pgp = pgPromise();
      this.schema = config.schemaName || 'public';
      this.db = this.pgp(
        `connectionString` in config
          ? { connectionString: config.connectionString }
          : {
              host: config.host,
              port: config.port,
              database: config.database,
              user: config.user,
              password: config.password,
              ssl: config.ssl,
            },
      );

      this.client = this.db;

      const operations = new StoreOperationsPG({ client: this.client, schemaName: this.schema });
      const scores = new ScoresPG({ client: this.client, operations, schema: this.schema });
      const traces = new TracesPG({ client: this.client, operations, schema: this.schema });
      const workflows = new WorkflowsPG({ client: this.client, operations, schema: this.schema });
      const legacyEvals = new LegacyEvalsPG({ client: this.client, schema: this.schema });
      const memory = new MemoryPG({ client: this.client, schema: this.schema, operations });

      this.stores = {
        operations,
        scores,
        traces,
        workflows,
        legacyEvals,
        memory,
      };
    } catch (e) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_INITIALIZATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
    };
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    return this.stores.legacyEvals.getEvals(options);
  }

  /**
   * @deprecated use getTracesPaginated instead
   */
  public async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    return this.stores.traces.getTraces(args);
  }

  public async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return this.stores.traces.getTracesPaginated(args);
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    return this.stores.traces.batchTraceInsert({ records });
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

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  public async getThreadsByResourceId(args: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    return this.stores.memory.getThreadsByResourceId(args);
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    return this.stores.memory.getThreadsByResourceIdPaginated(args);
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

  /**
   * @deprecated use getMessagesPaginated instead
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    return this.stores.memory.getMessages(args);
  }

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    return this.stores.memory.getMessagesPaginated(args);
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraMessageV2[]> {
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

  async close(): Promise<void> {
    this.pgp.end();
  }

  /**
   * Scorers
   */
  async getScoreById({ id: _id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id: _id });
  }

  async getScoresByScorerId({
    scorerId: _scorerId,
    pagination: _pagination,
  }: {
    scorerId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByScorerId({ scorerId: _scorerId, pagination: _pagination });
  }

  async saveScore(_score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(_score);
  }

  async getScoresByRunId({
    runId: _runId,
    pagination: _pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByRunId({ runId: _runId, pagination: _pagination });
  }

  async getScoresByEntityId({
    entityId: _entityId,
    entityType: _entityType,
    pagination: _pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByEntityId({
      entityId: _entityId,
      entityType: _entityType,
      pagination: _pagination,
    });
  }
}
