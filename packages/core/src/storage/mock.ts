import { MessageList } from '../agent';
import type { MastraMessageV2 } from '../agent';
import type { ScoreRowData } from '../eval';
import type { MastraMessageV1, StorageThreadType } from '../memory/types';
import type { Trace } from '../telemetry';
import type { WorkflowRunState } from '../workflows';
import { MastraStorage } from './base';
import type { TABLE_NAMES } from './constants';
import { StoreOperationsInMemory } from './domains/operations/inmemory';
import { ScoresInMemory } from './domains/scores/inmemory';
import type { InMemoryScores } from './domains/scores/inmemory';
import { TracesInMemory } from './domains/traces/inmemory';
import type { InMemoryTraces } from './domains/traces/inmemory';
import { WorkflowsInMemory } from './domains/workflows';
import type { InMemoryWorkflows } from './domains/workflows/inmemory';

import type {
  EvalRow,
  PaginationArgs,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  StorageGetTracesPaginatedArg,
  StoragePagination,
  StorageResourceType,
  WorkflowRun,
  WorkflowRuns,
} from './types';

export class MockStore extends MastraStorage {
  scoresStorage: ScoresInMemory;
  operationsStorage: StoreOperationsInMemory;
  workflowsStorage: WorkflowsInMemory;
  tracesStorage: TracesInMemory;

  constructor() {
    super({ name: 'InMemoryStorage' });
    // MockStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);

    const operationsStorage = new StoreOperationsInMemory();

    const database = operationsStorage.getDatabase();

    this.scoresStorage = new ScoresInMemory({
      collection: database.mastra_scorers as InMemoryScores,
    });

    this.workflowsStorage = new WorkflowsInMemory({
      collection: database.mastra_workflow_snapshot as InMemoryWorkflows,
      operations: operationsStorage,
    });

    this.tracesStorage = new TracesInMemory({
      collection: database.mastra_traces as InMemoryTraces,
      operations: operationsStorage,
    });

    this.operationsStorage = operationsStorage;
  }

  private data: Record<TABLE_NAMES, Record<string, any>> = {
    mastra_workflow_snapshot: {},
    mastra_evals: {},
    mastra_messages: {},
    mastra_threads: {},
    mastra_traces: {},
    mastra_resources: {},
    mastra_scorers: {},
  };

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    await this.workflowsStorage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.workflowsStorage.loadWorkflowSnapshot({ workflowName, runId });
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await this.operationsStorage.createTable({ tableName, schema });
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
    await this.operationsStorage.alterTable({ tableName, schema, ifNotExists });
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.operationsStorage.clearTable({ tableName });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.operationsStorage.dropTable({ tableName });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    await this.operationsStorage.insert({ tableName, record });
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    await this.operationsStorage.batchInsert({ tableName, records });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.operationsStorage.load({ tableName, keys });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    this.logger.debug(`MockStore: getThreadById called for ${threadId}`);
    // Mock implementation - find thread by id
    const thread = Object.values(this.data.mastra_threads).find((t: any) => t.id === threadId);
    return thread ? (thread as StorageThreadType) : null;
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    this.logger.debug(`MockStore: getThreadsByResourceId called for ${resourceId}`);
    // Mock implementation - find threads by resourceId
    const threads = Object.values(this.data.mastra_threads).filter((t: any) => t.resourceId === resourceId);
    return threads as StorageThreadType[];
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.logger.debug(`MockStore: saveThread called for ${thread.id}`);
    const key = thread.id;
    this.data.mastra_threads[key] = thread;
    return thread;
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
    this.logger.debug(`MockStore: updateThread called for ${id}`);
    const thread = this.data.mastra_threads[id];
    if (thread) {
      thread.title = title;
      thread.metadata = { ...thread.metadata, ...metadata };
      thread.updatedAt = new Date();
    }
    return thread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    this.logger.debug(`MockStore: deleteThread called for ${threadId}`);
    delete this.data.mastra_threads[threadId];
    // Also delete associated messages
    this.data.mastra_messages = Object.fromEntries(
      Object.entries(this.data.mastra_messages).filter(([, msg]: any) => msg.threadId !== threadId),
    );
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    this.logger.debug(`MockStore: getResourceById called for ${resourceId}`);
    const resource = this.data.mastra_resources[resourceId];
    return resource ? (resource as StorageResourceType) : null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    this.logger.debug(`MockStore: saveResource called for ${resource.id}`);
    this.data.mastra_resources[resource.id] = JSON.parse(JSON.stringify(resource)); // simple clone
    return resource;
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
    this.logger.debug(`MockStore: updateResource called for ${resourceId}`);
    let resource = this.data.mastra_resources[resourceId];

    if (!resource) {
      // Create new resource if it doesn't exist
      resource = {
        id: resourceId,
        workingMemory,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      resource = {
        ...resource,
        workingMemory: workingMemory !== undefined ? workingMemory : resource.workingMemory,
        metadata: {
          ...resource.metadata,
          ...metadata,
        },
        updatedAt: new Date(),
      };
    }

    this.data.mastra_resources[resourceId] = resource;
    return resource;
  }

