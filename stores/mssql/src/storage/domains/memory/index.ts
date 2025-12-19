import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  createStorageErrorId,
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import sql from 'mssql';
import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { getTableName, getSchemaName, buildDateRangeFilter, prepareWhereClause } from '../utils';

export class MemoryMSSQL extends MemoryStorage {
  private pool: sql.ConnectionPool;
  private schema?: string;
  private db: MssqlDB;
  private needsConnect: boolean;

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
    return format === 'v2' ? list.get.all.db() : list.get.all.v1();
  }

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName });
    this.needsConnect = needsConnect;
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_MESSAGES });
    await this.db.clearTable({ tableName: TABLE_THREADS });
    await this.db.clearTable({ tableName: TABLE_RESOURCES });
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
          id: createStorageErrorId('MSSQL', 'GET_THREAD_BY_ID', 'FAILED'),
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

  public async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;

    if (page < 0) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'LIST_THREADS_BY_RESOURCE_ID', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Page number must be non-negative',
        details: {
          resourceId,
          page,
        },
      });
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);
    try {
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
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const orderByField = field === 'createdAt' ? '[createdAt]' : '[updatedAt]';
      const dir = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const limitValue = perPageInput === false ? total : perPage;
      const dataQuery = `SELECT id, [resourceId], title, metadata, [createdAt], [updatedAt] ${baseQuery} ORDER BY ${orderByField} ${dir} OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;
      const dataRequest = this.pool.request();
      dataRequest.input('resourceId', resourceId);
      dataRequest.input('offset', offset);

      if (limitValue > 2147483647) {
        dataRequest.input('perPage', sql.BigInt, limitValue);
      } else {
        dataRequest.input('perPage', limitValue);
      }
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
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED'),
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
      return {
        threads: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
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
      const metadata = thread.metadata ? JSON.stringify(thread.metadata) : null;
      if (metadata === null) {
        req.input('metadata', sql.NVarChar, null);
      } else {
        req.input('metadata', metadata);
      }
      req.input('createdAt', sql.DateTime2, thread.createdAt);
      req.input('updatedAt', sql.DateTime2, thread.updatedAt);
      await req.query(mergeSql);
      // Return the exact same thread object to preserve timestamp precision
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SAVE_THREAD', 'FAILED'),
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
        id: createStorageErrorId('MSSQL', 'UPDATE_THREAD', 'NOT_FOUND'),
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
          id: createStorageErrorId('MSSQL', 'UPDATE_THREAD', 'NOT_FOUND'),
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
          id: createStorageErrorId('MSSQL', 'UPDATE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('MSSQL', 'DELETE_THREAD', 'FAILED'),
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

  private async _getIncludedMessages({ include }: { include: StorageListMessagesInput['include'] }) {
    if (!include || include.length === 0) return null;

    const unionQueries: string[] = [];
    const paramValues: any[] = [];
    let paramIdx = 1;
    const paramNames: string[] = [];
    const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // Query by message ID directly - get the threadId from the message itself via subquery

      const pId = `@p${paramIdx}`;
      const pPrev = `@p${paramIdx + 1}`;
      const pNext = `@p${paramIdx + 2}`;

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
            SELECT *, ROW_NUMBER() OVER (ORDER BY [createdAt] ASC) as row_num
            FROM ${tableName}
            WHERE [thread_id] = (SELECT thread_id FROM ${tableName} WHERE id = ${pId})
          ) AS m
          WHERE m.id = ${pId}
          OR EXISTS (
            SELECT 1
            FROM (
              SELECT *, ROW_NUMBER() OVER (ORDER BY [createdAt] ASC) as row_num
              FROM ${tableName}
              WHERE [thread_id] = (SELECT thread_id FROM ${tableName} WHERE id = ${pId})
            ) AS target
            WHERE target.id = ${pId}
            AND (
              -- Get previous messages (messages that come BEFORE the target)
              (m.row_num < target.row_num AND m.row_num >= target.row_num - ${pPrev})
              OR
              -- Get next messages (messages that come AFTER the target)
              (m.row_num > target.row_num AND m.row_num <= target.row_num + ${pNext})
            )
          )
        `,
      );

      paramValues.push(id, withPreviousMessages, withNextMessages);
      paramNames.push(`p${paramIdx}`, `p${paramIdx + 1}`, `p${paramIdx + 2}`);
      paramIdx += 3;
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

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

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
      const messagesWithParsedContent = rows.map(row => {
        if (typeof row.content === 'string') {
          try {
            return { ...row, content: JSON.parse(row.content) };
          } catch {
            return row;
          }
        }
        return row;
      });
      const cleanMessages = messagesWithParsedContent.map(({ seq_id, ...rest }) => rest);
      const list = new MessageList().add(cleanMessages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_MESSAGES_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageIds: JSON.stringify(messageIds),
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return { messages: [] };
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    if (page < 0) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'LIST_MESSAGES', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Page number must be non-negative',
        details: {
          threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
          page,
        },
      });
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderByStatement = `ORDER BY [${field}] ${direction}, [seq_id] ${direction}`;

      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const baseQuery = `SELECT seq_id, id, content, role, type, [createdAt], thread_id AS threadId, resourceId FROM ${tableName}`;

      const filters: Record<string, any> = {
        thread_id: threadIds.length === 1 ? threadIds[0] : { $in: threadIds },
        ...(resourceId ? { resourceId } : {}),
        ...buildDateRangeFilter(filter?.dateRange, 'createdAt'),
      };

      const { sql: actualWhereClause = '', params: whereParams } = prepareWhereClause(
        filters,
        TABLE_SCHEMAS[TABLE_MESSAGES],
      );
      const bindWhereParams = (req: sql.Request) => {
        Object.entries(whereParams).forEach(([paramName, paramValue]) => req.input(paramName, paramValue));
      };

      // Get total count
      const countRequest = this.pool.request();
      bindWhereParams(countRequest);
      const countResult = await countRequest.query(`SELECT COUNT(*) as total FROM ${tableName}${actualWhereClause}`);
      const total = parseInt(countResult.recordset[0]?.total, 10) || 0;

      const fetchBaseMessages = async (): Promise<any[]> => {
        const request = this.pool.request();
        bindWhereParams(request);

        if (perPageInput === false) {
          const result = await request.query(`${baseQuery}${actualWhereClause} ${orderByStatement}`);
          return result.recordset || [];
        }

        request.input('offset', offset);
        request.input('limit', perPage > 2147483647 ? sql.BigInt : sql.Int, perPage);
        const result = await request.query(
          `${baseQuery}${actualWhereClause} ${orderByStatement} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
        );
        return result.recordset || [];
      };

      // Get paginated messages from the thread first (without excluding included ones)
      const baseRows = perPage === 0 ? [] : await fetchBaseMessages();
      const messages: any[] = [...baseRows];
      const seqById = new Map<string, number>();
      messages.forEach(msg => {
        if (typeof msg.seq_id === 'number') seqById.set(msg.id, msg.seq_id);
      });

      // Only return early if there are no messages AND no includes to process
      if (total === 0 && messages.length === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Add included messages with context (if any), excluding duplicates
      if (include?.length) {
        const messageIds = new Set(messages.map(m => m.id));
        const includeMessages = await this._getIncludedMessages({ include });
        includeMessages?.forEach(msg => {
          if (!messageIds.has(msg.id)) {
            messages.push(msg);
            messageIds.add(msg.id);
            if (typeof msg.seq_id === 'number') seqById.set(msg.id, msg.seq_id);
          }
        });
      }
      // Parse and format messages to V2
      const parsed = this._parseAndFormatMessages(messages, 'v2');
      const mult = direction === 'ASC' ? 1 : -1;

      const finalMessages = (parsed as MastraDBMessage[]).sort((a, b) => {
        const aVal = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bVal = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        if (aVal == null || bVal == null) {
          return aVal == null && bVal == null ? a.id.localeCompare(b.id) : aVal == null ? 1 : -1;
        }

        const diff =
          (typeof aVal === 'number' && typeof bVal === 'number'
            ? aVal - bVal
            : String(aVal).localeCompare(String(bVal))) * mult;

        if (diff !== 0) return diff;

        const seqA = seqById.get(a.id);
        const seqB = seqById.get(b.id);
        return seqA != null && seqB != null ? (seqA - seqB) * mult : a.id.localeCompare(b.id);
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageCount = finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).length;
      const hasMore = perPageInput !== false && returnedThreadMessageCount < total && offset + perPage < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
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

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };
    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'SAVE_MESSAGES', 'INVALID_THREAD_ID'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`,
      });
    }
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'SAVE_MESSAGES', 'THREAD_NOT_FOUND'),
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
      const list = new MessageList().add(messagesWithParsedContent as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SAVE_MESSAGES', 'FAILED'),
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
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraDBMessage[]> {
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

    const existingMessages: MastraDBMessage[] = existingMessagesDb.map(msg => {
      if (typeof msg.content === 'string') {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {}
      }
      return msg as MastraDBMessage;
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
          id: createStorageErrorId('MSSQL', 'UPDATE_MESSAGES', 'FAILED'),
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
          id: createStorageErrorId('MSSQL', 'DELETE_MESSAGES', 'FAILED'),
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
        id: result.id,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        workingMemory: result.workingMemory,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_RESOURCE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      throw mastraError;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.db.insert({
      tableName: TABLE_RESOURCES,
      record: {
        ...resource,
        metadata: resource.metadata,
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
          id: createStorageErrorId('MSSQL', 'UPDATE_RESOURCE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      throw mastraError;
    }
  }
}
