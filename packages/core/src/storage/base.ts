import type { MastraMessageContentV2, MastraMessageV2 } from '../agent';
import type { TracingStrategy } from '../ai-tracing';
import { MastraBase } from '../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraMessageV1, StorageThreadType } from '../memory/types';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '../scores';
import type { Trace } from '../telemetry';
import type { StepResult, WorkflowRunState } from '../workflows/types';

import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  TABLE_AI_SPANS,
} from './constants';
import type { TABLE_NAMES } from './constants';
import type {
  ScoresStorage,
  StoreOperations,
  WorkflowsStorage,
  TracesStorage,
  MemoryStorage,
  LegacyEvalsStorage,
  ObservabilityStorage,
} from './domains';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageResourceType,
  StoragePagination,
  ThreadSortOptions,
  WorkflowRun,
  WorkflowRuns,
  StorageGetTracesArg,
  PaginationArgs,
  StorageGetTracesPaginatedArg,
  AISpanRecord,
  AITraceRecord,
  AITracesPaginatedArg,
} from './types';

export type StorageDomains = {
  legacyEvals: LegacyEvalsStorage;
  operations: StoreOperations;
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  traces: TracesStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
};

export function ensureDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date : new Date(date);
}

export function serializeDate(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  const dateObj = ensureDate(date);
  return dateObj?.toISOString();
}

export function resolveMessageLimit({
  last,
  defaultLimit,
}: {
  last: number | false | undefined;
  defaultLimit: number;
}): number {
  // TODO: Figure out consistent default limit for all stores as some stores use 40 and some use no limit (Number.MAX_SAFE_INTEGER)
  if (typeof last === 'number') return Math.max(0, last);
  if (last === false) return 0;
  return defaultLimit;
}
export abstract class MastraStorage extends MastraBase {
  /** @deprecated import from { TABLE_WORKFLOW_SNAPSHOT } '@mastra/core/storage' instead */
  static readonly TABLE_WORKFLOW_SNAPSHOT = TABLE_WORKFLOW_SNAPSHOT;
  /** @deprecated import from { TABLE_EVALS } '@mastra/core/storage' instead */
  static readonly TABLE_EVALS = TABLE_EVALS;
  /** @deprecated import from { TABLE_MESSAGES } '@mastra/core/storage' instead */
  static readonly TABLE_MESSAGES = TABLE_MESSAGES;
  /** @deprecated import from { TABLE_THREADS } '@mastra/core/storage' instead */
  static readonly TABLE_THREADS = TABLE_THREADS;
  /** @deprecated import { TABLE_TRACES } from '@mastra/core/storage' instead */
  static readonly TABLE_TRACES = TABLE_TRACES;

  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  stores?: StorageDomains;

