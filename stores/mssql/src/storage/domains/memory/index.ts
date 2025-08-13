import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  resolveMessageLimit,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type {
  StorageGetMessagesArg,
  PaginationInfo,
  PaginationArgs,
  StorageResourceType,
  ThreadSortOptions,
} from '@mastra/core/storage';
import sql from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { getTableName, getSchemaName } from '../utils';

export class MemoryMSSQL extends MemoryStorage {
  private pool: sql.ConnectionPool;
  private schema: string;
  private operations: StoreOperationsMSSQL;

  private _parseAndFormatMessages(messages: any[], format?: 'v1' | 'v2') {
    // Parse content back to objects if they were stringified during storage
    const messagesWithParsedContent = messages.map(message => {
      if (typeof message.content === 'string') {
        try {
          return { ...message, content: JSON.parse(message.content) };
        } catch {
          // If parsing fails, leave as string (V1 message)
          return message;
        }
      }
      return message;
    });

    // Remove seq_id from all messages before formatting
    const cleanMessages = messagesWithParsedContent.map(({ seq_id, ...rest }) => rest);

    // Use MessageList to ensure proper structure for both v1 and v2
    const list = new MessageList().add(cleanMessages, 'memory');
    return format === 'v2' ? list.get.all.v2() : list.get.all.v1();
  }

