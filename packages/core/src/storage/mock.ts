import type { MastraDBMessage } from '../agent';
import type { StorageThreadType } from '../memory/types';
import type { ScoreRowData, ScoringSource } from '../scores/types';
import type { StepResult, WorkflowRunState } from '../workflows/types';
import { MastraStorage } from './base';
import type { StorageDomains } from './base';
import type { TABLE_NAMES } from './constants';
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
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StoragePagination,
  StorageResourceType,
  WorkflowRun,
} from './types';

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

    const observabilityStorage = new ObservabilityInMemory({
      collection: database.mastra_ai_spans as InMemoryObservability,
      operations: operationsStorage,
    });

    this.stores = {
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

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    await this.stores.operations.batchInsert({ tableName, records });
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

  async getMessages({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.getMessages({ threadId, resourceId, selectBy }).catch(() => ({ messages: [] }));
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.listMessagesById({ messageIds });
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages(args: { messages: (Partial<MastraDBMessage> & { id: string })[] }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(args);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
  }

  async getMessagesPaginated({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<PaginationInfo & { messages: MastraDBMessage[] }> {
    return this.stores.memory.getMessagesPaginated({ threadId, resourceId, selectBy });
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
}

export const MockStore = InMemoryStore;
