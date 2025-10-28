import { existsSync } from 'fs';
import type { MastraMessageV2 } from '../agent';
import type { MastraMessageV1, StorageThreadType } from '../memory/types';
import type { ScoreRowData, ScoringSource } from '../scores/types';
import type { StepResult, WorkflowRunState } from '../workflows/types';
import { MastraStorage } from './base';
import type { StorageDomains } from './base';
import type { TABLE_NAMES } from './constants';
import { InMemoryLegacyEvals } from './domains/legacy-evals/inmemory';
import type { InMemoryEvals } from './domains/legacy-evals/inmemory';
import { InMemoryMemory } from './domains/memory/inmemory';
import type { InMemoryThreads, InMemoryResources, InMemoryMessages } from './domains/memory/inmemory';
import { ObservabilityInMemory } from './domains/observability/inmemory';
import type { InMemoryObservability } from './domains/observability/inmemory';
import { StoreOperationsInMemory } from './domains/operations/inmemory';
import { ScoresInMemory } from './domains/scores/inmemory';
import type { InMemoryScores } from './domains/scores/inmemory';
import { WorkflowsInMemory } from './domains/workflows';
import type { InMemoryWorkflows } from './domains/workflows/inmemory';

import type {
  AISpanRecord,
  AITraceRecord,
  EvalRow,
  PaginationArgs,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StoragePagination,
  StorageResourceType,
  ThreadSortOptions,
  WorkflowRun,
  WorkflowRuns,
  StorageListMessagesInput,
  StorageListMessagesOutput,
} from './types';
import { readFile, writeFile } from 'fs/promises';

export class InMemoryStore extends MastraStorage {
  stores: StorageDomains;

  constructor() {
    super({ name: 'InMemoryStorage' });
    // MockStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);

    const operationsStorage = new StoreOperationsInMemory();

    const database = operationsStorage.getDatabase();

    const scoresStorage = new ScoresInMemory({
      collection: database.mastra_scorers as InMemoryScores,
    });

    const workflowsStorage = new WorkflowsInMemory({
      collection: database.mastra_workflow_snapshot as InMemoryWorkflows,
      operations: operationsStorage,
    });

    const memoryStorage = new InMemoryMemory({
      collection: {
        threads: database.mastra_threads as InMemoryThreads,
        resources: database.mastra_resources as InMemoryResources,
        messages: database.mastra_messages as InMemoryMessages,
      },
      operations: operationsStorage,
    });

    const legacyEvalsStorage = new InMemoryLegacyEvals({
      collection: database.mastra_evals as InMemoryEvals,
    });

    const observabilityStorage = new ObservabilityInMemory({
      collection: database.mastra_ai_spans as InMemoryObservability,
      operations: operationsStorage,
    });

    this.stores = {
      legacyEvals: legacyEvalsStorage,
      operations: operationsStorage,
      workflows: workflowsStorage,
      scores: scoresStorage,
      memory: memoryStorage,
      observability: observabilityStorage,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      aiTracing: true,
      indexManagement: false,
      getScoresBySpan: true,
    };
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
    await this.stores.workflows.persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot });
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

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await this.stores.operations.createTable({ tableName, schema });
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
    await this.stores.operations.alterTable({ tableName, schema, ifNotExists });
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.stores.operations.clearTable({ tableName });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.stores.operations.dropTable({ tableName });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    await this.stores.operations.insert({ tableName, record });
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

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    await this.stores.operations.batchInsert({ tableName, records });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.stores.operations.load({ tableName, keys });
  }

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

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<MastraMessageV2[]> {
    return this.stores.memory.listMessagesById({ messageIds });
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages(args: { messages: Partial<MastraMessageV2> & { id: string }[] }): Promise<MastraMessageV2[]> {
    return this.stores.memory.updateMessages(args);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
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

  async listMessages(args: StorageListMessagesInput): Promise<PaginationInfo & { messages: MastraMessageV2[] }> {
    return this.stores.memory.listMessages(args);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
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
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByEntityId({ entityId, entityType, pagination });
  }

  async getScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresBySpan({ traceId, spanId, pagination });
  }

  async getEvals(
    options: { agentName?: string; type?: 'test' | 'live' } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    return this.stores.legacyEvals.getEvals(options);
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
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

  async createAISpan(span: AISpanRecord): Promise<void> {
    return this.stores.observability!.createAISpan(span);
  }

  async updateAISpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    return this.stores.observability!.updateAISpan(params);
  }

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    return this.stores.observability!.getAITrace(traceId);
  }

  async batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    return this.stores.observability!.batchCreateAISpans(args);
  }

  async batchUpdateAISpans(args: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    return this.stores.observability!.batchUpdateAISpans(args);
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    return this.stores.observability!.batchDeleteAITraces(args);
  }

  /**
   * Hydrate storage state from a JSON file
   */
  async hydrate(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Storage file not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    let data;
    try {
      data = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse JSON from ${filePath}. File size: ${content.length} bytes`);
      if (error instanceof SyntaxError && error.message.includes('position')) {
        // Try to find the problematic area
        const match = error.message.match(/position (\d+)/);
        if (match) {
          const position = parseInt(match[1] || '0');
          const start = Math.max(0, position - 100);
          const end = Math.min(content.length, position + 100);
          console.error(`Content around error position ${position}:`);
          console.error(content.substring(start, end));
        }
      }
      throw error;
    }

    // Convert arrays back to Maps
    for (const [tableName, tableData] of Object.entries(data)) {
      this.stores.operations.batchInsert({ tableName: tableName as TABLE_NAMES, records: tableData as any });
    }
  }

  /**
   * Persist the current storage state to a JSON file
   */
  async persist(filePath: string): Promise<void> {
    const data: Record<string, any> = {};

    const operationsDatabase = (this.stores.operations as StoreOperationsInMemory).getDatabase();

    // Convert Maps to arrays for JSON serialization
    for (const [tableName, tableData] of Object.entries(operationsDatabase)) {
      data[tableName] = Array.from(tableData.entries());
    }

    await writeFile(filePath, JSON.stringify(data, null, 2));
  }
}

export const MockStore = InMemoryStore;
