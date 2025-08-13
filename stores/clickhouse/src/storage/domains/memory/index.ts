import type { ClickHouseClient } from '@clickhouse/client';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type { PaginationInfo, StorageGetMessagesArg, StorageResourceType } from '@mastra/core/storage';
import {
  MemoryStorage,
  resolveMessageLimit,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type { StoreOperationsClickhouse } from '../operations';
import { transformRow, transformRows } from '../utils';

export class MemoryStorageClickhouse extends MemoryStorage {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;
  constructor({ client, operations }: { client: ClickHouseClient; operations: StoreOperationsClickhouse }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const messages: any[] = [];
      const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
      const include = selectBy?.include || [];

      if (include.length) {
        const unionQueries: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        for (const inc of include) {
          const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
          // if threadId is provided, use it, otherwise use threadId from args
          const searchId = inc.threadId || threadId;

          unionQueries.push(`
            SELECT * FROM (
              WITH numbered_messages AS (
                SELECT
                  id, content, role, type, "createdAt", thread_id, "resourceId",
                  ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
                FROM "${TABLE_MESSAGES}"
                WHERE thread_id = {var_thread_id_${paramIdx}:String}
              ),
              target_positions AS (
                SELECT row_num as target_pos
                FROM numbered_messages
                WHERE id = {var_include_id_${paramIdx}:String}
              )
              SELECT DISTINCT m.id, m.content, m.role, m.type, m."createdAt", m.thread_id AS "threadId"
              FROM numbered_messages m
              CROSS JOIN target_positions t
              WHERE m.row_num BETWEEN (t.target_pos - {var_withPreviousMessages_${paramIdx}:Int64}) AND (t.target_pos + {var_withNextMessages_${paramIdx}:Int64})
            ) AS query_${paramIdx}
          `);

          params.push(
            { [`var_thread_id_${paramIdx}`]: searchId },
            { [`var_include_id_${paramIdx}`]: id },
            { [`var_withPreviousMessages_${paramIdx}`]: withPreviousMessages },
            { [`var_withNextMessages_${paramIdx}`]: withNextMessages },
          );
          paramIdx++;
        }

        const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" DESC';

        // Merge all parameter objects
        const mergedParams = params.reduce((acc, paramObj) => ({ ...acc, ...paramObj }), {});

        const includeResult = await this.client.query({
          query: finalQuery,
          query_params: mergedParams,
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });

        const rows = await includeResult.json();
        const includedMessages = transformRows(rows.data);

        // Deduplicate messages
        const seen = new Set<string>();
        const dedupedMessages = includedMessages.filter((message: any) => {
          if (seen.has(message.id)) return false;
          seen.add(message.id);
          return true;
        });

        messages.push(...dedupedMessages);
      }

      // Then get the remaining messages, excluding the ids we just fetched
      const result = await this.client.query({
        query: `
        SELECT 
            id, 
            content, 
            role, 
            type,
            toDateTime64(createdAt, 3) as createdAt,
            thread_id AS "threadId"
        FROM "${TABLE_MESSAGES}"
        WHERE thread_id = {threadId:String}
        AND id NOT IN ({exclude:Array(String)})
        ORDER BY "createdAt" DESC
        LIMIT {limit:Int64}
        `,
        query_params: {
          threadId,
          exclude: messages.map(m => m.id),
          limit,
        },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      messages.push(...transformRows(rows.data));

      // Sort all messages by creation date
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Parse message content
      messages.forEach(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch {
            // If parsing fails, leave as string
          }
        }
      });

      const list = new MessageList({ threadId, resourceId }).add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId: resourceId ?? '' },
        },
        error,
      );
    }
  }

  public async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format: 'v1';
  }): Promise<MastraMessageV1[]>;
  public async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v2';
  }): Promise<MastraMessageV2[]>;
  public async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    if (messageIds.length === 0) return [];

    try {
      const result = await this.client.query({
        query: `
        SELECT 
          id, 
          content, 
          role, 
          type,
          toDateTime64(createdAt, 3) as createdAt,
          thread_id AS "threadId",
          "resourceId"
        FROM "${TABLE_MESSAGES}"
        WHERE id IN {messageIds:Array(String)}
        ORDER BY "createdAt" DESC
        `,
        query_params: {
          messageIds,
        },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      const messages: any[] = transformRows(rows.data);

      // Parse message content
      messages.forEach(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch {
            // If parsing fails, leave as string
          }
        }
      });

      const list = new MessageList().add(messages, 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    if (messages.length === 0) return messages;

    for (const message of messages) {
      const resourceId = message.resourceId;
      if (!resourceId) {
        throw new Error('Resource ID is required');
      }

      if (!message.threadId) {
        throw new Error('Thread ID is required');
      }

      // Check if thread exists
      const thread = await this.getThreadById({ threadId: message.threadId });
      if (!thread) {
        throw new Error(`Thread ${message.threadId} not found`);
      }
    }

    const threadIdSet = new Map();

    await Promise.all(
      messages.map(async m => {
        const resourceId = m.resourceId;
        if (!resourceId) {
          throw new Error('Resource ID is required');
        }

        if (!m.threadId) {
          throw new Error('Thread ID is required');
        }

        // Check if thread exists
        const thread = await this.getThreadById({ threadId: m.threadId });
        if (!thread) {
          throw new Error(`Thread ${m.threadId} not found`);
        }

        threadIdSet.set(m.threadId, thread);
      }),
    );

    try {
      // Clickhouse's MergeTree engine does not support native upserts or unique constraints on (id, thread_id).
      // Note: We cannot switch to ReplacingMergeTree without a schema migration,
      // as it would require altering the table engine.
      // To ensure correct upsert behavior, we first fetch existing (id, thread_id) pairs for the incoming messages.
      const existingResult = await this.client.query({
        query: `SELECT id, thread_id FROM ${TABLE_MESSAGES} WHERE id IN ({ids:Array(String)})`,
        query_params: {
          ids: messages.map(m => m.id),
        },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
        format: 'JSONEachRow',
      });
      const existingRows: Array<{ id: string; thread_id: string }> = await existingResult.json();

      const existingSet = new Set(existingRows.map(row => `${row.id}::${row.thread_id}`));

      // Partition the batch into different operations:
      // 1. New messages (insert)
      // 2. Existing messages with same (id, threadId) (update)
      // 3. Messages with same id but different threadId (delete old + insert new)
      const toInsert = messages.filter(m => !existingSet.has(`${m.id}::${m.threadId}`));
      const toUpdate = messages.filter(m => existingSet.has(`${m.id}::${m.threadId}`));

      // Find messages that need to be moved (same id, different threadId)
      const toMove = messages.filter(m => {
        const existingRow = existingRows.find(row => row.id === m.id);
        return existingRow && existingRow.thread_id !== m.threadId;
      });

      // Delete old messages that are being moved
      const deletePromises = toMove.map(message => {
        const existingRow = existingRows.find(row => row.id === message.id);
        if (!existingRow) return Promise.resolve();

        return this.client.command({
          query: `DELETE FROM ${TABLE_MESSAGES} WHERE id = {var_id:String} AND thread_id = {var_old_thread_id:String}`,
          query_params: {
            var_id: message.id,
            var_old_thread_id: existingRow.thread_id,
          },
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });
      });

      const updatePromises = toUpdate.map(message =>
        this.client.command({
          query: `
      ALTER TABLE ${TABLE_MESSAGES}
      UPDATE content = {var_content:String}, role = {var_role:String}, type = {var_type:String}, resourceId = {var_resourceId:String}
      WHERE id = {var_id:String} AND thread_id = {var_thread_id:String}
    `,
          query_params: {
            var_content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
            var_role: message.role,
            var_type: message.type || 'v2',
            var_resourceId: message.resourceId,
            var_id: message.id,
            var_thread_id: message.threadId,
          },
          clickhouse_settings: {
            // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
            date_time_input_format: 'best_effort',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        }),
      );

      // Execute message operations and thread update in parallel for better performance
      await Promise.all([
        // Insert new messages (including moved messages)
        this.client.insert({
          table: TABLE_MESSAGES,
          format: 'JSONEachRow',
          values: toInsert.map(message => ({
            id: message.id,
            thread_id: message.threadId,
            resourceId: message.resourceId,
            content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
            createdAt: message.createdAt.toISOString(),
            role: message.role,
            type: message.type || 'v2',
          })),
          clickhouse_settings: {
            // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
            date_time_input_format: 'best_effort',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        }),
        ...updatePromises,
        ...deletePromises,
        // Update thread's updatedAt timestamp
        this.client.insert({
          table: TABLE_THREADS,
          format: 'JSONEachRow',
          values: Array.from(threadIdSet.values()).map(thread => ({
            id: thread.id,
            resourceId: thread.resourceId,
            title: thread.title,
            metadata: thread.metadata,
            createdAt: thread.createdAt,
            updatedAt: new Date().toISOString(),
          })),
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        }),
      ]);

      const list = new MessageList().add(messages, 'memory');

      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const result = await this.client.query({
        query: `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          toDateTime64(createdAt, 3) as createdAt,
          toDateTime64(updatedAt, 3) as updatedAt
        FROM "${TABLE_THREADS}"
        FINAL
        WHERE id = {var_id:String}`,
        query_params: { var_id: threadId },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      const thread = transformRow(rows.data[0]) as StorageThreadType;

      if (!thread) {
        return null;
      }

      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_THREAD_BY_ID_FAILED',
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
      const result = await this.client.query({
        query: `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          toDateTime64(createdAt, 3) as createdAt,
          toDateTime64(updatedAt, 3) as updatedAt
        FROM "${TABLE_THREADS}"
        WHERE "resourceId" = {var_resourceId:String}`,
        query_params: { var_resourceId: resourceId },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      const threads = transformRows(rows.data) as StorageThreadType[];

      return threads.map((thread: StorageThreadType) => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_THREADS_BY_RESOURCE_ID_FAILED',
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
      await this.client.insert({
        table: TABLE_THREADS,
        values: [
          {
            ...thread,
            createdAt: thread.createdAt.toISOString(),
            updatedAt: thread.updatedAt.toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_SAVE_THREAD_FAILED',
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
    try {
      // First get the existing thread to merge metadata
      const existingThread = await this.getThreadById({ threadId: id });
      if (!existingThread) {
        throw new Error(`Thread ${id} not found`);
      }

      // Merge the existing metadata with the new metadata
      const mergedMetadata = {
        ...existingThread.metadata,
        ...metadata,
      };

      const updatedThread = {
        ...existingThread,
        title,
        metadata: mergedMetadata,
        updatedAt: new Date(),
      };

      await this.client.insert({
        table: TABLE_THREADS,
        format: 'JSONEachRow',
        values: [
          {
            id: updatedThread.id,
            resourceId: updatedThread.resourceId,
            title: updatedThread.title,
            metadata: updatedThread.metadata,
            createdAt: updatedThread.createdAt,
            updatedAt: updatedThread.updatedAt.toISOString(),
          },
        ],
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      return updatedThread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id, title },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // First delete all messages associated with this thread
      await this.client.command({
        query: `DELETE FROM "${TABLE_MESSAGES}" WHERE thread_id = {var_thread_id:String};`,
        query_params: { var_thread_id: threadId },
        clickhouse_settings: {
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Then delete the thread
      await this.client.command({
        query: `DELETE FROM "${TABLE_THREADS}" WHERE id = {var_id:String};`,
        query_params: { var_id: threadId },
        clickhouse_settings: {
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage = 100 } = args;

    try {
      const currentOffset = page * perPage;

      // Get total count
      const countResult = await this.client.query({
        query: `SELECT count() as total FROM ${TABLE_THREADS} WHERE resourceId = {resourceId:String}`,
        query_params: { resourceId },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
      const countData = await countResult.json();
      const total = (countData as any).data[0].total;

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Get paginated threads
      const dataResult = await this.client.query({
        query: `
              SELECT 
                id,
                resourceId,
                title,
                metadata,
                toDateTime64(createdAt, 3) as createdAt,
                toDateTime64(updatedAt, 3) as updatedAt
              FROM ${TABLE_THREADS}
              WHERE resourceId = {resourceId:String}
              ORDER BY createdAt DESC
              LIMIT {limit:Int64} OFFSET {offset:Int64}
            `,
        query_params: {
          resourceId,
          limit: perPage,
          offset: currentOffset,
        },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await dataResult.json();
      const threads = transformRows<StorageThreadType>(rows.data);

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: currentOffset + threads.length < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId, page },
        },
        error,
      );
    }
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    try {
      const { threadId, selectBy, format = 'v1' } = args;
      const page = selectBy?.pagination?.page || 0;
      const perPageInput = selectBy?.pagination?.perPage;
      const perPage =
        perPageInput !== undefined ? perPageInput : resolveMessageLimit({ last: selectBy?.last, defaultLimit: 20 });
      const offset = page * perPage;
      const dateRange = selectBy?.pagination?.dateRange;
      const fromDate = dateRange?.start;
      const toDate = dateRange?.end;

      const messages: MastraMessageV2[] = [];

      // Get include messages first (like libsql)
      if (selectBy?.include?.length) {
        const include = selectBy.include;
        const unionQueries: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        for (const inc of include) {
          const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
          const searchId = inc.threadId || threadId;

          unionQueries.push(`
                SELECT * FROM (
                  WITH numbered_messages AS (
                    SELECT
                      id, content, role, type, "createdAt", thread_id, "resourceId",
                      ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
                    FROM "${TABLE_MESSAGES}"
                    WHERE thread_id = {var_thread_id_${paramIdx}:String}
                  ),
                  target_positions AS (
                    SELECT row_num as target_pos
                    FROM numbered_messages
                    WHERE id = {var_include_id_${paramIdx}:String}
                  )
                  SELECT DISTINCT m.id, m.content, m.role, m.type, m."createdAt", m.thread_id AS "threadId"
                  FROM numbered_messages m
                  CROSS JOIN target_positions t
                  WHERE m.row_num BETWEEN (t.target_pos - {var_withPreviousMessages_${paramIdx}:Int64}) AND (t.target_pos + {var_withNextMessages_${paramIdx}:Int64})
                ) AS query_${paramIdx}
              `);

          params.push(
            { [`var_thread_id_${paramIdx}`]: searchId },
            { [`var_include_id_${paramIdx}`]: id },
            { [`var_withPreviousMessages_${paramIdx}`]: withPreviousMessages },
            { [`var_withNextMessages_${paramIdx}`]: withNextMessages },
          );
          paramIdx++;
        }

        const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" DESC';
        const mergedParams = params.reduce((acc, paramObj) => ({ ...acc, ...paramObj }), {});

        const includeResult = await this.client.query({
          query: finalQuery,
          query_params: mergedParams,
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });

        const rows = await includeResult.json();
        const includedMessages = transformRows<MastraMessageV2>(rows.data);

        // Deduplicate messages
        const seen = new Set<string>();
        const dedupedMessages = includedMessages.filter((message: MastraMessageV2) => {
          if (seen.has(message.id)) return false;
          seen.add(message.id);
          return true;
        });

        messages.push(...dedupedMessages);
      }

      // Get total count
      let countQuery = `SELECT count() as total FROM ${TABLE_MESSAGES} WHERE thread_id = {threadId:String}`;
      const countParams: any = { threadId };

      if (fromDate) {
        countQuery += ` AND createdAt >= parseDateTime64BestEffort({fromDate:String}, 3)`;
        countParams.fromDate = fromDate.toISOString();
      }
      if (toDate) {
        countQuery += ` AND createdAt <= parseDateTime64BestEffort({toDate:String}, 3)`;
        countParams.toDate = toDate.toISOString();
      }

      const countResult = await this.client.query({
        query: countQuery,
        query_params: countParams,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
      const countData = await countResult.json();
      const total = (countData as any).data[0].total;

      if (total === 0 && messages.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Get regular paginated messages, excluding include message IDs
      const excludeIds = messages.map(m => m.id);
      let dataQuery = `
            SELECT 
              id,
              content,
              role,
              type,
              toDateTime64(createdAt, 3) as createdAt,
              thread_id AS "threadId",
              resourceId
            FROM ${TABLE_MESSAGES}
            WHERE thread_id = {threadId:String}
          `;
      const dataParams: any = { threadId };

      if (fromDate) {
        dataQuery += ` AND createdAt >= parseDateTime64BestEffort({fromDate:String}, 3)`;
        dataParams.fromDate = fromDate.toISOString();
      }
      if (toDate) {
        dataQuery += ` AND createdAt <= parseDateTime64BestEffort({toDate:String}, 3)`;
        dataParams.toDate = toDate.toISOString();
      }

      // Exclude include message IDs
      if (excludeIds.length > 0) {
        dataQuery += ` AND id NOT IN ({excludeIds:Array(String)})`;
        dataParams.excludeIds = excludeIds;
      }

      // For last N functionality, we need to get the most recent messages first, then sort them chronologically
      if (selectBy?.last) {
        dataQuery += `
              ORDER BY createdAt DESC
              LIMIT {limit:Int64}
            `;
        dataParams.limit = perPage;
      } else {
        dataQuery += `
              ORDER BY createdAt ASC
              LIMIT {limit:Int64} OFFSET {offset:Int64}
            `;
        dataParams.limit = perPage;
        dataParams.offset = offset;
      }

      const result = await this.client.query({
        query: dataQuery,
        query_params: dataParams,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      const paginatedMessages = transformRows<MastraMessageV2>(rows.data);
      messages.push(...paginatedMessages);

      // For last N functionality, sort messages chronologically
      if (selectBy?.last) {
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      return {
        messages: format === 'v2' ? messages : (messages as unknown as MastraMessageV1[]),
        total,
        page,
        perPage,
        hasMore: offset + perPage < total,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;

    if (messages.length === 0) {
      return [];
    }

    try {
      const messageIds = messages.map(m => m.id);

      // Get existing messages
      const existingResult = await this.client.query({
        query: `SELECT id, content, role, type, "createdAt", thread_id AS "threadId", "resourceId" FROM ${TABLE_MESSAGES} WHERE id IN (${messageIds.map((_, i) => `{id_${i}:String}`).join(',')})`,
        query_params: messageIds.reduce((acc, m, i) => ({ ...acc, [`id_${i}`]: m }), {}),
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const existingRows = await existingResult.json();
      const existingMessages = transformRows<MastraMessageV2>(existingRows.data);

      if (existingMessages.length === 0) {
        return [];
      }

      // Parse content from string to object for merging
      const parsedExistingMessages = existingMessages.map(msg => {
        if (typeof msg.content === 'string') {
          try {
            msg.content = JSON.parse(msg.content);
          } catch {
            // ignore if not valid json
          }
        }
        return msg;
      });

      const threadIdsToUpdate = new Set<string>();
      const updatePromises: Promise<any>[] = [];

      for (const existingMessage of parsedExistingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) continue;

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

        threadIdsToUpdate.add(existingMessage.threadId!);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
        }

        const setClauses: string[] = [];
        const values: any = {};
        let paramIdx = 1;
        let newContent: any = null;

        const updatableFields = { ...fieldsToUpdate };

        // Special handling for content: merge in code, then update the whole field
        if (updatableFields.content) {
          const existingContent = existingMessage.content || {};
          const existingMetadata = existingContent.metadata || {};
          const updateMetadata = updatableFields.content.metadata || {};

          newContent = {
            ...existingContent,
            ...updatableFields.content,
            // Deep merge metadata
            metadata: {
              ...existingMetadata,
              ...updateMetadata,
            },
          };

          // Ensure we're updating the content field
          setClauses.push(`content = {var_content_${paramIdx}:String}`);
          values[`var_content_${paramIdx}`] = JSON.stringify(newContent);
          paramIdx++;
          delete updatableFields.content;
        }

        // Handle other fields
        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = key === 'threadId' ? 'thread_id' : key;
            setClauses.push(`"${dbColumn}" = {var_${key}_${paramIdx}:String}`);
            values[`var_${key}_${paramIdx}`] = updatableFields[key as keyof typeof updatableFields];
            paramIdx++;
          }
        }

        if (setClauses.length > 0) {
          values[`var_id_${paramIdx}`] = id;

          // Use ALTER TABLE UPDATE for ClickHouse
          const updateQuery = `
                ALTER TABLE ${TABLE_MESSAGES}
                UPDATE ${setClauses.join(', ')}
                WHERE id = {var_id_${paramIdx}:String}
              `;

          console.log('Updating message:', id, 'with query:', updateQuery, 'values:', values);

          updatePromises.push(
            this.client.command({
              query: updateQuery,
              query_params: values,
              clickhouse_settings: {
                date_time_input_format: 'best_effort',
                use_client_time_zone: 1,
                output_format_json_quote_64bit_integers: 0,
              },
            }),
          );
        }
      }

      // Execute all updates
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      // Optimize table to apply changes immediately
      await this.client.command({
        query: `OPTIMIZE TABLE ${TABLE_MESSAGES} FINAL`,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Verify updates were applied and retry if needed
      for (const existingMessage of parsedExistingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) continue;

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

        // Check if the update was actually applied
        const verifyResult = await this.client.query({
          query: `SELECT id, content, role, type, "createdAt", thread_id AS "threadId", "resourceId" FROM ${TABLE_MESSAGES} WHERE id = {messageId:String}`,
          query_params: { messageId: id },
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });

        const verifyRows = await verifyResult.json();
        if (verifyRows.data.length > 0) {
          const updatedMessage = transformRows<MastraMessageV2>(verifyRows.data)[0];

          if (updatedMessage) {
            // Check if the update was applied correctly
            let needsRetry = false;
            for (const [key, value] of Object.entries(fieldsToUpdate)) {
              if (key === 'content') {
                // For content updates, check if the content was updated
                const expectedContent = typeof value === 'string' ? value : JSON.stringify(value);
                const actualContent =
                  typeof updatedMessage.content === 'string'
                    ? updatedMessage.content
                    : JSON.stringify(updatedMessage.content);
                if (actualContent !== expectedContent) {
                  needsRetry = true;
                  break;
                }
              } else if (updatedMessage[key as keyof MastraMessageV2] !== value) {
                needsRetry = true;
                break;
              }
            }

            if (needsRetry) {
              console.log('Update not applied correctly, retrying with DELETE + INSERT for message:', id);

              // Use DELETE + INSERT as fallback
              await this.client.command({
                query: `DELETE FROM ${TABLE_MESSAGES} WHERE id = {messageId:String}`,
                query_params: { messageId: id },
                clickhouse_settings: {
                  date_time_input_format: 'best_effort',
                  use_client_time_zone: 1,
                  output_format_json_quote_64bit_integers: 0,
                },
              });

              // Reconstruct the updated content if needed
              let updatedContent = existingMessage.content || {};
              if (fieldsToUpdate.content) {
                const existingContent = existingMessage.content || {};
                const existingMetadata = existingContent.metadata || {};
                const updateMetadata = fieldsToUpdate.content.metadata || {};

                updatedContent = {
                  ...existingContent,
                  ...fieldsToUpdate.content,
                  metadata: {
                    ...existingMetadata,
                    ...updateMetadata,
                  },
                };
              }

              const updatedMessageData = {
                ...existingMessage,
                ...fieldsToUpdate,
                content: updatedContent,
              };

              await this.client.insert({
                table: TABLE_MESSAGES,
                format: 'JSONEachRow',
                values: [
                  {
                    id: updatedMessageData.id,
                    thread_id: updatedMessageData.threadId,
                    resourceId: updatedMessageData.resourceId,
                    content:
                      typeof updatedMessageData.content === 'string'
                        ? updatedMessageData.content
                        : JSON.stringify(updatedMessageData.content),
                    createdAt: updatedMessageData.createdAt.toISOString(),
                    role: updatedMessageData.role,
                    type: updatedMessageData.type || 'v2',
                  },
                ],
                clickhouse_settings: {
                  date_time_input_format: 'best_effort',
                  use_client_time_zone: 1,
                  output_format_json_quote_64bit_integers: 0,
                },
              });
            }
          }
        }
      }

      // Update thread timestamps with a small delay to ensure timestamp difference
      if (threadIdsToUpdate.size > 0) {
        // Add a small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        const now = new Date().toISOString().replace('Z', '');

        // Get existing threads to preserve their data
        const threadUpdatePromises = Array.from(threadIdsToUpdate).map(async threadId => {
          // Get existing thread data
          const threadResult = await this.client.query({
            query: `SELECT id, resourceId, title, metadata, createdAt FROM ${TABLE_THREADS} WHERE id = {threadId:String}`,
            query_params: { threadId },
            clickhouse_settings: {
              date_time_input_format: 'best_effort',
              date_time_output_format: 'iso',
              use_client_time_zone: 1,
              output_format_json_quote_64bit_integers: 0,
            },
          });

          const threadRows = await threadResult.json();
          if (threadRows.data.length > 0) {
            const existingThread = threadRows.data[0] as any;

            // Delete existing thread
            await this.client.command({
              query: `DELETE FROM ${TABLE_THREADS} WHERE id = {threadId:String}`,
              query_params: { threadId },
              clickhouse_settings: {
                date_time_input_format: 'best_effort',
                use_client_time_zone: 1,
                output_format_json_quote_64bit_integers: 0,
              },
            });

            // Insert updated thread with new timestamp
            await this.client.insert({
              table: TABLE_THREADS,
              format: 'JSONEachRow',
              values: [
                {
                  id: existingThread.id,
                  resourceId: existingThread.resourceId,
                  title: existingThread.title,
                  metadata: existingThread.metadata,
                  createdAt: existingThread.createdAt,
                  updatedAt: now,
                },
              ],
              clickhouse_settings: {
                date_time_input_format: 'best_effort',
                use_client_time_zone: 1,
                output_format_json_quote_64bit_integers: 0,
              },
            });
          }
        });

        await Promise.all(threadUpdatePromises);
      }

      // Re-fetch to return the fully updated messages
      const updatedMessages: MastraMessageV2[] = [];
      for (const messageId of messageIds) {
        const updatedResult = await this.client.query({
          query: `SELECT id, content, role, type, "createdAt", thread_id AS "threadId", "resourceId" FROM ${TABLE_MESSAGES} WHERE id = {messageId:String}`,
          query_params: { messageId },
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });
        const updatedRows = await updatedResult.json();
        if (updatedRows.data.length > 0) {
          const message = transformRows<MastraMessageV2>(updatedRows.data)[0];
          if (message) {
            updatedMessages.push(message);
          }
        }
      }

      // Parse content back to objects
      return updatedMessages.map(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch {
            // ignore if not valid json
          }
        }
        return message;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messages.map(m => m.id).join(',') },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const result = await this.client.query({
        query: `SELECT id, workingMemory, metadata, createdAt, updatedAt FROM ${TABLE_RESOURCES} WHERE id = {resourceId:String}`,
        query_params: { resourceId },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      if (rows.data.length === 0) {
        return null;
      }

      const resource = rows.data[0] as any;
      return {
        id: resource.id,
        workingMemory:
          resource.workingMemory && typeof resource.workingMemory === 'object'
            ? JSON.stringify(resource.workingMemory)
            : resource.workingMemory,
        metadata:
          resource.metadata && typeof resource.metadata === 'string'
            ? JSON.parse(resource.metadata)
            : resource.metadata,
        createdAt: new Date(resource.createdAt),
        updatedAt: new Date(resource.updatedAt),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_RESOURCE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      await this.client.insert({
        table: TABLE_RESOURCES,
        format: 'JSONEachRow',
        values: [
          {
            id: resource.id,
            workingMemory: resource.workingMemory,
            metadata: JSON.stringify(resource.metadata),
            createdAt: resource.createdAt.toISOString(),
            updatedAt: resource.updatedAt.toISOString(),
          },
        ],
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_SAVE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId: resource.id },
        },
        error,
      );
    }
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
    try {
      const existingResource = await this.getResourceById({ resourceId });

      if (!existingResource) {
        // Create new resource if it doesn't exist
        const newResource: StorageResourceType = {
          id: resourceId,
          workingMemory,
          metadata: metadata || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return this.saveResource({ resource: newResource });
      }

      const updatedResource = {
        ...existingResource,
        workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
        metadata: {
          ...existingResource.metadata,
          ...metadata,
        },
        updatedAt: new Date(),
      };

      // Use ALTER TABLE UPDATE for ClickHouse
      const updateQuery = `
            ALTER TABLE ${TABLE_RESOURCES}
            UPDATE workingMemory = {workingMemory:String}, metadata = {metadata:String}, updatedAt = {updatedAt:String}
            WHERE id = {resourceId:String}
          `;

      await this.client.command({
        query: updateQuery,
        query_params: {
          workingMemory: updatedResource.workingMemory,
          metadata: JSON.stringify(updatedResource.metadata),
          updatedAt: updatedResource.updatedAt.toISOString().replace('Z', ''),
          resourceId,
        },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Optimize table to apply changes
      await this.client.command({
        query: `OPTIMIZE TABLE ${TABLE_RESOURCES} FINAL`,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      return updatedResource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_UPDATE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }
}