  async getMessages<T extends MastraMessageV2[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    this.logger.debug(`MockStore: getMessages called for thread ${threadId}`);
    // Mock implementation - filter messages by threadId
    let messages = Object.values(this.data.mastra_messages).filter((msg: any) => msg.threadId === threadId);

    // Apply selectBy logic (simplified)
    if (selectBy?.last) {
      messages = messages.slice(-selectBy.last);
    }

    // Sort by createdAt
    messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return messages as T;
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    this.logger.debug(`MockStore: saveMessages called with ${messages.length} messages`);
    for (const message of messages) {
      const key = message.id;
      this.data.mastra_messages[key] = message;
    }

    const list = new MessageList().add(messages, 'memory');
    if (format === `v2`) return list.get.all.v2();
    return list.get.all.v1();
  }

  async updateMessages(args: { messages: Partial<MastraMessageV2> & { id: string }[] }): Promise<MastraMessageV2[]> {
    this.logger.debug(`MockStore: updateMessages called with ${args.messages.length} messages`);
    const messages = args.messages.map(m => this.data.mastra_messages[m.id]);
    return messages;
  }

  async getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
    filters,
    fromDate,
    toDate,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any[]> {
    return this.tracesStorage.getTraces({ name, scope, page, perPage, attributes, filters, fromDate, toDate });
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return this.tracesStorage.getTracesPaginated(args);
  }

  async batchTraceInsert(args: { records: Record<string, any>[] }): Promise<void> {
    return this.tracesStorage.batchTraceInsert(args);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.scoresStorage.getScoreById({ id });
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    return this.scoresStorage.saveScore(score);
  }

  async getScoresByScorerId({
    scorerId,
    pagination,
  }: {
    scorerId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.scoresStorage.getScoresByScorerId({ scorerId, pagination });
  }

  async getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.scoresStorage.getScoresByRunId({ runId, pagination });
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
    return this.scoresStorage.getScoresByEntityId({ entityId, entityType, pagination });
  }

  async getEvals(options: { agentName?: string; type?: 'test' | 'live' } & PaginationArgs): Promise<PaginationInfo & { evals: EvalRow[] }> {
    this.logger.debug(`MockStore: getEvals called`, options);

    let evals = Object.values(this.data.mastra_evals) as EvalRow[];

    // Filter by agentName if provided
    if (options.agentName) {
      evals = evals.filter((evalR) => evalR.agentName === options.agentName);
    }

    // Filter by type if provided
    if (options.type === 'test') {
      evals = evals.filter((evalR) => evalR.testInfo && evalR.testInfo.testPath);
    } else if (options.type === 'live') {
      evals = evals.filter((evalR) => !evalR.testInfo || !evalR.testInfo.testPath);
    }

    // Filter by date range if provided
    if (options.dateRange?.start) {
      evals = evals.filter((evalR) => new Date(evalR.createdAt) >= options.dateRange!.start!);
    }
    if (options.dateRange?.end) {
      evals = evals.filter((evalR) => new Date(evalR.createdAt) <= options.dateRange!.end!);
    }

    // Sort by createdAt (newest first)
    evals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = evals.length;
    const page = options.page || 0;
    const perPage = options.perPage || 100;
    const start = page * perPage;
    const end = start + perPage;

    return {
      evals: evals.slice(start, end),
      total,
      page,
      perPage,
      hasMore: total > end,
    };
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    this.logger.debug(`MockStore: getEvalsByAgentName called for ${agentName}`);
    // Mock implementation - filter evals by agentName and type
    let evals = Object.values(this.data.mastra_evals).filter((e: any) => e.agentName === agentName);

    if (type === 'test') {
      evals = evals.filter((e: any) => e.testInfo && e.testInfo.testPath);
    } else if (type === 'live') {
      evals = evals.filter((e: any) => !e.testInfo || !e.testInfo.testPath);
    }

    // Sort by createdAt
    evals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return evals as EvalRow[];
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
    return this.workflowsStorage.getWorkflowRuns({ workflowName, fromDate, toDate, limit, offset, resourceId });
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    return this.workflowsStorage.getWorkflowRunById({ runId, workflowName });
  }



  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    this.logger.debug(`MockStore: getThreadsByResourceIdPaginated called for ${args.resourceId}`);
    // Mock implementation - find threads by resourceId
    const threads = Object.values(this.data.mastra_threads).filter((t: any) => t.resourceId === args.resourceId);
    return {
      threads: threads.slice(args.page * args.perPage, (args.page + 1) * args.perPage),
      total: threads.length,
      page: args.page,
      perPage: args.perPage,
      hasMore: threads.length > (args.page + 1) * args.perPage,
    };
  }

  async getMessagesPaginated({
    threadId,
    selectBy,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<
    PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }
  > {
    this.logger.debug(`MockStore: getMessagesPaginated called for thread ${threadId}`);

    const { page = 0, perPage = 40 } = selectBy?.pagination || {};

    // Mock implementation - filter messages by threadId
    let messages = Object.values(this.data.mastra_messages).filter((msg: any) => msg.threadId === threadId);

    // Apply selectBy logic (simplified)
    if (selectBy?.last) {
      messages = messages.slice(-selectBy.last);
    }

    // Sort by createdAt
    messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const start = page * perPage;
    const end = start + perPage;
    return {
      messages: messages.slice(start, end),
      total: messages.length,
      page,
      perPage,
      hasMore: messages.length > end,
    };
  }
}
