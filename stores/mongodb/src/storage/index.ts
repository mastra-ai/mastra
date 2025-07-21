import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type { ScoreRowData } from '@mastra/core/scores';
import type {
  EvalRow,
  PaginationArgs,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  StoragePagination,
  TABLE_NAMES,
  WorkflowRun,
} from '@mastra/core/storage';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { Collection } from 'mongodb';
import { MongoDBConnector } from './MongoDBConnector';
import type { MongoDBConfig } from './types';

function safelyParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

export class MongoDBStore extends MastraStorage {
  #connector: MongoDBConnector;

  constructor(config: MongoDBConfig) {
    super({ name: 'MongoDBStore' });

    try {
      if ('connectorHandler' in config) {
        this.#connector = MongoDBConnector.fromConnectionHandler(config.connectorHandler);
        return;
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_CONSTRUCTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { connectionHandler: true },
        },
        error,
      );
    }

    try {
      this.#connector = MongoDBConnector.fromDatabaseConfig({
        options: config.options,
        url: config.url,
        dbName: config.dbName,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_CONSTRUCTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { url: config?.url, dbName: config?.dbName },
        },
        error,
      );
    }
  }

  private getCollection(collectionName: string): Promise<Collection> {
    return this.#connector.getCollection(collectionName);
  }

  async createTable(): Promise<void> {
    // Nothing to do here, MongoDB is schemaless
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
    // Nothing to do here, MongoDB is schemaless
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const collection = await this.getCollection(tableName);
      await collection.deleteMany({});
    } catch (error) {
      if (error instanceof Error) {
        const matstraError = new MastraError(
          {
            id: 'STORAGE_MONGODB_STORE_CLEAR_TABLE_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { tableName },
          },
          error,
        );
        this.logger.error(matstraError.message);
        this.logger?.trackException(matstraError);
      }
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const collection = await this.getCollection(tableName);
      await collection.insertOne(record);
    } catch (error) {
      if (error instanceof Error) {
        const matstraError = new MastraError(
          {
            id: 'STORAGE_MONGODB_STORE_INSERT_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { tableName },
          },
          error,
        );
        this.logger.error(matstraError.message);
        this.logger?.trackException(matstraError);
      }
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (!records.length) {
      return;
    }

    try {
      const collection = await this.getCollection(tableName);
      await collection.insertMany(records);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.info(`Loading ${tableName} with keys ${JSON.stringify(keys)}`);
    try {
      const collection = await this.getCollection(tableName);
      return (await collection.find(keys).toArray()) as R;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const collection = await this.getCollection(TABLE_THREADS);
      const result = await collection.findOne<any>({ id: threadId });
      if (!result) {
        return null;
      }

      return {
        ...result,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const collection = await this.getCollection(TABLE_THREADS);
      const results = await collection.find<any>({ resourceId }).toArray();
      if (!results.length) {
        return [];
      }

      return results.map(result => ({
        ...result,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const collection = await this.getCollection(TABLE_THREADS);
      await collection.updateOne(
        { id: thread.id },
        {
          $set: {
            ...thread,
            metadata: JSON.stringify(thread.metadata),
          },
        },
        { upsert: true },
      );
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: thread.id },
        },
        error,
      );
    }
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
      throw new MastraError({
        id: 'STORAGE_MONGODB_STORE_UPDATE_THREAD_NOT_FOUND',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { threadId: id, status: 404 },
        text: `Thread ${id} not found`,
      });
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    try {
      const collection = await this.getCollection(TABLE_THREADS);
      await collection.updateOne(
        { id },
        {
          $set: {
            title,
            metadata: JSON.stringify(updatedThread.metadata),
          },
        },
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id },
        },
        error,
      );
    }

    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // First, delete all messages associated with the thread
      const collectionMessages = await this.getCollection(TABLE_MESSAGES);
      await collectionMessages.deleteMany({ thread_id: threadId });
      // Then delete the thread itself
      const collectionThreads = await this.getCollection(TABLE_THREADS);
      await collectionThreads.deleteOne({ id: threadId });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & {
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const limit = this.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
      const include = selectBy?.include || [];
      let messages: MastraMessageV2[] = [];
      let allMessages: MastraMessageV2[] = [];
      const collection = await this.getCollection(TABLE_MESSAGES);
      // Get all messages from the thread ordered by creation date descending
      allMessages = (await collection.find({ thread_id: threadId }).sort({ createdAt: -1 }).toArray()).map((row: any) =>
        this.parseRow(row),
      );

      // If there are messages to include, select the messages around the included IDs
      if (include.length) {
        // Map IDs to their position in the ordered array
        const idToIndex = new Map<string, number>();
        allMessages.forEach((msg, idx) => {
          idToIndex.set(msg.id, idx);
        });

        const selectedIndexes = new Set<number>();
        for (const inc of include) {
          const idx = idToIndex.get(inc.id);
          if (idx === undefined) continue;
          // Previous messages
          for (let i = 1; i <= (inc.withPreviousMessages || 0); i++) {
            if (idx + i < allMessages.length) selectedIndexes.add(idx + i);
          }
          // Included message
          selectedIndexes.add(idx);
          // Next messages
          for (let i = 1; i <= (inc.withNextMessages || 0); i++) {
            if (idx - i >= 0) selectedIndexes.add(idx - i);
          }
        }
        // Add the selected messages, filtering out undefined
        messages.push(
          ...Array.from(selectedIndexes)
            .map(i => allMessages[i])
            .filter((m): m is MastraMessageV2 => !!m),
        );
      }

      // Get the remaining messages, excluding those already selected
      const excludeIds = new Set(messages.map(m => m.id));
      for (const msg of allMessages) {
        if (messages.length >= limit) break;
        if (!excludeIds.has(msg.id)) {
          messages.push(msg);
        }
      }

      // Sort all messages by creation date ascending
      messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const list = new MessageList().add(messages.slice(0, limit), 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages({
    messages,
    format,
  }:
    | { messages: MastraMessageV1[]; format?: undefined | 'v1' }
    | { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    if (!messages.length) {
      return messages;
    }

    const threadId = messages[0]?.threadId;
    if (!threadId) {
      this.logger.error('Thread ID is required to save messages');
      throw new Error('Thread ID is required');
    }

    try {
      // Prepare batch statements for all messages
      const messagesToInsert = messages.map(message => {
        const time = message.createdAt || new Date();
        return {
          id: message.id,
          thread_id: threadId,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          role: message.role,
          type: message.type,
          resourceId: message.resourceId,
          createdAt: time instanceof Date ? time.toISOString() : time,
        };
      });

      // Execute message inserts and thread update in parallel for better performance
      const collection = await this.getCollection(TABLE_MESSAGES);
      const threadsCollection = await this.getCollection(TABLE_THREADS);

      await Promise.all([
        collection.bulkWrite(
          messagesToInsert.map(msg => ({
            updateOne: {
              filter: { id: msg.id },
              update: { $set: msg },
              upsert: true,
            },
          })),
        ),
        threadsCollection.updateOne({ id: threadId }, { $set: { updatedAt: new Date() } }),
      ]);

      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      this.logger.error('Failed to save messages in database: ' + (error as { message: string })?.message);
      throw error;
    }
  }

  async getTraces(
    {
      name,
      scope,
      page,
      perPage,
      attributes,
      filters,
    }: {
      name?: string;
      scope?: string;
      page: number;
      perPage: number;
      attributes?: Record<string, string>;
      filters?: Record<string, any>;
    } = {
      page: 0,
      perPage: 100,
    },
  ): Promise<any[]> {
    const limit = perPage;
    const offset = page * perPage;

    const query: any = {};
    if (name) {
      query['name'] = new RegExp(name);
    }

    if (scope) {
      query['scope'] = scope;
    }

    if (attributes) {
      query['$and'] = Object.entries(attributes).map(([key, value]) => ({
        attributes: new RegExp(`\"${key}\":\"${value}\"`),
      }));
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query[key] = value;
      });
    }

    try {
      const collection = await this.getCollection(TABLE_TRACES);
      const result = await collection
        .find(query, {
          sort: { startTime: -1 },
        })
        .limit(limit)
        .skip(offset)
        .toArray();

      return result.map(row => ({
        id: row.id,
        parentSpanId: row.parentSpanId,
        traceId: row.traceId,
        name: row.name,
        scope: row.scope,
        kind: row.kind,
        status: safelyParseJSON(row.status as string),
        events: safelyParseJSON(row.events as string),
        links: safelyParseJSON(row.links as string),
        attributes: safelyParseJSON(row.attributes as string),
        startTime: row.startTime,
        endTime: row.endTime,
        other: safelyParseJSON(row.other as string),
        createdAt: row.createdAt,
      })) as any;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    runs: Array<{
      workflowName: string;
      runId: string;
      snapshot: WorkflowRunState | string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    total: number;
  }> {
    const query: any = {};
    if (workflowName) {
      query['workflow_name'] = workflowName;
    }

    if (fromDate || toDate) {
      query['createdAt'] = {};
      if (fromDate) {
        query['createdAt']['$gte'] = fromDate;
      }
      if (toDate) {
        query['createdAt']['$lte'] = toDate;
      }
    }

    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        total = await collection.countDocuments(query);
      }

      // Get results
      const request = collection.find(query).sort({ createdAt: 'desc' });
      if (limit) {
        request.limit(limit);
      }

      if (offset) {
        request.skip(offset);
      }

      const result = await request.toArray();
      const runs = result.map(row => {
        let parsedSnapshot: WorkflowRunState | string = row.snapshot;
        if (typeof parsedSnapshot === 'string') {
          try {
            parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
          } catch (e) {
            // If parsing fails, return the raw snapshot string
            console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
          }
        }

        return {
          workflowName: row.workflow_name as string,
          runId: row.run_id as string,
          snapshot: parsedSnapshot,
          createdAt: new Date(row.createdAt as string),
          updatedAt: new Date(row.updatedAt as string),
        };
      });

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const query: any = {
        agent_name: agentName,
      };

      if (type === 'test') {
        query['test_info'] = { $ne: null };
        // is not possible to filter by test_info.testPath because it is not a json field
        // query['test_info.testPath'] = { $ne: null };
      }

      if (type === 'live') {
        // is not possible to filter by test_info.testPath because it is not a json field
        query['test_info'] = null;
      }

      const collection = await this.getCollection(TABLE_EVALS);
      const documents = await collection.find(query).sort({ created_at: 'desc' }).toArray();
      const result = documents.map(row => this.transformEvalRow(row));
      // Post filter to remove if test_info.testPath is null
      return result.filter(row => {
        if (type === 'live') {
          return !Boolean(row.testInfo?.testPath);
        }

        if (type === 'test') {
          return row.testInfo?.testPath !== null;
        }
        return true;
      });
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
    }
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
    try {
      const now = new Date().toISOString();
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      await collection.updateOne(
        { workflow_name: workflowName, run_id: runId },
        {
          $set: {
            snapshot: JSON.stringify(snapshot),
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.load<any[]>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });

      if (!result?.length) {
        return null;
      }

      return JSON.parse(result[0].snapshot);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const query: any = {};
      if (runId) {
        query['run_id'] = runId;
      }

      if (workflowName) {
        query['workflow_name'] = workflowName;
      }

      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      const result = await collection.findOne(query);
      if (!result) {
        return null;
      }

      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId },
        },
        error,
      );
    }
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resourceId: row.resourceId,
    };
  }

  private parseRow(row: any): MastraMessageV2 {
    let content = row.content;
    try {
      content = JSON.parse(row.content);
    } catch {
      // use content as is if it's not JSON
    }
    return {
      id: row.id,
      content,
      role: row.role,
      type: row.type,
      createdAt: new Date(row.createdAt as string),
      threadId: row.thread_id,
      resourceId: row.resourceId,
    } as MastraMessageV2;
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
    let testInfoValue = null;
    if (row.test_info) {
      try {
        testInfoValue = typeof row.test_info === 'string' ? JSON.parse(row.test_info) : row.test_info;
      } catch (e) {
        console.warn('Failed to parse test_info:', e);
      }
    }
    const resultValue = JSON.parse(row.result as string);
    if (!resultValue || typeof resultValue !== 'object' || !('score' in resultValue)) {
      throw new MastraError({
        id: 'STORAGE_MONGODB_STORE_INVALID_METRIC_FORMAT',
        text: `Invalid MetricResult format: ${JSON.stringify(resultValue)}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      });
    }

    return {
      input: row.input as string,
      output: row.output as string,
      result: resultValue as MetricResult,
      agentName: row.agent_name as string,
      metricName: row.metric_name as string,
      instructions: row.instructions as string,
      testInfo: testInfoValue as TestInfo,
      globalRunId: row.global_run_id as string,
      runId: row.run_id as string,
      createdAt: row.created_at as string,
    };
  }

  async getTracesPaginated(_args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_TRACES_PAGINATED_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      text: 'Method not implemented.',
    });
  }

  async getThreadsByResourceIdPaginated(_args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      text: 'Method not implemented.',
    });
  }

  async getMessagesPaginated(
    _args: StorageGetMessagesArg,
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_MESSAGES_PAGINATED_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      text: 'Method not implemented.',
    });
  }

  async close(): Promise<void> {
    try {
      await this.#connector.close();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_CLOSE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async updateMessages(_args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    this.logger.error('updateMessages is not yet implemented in MongoDBStore');
    throw new Error('Method not implemented');
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_SCORE_BY_ID_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { id },
      text: 'getScoreById is not implemented yet in MongoDBStore',
    });
  }

  async saveScore(_score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_SAVE_SCORE_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: {},
      text: 'saveScore is not implemented yet in MongoDBStore',
    });
  }

  async getScoresByScorerId({
    scorerId,
    pagination: _pagination,
    entityId,
    entityType,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { scorerId, entityId: entityId || '', entityType: entityType || '' },
      text: 'getScoresByScorerId is not implemented yet in MongoDBStore',
    });
  }

  async getScoresByRunId({
    runId,
    pagination: _pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_RUN_ID_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { runId },
      text: 'getScoresByRunId is not implemented yet in MongoDBStore',
    });
  }

  async getScoresByEntityId({
    entityId,
    entityType,
    pagination: _pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { entityId, entityType },
      text: 'getScoresByEntityId is not implemented yet in MongoDBStore',
    });
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_GET_EVALS_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { agentName: options.agentName || '', type: options.type || '' },
      text: 'getEvals is not implemented yet in MongoDBStore',
    });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    throw new MastraError({
      id: 'STORAGE_MONGODB_STORE_DROP_TABLE_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { tableName },
      text: 'dropTable is not implemented yet in MongoDBStore',
    });
  }
}