  constructor({
    pool,
    schema,
    operations,
  }: {
    pool: sql.ConnectionPool;
    schema: string;
    operations: StoreOperationsMSSQL;
  }) {
    super();
    this.pool = pool;
    this.schema = schema;
    this.operations = operations;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const sql = `SELECT 
        id,
        [resourceId],
        title,
        metadata,
        [createdAt],
        [updatedAt]
      FROM ${getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) })}
      WHERE id = @threadId`;
      const request = this.pool.request();
      request.input('threadId', threadId);
      const resultSet = await request.query(sql);
      const thread = resultSet.recordset[0] || null;
      if (!thread) {
        return null;
      }
      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
    } & PaginationArgs &
      ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy = 'createdAt', sortDirection = 'DESC' } = args;
    try {
      const perPage = perPageInput !== undefined ? perPageInput : 100;
      const currentOffset = page * perPage;
      const baseQuery = `FROM ${getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) })} WHERE [resourceId] = @resourceId`;

      const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;
      const countRequest = this.pool.request();
      countRequest.input('resourceId', resourceId);
      const countResult = await countRequest.query(countQuery);
      const total = parseInt(countResult.recordset[0]?.count ?? '0', 10);

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const orderByField = orderBy === 'createdAt' ? '[createdAt]' : '[updatedAt]';
      const dataQuery = `SELECT id, [resourceId], title, metadata, [createdAt], [updatedAt] ${baseQuery} ORDER BY ${orderByField} ${sortDirection} OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;
      const dataRequest = this.pool.request();
      dataRequest.input('resourceId', resourceId);
      dataRequest.input('perPage', perPage);
      dataRequest.input('offset', currentOffset);
      const rowsResult = await dataRequest.query(dataQuery);
      const rows = rowsResult.recordset || [];
      const threads = rows.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: currentOffset + threads.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return { threads: [], total: 0, page, perPage: perPageInput || 100, hasMore: false };
    }
  }

  public async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const table = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const mergeSql = `MERGE INTO ${table} WITH (HOLDLOCK) AS target
        USING (SELECT @id AS id) AS source
        ON (target.id = source.id)
        WHEN MATCHED THEN
          UPDATE SET
            [resourceId] = @resourceId,
            title = @title,
            metadata = @metadata,
            [updatedAt] = @updatedAt
        WHEN NOT MATCHED THEN
          INSERT (id, [resourceId], title, metadata, [createdAt], [updatedAt])
          VALUES (@id, @resourceId, @title, @metadata, @createdAt, @updatedAt);`;
      const req = this.pool.request();
      req.input('id', thread.id);
      req.input('resourceId', thread.resourceId);
      req.input('title', thread.title);
      req.input('metadata', thread.metadata ? JSON.stringify(thread.metadata) : null);
      req.input('createdAt', sql.DateTime2, thread.createdAt);
      req.input('updatedAt', sql.DateTime2, thread.updatedAt);
      await req.query(mergeSql);
      // Return the exact same thread object to preserve timestamp precision
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id,
          },
        },
        error,
      );
    }
  }

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  public async getThreadsByResourceId(args: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    const { resourceId, orderBy = 'createdAt', sortDirection = 'DESC' } = args;
    try {
      const baseQuery = `FROM ${getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) })} WHERE [resourceId] = @resourceId`;
      const orderByField = orderBy === 'createdAt' ? '[createdAt]' : '[updatedAt]';
      const dataQuery = `SELECT id, [resourceId], title, metadata, [createdAt], [updatedAt] ${baseQuery} ORDER BY ${orderByField} ${sortDirection}`;
      const request = this.pool.request();
      request.input('resourceId', resourceId);
      const resultSet = await request.query(dataQuery);
      const rows = resultSet.recordset || [];
      return rows.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));
    } catch (error) {
      this.logger?.error?.(`Error getting threads for resource ${resourceId}:`, error);
      return [];
    }
  }

  /**
   * Updates a thread's title and metadata, merging with existing metadata. Returns the updated thread.
   */
  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_MSSQL_STORE_UPDATE_THREAD_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          threadId: id,
          title,
        },
      });
    }

    const mergedMetadata = {
      ...existingThread.metadata,
      ...metadata,
    };

    try {
      const table = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const sql = `UPDATE ${table}
        SET title = @title,
            metadata = @metadata,
            [updatedAt] = @updatedAt
        OUTPUT INSERTED.*
        WHERE id = @id`;
      const req = this.pool.request();
      req.input('id', id);
      req.input('title', title);
      req.input('metadata', JSON.stringify(mergedMetadata));
      req.input('updatedAt', new Date());
      const result = await req.query(sql);
      let thread = result.recordset && result.recordset[0];
      if (thread && 'seq_id' in thread) {
        const { seq_id, ...rest } = thread;
        thread = rest;
      }
      if (!thread) {
        throw new MastraError({
          id: 'MASTRA_STORAGE_MSSQL_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Thread ${id} not found after update`,
          details: {
            threadId: id,
            title,
          },
        });
      }
      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
            title,
          },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const messagesTable = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const threadsTable = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
    const deleteMessagesSql = `DELETE FROM ${messagesTable} WHERE [thread_id] = @threadId`;
    const deleteThreadSql = `DELETE FROM ${threadsTable} WHERE id = @threadId`;
    const tx = this.pool.transaction();
    try {
      await tx.begin();
      const req = tx.request();
      req.input('threadId', threadId);
      await req.query(deleteMessagesSql);
      await req.query(deleteThreadSql);
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  private async _getIncludedMessages({
    threadId,
    selectBy,
    orderByStatement,
  }: {
    threadId: string;
    selectBy: StorageGetMessagesArg['selectBy'];
    orderByStatement: string;
  }) {
    const include = selectBy?.include;
    if (!include) return null;

    const unionQueries: string[] = [];
    const paramValues: any[] = [];
    let paramIdx = 1;
    const paramNames: string[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      const searchId = inc.threadId || threadId;

      const pThreadId = `@p${paramIdx}`;
      const pId = `@p${paramIdx + 1}`;
      const pPrev = `@p${paramIdx + 2}`;
      const pNext = `@p${paramIdx + 3}`;

      unionQueries.push(
        `
          SELECT
            m.id, 
            m.content, 
            m.role, 
            m.type,
            m.[createdAt], 
            m.thread_id AS threadId,
            m.[resourceId],
            m.seq_id
          FROM (
            SELECT *, ROW_NUMBER() OVER (${orderByStatement}) as row_num
            FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })}
            WHERE [thread_id] = ${pThreadId}
          ) AS m
          WHERE m.id = ${pId}
          OR EXISTS (
            SELECT 1
            FROM (
              SELECT *, ROW_NUMBER() OVER (${orderByStatement}) as row_num
              FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })}
              WHERE [thread_id] = ${pThreadId}
            ) AS target
            WHERE target.id = ${pId}
            AND (
              (m.row_num <= target.row_num + ${pPrev} AND m.row_num > target.row_num)
              OR
              (m.row_num >= target.row_num - ${pNext} AND m.row_num < target.row_num)
            )
          )
        `,
      );

      paramValues.push(searchId, id, withPreviousMessages, withNextMessages);
      paramNames.push(`p${paramIdx}`, `p${paramIdx + 1}`, `p${paramIdx + 2}`, `p${paramIdx + 3}`);
      paramIdx += 4;
    }

    const finalQuery = `
      SELECT * FROM (
        ${unionQueries.join(' UNION ALL ')}
      ) AS union_result
      ORDER BY [seq_id] ASC
    `;

    const req = this.pool.request();
    for (let i = 0; i < paramValues.length; ++i) {
      req.input(paramNames[i] as string, paramValues[i]);
    }

    const result = await req.query(finalQuery);
    const includedRows = result.recordset || [];

    const seen = new Set<string>();
    const dedupedRows = includedRows.filter((row: any) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    return dedupedRows;
  }

  /**
   * @deprecated use getMessagesPaginated instead
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const { threadId, format, selectBy } = args;
    const selectStatement = `SELECT seq_id, id, content, role, type, [createdAt], thread_id AS threadId, resourceId`;
    const orderByStatement = `ORDER BY [seq_id] DESC`;
    const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
    try {
      let rows: any[] = [];
      const include = selectBy?.include || [];
      if (include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
        if (includeMessages) {
          rows.push(...includeMessages);
        }
      }
      const excludeIds = rows.map(m => m.id).filter(Boolean);

      let query = `${selectStatement} FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} WHERE [thread_id] = @threadId`;
      const request = this.pool.request();
      request.input('threadId', threadId);

      if (excludeIds.length > 0) {
        const excludeParams = excludeIds.map((_, idx) => `@id${idx}`);
        query += ` AND id NOT IN (${excludeParams.join(', ')})`;
        excludeIds.forEach((id, idx) => {
          request.input(`id${idx}`, id);
        });
      }

      query += ` ${orderByStatement} OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
      request.input('limit', limit);
      const result = await request.query(query);
      const remainingRows = result.recordset || [];
      rows.push(...remainingRows);
      rows.sort((a, b) => {
        const timeDiff = a.seq_id - b.seq_id;
        return timeDiff;
      });
      rows = rows.map(({ seq_id, ...rest }) => rest);
      return this._parseAndFormatMessages(rows, format);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
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

    const selectStatement = `SELECT seq_id, id, content, role, type, [createdAt], thread_id AS threadId, resourceId`;
    const orderByStatement = `ORDER BY [seq_id] DESC`;
    try {
      let rows: any[] = [];
      let query = `${selectStatement} FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} WHERE [id] IN (${messageIds.map((_, i) => `@id${i}`).join(', ')})`;
      const request = this.pool.request();
      messageIds.forEach((id, i) => request.input(`id${i}`, id));

      query += ` ${orderByStatement}`;
      const result = await request.query(query);
      const remainingRows = result.recordset || [];
      rows.push(...remainingRows);
      rows.sort((a, b) => {
        const timeDiff = a.seq_id - b.seq_id;
        return timeDiff;
      });
      rows = rows.map(({ seq_id, ...rest }) => rest);
      if (format === `v1`) return this._parseAndFormatMessages(rows, format);
      return this._parseAndFormatMessages(rows, `v2`);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageIds: JSON.stringify(messageIds),
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
    }
  }

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, selectBy } = args;
    const { page = 0, perPage: perPageInput } = selectBy?.pagination || {};
    const orderByStatement = `ORDER BY [seq_id] DESC`;
    let messages: any[] = [];
    if (selectBy?.include?.length) {
      const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
      if (includeMessages) {
        messages.push(...includeMessages);
      }
    }
    try {
      const { threadId, format, selectBy } = args;
      const { page = 0, perPage: perPageInput, dateRange } = selectBy?.pagination || {};
      const fromDate = dateRange?.start;
      const toDate = dateRange?.end;

      const selectStatement = `SELECT seq_id, id, content, role, type, [createdAt], thread_id AS threadId, resourceId`;
      const orderByStatement = `ORDER BY [seq_id] DESC`;

      let messages: any[] = [];

      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
        if (includeMessages) messages.push(...includeMessages);
      }

      const perPage =
        perPageInput !== undefined ? perPageInput : resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
      const currentOffset = page * perPage;

      const conditions: string[] = ['[thread_id] = @threadId'];
      const request = this.pool.request();
      request.input('threadId', threadId);

      if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
        conditions.push('[createdAt] >= @fromDate');
        request.input('fromDate', fromDate.toISOString());
      }
      if (toDate instanceof Date && !isNaN(toDate.getTime())) {
        conditions.push('[createdAt] <= @toDate');
        request.input('toDate', toDate.toISOString());
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const countQuery = `SELECT COUNT(*) as total FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} ${whereClause}`;
      const countResult = await request.query(countQuery);
      const total = parseInt(countResult.recordset[0]?.total, 10) || 0;

      if (total === 0 && messages.length > 0) {
        const parsedIncluded = this._parseAndFormatMessages(messages, format);
        return {
          messages: parsedIncluded,
          total: parsedIncluded.length,
          page,
          perPage,
          hasMore: false,
        };
      }

      const excludeIds = messages.map(m => m.id);
      if (excludeIds.length > 0) {
        const excludeParams = excludeIds.map((_, idx) => `@id${idx}`);
        conditions.push(`id NOT IN (${excludeParams.join(', ')})`);
        excludeIds.forEach((id, idx) => request.input(`id${idx}`, id));
      }

      const finalWhereClause = `WHERE ${conditions.join(' AND ')}`;
      const dataQuery = `${selectStatement} FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} ${finalWhereClause} ${orderByStatement} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

      request.input('offset', currentOffset);
      request.input('limit', perPage);

      const rowsResult = await request.query(dataQuery);
      const rows = rowsResult.recordset || [];
      rows.sort((a, b) => a.seq_id - b.seq_id);
      messages.push(...rows);

      const parsed = this._parseAndFormatMessages(messages, format);
      return {
        messages: parsed,
        total: total + excludeIds.length,
        page,
        perPage,
        hasMore: currentOffset + rows.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return { messages: [], total: 0, page, perPage: perPageInput || 40, hasMore: false };
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
    if (messages.length === 0) return messages;
    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_MESSAGES_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`,
      });
    }
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_MESSAGES_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ${threadId} not found`,
        details: { threadId },
      });
    }
    const tableMessages = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const tableThreads = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
    try {
      const transaction = this.pool.transaction();
      await transaction.begin();
      try {
        for (const message of messages) {
          if (!message.threadId) {
            throw new Error(
              `Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.`,
            );
          }
          if (!message.resourceId) {
            throw new Error(
              `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
            );
          }
          const request = transaction.request();
          request.input('id', message.id);
          request.input('thread_id', message.threadId);
          request.input(
            'content',
            typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          );
          request.input('createdAt', sql.DateTime2, message.createdAt);
          request.input('role', message.role);
          request.input('type', message.type || 'v2');
          request.input('resourceId', message.resourceId);
          const mergeSql = `MERGE INTO ${tableMessages} AS target
            USING (SELECT @id AS id) AS src
            ON target.id = src.id
            WHEN MATCHED THEN UPDATE SET
              thread_id = @thread_id,
              content = @content,
              [createdAt] = @createdAt,
              role = @role,
              type = @type,
              resourceId = @resourceId
            WHEN NOT MATCHED THEN INSERT (id, thread_id, content, [createdAt], role, type, resourceId)
              VALUES (@id, @thread_id, @content, @createdAt, @role, @type, @resourceId);`;
          await request.query(mergeSql);
        }
        const threadReq = transaction.request();
        threadReq.input('updatedAt', sql.DateTime2, new Date());
        threadReq.input('id', threadId);
        await threadReq.query(`UPDATE ${tableThreads} SET [updatedAt] = @updatedAt WHERE id = @id`);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      const messagesWithParsedContent = messages.map(message => {
        if (typeof message.content === 'string') {
          try {
            return { ...message, content: JSON.parse(message.content) };
          } catch {
            return message;
          }
        }
        return message;
      });
      const list = new MessageList().add(messagesWithParsedContent, 'memory');
      if (format === 'v2') return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraMessageV2[]> {
    if (!messages || messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const idParams = messageIds.map((_, i) => `@id${i}`).join(', ');
    let selectQuery = `SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })}`;
    if (idParams.length > 0) {
      selectQuery += ` WHERE id IN (${idParams})`;
    } else {
      return [];
    }
    const selectReq = this.pool.request();
    messageIds.forEach((id, i) => selectReq.input(`id${i}`, id));
    const existingMessagesDb = (await selectReq.query(selectQuery)).recordset;
    if (!existingMessagesDb || existingMessagesDb.length === 0) {
      return [];
    }

    const existingMessages: MastraMessageV2[] = existingMessagesDb.map(msg => {
      if (typeof msg.content === 'string') {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {}
      }
      return msg as MastraMessageV2;
    });

    const threadIdsToUpdate = new Set<string>();
    const transaction = this.pool.transaction();

    try {
      await transaction.begin();
      for (const existingMessage of existingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) continue;
        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;
        threadIdsToUpdate.add(existingMessage.threadId!);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
        }
        const setClauses: string[] = [];
        const req = transaction.request();
        req.input('id', id);
        const columnMapping: Record<string, string> = { threadId: 'thread_id' };
        const updatableFields = { ...fieldsToUpdate };
        if (updatableFields.content) {
          const newContent = {
            ...existingMessage.content,
            ...updatableFields.content,
            ...(existingMessage.content?.metadata && updatableFields.content.metadata
              ? { metadata: { ...existingMessage.content.metadata, ...updatableFields.content.metadata } }
              : {}),
          };
          setClauses.push(`content = @content`);
          req.input('content', JSON.stringify(newContent));
          delete updatableFields.content;
        }
        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = columnMapping[key] || key;
            setClauses.push(`[${dbColumn}] = @${dbColumn}`);
            req.input(dbColumn, updatableFields[key as keyof typeof updatableFields]);
          }
        }
        if (setClauses.length > 0) {
          const updateSql = `UPDATE ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} SET ${setClauses.join(', ')} WHERE id = @id`;
          await req.query(updateSql);
        }
      }
      if (threadIdsToUpdate.size > 0) {
        const threadIdParams = Array.from(threadIdsToUpdate)
          .map((_, i) => `@tid${i}`)
          .join(', ');
        const threadReq = transaction.request();
        Array.from(threadIdsToUpdate).forEach((tid, i) => threadReq.input(`tid${i}`, tid));
        threadReq.input('updatedAt', new Date().toISOString());
        const threadSql = `UPDATE ${getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) })} SET updatedAt = @updatedAt WHERE id IN (${threadIdParams})`;
        await threadReq.query(threadSql);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    const refetchReq = this.pool.request();
    messageIds.forEach((id, i) => refetchReq.input(`id${i}`, id));
    const updatedMessages = (await refetchReq.query(selectQuery)).recordset;
    return (updatedMessages || []).map(message => {
      if (typeof message.content === 'string') {
        try {
          message.content = JSON.parse(message.content);
        } catch {}
      }
      return message;
    });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    try {
      const messageTableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });

      // Build placeholders for the IN clause
      const placeholders = messageIds.map((_, idx) => `@p${idx + 1}`).join(',');

      // Get thread IDs for all messages first
      const request = this.pool.request();
      messageIds.forEach((id, idx) => {
        request.input(`p${idx + 1}`, id);
      });

      const messages = await request.query(
        `SELECT DISTINCT [thread_id] FROM ${messageTableName} WHERE [id] IN (${placeholders})`,
      );

      const threadIds = messages.recordset?.map(msg => msg.thread_id).filter(Boolean) || [];

      // Use transaction for the actual delete and update operations
      const transaction = this.pool.transaction();
      await transaction.begin();

      try {
        // Delete all messages
        const deleteRequest = transaction.request();
        messageIds.forEach((id, idx) => {
          deleteRequest.input(`p${idx + 1}`, id);
        });

        await deleteRequest.query(`DELETE FROM ${messageTableName} WHERE [id] IN (${placeholders})`);

        // Update thread timestamps sequentially to avoid transaction conflicts
        if (threadIds.length > 0) {
          for (const threadId of threadIds) {
            const updateRequest = transaction.request();
            updateRequest.input('p1', threadId);
            await updateRequest.query(`UPDATE ${threadTableName} SET [updatedAt] = GETDATE() WHERE [id] = @p1`);
          }
        }

        await transaction.commit();
      } catch (error) {
        try {
          await transaction.rollback();
        } catch {
          // Ignore rollback errors as they're usually not critical
        }
        throw error;
      }

      // TODO: Delete from vector store if semantic recall is enabled
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_DELETE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
    try {
      const req = this.pool.request();
      req.input('resourceId', resourceId);
      const result = (await req.query(`SELECT * FROM ${tableName} WHERE id = @resourceId`)).recordset[0];

      if (!result) {
        return null;
      }

      return {
        ...result,
        workingMemory:
          typeof result.workingMemory === 'object' ? JSON.stringify(result.workingMemory) : result.workingMemory,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_GET_RESOURCE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.operations.insert({
      tableName: TABLE_RESOURCES,
      record: {
        ...resource,
        metadata: JSON.stringify(resource.metadata),
      },
    });

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
    try {
      const existingResource = await this.getResourceById({ resourceId });

      if (!existingResource) {
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

      const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
      const updates: string[] = [];
      const req = this.pool.request();

      if (workingMemory !== undefined) {
        updates.push('workingMemory = @workingMemory');
        req.input('workingMemory', workingMemory);
      }

      if (metadata) {
        updates.push('metadata = @metadata');
        req.input('metadata', JSON.stringify(updatedResource.metadata));
      }

      updates.push('updatedAt = @updatedAt');
      req.input('updatedAt', updatedResource.updatedAt.toISOString());

      req.input('id', resourceId);

      await req.query(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = @id`);

      return updatedResource;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_UPDATE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }
}