  constructor({ name }: { name: string }) {
    super({
      component: 'STORAGE',
      name,
    });
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    aiTracing?: boolean;
  } {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: false,
      aiTracing: false,
    };
  }

  protected ensureDate(date: Date | string | undefined): Date | undefined {
    return ensureDate(date);
  }

  protected serializeDate(date: Date | string | undefined): string | undefined {
    return serializeDate(date);
  }

  /**
   * Resolves limit for how many messages to fetch
   *
   * @param last The number of messages to fetch
   * @param defaultLimit The default limit to use if last is not provided
   * @returns The resolved limit
   */
  protected resolveMessageLimit({
    last,
    defaultLimit,
  }: {
    last: number | false | undefined;
    defaultLimit: number;
  }): number {
    return resolveMessageLimit({ last, defaultLimit });
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'TEXT';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'float':
        return 'FLOAT';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'jsonb':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
      case 'uuid':
        return "DEFAULT ''";
      case 'timestamp':
        return "DEFAULT '1970-01-01 00:00:00'";
      case 'integer':
      case 'float':
      case 'bigint':
        return 'DEFAULT 0';
      case 'jsonb':
        return "DEFAULT '{}'";
      default:
        return "DEFAULT ''";
    }
  }

  abstract createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void>;

  abstract insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void>;

  batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    if (this.stores?.traces) {
      return this.stores.traces.batchTraceInsert({ records });
    }
    return this.batchInsert({ tableName: TABLE_TRACES, records });
  }

  abstract load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null>;

  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  abstract getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]>;

  abstract saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType>;

  abstract updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType>;

  abstract deleteThread({ threadId }: { threadId: string }): Promise<void>;

  async getResourceById(_: { resourceId: string }): Promise<StorageResourceType | null> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  async saveResource(_: { resource: StorageResourceType }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  async updateResource(_: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  abstract getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  abstract getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  abstract getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]>;
  abstract getMessagesById({ messageIds }: { messageIds: string[]; format: 'v1' }): Promise<MastraMessageV1[]>;
  abstract getMessagesById({ messageIds }: { messageIds: string[]; format?: 'v2' }): Promise<MastraMessageV2[]>;
  abstract getMessagesById({
    messageIds,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]>;

  abstract saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  abstract saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  abstract saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]>;

  abstract updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]>;

  async deleteMessages(_messageIds: string[]): Promise<void> {
    throw new Error(
      `Message deletion is not supported by this storage adapter (${this.constructor.name}). ` +
        `The deleteMessages method needs to be implemented in the storage adapter.`,
    );
  }

  abstract getTraces(args: StorageGetTracesArg): Promise<Trace[]>;

  abstract getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }>;

  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (this.shouldCacheInit && (await this.hasInitialized)) {
      return;
    }

    const tableCreationTasks = [
      this.createTable({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      }),

      this.createTable({
        tableName: TABLE_EVALS,
        schema: TABLE_SCHEMAS[TABLE_EVALS],
      }),

      this.createTable({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
      }),

      this.createTable({
        tableName: TABLE_MESSAGES,
        schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      }),

      this.createTable({
        tableName: TABLE_TRACES,
        schema: TABLE_SCHEMAS[TABLE_TRACES],
      }),

      this.createTable({
        tableName: TABLE_SCORERS,
        schema: TABLE_SCHEMAS[TABLE_SCORERS],
      }),
    ];

    // Only create resources table for storage adapters that support it
    if (this.supports.resourceWorkingMemory) {
      tableCreationTasks.push(
        this.createTable({
          tableName: TABLE_RESOURCES,
          schema: TABLE_SCHEMAS[TABLE_RESOURCES],
        }),
      );
    }

    if (this.supports.aiTracing) {
      tableCreationTasks.push(
        this.createTable({
          tableName: TABLE_AI_SPANS,
          schema: TABLE_SCHEMAS[TABLE_AI_SPANS],
        }),
      );
    }

    this.hasInitialized = Promise.all(tableCreationTasks).then(() => true);

    await this.hasInitialized;

    await this?.alterTable?.({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });
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
    await this.init();

    const data = {
      workflow_name: workflowName,
      run_id: runId,
      snapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.logger.debug('Persisting workflow snapshot', { workflowName, runId, data });
    await this.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: data,
    });
  }

  abstract updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    runtimeContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
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
  }): Promise<WorkflowRunState | undefined>;

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    if (!this.hasInitialized) {
      await this.init();
    }
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    const d = await this.load<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    return d ? d.snapshot : null;
  }

  /**
   * SCORERS
   */

  abstract getScoreById({ id }: { id: string }): Promise<ScoreRowData | null>;

  abstract saveScore(score: ValidatedSaveScorePayload): Promise<{ score: ScoreRowData }>;

  abstract getScoresByScorerId({
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract getScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }>;

  abstract getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]>;

  abstract getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }>;

  abstract getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }>;

  /**
   * OBSERVABILITY
   */

  /**
   * Provides hints for AI tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   */
  public get aiTracingStrategy(): {
    preferred: TracingStrategy;
    supported: TracingStrategy[];
  } {
    if (this.stores?.observability) {
      return this.stores.observability.aiTracingStrategy;
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_TRACING_STRATEGY_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Creates a single AI span record in the storage provider.
   */
  async createAISpan(span: AISpanRecord): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.createAISpan(span);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_CREATE_AI_SPAN_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Updates a single AI span with partial data. Primarily used for realtime trace creation.
   */
  async updateAISpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.updateAISpan(params);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_UPDATE_AI_SPAN_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Retrieves a single AI trace with all its associated spans.
   */
  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    if (this.stores?.observability) {
      return this.stores.observability.getAITrace(traceId);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_AI_TRACE_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Retrieves a paginated list of AI traces with optional filtering.
   */
  async getAITracesPaginated(
    args: AITracesPaginatedArg,
  ): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    if (this.stores?.observability) {
      return this.stores.observability.getAITracesPaginated(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_GET_AI_TRACES_PAGINATED_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Creates multiple AI spans in a single batch.
   */
  async batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.batchCreateAISpans(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_BATCH_CREATE_AI_SPANS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Updates multiple AI spans in a single batch.
   */
  async batchUpdateAISpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.batchUpdateAISpans(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_BATCH_UPDATE_AI_SPANS_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }

  /**
   * Deletes multiple AI traces and all their associated spans in a single batch operation.
   */
  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    if (this.stores?.observability) {
      return this.stores.observability.batchDeleteAITraces(args);
    }
    throw new MastraError({
      id: 'MASTRA_STORAGE_BATCH_DELETE_AI_TRACES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `AI tracing is not supported by this storage adapter (${this.constructor.name})`,
    });
  }
}
