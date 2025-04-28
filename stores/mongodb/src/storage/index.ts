import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { MessageType, StorageThreadType } from '@mastra/core/memory';
import type { EvalRow, StorageGetMessagesArg, TABLE_NAMES } from '@mastra/core/storage';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { Db } from 'mongodb';
import { MongoClient } from 'mongodb';

function safelyParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

export interface MongoDBConfig {
  url: string;
  dbName: string;
}

export class MongoDBStore extends MastraStorage {
  private client: MongoClient;
  private db: Db;

  constructor(config: MongoDBConfig) {
    super({ name: 'MongoDBStore' });

    if (!config.url?.trim().length) {
      throw new Error(
        'MongoDBStore: url must be provided and cannot be empty. Passing an empty string may cause fallback to local MongoDB defaults.',
      );
    }

    if (!config.dbName?.trim().length) {
      throw new Error(
        'MongoDBStore: dbName must be provided and cannot be empty. Passing an empty string may cause fallback to local MongoDB defaults.',
      );
    }

    this.client = new MongoClient(config.url);
    this.db = this.client.db(config.dbName);
  }

  async createTable(): Promise<void> {
    // Nothing to do here, MongoDB is schemaless
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.collection(tableName).deleteMany({});
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      await this.db.collection(tableName).insertOne(record);
    } catch (error) {
      this.logger.error(`Error upserting into table ${tableName}: ${error}`);
      throw error;
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (!records.length) {
      return;
    }

    try {
      await this.db.collection(tableName).insertMany(records);
    } catch (error) {
      this.logger.error(`Error upserting into table ${tableName}: ${error}`);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.info(`Loading ${tableName} with keys ${JSON.stringify(keys)}`);
    try {
      return (await this.db.collection(tableName).find(keys).toArray()) as R;
    } catch (error) {
      this.logger.error(`Error loading ${tableName} with keys ${JSON.stringify(keys)}: ${error}`);
      throw error;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const result = await this.db.collection(TABLE_THREADS).findOne<any>({ id: threadId });
      if (!result) {
        return null;
      }

      return {
        ...result,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      };
    } catch (error) {
      this.logger.error(`Error loading thread with ID ${threadId}: ${error}`);
      throw error;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const results = await this.db.collection(TABLE_THREADS).find<any>({ resourceId }).toArray();
      if (!results.length) {
        return [];
      }

      return results.map(result => ({
        ...result,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      }));
    } catch (error) {
      this.logger.error(`Error loading threads by resourceId ${resourceId}: ${error}`);
      throw error;
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.db.collection(TABLE_THREADS).insertOne({
        ...thread,
        metadata: JSON.stringify(thread.metadata),
      });
      return thread;
    } catch (error) {
      this.logger.error(`Error saving thread ${thread.id}: ${error}`);
      throw error;
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

    try {
      await this.db.collection(TABLE_THREADS).updateOne(
        { id },
        {
          $set: {
            title,
            metadata: JSON.stringify(updatedThread.metadata),
          },
        },
      );
    } catch (error) {
      this.logger.error(`Error updating thread ${id}:) ${error}`);
      throw error;
    }

    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // First, delete all messages associated with the thread
      await this.db.collection(TABLE_MESSAGES).deleteMany({ thread_id: threadId });
      // Then delete the thread itself
      await this.db.collection(TABLE_THREADS).deleteOne({ id: threadId });
    } catch (error) {
      this.logger.error(`Error deleting thread ${threadId}: ${error}`);
      throw error;
    }
  }

  async getMessages<T extends MessageType[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    try {
      const messages: MessageType[] = [];
      const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;

      // If we have specific messages to select
      if (selectBy?.include?.length) {
        const includeIds = selectBy.include.map(i => i.id);
        const maxPrev = Math.max(...selectBy.include.map(i => i.withPreviousMessages || 0));
        const maxNext = Math.max(...selectBy.include.map(i => i.withNextMessages || 0));

        // Get messages around all specified IDs in one query using row numbers
        const includeResult = await this.db
          .collection(TABLE_MESSAGES)
          .aggregate([
            { $match: { thread_id: threadId, id: { $in: includeIds } } },
            {
              $addFields: {
                row_num: {
                  $rank: {
                    sortBy: { createdAt: 1 },
                  },
                },
              },
            },
            {
              $lookup: {
                from: TABLE_MESSAGES,
                let: { target_pos: '$row_num' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gte: ['$row_num', { $subtract: ['$$target_pos', maxPrev] }] },
                          { $lte: ['$row_num', { $add: ['$$target_pos', maxNext] }] },
                        ],
                      },
                    },
                  },
                ],
                as: 'messages',
              },
            },
            { $unwind: '$messages' },
            { $sort: { 'messages.createdAt': 1 } },
          ])
          .toArray();

        if (includeResult.length) {
          messages.push(...includeResult.map((row: any) => this.parseRow(row)));
        }
      }

      // Get remaining messages, excluding already fetched IDs
      const excludeIds = messages.map(m => m.id);
      const remainingIds = [threadId, ...(excludeIds.length ? excludeIds : [])];
      const remainingResults = await this.db
        .collection(TABLE_MESSAGES)
        .find(
          {
            thread_id: { $in: remainingIds },
          },
          {
            limit: limit,
            sort: { createdAt: 'desc' },
          },
        )
        .toArray();

      if (remainingResults.length) {
        messages.push(...remainingResults.map((row: any) => this.parseRow(row)));
      }

      // Sort all messages by creation date
      messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return messages as T;
    } catch (error) {
      this.logger.error('Error getting messages:', error as Error);
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
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

      // Execute all inserts in a single batch
      await this.db.collection(TABLE_MESSAGES).insertMany(messagesToInsert);
      return messages;
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
      query['name'] = `%${name}%`;
    }

    if (scope) {
      query['scope'] = scope;
    }

    if (attributes) {
      Object.keys(attributes).forEach(key => {
        query[`attributes.${key}`] = attributes[key];
      });
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query[key] = value;
      });
    }

    const result = await this.db
      .collection(TABLE_TRACES)
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

    let total = 0;
    // Only get total count when using pagination
    if (limit !== undefined && offset !== undefined) {
      total = await this.db.collection(TABLE_WORKFLOW_SNAPSHOT).countDocuments(query);
    }

    // Get results
    const request = this.db.collection(TABLE_WORKFLOW_SNAPSHOT).find(query).sort({ createdAt: 'desc' });
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

      const documents = await this.db.collection(TABLE_EVALS).find(query).sort({ created_at: 'desc' }).toArray();
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
      this.logger.error('Failed to get evals for the specified agent: ' + (error as any)?.message);
      throw error;
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
      await this.db.collection(TABLE_WORKFLOW_SNAPSHOT).updateOne(
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
      this.logger.error(`Error persisting workflow snapshot: ${error}`);
      throw error;
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
      console.error('Error loading workflow snapshot:', error);
      throw error;
    }
  }

  private parseRow(row: any): MessageType {
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
    } as MessageType;
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

    return {
      input: row.input as string,
      output: row.output as string,
      result: row.result as MetricResult,
      agentName: row.agent_name as string,
      metricName: row.metric_name as string,
      instructions: row.instructions as string,
      testInfo: testInfoValue as TestInfo,
      globalRunId: row.global_run_id as string,
      runId: row.run_id as string,
      createdAt: row.created_at as string,
    };
  }
}
