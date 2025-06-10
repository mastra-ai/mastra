import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2 } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type {
  TABLE_NAMES,
  StorageColumn,
  StorageGetMessagesArg,
  EvalRow,
  WorkflowRuns,
  WorkflowRun,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { Redis } from '@upstash/redis';
import { MessageList } from '../../../../packages/core/dist/agent/index.cjs';

export interface UpstashConfig {
  url: string;
  token: string;
}

export class UpstashStore extends MastraStorage {
  private redis: Redis;

  constructor(config: UpstashConfig) {
    super({ name: 'Upstash' });
    this.redis = new Redis({
      url: config.url,
      token: config.token,
    });
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
    };
  }

  private transformEvalRecord(record: Record<string, any>): EvalRow {
    // Parse JSON strings if needed
    let result = record.result;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        console.warn('Failed to parse result JSON:');
      }
    }

    let testInfo = record.test_info;
    if (typeof testInfo === 'string') {
      try {
        testInfo = JSON.parse(testInfo);
      } catch {
        console.warn('Failed to parse test_info JSON:');
      }
    }

    return {
      agentName: record.agent_name,
      input: record.input,
      output: record.output,
      result: result as MetricResult,
      metricName: record.metric_name,
      instructions: record.instructions,
      testInfo: testInfo as TestInfo | undefined,
      globalRunId: record.global_run_id,
      runId: record.run_id,
      createdAt:
        typeof record.created_at === 'string'
          ? record.created_at
          : record.created_at instanceof Date
            ? record.created_at.toISOString()
            : new Date().toISOString(),
    };
  }

  private parseJSON(value: any): any {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private getKey(tableName: TABLE_NAMES, keys: Record<string, any>): string {
    const keyParts = Object.entries(keys)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}:${value}`);
    return `${tableName}:${keyParts.join(':')}`;
  }

  /**
   * Scans for keys matching the given pattern using SCAN and returns them as an array.
   * @param pattern Redis key pattern, e.g. "table:*"
   * @param batchSize Number of keys to scan per batch (default: 1000)
   */
  private async scanKeys(pattern: string, batchSize = 10000): Promise<string[]> {
    let cursor = '0';
    let keys: string[] = [];
    do {
      // Upstash: scan(cursor, { match, count })
      const [nextCursor, batch] = await this.redis.scan(cursor, {
        match: pattern,
        count: batchSize,
      });
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0');
    return keys;
  }

  /**
   * Deletes all keys matching the given pattern using SCAN and DEL in batches.
   * @param pattern Redis key pattern, e.g. "table:*"
   * @param batchSize Number of keys to delete per batch (default: 1000)
   */
  private async scanAndDelete(pattern: string, batchSize = 10000): Promise<number> {
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, {
        match: pattern,
        count: batchSize,
      });
      if (keys.length > 0) {
        await this.redis.del(...keys);
        totalDeleted += keys.length;
      }
      cursor = nextCursor;
    } while (cursor !== '0');
    return totalDeleted;
  }

  private getMessageKey(threadId: string, messageId: string): string {
    const key = this.getKey(TABLE_MESSAGES, { threadId, id: messageId });
    return key;
  }

  private getThreadMessagesKey(threadId: string): string {
    return `thread:${threadId}:messages`;
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        // If parsing fails, return the raw snapshot string
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: this.ensureDate(row.createdAt)!,
      updatedAt: this.ensureDate(row.updatedAt)!,
      resourceId: row.resourceId,
    };
  }

  private processRecord(tableName: TABLE_NAMES, record: Record<string, any>) {
    let key: string;

    if (tableName === TABLE_MESSAGES) {
      // For messages, use threadId as the primary key component
      key = this.getKey(tableName, { threadId: record.threadId, id: record.id });
    } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      key = this.getKey(tableName, {
        namespace: record.namespace || 'workflows',
        workflow_name: record.workflow_name,
        run_id: record.run_id,
        ...(record.resourceId ? { resourceId: record.resourceId } : {}),
      });
    } else if (tableName === TABLE_EVALS) {
      key = this.getKey(tableName, { id: record.run_id });
    } else {
      key = this.getKey(tableName, { id: record.id });
    }

    // Convert dates to ISO strings before storing
    const processedRecord = {
      ...record,
      createdAt: this.serializeDate(record.createdAt),
      updatedAt: this.serializeDate(record.updatedAt),
    };

    return { key, processedRecord };
  }

  /**
   * @deprecated Use getEvals instead
   */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const pattern = `${TABLE_EVALS}:*`;
      const keys = await this.scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return [];
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // Filter by agent name and remove nulls
      const nonNullRecords = results.filter(
        (record): record is Record<string, any> =>
          record !== null && typeof record === 'object' && 'agent_name' in record && record.agent_name === agentName,
      );

      let filteredEvals = nonNullRecords;

      if (type === 'test') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return false;

          // Handle test_info as a JSON string
          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo;
            }

            // Handle test_info as an object
            return typeof record.test_info === 'object' && 'testPath' in record.test_info;
          } catch {
            return false;
          }
        });
      } else if (type === 'live') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return true;

          // Handle test_info as a JSON string
          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return !(parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo);
            }

            // Handle test_info as an object
            return !(typeof record.test_info === 'object' && 'testPath' in record.test_info);
          } catch {
            return true;
          }
        });
      }

      // Transform to EvalRow format
      return filteredEvals.map(record => this.transformEvalRecord(record));
    } catch (error) {
      console.error('Failed to get evals for the specified agent:', error);
      return [];
    }
  }

  public async getTraces(args: {
    name?: string;
    scope?: string;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    page: number;
    perPage?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any[]>;
  public async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage?: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    fromDate?: Date;
    toDate?: Date;
    returnPaginationResults: true;
  }): Promise<{
    traces: any[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  public async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage?: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    fromDate?: Date;
    toDate?: Date;
    returnPaginationResults?: boolean;
  }): Promise<
    | any[]
    | {
        traces: any[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
      }
  > {
    const {
      name,
      scope,
      page,
      perPage: perPageInput,
      attributes,
      filters,
      fromDate,
      toDate,
      returnPaginationResults,
    } = args;

    const perPage = perPageInput !== undefined ? perPageInput : 100;

    try {
      const pattern = `${TABLE_TRACES}:*`;
      const keys = await this.scanKeys(pattern);

      if (keys.length === 0) {
        if (returnPaginationResults) {
          return {
            traces: [],
            total: 0,
            page,
            perPage: perPage || 100,
            hasMore: false,
          };
        }
        return [];
      }

      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      let filteredTraces = results.filter(
        (record): record is Record<string, any> => record !== null && typeof record === 'object',
      );

      if (name) {
        filteredTraces = filteredTraces.filter(record => record.name?.toLowerCase().startsWith(name.toLowerCase()));
      }
      if (scope) {
        filteredTraces = filteredTraces.filter(record => record.scope === scope);
      }
      if (attributes) {
        filteredTraces = filteredTraces.filter(record => {
          const recordAttributes = record.attributes;
          if (!recordAttributes) return false;
          const parsedAttributes =
            typeof recordAttributes === 'string' ? JSON.parse(recordAttributes) : recordAttributes;
          return Object.entries(attributes).every(([key, value]) => parsedAttributes[key] === value);
        });
      }
      if (filters) {
        filteredTraces = filteredTraces.filter(record =>
          Object.entries(filters).every(([key, value]) => record[key] === value),
        );
      }
      if (fromDate) {
        filteredTraces = filteredTraces.filter(
          record => new Date(record.createdAt).getTime() >= new Date(fromDate).getTime(),
        );
      }
      if (toDate) {
        filteredTraces = filteredTraces.filter(
          record => new Date(record.createdAt).getTime() <= new Date(toDate).getTime(),
        );
      }

      filteredTraces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const transformedTraces = filteredTraces.map(record => ({
        id: record.id,
        parentSpanId: record.parentSpanId,
        traceId: record.traceId,
        name: record.name,
        scope: record.scope,
        kind: record.kind,
        status: this.parseJSON(record.status),
        events: this.parseJSON(record.events),
        links: this.parseJSON(record.links),
        attributes: this.parseJSON(record.attributes),
        startTime: record.startTime,
        endTime: record.endTime,
        other: this.parseJSON(record.other),
        createdAt: this.ensureDate(record.createdAt),
      }));

      const total = transformedTraces.length;
      const resolvedPerPage = perPage || 100;
      const start = page * resolvedPerPage;
      const end = start + resolvedPerPage;
      const paginatedTraces = transformedTraces.slice(start, end);
      const hasMore = end < total;
      if (returnPaginationResults) {
        return {
          traces: paginatedTraces,
          total,
          page,
          perPage: resolvedPerPage,
          hasMore,
        };
      } else {
        return paginatedTraces;
      }
    } catch (error) {
      console.error('Failed to get traces:', error);
      if (returnPaginationResults) {
        return {
          traces: [],
          total: 0,
          page,
          perPage: perPage || 100,
          hasMore: false,
        };
      }
      return [];
    }
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // Redis is schemaless, so we don't need to create tables
    // But we can store the schema for reference
    await this.redis.set(`schema:${tableName}`, schema);
  }

  /**
   * No-op: This backend is schemaless and does not require schema changes.
   * @param tableName Name of the table
   * @param schema Schema of the table
   * @param ifNotExists Array of column names to add if they don't exist
   */
  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // Nothing to do here, Redis is schemaless
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const pattern = `${tableName}:*`;
    await this.scanAndDelete(pattern);
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const { key, processedRecord } = this.processRecord(tableName, record);

    await this.redis.set(key, processedRecord);
  }

  async batchInsert(input: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const { tableName, records } = input;
    if (!records.length) return;

    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const pipeline = this.redis.pipeline();
      for (const record of batch) {
        const { key, processedRecord } = this.processRecord(tableName, record);
        pipeline.set(key, processedRecord);
      }
      await pipeline.exec();
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = this.getKey(tableName, keys);
    const data = await this.redis.get<R>(key);
    return data || null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.load<StorageThreadType>({
      tableName: TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!thread) return null;

    return {
      ...thread,
      createdAt: this.ensureDate(thread.createdAt)!,
      updatedAt: this.ensureDate(thread.updatedAt)!,
      metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
    };
  }

  async getThreadsByResourceId(args: { resourceId: string }): Promise<StorageThreadType[]>;
  async getThreadsByResourceId(args: { resourceId: string; page: number; perPage?: number }): Promise<{
    threads: StorageThreadType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  async getThreadsByResourceId(args: { resourceId: string; page?: number; perPage?: number }): Promise<
    | StorageThreadType[]
    | {
        threads: StorageThreadType[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
      }
  > {
    const resourceId: string = args.resourceId;
    const page: number | undefined = args.page;
    // Determine perPage only if page is actually provided. Otherwise, its value is not critical for the non-paginated path.
    // If page is provided, perPage defaults to 100 if not specified.
    const perPage: number = page !== undefined ? (args.perPage !== undefined ? args.perPage : 100) : 100;

    try {
      const pattern = `${TABLE_THREADS}:*`;
      const keys = await this.scanKeys(pattern);

      if (keys.length === 0) {
        if (page !== undefined) {
          return {
            threads: [],
            total: 0,
            page,
            perPage, // perPage is number here
            hasMore: false,
          };
        }
        return [];
      }

      const allThreads: StorageThreadType[] = [];
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      for (let i = 0; i < results.length; i++) {
        const thread = results[i] as StorageThreadType | null;
        if (thread && thread.resourceId === resourceId) {
          allThreads.push({
            ...thread,
            createdAt: this.ensureDate(thread.createdAt)!,
            updatedAt: this.ensureDate(thread.updatedAt)!,
            metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
          });
        }
      }

      allThreads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      if (page !== undefined) {
        // If page is defined, perPage is also a number (due to the defaulting logic above)
        const total = allThreads.length;
        const start = page * perPage;
        const end = start + perPage;
        const paginatedThreads = allThreads.slice(start, end);
        const hasMore = end < total;
        return {
          threads: paginatedThreads,
          total,
          page,
          perPage,
          hasMore,
        };
      } else {
        // page is undefined, return all threads
        return allThreads;
      }
    } catch (error) {
      console.error('Error in getThreadsByResourceId:', error);
      if (page !== undefined) {
        return {
          threads: [],
          total: 0,
          page,
          perPage, // perPage is number here
          hasMore: false,
        };
      }
      return [];
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.insert({
      tableName: TABLE_THREADS,
      record: thread,
    });
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
    const thread = await this.getThreadById({ threadId: id });
    if (!thread) {
      throw new Error(`Thread ${id} not found`);
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    await this.saveThread({ thread: updatedThread });
    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // Delete thread metadata and sorted set
    const threadKey = this.getKey(TABLE_THREADS, { id: threadId });
    const threadMessagesKey = this.getThreadMessagesKey(threadId);
    const messageIds: string[] = await this.redis.zrange(threadMessagesKey, 0, -1);

    const pipeline = this.redis.pipeline();
    pipeline.del(threadKey);
    pipeline.del(threadMessagesKey);

    for (let i = 0; i < messageIds.length; i++) {
      const messageId = messageIds[i];
      const messageKey = this.getMessageKey(threadId, messageId as string);
      pipeline.del(messageKey);
    }

    await pipeline.exec();

    // Bulk delete all message keys for this thread if any remain
    await this.scanAndDelete(this.getMessageKey(threadId, '*'));
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    if (messages.length === 0) return [];

    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    // Check if thread exists
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Add an index to each message to maintain order
    const messagesWithIndex = messages.map((message, index) => ({
      ...message,
      _index: index,
    }));

    const batchSize = 1000;
    for (let i = 0; i < messagesWithIndex.length; i += batchSize) {
      const batch = messagesWithIndex.slice(i, i + batchSize);
      const pipeline = this.redis.pipeline();
      for (const message of batch) {
        const key = this.getMessageKey(message.threadId!, message.id);
        const createdAtScore = new Date(message.createdAt).getTime();
        const score = message._index !== undefined ? message._index : createdAtScore;

        // Store the message data
        pipeline.set(key, message);

        // Add to sorted set for this thread
        pipeline.zadd(this.getThreadMessagesKey(message.threadId!), {
          score,
          member: message.id,
        });
      }

      await pipeline.exec();
    }

    const list = new MessageList().add(messages, 'memory');
    if (format === `v2`) return list.get.all.v2();
    return list.get.all.v1();
  }

  // Function overloads for different return types
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
      page: number;
      perPage?: number;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<{
    messages: MastraMessageV1[] | MastraMessageV2[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  public async getMessages({
    threadId,
    selectBy,
    format,
    page,
    perPage = 40,
    fromDate,
    toDate,
  }: StorageGetMessagesArg & {
    format?: 'v1' | 'v2';
    page?: number;
    perPage?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<
    | MastraMessageV1[]
    | MastraMessageV2[]
    | {
        messages: MastraMessageV1[] | MastraMessageV2[];
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
      }
  > {
    const threadMessagesKey = this.getThreadMessagesKey(threadId);

    const allMessageIds = await this.redis.zrange(threadMessagesKey, 0, -1);
    // If pagination is requested, use the new pagination logic
    if (page !== undefined) {
      try {
        // Get all message IDs from the sorted set

        if (allMessageIds.length === 0) {
          return {
            messages: [],
            total: 0,
            page,
            perPage,
            hasMore: false,
          };
        }

        // Use pipeline to fetch all messages efficiently
        const pipeline = this.redis.pipeline();
        allMessageIds.forEach(id => pipeline.get(this.getMessageKey(threadId, id as string)));
        const results = await pipeline.exec();

        // Process messages and apply filters - handle undefined results from pipeline
        let messages = results
          .map((result: any) => result as MastraMessageV2 | null)
          .filter((msg): msg is MastraMessageV2 => msg !== null) as (MastraMessageV2 & { _index?: number })[];

        // Apply date filters if provided
        if (fromDate) {
          messages = messages.filter(msg => msg && new Date(msg.createdAt).getTime() >= fromDate.getTime());
        }

        if (toDate) {
          messages = messages.filter(msg => msg && new Date(msg.createdAt).getTime() <= toDate.getTime());
        }

        // Sort messages by their position in the sorted set
        messages.sort((a, b) => allMessageIds.indexOf(a!.id) - allMessageIds.indexOf(b!.id));

        const total = messages.length;

        // Apply pagination
        const start = page * perPage;
        const end = start + perPage;
        const hasMore = end < total;
        const paginatedMessages = messages.slice(start, end);

        // Remove _index before returning and handle format conversion properly
        const prepared = paginatedMessages
          .filter(message => message !== null && message !== undefined)
          .map(message => {
            const { _index, ...messageWithoutIndex } = message as MastraMessageV2 & { _index?: number };
            return messageWithoutIndex as unknown as MastraMessageV1;
          });

        // Return pagination object with correct format
        if (format === 'v2') {
          // Convert V1 format back to V2 format
          const v2Messages = prepared.map(msg => ({
            ...msg,
            content: msg.content || { format: 2, parts: [{ type: 'text', text: '' }] },
          })) as MastraMessageV2[];

          return {
            messages: v2Messages,
            total,
            page,
            perPage,
            hasMore,
          };
        }

        return {
          messages: prepared,
          total,
          page,
          perPage,
          hasMore,
        };
      } catch (error) {
        console.error('Failed to get paginated messages:', error);
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }
    }

    // Original logic for backward compatibility
    // When selectBy is undefined or selectBy.last is undefined, get ALL messages (not just 40)
    let limit: number;
    if (typeof selectBy?.last === 'number') {
      limit = Math.max(0, selectBy.last);
    } else if (selectBy?.last === false) {
      limit = 0;
    } else {
      // No limit specified - get all messages
      limit = Number.MAX_SAFE_INTEGER;
    }

    const messageIds = new Set<string>();
    const messageIdToThreadIds: Record<string, string> = {};

    if (limit === 0 && !selectBy?.include) {
      return [];
    }

    // First, get specifically included messages and their context
    if (selectBy?.include?.length) {
      for (const item of selectBy.include) {
        messageIds.add(item.id);

        // Use per-include threadId if present, else fallback to main threadId
        const itemThreadId = item.threadId || threadId;
        messageIdToThreadIds[item.id] = itemThreadId;
        const itemThreadMessagesKey = this.getThreadMessagesKey(itemThreadId);

        // Get the rank of this message in the sorted set
        const rank = await this.redis.zrank(itemThreadMessagesKey, item.id);
        if (rank === null) continue;

        // Get previous messages if requested
        if (item.withPreviousMessages) {
          const start = Math.max(0, rank - item.withPreviousMessages);
          const prevIds = rank === 0 ? [] : await this.redis.zrange(itemThreadMessagesKey, start, rank - 1);
          prevIds.forEach(id => {
            messageIds.add(id as string);
            messageIdToThreadIds[id as string] = itemThreadId;
          });
        }

        // Get next messages if requested
        if (item.withNextMessages) {
          const nextIds = await this.redis.zrange(itemThreadMessagesKey, rank + 1, rank + item.withNextMessages);
          nextIds.forEach(id => {
            messageIds.add(id as string);
            messageIdToThreadIds[id as string] = itemThreadId;
          });
        }
      }
    }

    // Then get the most recent messages (or all if no limit)
    if (limit === Number.MAX_SAFE_INTEGER) {
      // Get all messages
      const allIds = await this.redis.zrange(threadMessagesKey, 0, -1);
      allIds.forEach(id => {
        messageIds.add(id as string);
        messageIdToThreadIds[id as string] = threadId;
      });
    } else if (limit > 0) {
      // Get limited number of recent messages
      const latestIds = await this.redis.zrange(threadMessagesKey, -limit, -1);
      latestIds.forEach(id => {
        messageIds.add(id as string);
        messageIdToThreadIds[id as string] = threadId;
      });
    }

    // Fetch all needed messages in parallel
    const messages = (
      await Promise.all(
        Array.from(messageIds).map(async id => {
          const tId = messageIdToThreadIds[id] || threadId;
          const byThreadId = await this.redis.get<MastraMessageV2 & { _index?: number }>(this.getMessageKey(tId, id));
          if (byThreadId) return byThreadId;

          return null;
        }),
      )
    ).filter(msg => msg !== null) as (MastraMessageV2 & { _index?: number })[];

    // Sort messages by their position in the sorted set
    messages.sort((a, b) => allMessageIds.indexOf(a!.id) - allMessageIds.indexOf(b!.id));

    // Remove _index before returning and handle format conversion properly
    const prepared = messages
      .filter(message => message !== null && message !== undefined)
      .map(message => {
        const { _index, ...messageWithoutIndex } = message as MastraMessageV2 & { _index?: number };
        return messageWithoutIndex as unknown as MastraMessageV1;
      });

    // For backward compatibility, return messages directly without using MessageList
    // since MessageList has deduplication logic that can cause issues
    if (format === 'v2') {
      // Convert V1 format back to V2 format
      return prepared.map(msg => ({
        ...msg,
        content: msg.content || { format: 2, parts: [{ type: 'text', text: '' }] },
      })) as MastraMessageV2[];
    }

    return prepared;
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { namespace = 'workflows', workflowName, runId, snapshot } = params;
    await this.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: {
        namespace,
        workflow_name: workflowName,
        run_id: runId,
        snapshot,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace = 'workflows', workflowName, runId } = params;
    const key = this.getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
    });
    const data = await this.redis.get<{
      namespace: string;
      workflow_name: string;
      run_id: string;
      snapshot: WorkflowRunState;
    }>(key);
    if (!data) return null;
    return data.snapshot;
  }

  /**
   * Get all evaluations with pagination and total count
   * @param options Pagination and filtering options
   * @returns Object with evals array and total count
   */
  async getEvals(options?: {
    agentName?: string;
    type?: 'test' | 'live';
    page?: number;
    perPage?: number;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    evals: EvalRow[];
    total: number;
    page?: number;
    perPage?: number;
    hasMore?: boolean;
  }> {
    try {
      // Default pagination parameters
      const page = options?.page ?? 0;
      const perPage = options?.perPage ?? 100;
      const limit = options?.limit;
      const offset = options?.offset;

      // Get all keys that match the evals table pattern using cursor-based scanning
      const pattern = `${TABLE_EVALS}:*`;
      const keys = await this.scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return {
          evals: [],
          total: 0,
          page: options?.page ?? 0,
          perPage: options?.perPage ?? 100,
          hasMore: false,
        };
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // Process results and apply filters
      let filteredEvals = results
        .map((result: any) => result as Record<string, any> | null)
        .filter((record): record is Record<string, any> => record !== null && typeof record === 'object');

      // Apply agent name filter if provided
      if (options?.agentName) {
        filteredEvals = filteredEvals.filter(record => record.agent_name === options.agentName);
      }

      // Apply type filter if provided
      if (options?.type === 'test') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return false;

          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo;
            }
            return typeof record.test_info === 'object' && 'testPath' in record.test_info;
          } catch {
            return false;
          }
        });
      } else if (options?.type === 'live') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return true;

          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return !(parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo);
            }
            return !(typeof record.test_info === 'object' && 'testPath' in record.test_info);
          } catch {
            return true;
          }
        });
      }

      // Apply date filters if provided
      if (options?.fromDate) {
        filteredEvals = filteredEvals.filter(record => {
          const createdAt = new Date(record.created_at || record.createdAt || 0);
          return createdAt.getTime() >= options.fromDate!.getTime();
        });
      }

      if (options?.toDate) {
        filteredEvals = filteredEvals.filter(record => {
          const createdAt = new Date(record.created_at || record.createdAt || 0);
          return createdAt.getTime() <= options.toDate!.getTime();
        });
      }

      // Sort by creation date (newest first)
      filteredEvals.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const total = filteredEvals.length;

      // Apply pagination - support both page/perPage and limit/offset patterns
      let paginatedEvals: Record<string, any>[];
      let hasMore = false;

      if (limit !== undefined && offset !== undefined) {
        // Offset-based pagination
        paginatedEvals = filteredEvals.slice(offset, offset + limit);
        hasMore = offset + limit < total;
      } else {
        // Page-based pagination
        const start = page * perPage;
        const end = start + perPage;
        paginatedEvals = filteredEvals.slice(start, end);
        hasMore = end < total;
      }

      // Transform to EvalRow format
      const evals = paginatedEvals.map(record => this.transformEvalRecord(record));

      return {
        evals,
        total,
        page: limit !== undefined ? undefined : page,
        perPage: limit !== undefined ? undefined : perPage,
        hasMore,
      };
    } catch (error) {
      console.error('Failed to get evals:', error);
      return {
        evals: [],
        total: 0,
        page: options?.page ?? 0,
        perPage: options?.perPage ?? 100,
        hasMore: false,
      };
    }
  }

  async getWorkflowRuns(
    {
      namespace,
      workflowName,
      fromDate,
      toDate,
      limit,
      offset,
      resourceId,
    }: {
      namespace: string;
      workflowName?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
      resourceId?: string;
    } = { namespace: 'workflows' },
  ): Promise<WorkflowRuns> {
    try {
      // Get all workflow keys
      let pattern = this.getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace }) + ':*';
      if (workflowName && resourceId) {
        pattern = this.getKey(TABLE_WORKFLOW_SNAPSHOT, {
          namespace,
          workflow_name: workflowName,
          run_id: '*',
          resourceId,
        });
      } else if (workflowName) {
        pattern = this.getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName }) + ':*';
      } else if (resourceId) {
        pattern = this.getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: '*', run_id: '*', resourceId });
      }
      const keys = await this.scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return { runs: [], total: 0 };
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // Filter and transform results - handle undefined results
      let runs = results
        .map((result: any) => result as Record<string, any> | null)
        .filter(
          (record): record is Record<string, any> =>
            record !== null && record !== undefined && typeof record === 'object' && 'workflow_name' in record,
        )
        // Only filter by workflowName if it was specifically requested
        .filter(record => !workflowName || record.workflow_name === workflowName)
        .map(w => this.parseWorkflowRun(w!))
        .filter(w => {
          if (fromDate && w.createdAt < fromDate) return false;
          if (toDate && w.createdAt > toDate) return false;
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = runs.length;

      // Apply pagination if requested
      if (limit !== undefined && offset !== undefined) {
        runs = runs.slice(offset, offset + limit);
      }

      return { runs, total };
    } catch (error) {
      console.error('Error getting workflow runs:', error);
      throw error;
    }
  }

  async getWorkflowRunById({
    namespace = 'workflows',
    runId,
    workflowName,
  }: {
    namespace: string;
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const key = this.getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId }) + '*';
      const keys = await this.scanKeys(key);
      const workflows = await Promise.all(
        keys.map(async key => {
          const data = await this.redis.get<{
            workflow_name: string;
            run_id: string;
            snapshot: WorkflowRunState | string;
            createdAt: string | Date;
            updatedAt: string | Date;
            resourceId: string;
          }>(key);
          return data;
        }),
      );
      const data = workflows.find(w => w?.run_id === runId && w?.workflow_name === workflowName) as WorkflowRun | null;
      if (!data) return null;
      return this.parseWorkflowRun(data);
    } catch (error) {
      console.error('Error getting workflow run by ID:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // No explicit cleanup needed for Upstash Redis
  }
}
