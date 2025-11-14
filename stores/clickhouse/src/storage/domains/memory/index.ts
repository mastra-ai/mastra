import type { ClickHouseClient } from '@clickhouse/client';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import {
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type { StoreOperationsClickhouse } from '../operations';
import { transformRow, transformRows } from '../utils';

/**
 * Serialize metadata object to JSON string for storage in ClickHouse.
 * Ensures we always store valid JSON, defaulting to '{}' for null/undefined.
 */
function serializeMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '{}';
  }
  return JSON.stringify(metadata);
}

/**
 * Parse metadata JSON string from ClickHouse back to object.
 * Handles empty strings and malformed JSON gracefully.
 */
function parseMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata as Record<string, unknown>;
  if (typeof metadata !== 'string') return {};

  const trimmed = metadata.trim();
  if (trimmed === '' || trimmed === 'null') return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

export class MemoryStorageClickhouse extends MemoryStorage {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;
  constructor({ client, operations }: { client: ClickHouseClient; operations: StoreOperationsClickhouse }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

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

      const list = new MessageList().add(messages as MastraMessageV1[] | MastraDBMessage[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_LIST_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    if (page < 0) {
      throw new MastraError(
        {
          id: 'STORAGE_CLICKHOUSE_LIST_MESSAGES_INVALID_PAGE',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    if (!threadId.trim()) {
      throw new MastraError(
        {
          id: 'STORAGE_CLICKHOUSE_LIST_MESSAGES_INVALID_THREAD_ID',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        new Error('threadId must be a non-empty string'),
      );
    }

    const perPageForQuery = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPageForQuery);

    try {
      // Step 1: Get paginated messages from the thread first (without excluding included ones)
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

      if (resourceId) {
        dataQuery += ` AND resourceId = {resourceId:String}`;
        dataParams.resourceId = resourceId;
      }

      if (filter?.dateRange?.start) {
        const startDate =
          filter.dateRange.start instanceof Date
            ? filter.dateRange.start.toISOString()
            : new Date(filter.dateRange.start).toISOString();
        dataQuery += ` AND createdAt >= parseDateTime64BestEffort({fromDate:String}, 3)`;
        dataParams.fromDate = startDate;
      }

      if (filter?.dateRange?.end) {
        const endDate =
          filter.dateRange.end instanceof Date
            ? filter.dateRange.end.toISOString()
            : new Date(filter.dateRange.end).toISOString();
        dataQuery += ` AND createdAt <= parseDateTime64BestEffort({toDate:String}, 3)`;
        dataParams.toDate = endDate;
      }

      // Build ORDER BY clause
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      dataQuery += ` ORDER BY "${field}" ${direction}`;

      // Apply pagination
      if (perPageForResponse === false) {
        // Get all messages
      } else {
        dataQuery += ` LIMIT {limit:Int64} OFFSET {offset:Int64}`;
        dataParams.limit = perPageForQuery;
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
      const paginatedMessages = transformRows<MastraDBMessage>(rows.data);
      const paginatedCount = paginatedMessages.length;

      // Get total count
      let countQuery = `SELECT count() as total FROM ${TABLE_MESSAGES} WHERE thread_id = {threadId:String}`;
      const countParams: any = { threadId };

      if (resourceId) {
        countQuery += ` AND resourceId = {resourceId:String}`;
        countParams.resourceId = resourceId;
      }

      if (filter?.dateRange?.start) {
        const startDate =
          filter.dateRange.start instanceof Date
            ? filter.dateRange.start.toISOString()
            : new Date(filter.dateRange.start).toISOString();
        countQuery += ` AND createdAt >= parseDateTime64BestEffort({fromDate:String}, 3)`;
        countParams.fromDate = startDate;
      }

      if (filter?.dateRange?.end) {
        const endDate =
          filter.dateRange.end instanceof Date
            ? filter.dateRange.end.toISOString()
            : new Date(filter.dateRange.end).toISOString();
        countQuery += ` AND createdAt <= parseDateTime64BestEffort({toDate:String}, 3)`;
        countParams.toDate = endDate;
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

      // Only return early if there are no messages AND no includes to process
      if (total === 0 && paginatedCount === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Step 2: Add included messages with context (if any), excluding duplicates
      const messageIds = new Set(paginatedMessages.map((m: MastraDBMessage) => m.id));
      let includeMessages: MastraDBMessage[] = [];

      if (include && include.length > 0) {
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
              SELECT DISTINCT m.id, m.content, m.role, m.type, m."createdAt", m.thread_id AS "threadId", m."resourceId"
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

        const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" ASC';
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

        const includeRows = await includeResult.json();
        includeMessages = transformRows<MastraDBMessage>(includeRows.data);

        // Deduplicate: only add messages that aren't already in the paginated results
        for (const includeMsg of includeMessages) {
          if (!messageIds.has(includeMsg.id)) {
            paginatedMessages.push(includeMsg);
            messageIds.add(includeMsg.id);
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(paginatedMessages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output
      finalMessages = finalMessages.sort((a, b) => {
        const isDateField = field === 'createdAt' || field === 'updatedAt';
        const aValue = isDateField ? new Date((a as any)[field]).getTime() : (a as any)[field];
        const bValue = isDateField ? new Date((b as any)[field]).getTime() : (b as any)[field];

        // Handle tiebreaker for stable sorting
        if (aValue === bValue) {
          return a.id.localeCompare(b.id);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        // Fallback to string comparison for non-numeric fields
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const returnedThreadMessageIds = new Set(finalMessages.filter(m => m.threadId === threadId).map(m => m.id));
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore =
        perPageForResponse === false ? false : allThreadMessagesReturned ? false : offset + paginatedCount < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_CLICKHOUSE_STORE_LIST_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return {
        messages: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    if (messages.length === 0) return { messages };

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
            metadata: serializeMetadata(thread.metadata),
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

      const list = new MessageList().add(messages as MastraMessageV1[] | MastraDBMessage[], 'memory');

      return { messages: list.get.all.db() };
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
        WHERE id = {var_id:String}
        ORDER BY updatedAt DESC
        LIMIT 1`,
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
        metadata: parseMetadata(thread.metadata),
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

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      // ClickHouse's ReplacingMergeTree may create duplicate rows until background merges run
      // We handle this by always querying for the newest row (ORDER BY updatedAt DESC LIMIT 1)
      await this.client.insert({
        table: TABLE_THREADS,
        values: [
          {
            ...thread,
            metadata: serializeMetadata(thread.metadata),
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
            metadata: serializeMetadata(updatedThread.metadata),
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

  public async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new MastraError(
        {
          id: 'STORAGE_CLICKHOUSE_LIST_THREADS_BY_RESOURCE_ID_INVALID_PAGE',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    // When perPage is false (get all), ignore page offset
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);

    try {
      // Get total count - count distinct thread IDs to handle duplicates
      const countResult = await this.client.query({
        query: `SELECT count(DISTINCT id) as total FROM ${TABLE_THREADS} WHERE resourceId = {resourceId:String}`,
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
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated threads - get newest version of each thread by using row number
      const dataResult = await this.client.query({
        query: `
              WITH ranked_threads AS (
                SELECT
                  id,
                  resourceId,
                  title,
                  metadata,
                  toDateTime64(createdAt, 3) as createdAt,
                  toDateTime64(updatedAt, 3) as updatedAt,
                  ROW_NUMBER() OVER (PARTITION BY id ORDER BY updatedAt DESC) as row_num
                FROM ${TABLE_THREADS}
                WHERE resourceId = {resourceId:String}
              )
              SELECT
                id,
                resourceId,
                title,
                metadata,
                createdAt,
                updatedAt
              FROM ranked_threads
              WHERE row_num = 1
              ORDER BY "${field}" ${direction === 'DESC' ? 'DESC' : 'ASC'}
              LIMIT {perPage:Int64} OFFSET {offset:Int64}
            `,
        query_params: {
          resourceId,
          perPage: perPage,
          offset: offset,
        },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await dataResult.json();
      const threads = transformRows<StorageThreadType>(rows.data).map(thread => ({
        ...thread,
        metadata: parseMetadata(thread.metadata),
      }));

      return {
        threads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_LIST_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId, page },
        },
        error,
      );
    }
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
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
      const existingMessages = transformRows<MastraDBMessage>(existingRows.data);

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

          console.info('Updating message:', id, 'with query:', updateQuery, 'values:', values);

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
          const updatedMessage = transformRows<MastraDBMessage>(verifyRows.data)[0];

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
              } else if (updatedMessage[key as keyof MastraDBMessage] !== value) {
                needsRetry = true;
                break;
              }
            }

            if (needsRetry) {
              console.info('Update not applied correctly, retrying with DELETE + INSERT for message:', id);
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
          // Get existing thread data - get newest version by updatedAt
          const threadResult = await this.client.query({
            query: `SELECT id, resourceId, title, metadata, createdAt FROM ${TABLE_THREADS} WHERE id = {threadId:String} ORDER BY updatedAt DESC LIMIT 1`,
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
                  metadata:
                    typeof existingThread.metadata === 'string'
                      ? existingThread.metadata
                      : serializeMetadata(existingThread.metadata as Record<string, unknown>),
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
      const updatedMessages: MastraDBMessage[] = [];
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
          const message = transformRows<MastraDBMessage>(updatedRows.data)[0];
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
        query: `SELECT id, workingMemory, metadata, createdAt, updatedAt FROM ${TABLE_RESOURCES} WHERE id = {resourceId:String} ORDER BY updatedAt DESC LIMIT 1`,
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
