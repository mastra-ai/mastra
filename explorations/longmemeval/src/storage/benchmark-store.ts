import { MastraStorage } from '@mastra/core/storage';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  TABLE_NAMES,
  StorageColumn,
  StorageResourceType,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
} from '@mastra/core/storage';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

type DBMode = 'read' | 'read-write';

export class BenchmarkStore extends MastraStorage {
  private data: Record<TABLE_NAMES, Map<string, any>> = {
    mastra_workflow_snapshot: new Map(),
    mastra_messages: new Map(),
    mastra_threads: new Map(),
    mastra_traces: new Map(),
    mastra_resources: new Map(),
  };

  private mode: DBMode;

  constructor(mode: DBMode = 'read-write') {
    super({ name: 'BenchmarkStore' });
    this.hasInitialized = Promise.resolve(true);
    this.mode = mode;
  }

  get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
    };
  }

  async createTable(_: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {}
  async alterTable(_: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {}

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    if (this.mode === `read`) return;
    this.data[tableName].clear();
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    if (this.mode === `read`) return;
    const key = record.id || record.run_id || `${Date.now()}_${Math.random()}`;
    this.data[tableName].set(key, JSON.parse(JSON.stringify(record))); // Deep clone
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (this.mode === `read`) return;
    for (const record of records) {
      await this.insert({ tableName, record });
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = keys.run_id || keys.id;
    const record = this.data[tableName].get(key!);
    return record ? (record as R) : null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = this.data.mastra_threads.get(threadId);
    return thread || null;
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.data.mastra_threads.set(thread.id, thread);
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
    const thread = this.data.mastra_threads.get(id);

    if (this.mode === `read`) return thread;

    if (thread) {
      thread.title = title;
      thread.metadata = { ...thread.metadata, ...metadata };
      thread.updatedAt = new Date();
      this.data.mastra_threads.set(id, thread);
    }
    return thread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    if (this.mode === `read`) return;

    this.data.mastra_threads.delete(threadId);
    // Also delete associated messages
    for (const [id, msg] of this.data.mastra_messages.entries()) {
      if (msg.threadId === threadId) {
        this.data.mastra_messages.delete(id);
      }
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const resource = this.data.mastra_resources.get(resourceId);
    return resource || null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    if (this.mode === `read`) return resource;
    this.data.mastra_resources.set(resource.id, JSON.parse(JSON.stringify(resource)));
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
    let resource = this.data.mastra_resources.get(resourceId);

    if (this.mode === `read`) return resource;

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

    this.data.mastra_resources.set(resourceId, resource);
    return resource;
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraDBMessage[]; format: 'v2' }): Promise<MastraDBMessage[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraDBMessage[]; format: 'v2' },
  ): Promise<MastraDBMessage[] | MastraMessageV1[]> {
    if (this.mode === `read`) return [];

    const { messages, format = 'v1' } = args;

    for (const message of messages) {
      this.data.mastra_messages.set(message.id, message);
    }

    const list = new MessageList().add(messages, 'memory');
    return format === 'v2' ? list.get.all.db() : list.get.all.v1();
  }

  async updateMessages(args: { messages: Partial<MastraDBMessage> & { id: string }[] }): Promise<MastraDBMessage[]> {
    const updatedMessages: MastraDBMessage[] = [];

    if (this.mode === `read`) return [];

    for (const update of args.messages) {
      const existing = this.data.mastra_messages.get(update.id);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        this.data.mastra_messages.set(update.id, updated);
        updatedMessages.push(updated);
      }
    }

    return updatedMessages;
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
    let traces = Array.from(this.data.mastra_traces.values());

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
    let evals = Array.from(this.data.mastra_evals.values()).filter((e: any) => e.agentName === agentName);

    if (type === 'test') {
      evals = evals.filter((e: any) => e.testInfo && e.testInfo.testPath);
    } else if (type === 'live') {
      evals = evals.filter((e: any) => !e.testInfo || !e.testInfo.testPath);
    }

    // Sort by createdAt
    evals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return evals as EvalRow[];
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    let runs = Array.from(this.data.mastra_workflow_snapshot.values());

    if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
    if (fromDate) runs = runs.filter((run: any) => new Date(run.createdAt) >= fromDate);
    if (toDate) runs = runs.filter((run: any) => new Date(run.createdAt) <= toDate);
    if (resourceId) runs = runs.filter((run: any) => run.resourceId === resourceId);

    const total = runs.length;

    // Sort by createdAt
    runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (limit !== undefined && offset !== undefined) {
      runs = runs.slice(offset, offset + limit);
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
    const run = this.data.mastra_workflow_snapshot.get(runId);

    if (!run || (workflowName && run.workflow_name !== workflowName)) {
      return null;
    }

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

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const allThreads: StorageThreadType[] = [];
    for (const thread of this.data.mastra_threads.values()) {
      if (thread.resourceId === args.resourceId) {
        allThreads.push(thread);
      }
    }
    const start = args.offset * args.limit;
    const threads = allThreads.slice(start, start + args.limit);

    return {
      threads,
      total: allThreads.length,
      page: args.offset,
      perPage: args.limit,
      hasMore: allThreads.length > (args.offset + 1) * args.limit,
    };
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, page = 0, perPage = 40, resourceId, filter, include, orderBy } = args;
    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

    let messages: any[] = [];
    const includedMessageIds = new Set<string>();

    // Handle include for cross-thread queries (resource scope support)
    if (include?.length) {
      for (const inc of include) {
        // Use the included threadId if provided (resource scope), otherwise use main threadId
        const queryThreadId = inc.threadId || threadId;

        // Get the target message and surrounding context
        const threadMessages = Array.from(this.data.mastra_messages.values())
          .filter((msg: any) => msg.threadId === queryThreadId)
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const targetIndex = threadMessages.findIndex((msg: any) => msg.id === inc.id);

        if (targetIndex >= 0) {
          const startIdx = Math.max(0, targetIndex - (inc.withPreviousMessages || 0));
          const endIdx = Math.min(threadMessages.length, targetIndex + (inc.withNextMessages || 0) + 1);

          for (let i = startIdx; i < endIdx; i++) {
            includedMessageIds.add(threadMessages[i].id);
          }
        }
      }
    }

    // Get base messages for the thread
    const baseMessages = Array.from(this.data.mastra_messages.values()).filter((msg: any) => {
      if (msg.threadId !== threadId) return false;
      if (resourceId && msg.resourceId !== resourceId) return false;
      return true;
    });

    // Combine base messages with included messages
    const baseMessageIds = new Set(baseMessages.map((m: any) => m.id));
    const allMessageIds = new Set([...baseMessageIds, ...includedMessageIds]);

    // Get all unique messages and convert to v2 format
    const allMessages = Array.from(this.data.mastra_messages.values()).filter((msg: any) => allMessageIds.has(msg.id));
    const list = new MessageList().add(allMessages, 'memory');
    let filteredMessages = list.get.all.db();

    // Apply date filters
    if (filter?.dateRange?.start) {
      filteredMessages = filteredMessages.filter((m: any) => new Date(m.createdAt) >= filter.dateRange!.start!);
    }
    if (filter?.dateRange?.end) {
      filteredMessages = filteredMessages.filter((m: any) => new Date(m.createdAt) <= filter.dateRange!.end!);
    }

    // Apply ordering - default to ASC by createdAt
    const sortField = orderBy?.field || 'createdAt';
    const sortDirection = orderBy?.direction || 'ASC';
    const direction = sortDirection === 'ASC' ? 1 : -1;

    filteredMessages.sort((a: any, b: any) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal instanceof Date && bVal instanceof Date) {
        return direction * (aVal.getTime() - bVal.getTime());
      }
      return direction * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
    });

    // Apply pagination
    const normalizedPerPage = perPage === false ? filteredMessages.length : perPage;
    const start = perPage === false ? 0 : page * normalizedPerPage;
    messages = filteredMessages.slice(start, start + normalizedPerPage);

    return {
      messages: messages as MastraDBMessage[],
      total: filteredMessages.length,
      page,
      perPage: perPage === false ? false : normalizedPerPage,
      hasMore: perPage === false ? false : filteredMessages.length > (page + 1) * normalizedPerPage,
    };
  }

  /**
   * Persist the current storage state to a JSON file
   */
  async persist(filePath: string): Promise<void> {
    if (this.mode === `read`) return;

    const data: Record<string, any> = {};

    // Convert Maps to arrays for JSON serialization
    for (const [tableName, tableData] of Object.entries(this.data)) {
      data[tableName] = Array.from(tableData.entries());
    }

    await writeFile(filePath, JSON.stringify(data, null, 2));
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
          const position = parseInt(match[1]);
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
      this.data[tableName as TABLE_NAMES] = new Map(tableData as any);
    }
  }

  /**
   * Clear all data and start fresh
   */
  async clear(): Promise<void> {
    if (this.mode === `read`) return;
    for (const table of Object.values(this.data)) {
      table.clear();
    }
  }
}
