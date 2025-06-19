import { MessageList } from '../agent';
import type { MastraMessageV2 } from '../agent';
import type { MastraMessageV1, StorageThreadType } from '../memory/types';
import type { Trace } from '../telemetry';
import { MastraStorage } from './base';
import type { TABLE_NAMES } from './constants';
import type { EvalRow, PaginationInfo, StorageColumn, StorageGetMessagesArg, WorkflowRun, WorkflowRuns } from './types';

export class MockStore extends MastraStorage {
  private data: Record<TABLE_NAMES, Record<string, any>> = {
    mastra_workflow_snapshot: {},
    mastra_evals: {},
    mastra_messages: {},
    mastra_threads: {},
    mastra_traces: {},
  };

  constructor() {
    super({ name: 'MockStore' });
    // MockStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);
  }

  async createTable(_: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    // In-memory mock, no actual table creation needed
  }

  async alterTable({
    tableName,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    this.logger.debug(`MockStore: alterTable called for ${tableName}`);
    // In-memory mock, no actual table alteration needed
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.logger.debug(`MockStore: clearTable called for ${tableName}`);
    this.data[tableName] = {};
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    this.logger.debug(`MockStore: insert called for ${tableName}`, record);
    this.data[tableName][record.run_id] = JSON.parse(JSON.stringify(record)); // simple clone - fine for mocking
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    this.logger.debug(`MockStore: batchInsert called for ${tableName} with ${records.length} records`);
    for (const record of records) {
      this.data[tableName][record.run_id] = JSON.parse(JSON.stringify(record)); // simple clone - fine for mocking
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.debug(`MockStore: load called for ${tableName} with keys`, keys);
    const record = this.data[tableName][keys.run_id!];
    return record ? (record as R) : null;
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
    this.logger.debug(`MockStore: getTraces called`);
    // Mock implementation - basic filtering
    let traces = Object.values(this.data.mastra_traces);

    if (name) traces = traces.filter((t: any) => t.name?.startsWith(name));
    if (scope) traces = traces.filter((t: any) => t.scope === scope);
    if (attributes) {
      traces = traces.filter((t: any) =>
        Object.entries(attributes).every(([key, value]) => t.attributes?.[key] === value),
      );
    }
    if (filters) {
      traces = traces.filter((t: any) => Object.entries(filters).every(([key, value]) => t[key] === value));
    }
    if (fromDate) traces = traces.filter((t: any) => new Date(t.createdAt) >= fromDate);
    if (toDate) traces = traces.filter((t: any) => new Date(t.createdAt) <= toDate);

    // Apply pagination and sort
    traces.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const start = page * perPage;
    const end = start + perPage;
    return traces.slice(start, end);
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
    this.logger.debug(`MockStore: getWorkflowRuns called`);
    let runs = Object.values(this.data.mastra_workflow_snapshot || {});

    if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
    if (fromDate) runs = runs.filter((run: any) => new Date(run.createdAt) >= fromDate);
    if (toDate) runs = runs.filter((run: any) => new Date(run.createdAt) <= toDate);
    if (resourceId) runs = runs.filter((run: any) => run.resourceId === resourceId);

    const total = runs.length;

    // Sort by createdAt
    runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (limit !== undefined && offset !== undefined) {
      const start = offset;
      const end = start + limit;
      runs = runs.slice(start, end);
    }

    // Deserialize snapshot if it's a string
    const parsedRuns = runs.map((run: any) => ({
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : { ...run.snapshot },
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
    }));

    return { runs: parsedRuns as WorkflowRun[], total };
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    this.logger.debug(`MockStore: getWorkflowRunById called for runId ${runId}`);
    let run = Object.values(this.data.mastra_workflow_snapshot || {}).find((r: any) => r.run_id === runId);

    if (run && workflowName && run.workflow_name !== workflowName) {
      run = undefined; // Not found if workflowName doesn't match
    }

    if (!run) return null;

    // Deserialize snapshot if it's a string
    const parsedRun = {
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot,
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
    };

    return parsedRun as WorkflowRun;
  }

  async getTracesPaginated({
    name,
    scope,
    attributes,
    page,
    perPage,
    fromDate,
    toDate,
  }: {
    name?: string;
    scope?: string;
    attributes?: Record<string, string>;
    page: number;
    perPage: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<PaginationInfo & { traces: Trace[] }> {
    this.logger.debug(`MockStore: getTracesPaginated called`);
    // Mock implementation - basic filtering
    let traces = Object.values(this.data.mastra_traces);

    if (name) traces = traces.filter((t: any) => t.name?.startsWith(name));
    if (scope) traces = traces.filter((t: any) => t.scope === scope);
    if (attributes) {
      traces = traces.filter((t: any) =>
        Object.entries(attributes).every(([key, value]) => t.attributes?.[key] === value),
      );
    }
    if (fromDate) traces = traces.filter((t: any) => new Date(t.createdAt) >= fromDate);
    if (toDate) traces = traces.filter((t: any) => new Date(t.createdAt) <= toDate);

    // Apply pagination and sort
    traces.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const start = page * perPage;
    const end = start + perPage;
    return {
      traces: traces.slice(start, end),
      total: traces.length,
      page,
      perPage,
      hasMore: traces.length > end,
    };
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
