import { randomUUID } from 'node:crypto';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  createStorageErrorId,
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  validateStorageMetadataFilter,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
  OBSERVATIONAL_MEMORY_TABLE_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageMetadataFilter,
  CreateIndexOptions,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
  ObservationalMemoryRecord,
  ObservationalMemoryHistoryOptions,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedReflectionInput,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';
import sql from 'mssql';
import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { getTableName, getSchemaName, buildDateRangeFilter, prepareWhereClause } from '../utils';

const OM_TABLE = 'mastra_observational_memory' as const;

function bindMssqlMetadataParams(request: sql.Request, params: Record<string, unknown>): void {
  for (const [paramName, paramValue] of Object.entries(params)) {
    request.input(paramName, paramValue);
  }
}

function buildMssqlMessageMetadataFilter(metadataFilter: StorageMetadataFilter | undefined): {
  clauses: string[];
  params: Record<string, unknown>;
} {
  if (!metadataFilter) return { clauses: [], params: {} };

  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  Object.entries(metadataFilter).forEach(([key, value], index) => {
    const keyParam = `metadataKey${index}`;
    params[keyParam] = key;
    clauses.push('ISJSON(content) = 1');

    if (value === null) {
      clauses.push(`EXISTS (SELECT 1 FROM OPENJSON(content, '$.metadata') WHERE [key] = @${keyParam} AND [type] = 0)`);
      return;
    }

    const valueParam = `metadataValue${index}`;
    params[valueParam] = String(value);
    const jsonType = typeof value === 'string' ? 1 : typeof value === 'number' ? 2 : 3;
    clauses.push(
      `EXISTS (SELECT 1 FROM OPENJSON(content, '$.metadata') WHERE [key] = @${keyParam} AND [type] = ${jsonType} AND [value] = @${valueParam})`,
    );
  });

  return { clauses, params };
}

export class MemoryMSSQL extends MemoryStorage {
  override readonly supportsPartialThreadUpdate = true;
  readonly supportsObservationalMemory = true;

  private pool: sql.ConnectionPool;
  private schema?: string;
  private db: MssqlDB;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES, OM_TABLE] as const;

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
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.indexes = indexes?.filter(idx => (MemoryMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });

    const omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];
    if (omSchema) {
      await this.db.createTable({
        tableName: OM_TABLE as any,
        schema: omSchema,
      });
    }

    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the memory domain tables.
   * IMPORTANT: Uses seq_id DESC instead of createdAt DESC for MSSQL due to millisecond accuracy limitations
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema ? `${this.schema}_` : '';
    const indexes: CreateIndexOptions[] = [
      {
        name: `${schemaPrefix}mastra_threads_resourceid_seqid_idx`,
        table: TABLE_THREADS,
        columns: ['resourceId', 'seq_id DESC'],
      },
      {
        name: `${schemaPrefix}mastra_messages_thread_id_seqid_idx`,
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'seq_id DESC'],
      },
    ];

    const omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];
    if (omSchema) {
      indexes.push({
        name: `${schemaPrefix}idx_om_lookup_key`,
        table: OM_TABLE as any,
        columns: ['lookupKey'],
      });
    }

    return indexes;
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) {
      return;
    }

    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_MESSAGES });
    await this.db.clearTable({ tableName: TABLE_THREADS });
    await this.db.clearTable({ tableName: TABLE_RESOURCES });
    const omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];
    if (omSchema) {
      await this.db.clearTable({ tableName: OM_TABLE as any });
    }
  }

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
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
      if (!thread || (resourceId !== undefined && thread.resourceId !== resourceId)) {
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

  public async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;

    try {
      // Validate pagination input before normalization
      // This ensures page === 0 when perPageInput === false
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'LIST_THREADS', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid pagination parameters',
        details: { page, ...(perPageInput !== undefined && { perPage: perPageInput }) },
      });
    }

    const perPage = normalizePerPage(perPageInput, 100);

    // Validate metadata keys to prevent SQL injection
    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid metadata key',
        details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
      });
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);

    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const whereClauses: string[] = [];
      const params: Record<string, any> = {};

      // Add resourceId filter if provided
      if (filter?.resourceId) {
        whereClauses.push('[resourceId] = @resourceId');
        params.resourceId = filter.resourceId;
      }

      // Add metadata filters if provided (AND logic)
      // Keys are validated above to prevent SQL injection
      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        let metadataIndex = 0;
        for (const [key, value] of Object.entries(filter.metadata)) {
          // Validate filter value type - only allow scalar types
          if (value !== null && typeof value === 'object') {
            throw new MastraError({
              id: createStorageErrorId('MSSQL', 'LIST_THREADS', 'INVALID_METADATA_VALUE'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Metadata filter value for key "${key}" must be a scalar type (string, number, boolean, or null), got ${Array.isArray(value) ? 'array' : 'object'}`,
              details: { key, valueType: Array.isArray(value) ? 'array' : 'object' },
            });
          }

          // Handle null values specially: JSON_VALUE returns NULL for null values,
          // and NULL = NULL evaluates to NULL (not true) in SQL
          if (value === null) {
            whereClauses.push(`JSON_VALUE(metadata, '$.${key}') IS NULL`);
          } else {
            const paramName = `metadata${metadataIndex}`;
            whereClauses.push(`JSON_VALUE(metadata, '$.${key}') = @${paramName}`);
            // JSON_VALUE returns strings directly, numbers as strings, booleans as 'true'/'false'
            // Don't use JSON.stringify as it escapes quotes/backslashes which JSON_VALUE doesn't
            if (typeof value === 'string') {
              params[paramName] = value;
            } else if (typeof value === 'boolean') {
              params[paramName] = value ? 'true' : 'false';
            } else {
              params[paramName] = String(value);
            }
          }
          metadataIndex++;
        }
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const baseQuery = `FROM ${tableName} ${whereClause}`;

      const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;
      const countRequest = this.pool.request();
      for (const [key, value] of Object.entries(params)) {
        countRequest.input(key, value);
      }
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

      for (const [key, value] of Object.entries(params)) {
        dataRequest.input(key, value);
      }
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
      // Re-throw USER errors (validation errors) directly so callers get proper 400 responses
      if (error instanceof MastraError && error.category === ErrorCategory.USER) {
        throw error;
      }
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!filter?.metadata,
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      throw mastraError;
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
    title?: string;
    metadata?: Record<string, unknown>;
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
          title: title ?? null,
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
      req.input('title', title ?? existingThread.title);
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
            title: title ?? null,
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
            title: title ?? null,
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

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
    if (!sourceThread) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }

    const newThreadId = providedThreadId || randomUUID();

    const existingThread = await this.getThreadById({ threadId: newThreadId });
    if (existingThread) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    try {
      const messagesTable = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const threadsTable = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });

      let messageQuery = `SELECT id, content, role, type, [createdAt], thread_id, [resourceId] FROM ${messagesTable} WHERE thread_id = @threadId`;
      const messageReq = this.pool.request();
      messageReq.input('threadId', sourceThreadId);

      const conditions: string[] = [];
      let paramIndex = 1;

      if (options?.messageFilter?.startDate) {
        paramIndex++;
        messageReq.input(`startDate${paramIndex}`, options.messageFilter.startDate instanceof Date ? options.messageFilter.startDate.toISOString() : options.messageFilter.startDate);
        conditions.push(`AND [createdAt] >= @startDate${paramIndex}`);
      }
      if (options?.messageFilter?.endDate) {
        paramIndex++;
        messageReq.input(`endDate${paramIndex}`, options.messageFilter.endDate instanceof Date ? options.messageFilter.endDate.toISOString() : options.messageFilter.endDate);
        conditions.push(`AND [createdAt] <= @endDate${paramIndex}`);
      }
      if (options?.messageFilter?.messageIds && options.messageFilter.messageIds.length > 0) {
        const placeholders = options.messageFilter.messageIds.map((_, i) => `@messageId${i + 1}`).join(', ');
        conditions.push(`AND id IN (${placeholders})`);
        options.messageFilter.messageIds.forEach((id, i) => {
          messageReq.input(`messageId${i + 1}`, id);
        });
      }

      messageQuery += ` ${conditions.join(' ')} ORDER BY [createdAt] ASC`;

      if (options?.messageLimit && options.messageLimit > 0) {
        paramIndex++;
        const limitQuery = `SELECT * FROM (${messageQuery.replace('ORDER BY [createdAt] ASC', 'ORDER BY [createdAt] DESC')}) AS sub ORDER BY [createdAt] ASC OFFSET 0 ROWS FETCH NEXT @messageLimit ROWS ONLY`;
        messageReq.input('messageLimit', options.messageLimit);
        messageQuery = limitQuery;
      }

      const sourceMessagesResult = await messageReq.query(messageQuery);
      const sourceMessages = sourceMessagesResult.recordset || [];

      const now = new Date();
      const nowStr = now.toISOString();

      const lastMessageId = sourceMessages.length > 0 ? (sourceMessages[sourceMessages.length - 1]!.id as string) : undefined;

      const cloneMetadata: ThreadCloneMetadata = {
        sourceThreadId,
        clonedAt: now,
        ...(lastMessageId && { lastMessageId }),
      };

      const newThread: StorageThreadType = {
        id: newThreadId,
        resourceId: resourceId || sourceThread.resourceId,
        title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : ''),
        metadata: {
          ...metadata,
          clone: cloneMetadata,
        },
        createdAt: now,
        updatedAt: now,
      };

      const tx = this.pool.transaction();
      try {
        await tx.begin();

        const threadReq = tx.request();
        threadReq.input('id', newThread.id);
        threadReq.input('resourceId', newThread.resourceId);
        threadReq.input('title', newThread.title ?? '');
        threadReq.input('metadata', JSON.stringify(newThread.metadata));
        threadReq.input('createdAt', nowStr);
        threadReq.input('updatedAt', nowStr);

        await threadReq.query(
          `INSERT INTO ${threadsTable} (id, [resourceId], title, metadata, [createdAt], [updatedAt]) VALUES (@id, @resourceId, @title, @metadata, @createdAt, @updatedAt)`,
        );

        const clonedMessages: MastraDBMessage[] = [];
        const messageIdMap: Record<string, string> = {};
        const targetResourceId = resourceId || sourceThread.resourceId;

        for (const sourceMsg of sourceMessages) {
          const newMessageId = randomUUID();
          messageIdMap[sourceMsg.id as string] = newMessageId;
          const contentStr = sourceMsg.content as string;
          let parsedContent: MastraDBMessage['content'];
          try {
            parsedContent = JSON.parse(contentStr);
          } catch {
            parsedContent = { format: 2, parts: [{ type: 'text', text: contentStr }] };
          }

          const msgReq = tx.request();
          msgReq.input('id', newMessageId);
          msgReq.input('threadId', newThreadId);
          msgReq.input('content', contentStr);
          msgReq.input('role', sourceMsg.role as string);
          msgReq.input('type', (sourceMsg.type as string) || 'v2');
          msgReq.input('createdAt', sourceMsg.createdAt as string);
          msgReq.input('resourceId', targetResourceId);

          await msgReq.query(
            `INSERT INTO ${messagesTable} (id, thread_id, content, role, type, [createdAt], [resourceId]) VALUES (@id, @threadId, @content, @role, @type, @createdAt, @resourceId)`,
          );

          clonedMessages.push({
            id: newMessageId,
            threadId: newThreadId,
            content: parsedContent,
            role: sourceMsg.role as MastraDBMessage['role'],
            type: (sourceMsg.type as string) || undefined,
            createdAt: new Date(sourceMsg.createdAt as string),
            resourceId: targetResourceId,
          });
        }

        await tx.commit();

        return {
          thread: newThread,
          clonedMessages,
          messageIdMap,
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CLONE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sourceThreadId, newThreadId },
        },
        error,
      );
    }
  }

  private _sortMessages(messages: MastraDBMessage[], field: string, direction: string): MastraDBMessage[] {
    const mult = direction === 'ASC' ? 1 : -1;
    return messages.sort((a, b) => {
      const aVal = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
      const bVal = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

      if (aVal == null || bVal == null) {
        return aVal == null && bVal == null ? a.id.localeCompare(b.id) : aVal == null ? 1 : -1;
      }

      const diff =
        (typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal))) * mult;

      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  }

  /**
   * Fetches the messages named by `include` together with their surrounding context.
   *
   * @param include - Message ids to pin, each with an optional before/after window.
   * @param resourceId - When set, restricts both the pinned messages and their context
   * to that resource so an id from another resource returns nothing.
   */
  private async _getIncludedMessages({
    include,
    resourceId,
  }: {
    include: StorageListMessagesInput['include'];
    resourceId?: string;
  }) {
    if (!include || include.length === 0) return null;

    const unionQueries: string[] = [];
    const paramValues: any[] = [];
    let paramIdx = 1;
    const paramNames: string[] = [];
    const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const resourceCondition = resourceId ? ` AND [resourceId] = @presource` : '';

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
            WHERE [thread_id] = (SELECT thread_id FROM ${tableName} WHERE id = ${pId}${resourceCondition})${resourceCondition}
          ) AS m
          WHERE m.id = ${pId}
          OR EXISTS (
            SELECT 1
            FROM (
              SELECT *, ROW_NUMBER() OVER (ORDER BY [createdAt] ASC) as row_num
              FROM ${tableName}
              WHERE [thread_id] = (SELECT thread_id FROM ${tableName} WHERE id = ${pId}${resourceCondition})${resourceCondition}
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
    if (resourceId) {
      req.input('presource', resourceId);
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
      throw mastraError;
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);

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

      const { sql: preparedWhereClause = '', params: whereParams } = prepareWhereClause(
        filters,
        TABLE_SCHEMAS[TABLE_MESSAGES],
      );
      const metadataWhere = buildMssqlMessageMetadataFilter(metadataFilter);
      const actualWhereClause = metadataWhere.clauses.length
        ? `${preparedWhereClause || ' WHERE 1 = 1'} AND ${metadataWhere.clauses.join(' AND ')}`
        : preparedWhereClause;
      const bindWhereParams = (req: sql.Request) => {
        Object.entries(whereParams).forEach(([paramName, paramValue]) => req.input(paramName, paramValue));
        bindMssqlMetadataParams(req, metadataWhere.params);
      };

      // When perPage is 0 with no includes, there's nothing to return.
      if (perPage === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      // When perPage is 0, we only need included messages — skip COUNT and data queries
      if (perPage === 0 && include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include, resourceId });
        const messages = this._parseAndFormatMessages(includeMessages ?? [], 'v2') as MastraDBMessage[];
        return {
          messages: this._sortMessages(messages, field, direction),
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

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
      const primaryPageCount = messages.length;
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
        const includeMessages = await this._getIncludedMessages({ include, resourceId });
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

      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageCount = finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).length;
      const hasMore = metadataFilter
        ? perPageInput !== false && offset + primaryPageCount < total
        : perPageInput !== false && returnedThreadMessageCount < total && offset + perPage < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      // Re-throw USER errors (validation errors) directly so callers get proper 400 responses
      if (error instanceof MastraError && error.category === ErrorCategory.USER) {
        throw error;
      }
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
      throw mastraError;
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

  // ============================================
  // Observational Memory Methods
  // ============================================

  private getOMKey(threadId: string | null, resourceId: string): string {
    return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
  }

  private parseOMRow(row: any): ObservationalMemoryRecord {
    return {
      id: row.id,
      scope: row.scope,
      threadId: row.threadId || null,
      resourceId: row.resourceId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      lastObservedAt: row.lastObservedAt ? new Date(row.lastObservedAt) : undefined,
      originType: row.originType || 'initial',
      generationCount: Number(row.generationCount || 0),
      activeObservations: row.activeObservations || '',
      bufferedObservationChunks: row.bufferedObservationChunks
        ? typeof row.bufferedObservationChunks === 'string'
          ? JSON.parse(row.bufferedObservationChunks)
          : row.bufferedObservationChunks
        : undefined,
      bufferedObservations: row.activeObservationsPendingUpdate || undefined,
      bufferedObservationTokens: row.bufferedObservationTokens ? Number(row.bufferedObservationTokens) : undefined,
      bufferedMessageIds: undefined,
      bufferedReflection: row.bufferedReflection || undefined,
      bufferedReflectionTokens: row.bufferedReflectionTokens ? Number(row.bufferedReflectionTokens) : undefined,
      bufferedReflectionInputTokens: row.bufferedReflectionInputTokens
        ? Number(row.bufferedReflectionInputTokens)
        : undefined,
      reflectedObservationLineCount: row.reflectedObservationLineCount
        ? Number(row.reflectedObservationLineCount)
        : undefined,
      totalTokensObserved: Number(row.totalTokensObserved || 0),
      observationTokenCount: Number(row.observationTokenCount || 0),
      pendingMessageTokens: Number(row.pendingMessageTokens || 0),
      isReflecting: Boolean(row.isReflecting),
      isObserving: Boolean(row.isObserving),
      isBufferingObservation:
        row.isBufferingObservation === true || row.isBufferingObservation === 'true' || row.isBufferingObservation === 1,
      isBufferingReflection:
        row.isBufferingReflection === true || row.isBufferingReflection === 'true' || row.isBufferingReflection === 1,
      lastBufferedAtTokens:
        typeof row.lastBufferedAtTokens === 'number'
          ? row.lastBufferedAtTokens
          : parseInt(String(row.lastBufferedAtTokens ?? '0'), 10) || 0,
      lastBufferedAtTime: row.lastBufferedAtTime ? new Date(String(row.lastBufferedAtTime)) : null,
      config: row.config ? (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) : {},
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      observedMessageIds: row.observedMessageIds
        ? typeof row.observedMessageIds === 'string'
          ? JSON.parse(row.observedMessageIds)
          : row.observedMessageIds
        : undefined,
      observedTimezone: row.observedTimezone || undefined,
    };
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();
      request.input('lookupKey', lookupKey);
      const sql = `SELECT TOP 1 * FROM ${tableName} WHERE [lookupKey] = @lookupKey ORDER BY [generationCount] DESC`;
      const resultSet = await request.query(sql);
      if (!resultSet.recordset || resultSet.recordset.length === 0) return null;
      return this.parseOMRow(resultSet.recordset[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit: number = 10,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();
      request.input('lookupKey', lookupKey);

      const conditions = ['[lookupKey] = @lookupKey'];
      let paramIndex = 1;

      if (options?.from) {
        paramIndex++;
        request.input(`from${paramIndex}`, options.from.toISOString());
        conditions.push(`[createdAt] >= @from${paramIndex}`);
      }
      if (options?.to) {
        paramIndex++;
        request.input(`to${paramIndex}`, options.to.toISOString());
        conditions.push(`[createdAt] <= @to${paramIndex}`);
      }

      paramIndex++;
      request.input('limit', limit);
      let sql = `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY [generationCount] DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;

      if (options?.offset != null) {
        sql = sql.replace('OFFSET 0 ROWS', `OFFSET @offset ROWS`);
        request.input('offset', options.offset);
      }

      const resultSet = await request.query(sql);
      if (!resultSet.recordset) return [];
      return resultSet.recordset.map(row => this.parseOMRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_OBSERVATIONAL_MEMORY_HISTORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId, limit },
        },
        error,
      );
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    try {
      const id = randomUUID();
      const now = new Date();
      const lookupKey = this.getOMKey(input.threadId, input.resourceId);

      const record: ObservationalMemoryRecord = {
        id,
        scope: input.scope,
        threadId: input.threadId,
        resourceId: input.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: undefined,
        originType: 'initial',
        generationCount: 0,
        activeObservations: '',
        totalTokensObserved: 0,
        observationTokenCount: 0,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: input.config,
        observedTimezone: input.observedTimezone,
      };

      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const nowStr = now.toISOString();
      const request = this.pool.request();
      request.input('id', id);
      request.input('lookupKey', lookupKey);
      request.input('scope', input.scope);
      request.input('resourceId', input.resourceId);
      request.input('threadId', input.threadId || null);
      request.input('activeObservations', '');
      request.input('activeObservationsPendingUpdate', null);
      request.input('originType', 'initial');
      request.input('config', JSON.stringify(input.config));
      request.input('generationCount', 0);
      request.input('lastObservedAt', null);
      request.input('lastReflectionAt', null);
      request.input('pendingMessageTokens', 0);
      request.input('totalTokensObserved', 0);
      request.input('observationTokenCount', 0);
      request.input('isObserving', false);
      request.input('isReflecting', false);
      request.input('isBufferingObservation', false);
      request.input('isBufferingReflection', false);
      request.input('lastBufferedAtTokens', 0);
      request.input('lastBufferedAtTime', null);
      request.input('observedTimezone', input.observedTimezone || null);
      request.input('createdAt', nowStr);
      request.input('updatedAt', nowStr);

      await request.query(
        `INSERT INTO ${tableName} (
          id, [lookupKey], scope, [resourceId], [threadId],
          [activeObservations], [activeObservationsPendingUpdate],
          [originType], config, [generationCount], [lastObservedAt], [lastReflectionAt],
          [pendingMessageTokens], [totalTokensObserved], [observationTokenCount],
          [isObserving], [isReflecting], [isBufferingObservation], [isBufferingReflection], [lastBufferedAtTokens], [lastBufferedAtTime],
          [observedTimezone], [createdAt], [updatedAt]
        ) VALUES (
          @id, @lookupKey, @scope, @resourceId, @threadId,
          @activeObservations, @activeObservationsPendingUpdate,
          @originType, @config, @generationCount, @lastObservedAt, @lastReflectionAt,
          @pendingMessageTokens, @totalTokensObserved, @observationTokenCount,
          @isObserving, @isReflecting, @isBufferingObservation, @isBufferingReflection, @lastBufferedAtTokens, @lastBufferedAtTime,
          @observedTimezone, @createdAt, @updatedAt
        )`,
      );

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INITIALIZE_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: input.threadId, resourceId: input.resourceId },
        },
        error,
      );
    }
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    try {
      const lookupKey = this.getOMKey(record.threadId, record.resourceId);
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('id', record.id);
      request.input('lookupKey', lookupKey);
      request.input('scope', record.scope);
      request.input('resourceId', record.resourceId);
      request.input('threadId', record.threadId || null);
      request.input('activeObservations', record.activeObservations || '');
      request.input('activeObservationsPendingUpdate', null);
      request.input('originType', record.originType || 'initial');
      request.input('config', record.config ? JSON.stringify(record.config) : null);
      request.input('generationCount', record.generationCount || 0);
      request.input('lastObservedAt', record.lastObservedAt ? record.lastObservedAt.toISOString() : null);
      request.input('lastReflectionAt', null);
      request.input('pendingMessageTokens', record.pendingMessageTokens || 0);
      request.input('totalTokensObserved', record.totalTokensObserved || 0);
      request.input('observationTokenCount', record.observationTokenCount || 0);
      request.input('observedMessageIds', record.observedMessageIds ? JSON.stringify(record.observedMessageIds) : null);
      request.input('bufferedObservationChunks', record.bufferedObservationChunks ? JSON.stringify(record.bufferedObservationChunks) : null);
      request.input('bufferedReflection', record.bufferedReflection || null);
      request.input('bufferedReflectionTokens', record.bufferedReflectionTokens ?? null);
      request.input('bufferedReflectionInputTokens', record.bufferedReflectionInputTokens ?? null);
      request.input('reflectedObservationLineCount', record.reflectedObservationLineCount ?? null);
      request.input('isObserving', record.isObserving || false);
      request.input('isReflecting', record.isReflecting || false);
      request.input('isBufferingObservation', record.isBufferingObservation || false);
      request.input('isBufferingReflection', record.isBufferingReflection || false);
      request.input('lastBufferedAtTokens', record.lastBufferedAtTokens || 0);
      request.input('lastBufferedAtTime', record.lastBufferedAtTime ? record.lastBufferedAtTime.toISOString() : null);
      request.input('observedTimezone', record.observedTimezone || null);
      request.input('metadata', record.metadata ? JSON.stringify(record.metadata) : null);
      request.input('createdAt', record.createdAt.toISOString());
      request.input('updatedAt', record.updatedAt.toISOString());

      await request.query(
        `INSERT INTO ${tableName} (
          id, [lookupKey], scope, [resourceId], [threadId],
          [activeObservations], [activeObservationsPendingUpdate],
          [originType], config, [generationCount], [lastObservedAt], [lastReflectionAt],
          [pendingMessageTokens], [totalTokensObserved], [observationTokenCount],
          [observedMessageIds], [bufferedObservationChunks],
          [bufferedReflection], [bufferedReflectionTokens], [bufferedReflectionInputTokens],
          [reflectedObservationLineCount],
          [isObserving], [isReflecting], [isBufferingObservation], [isBufferingReflection],
          [lastBufferedAtTokens], [lastBufferedAtTime],
          [observedTimezone], metadata, [createdAt], [updatedAt]
        ) VALUES (
          @id, @lookupKey, @scope, @resourceId, @threadId,
          @activeObservations, @activeObservationsPendingUpdate,
          @originType, @config, @generationCount, @lastObservedAt, @lastReflectionAt,
          @pendingMessageTokens, @totalTokensObserved, @observationTokenCount,
          @observedMessageIds, @bufferedObservationChunks,
          @bufferedReflection, @bufferedReflectionTokens, @bufferedReflectionInputTokens,
          @reflectedObservationLineCount,
          @isObserving, @isReflecting, @isBufferingObservation, @isBufferingReflection,
          @lastBufferedAtTokens, @lastBufferedAtTime,
          @observedTimezone, @metadata, @createdAt, @updatedAt
        )`,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'INSERT_OBSERVATIONAL_MEMORY_RECORD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: record.id, threadId: record.threadId, resourceId: record.resourceId },
        },
        error,
      );
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    try {
      const now = new Date();
      const observedMessageIdsJson = input.observedMessageIds ? JSON.stringify(input.observedMessageIds) : null;
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('activeObservations', input.observations);
      request.input('lastObservedAt', input.lastObservedAt.toISOString());
      request.input('observationTokenCount', input.tokenCount);
      request.input('tokenCount', input.tokenCount);
      request.input('observedMessageIds', observedMessageIdsJson);
      request.input('updatedAt', now.toISOString());
      request.input('id', input.id);

      const result = await request.query(
        `UPDATE ${tableName} SET
          [activeObservations] = @activeObservations,
          [lastObservedAt] = @lastObservedAt,
          [pendingMessageTokens] = 0,
          [observationTokenCount] = @observationTokenCount,
          [totalTokensObserved] = [totalTokensObserved] + @tokenCount,
          [observedMessageIds] = @observedMessageIds,
          [updatedAt] = @updatedAt
        WHERE id = @id`,
      );

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'UPDATE_ACTIVE_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_ACTIVE_OBSERVATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    try {
      const id = randomUUID();
      const now = new Date();
      const lookupKey = this.getOMKey(input.currentRecord.threadId, input.currentRecord.resourceId);

      const record: ObservationalMemoryRecord = {
        id,
        scope: input.currentRecord.scope,
        threadId: input.currentRecord.threadId,
        resourceId: input.currentRecord.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: input.currentRecord.lastObservedAt,
        originType: 'reflection',
        generationCount: input.currentRecord.generationCount + 1,
        activeObservations: input.reflection,
        totalTokensObserved: input.currentRecord.totalTokensObserved,
        observationTokenCount: input.tokenCount,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: input.currentRecord.config,
        metadata: input.currentRecord.metadata,
        observedTimezone: input.currentRecord.observedTimezone,
      };

      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const nowStr = now.toISOString();
      const request = this.pool.request();

      request.input('id', id);
      request.input('lookupKey', lookupKey);
      request.input('scope', record.scope);
      request.input('resourceId', record.resourceId);
      request.input('threadId', record.threadId || null);
      request.input('activeObservations', input.reflection);
      request.input('activeObservationsPendingUpdate', null);
      request.input('originType', 'reflection');
      request.input('config', JSON.stringify(record.config));
      request.input('generationCount', input.currentRecord.generationCount + 1);
      request.input('lastObservedAt', record.lastObservedAt?.toISOString() || null);
      request.input('lastReflectionAt', nowStr);
      request.input('pendingMessageTokens', record.pendingMessageTokens);
      request.input('totalTokensObserved', record.totalTokensObserved);
      request.input('observationTokenCount', record.observationTokenCount);
      request.input('isObserving', false);
      request.input('isReflecting', false);
      request.input('isBufferingObservation', false);
      request.input('isBufferingReflection', false);
      request.input('lastBufferedAtTokens', 0);
      request.input('lastBufferedAtTime', null);
      request.input('observedTimezone', record.observedTimezone || null);
      request.input('metadata', record.metadata ? JSON.stringify(record.metadata) : null);
      request.input('createdAt', nowStr);
      request.input('updatedAt', nowStr);

      await request.query(
        `INSERT INTO ${tableName} (
          id, [lookupKey], scope, [resourceId], [threadId],
          [activeObservations], [activeObservationsPendingUpdate],
          [originType], config, [generationCount], [lastObservedAt], [lastReflectionAt],
          [pendingMessageTokens], [totalTokensObserved], [observationTokenCount],
          [isObserving], [isReflecting], [isBufferingObservation], [isBufferingReflection], [lastBufferedAtTokens], [lastBufferedAtTime],
          [observedTimezone], metadata, [createdAt], [updatedAt]
        ) VALUES (
          @id, @lookupKey, @scope, @resourceId, @threadId,
          @activeObservations, @activeObservationsPendingUpdate,
          @originType, @config, @generationCount, @lastObservedAt, @lastReflectionAt,
          @pendingMessageTokens, @totalTokensObserved, @observationTokenCount,
          @isObserving, @isReflecting, @isBufferingObservation, @isBufferingReflection, @lastBufferedAtTokens, @lastBufferedAtTime,
          @observedTimezone, @metadata, @createdAt, @updatedAt
        )`,
      );

      return record;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CREATE_REFLECTION_GENERATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { currentRecordId: input.currentRecord.id },
        },
        error,
      );
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('isReflecting', isReflecting);
      request.input('updatedAt', new Date().toISOString());
      request.input('id', id);

      const result = await request.query(
        `UPDATE ${tableName} SET [isReflecting] = @isReflecting, [updatedAt] = @updatedAt WHERE id = @id`,
      );

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SET_REFLECTING_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isReflecting },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SET_REFLECTING_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isReflecting },
        },
        error,
      );
    }
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('isObserving', isObserving);
      request.input('updatedAt', new Date().toISOString());
      request.input('id', id);

      const result = await request.query(
        `UPDATE ${tableName} SET [isObserving] = @isObserving, [updatedAt] = @updatedAt WHERE id = @id`,
      );

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SET_OBSERVING_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isObserving },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SET_OBSERVING_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isObserving },
        },
        error,
      );
    }
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('isBufferingObservation', isBuffering);
      request.input('updatedAt', new Date().toISOString());
      request.input('id', id);

      let sql = `UPDATE ${tableName} SET [isBufferingObservation] = @isBufferingObservation, [updatedAt] = @updatedAt WHERE id = @id`;

      if (lastBufferedAtTokens !== undefined) {
        sql = `UPDATE ${tableName} SET [isBufferingObservation] = @isBufferingObservation, [lastBufferedAtTokens] = @lastBufferedAtTokens, [updatedAt] = @updatedAt WHERE id = @id`;
        request.input('lastBufferedAtTokens', lastBufferedAtTokens);
      }

      const result = await request.query(sql);

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SET_BUFFERING_OBSERVATION_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering, lastBufferedAtTokens: lastBufferedAtTokens ?? null },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SET_BUFFERING_OBSERVATION_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering, lastBufferedAtTokens: lastBufferedAtTokens ?? null },
        },
        error,
      );
    }
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('isBufferingReflection', isBuffering);
      request.input('updatedAt', new Date().toISOString());
      request.input('id', id);

      const result = await request.query(
        `UPDATE ${tableName} SET [isBufferingReflection] = @isBufferingReflection, [updatedAt] = @updatedAt WHERE id = @id`,
      );

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SET_BUFFERING_REFLECTION_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SET_BUFFERING_REFLECTION_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering },
        },
        error,
      );
    }
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('lookupKey', lookupKey);

      await request.query(`DELETE FROM ${tableName} WHERE [lookupKey] = @lookupKey`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CLEAR_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('pendingMessageTokens', tokenCount);
      request.input('updatedAt', new Date().toISOString());
      request.input('id', id);

      const result = await request.query(
        `UPDATE ${tableName} SET [pendingMessageTokens] = @pendingMessageTokens, [updatedAt] = @updatedAt WHERE id = @id`,
      );

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SET_PENDING_MESSAGE_TOKENS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SET_PENDING_MESSAGE_TOKENS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        },
        error,
      );
    }
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('id', input.id);
      const selectResult = await request.query(`SELECT config FROM ${tableName} WHERE id = @id`);

      if (!selectResult.recordset || selectResult.recordset.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'UPDATE_OM_CONFIG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      const row = selectResult.recordset[0] as any;
      const existing: Record<string, unknown> = row.config ? JSON.parse(row.config) : {};
      const merged = this.deepMergeConfig(existing, input.config);

      request.input('config', JSON.stringify(merged));
      request.input('updatedAt', new Date().toISOString());

      await request.query(`UPDATE ${tableName} SET config = @config, [updatedAt] = @updatedAt WHERE id = @id`);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_OM_CONFIG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    try {
      const nowStr = new Date().toISOString();
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('id', input.id);
      const currentResult = await request.query(
        `SELECT [bufferedObservationChunks] FROM ${tableName} WHERE id = @id`,
      );

      if (!currentResult.recordset || currentResult.recordset.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'UPDATE_BUFFERED_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      const row = currentResult.recordset[0]!;
      let existingChunks: BufferedObservationChunk[] = [];
      if (row.bufferedObservationChunks) {
        try {
          const parsed =
            typeof row.bufferedObservationChunks === 'string'
              ? JSON.parse(row.bufferedObservationChunks)
              : row.bufferedObservationChunks;
          existingChunks = Array.isArray(parsed) ? parsed : [];
        } catch {
          existingChunks = [];
        }
      }

      const newChunk: BufferedObservationChunk = {
        id: `ombuf-${randomUUID()}`,
        cycleId: input.chunk.cycleId,
        observations: input.chunk.observations,
        tokenCount: input.chunk.tokenCount,
        messageIds: input.chunk.messageIds,
        messageTokens: input.chunk.messageTokens,
        lastObservedAt: input.chunk.lastObservedAt,
        createdAt: new Date(),
        suggestedContinuation: input.chunk.suggestedContinuation,
        currentTask: input.chunk.currentTask,
        threadTitle: input.chunk.threadTitle,
        extractedValues: input.chunk.extractedValues,
        extractionFailures: input.chunk.extractionFailures,
      };

      const newChunks = [...existingChunks, newChunk];
      const lastBufferedAtTime = input.lastBufferedAtTime ? input.lastBufferedAtTime.toISOString() : null;

      const updateRequest = this.pool.request();
      updateRequest.input('bufferedObservationChunks', JSON.stringify(newChunks));
      updateRequest.input('lastBufferedAtTime', lastBufferedAtTime);
      updateRequest.input('updatedAt', nowStr);
      updateRequest.input('id', input.id);

      await updateRequest.query(
        `UPDATE ${tableName} SET
          [bufferedObservationChunks] = @bufferedObservationChunks,
          [lastBufferedAtTime] = COALESCE(@lastBufferedAtTime, [lastBufferedAtTime]),
          [updatedAt] = @updatedAt
        WHERE id = @id`,
      );
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_BUFFERED_OBSERVATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      const nowStr = new Date().toISOString();
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('id', input.id);
      const currentResult = await request.query(`SELECT * FROM ${tableName} WHERE id = @id`);

      if (!currentResult.recordset || currentResult.recordset.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SWAP_BUFFERED_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      const row = currentResult.recordset[0]!;

      let chunks: BufferedObservationChunk[] = [];
      if (row.bufferedObservationChunks) {
        try {
          const parsed =
            typeof row.bufferedObservationChunks === 'string'
              ? JSON.parse(row.bufferedObservationChunks)
              : row.bufferedObservationChunks;
          chunks = Array.isArray(parsed) ? parsed : [];
        } catch {
          chunks = [];
        }
      }

      if (chunks.length === 0) {
        return {
          chunksActivated: 0,
          messageTokensActivated: 0,
          observationTokensActivated: 0,
          messagesActivated: 0,
          activatedCycleIds: [],
          activatedMessageIds: [],
        };
      }

      const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
      const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

      let cumulativeMessageTokens = 0;
      let bestOverBoundary = 0;
      let bestOverTokens = 0;
      let bestUnderBoundary = 0;
      let bestUnderTokens = 0;

      for (let i = 0; i < chunks.length; i++) {
        cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
        const boundary = i + 1;

        if (cumulativeMessageTokens >= targetMessageTokens) {
          if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
            bestOverBoundary = boundary;
            bestOverTokens = cumulativeMessageTokens;
          }
        } else {
          if (cumulativeMessageTokens > bestUnderTokens) {
            bestUnderBoundary = boundary;
            bestUnderTokens = cumulativeMessageTokens;
          }
        }
      }

      const maxOvershoot = retentionFloor * 0.95;
      const overshoot = bestOverTokens - targetMessageTokens;
      const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
      const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
      const minRemaining = Math.min(1000, retentionFloor);

      let chunksToActivate: number;
      if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
        chunksToActivate = bestOverBoundary;
      } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
        chunksToActivate = bestOverBoundary;
      } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
        chunksToActivate = bestUnderBoundary;
      } else if (bestOverBoundary > 0) {
        chunksToActivate = bestOverBoundary;
      } else {
        chunksToActivate = 1;
      }

      const activatedChunks = chunks.slice(0, chunksToActivate);
      const remainingChunks = chunks.slice(chunksToActivate);

      const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
      const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
      const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
      const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
      const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
      const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

      const latestChunk = activatedChunks[activatedChunks.length - 1];
      const lastObservedAt =
        input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
      const lastObservedAtStr = lastObservedAt.toISOString();

      const existingActive = (row.activeObservations as string) || '';
      const existingTokenCount = Number(row.observationTokenCount || 0);

      const boundary = `\n\n--- message boundary (${lastObservedAt.toISOString()}) ---\n\n`;
      const newActive = existingActive ? `${existingActive}${boundary}${activatedContent}` : activatedContent;
      const newTokenCount = existingTokenCount + activatedTokens;

      const existingPending = Number(row.pendingMessageTokens || 0);
      const newPending = Math.max(0, existingPending - activatedMessageTokens);

      const updateRequest = this.pool.request();
      updateRequest.input('activeObservations', newActive);
      updateRequest.input('observationTokenCount', newTokenCount);
      updateRequest.input('pendingMessageTokens', newPending);
      updateRequest.input('bufferedObservationChunks', remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null);
      updateRequest.input('lastObservedAt', lastObservedAtStr);
      updateRequest.input('updatedAt', nowStr);
      updateRequest.input('id', input.id);

      const updateResult = await updateRequest.query(
        `UPDATE ${tableName} SET
          [activeObservations] = @activeObservations,
          [observationTokenCount] = @observationTokenCount,
          [pendingMessageTokens] = @pendingMessageTokens,
          [bufferedObservationChunks] = @bufferedObservationChunks,
          [lastObservedAt] = @lastObservedAt,
          [updatedAt] = @updatedAt
        WHERE id = @id
          AND [bufferedObservationChunks] IS NOT NULL
          AND [bufferedObservationChunks] != '[]'`,
      );

      if (updateResult.rowsAffected[0] === 0) {
        return {
          chunksActivated: 0,
          messageTokensActivated: 0,
          observationTokensActivated: 0,
          messagesActivated: 0,
          activatedCycleIds: [],
          activatedMessageIds: [],
        };
      }

      const latestChunkHints = activatedChunks[activatedChunks.length - 1];

      return {
        chunksActivated: activatedChunks.length,
        messageTokensActivated: activatedMessageTokens,
        observationTokensActivated: activatedTokens,
        messagesActivated: activatedMessageCount,
        activatedCycleIds,
        activatedMessageIds,
        observations: activatedContent,
        perChunk: activatedChunks.map(c => ({
          cycleId: c.cycleId ?? '',
          messageTokens: c.messageTokens ?? 0,
          observationTokens: c.tokenCount,
          messageCount: c.messageIds.length,
          observations: c.observations,
        })),
        suggestedContinuation: latestChunkHints?.suggestedContinuation ?? undefined,
        currentTask: latestChunkHints?.currentTask ?? undefined,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SWAP_BUFFERED_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    try {
      const nowStr = new Date().toISOString();
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('reflection', input.reflection);
      request.input('tokenCount', input.tokenCount);
      request.input('inputTokenCount', input.inputTokenCount);
      request.input('reflectedObservationLineCount', input.reflectedObservationLineCount);
      request.input('updatedAt', nowStr);
      request.input('id', input.id);

      const result = await request.query(
        `UPDATE ${tableName} SET
          [bufferedReflection] = CASE
            WHEN [bufferedReflection] IS NOT NULL AND [bufferedReflection] != ''
            THEN [bufferedReflection] + CHAR(10) + CHAR(10) + @reflection
            ELSE @reflection
          END,
          [bufferedReflectionTokens] = COALESCE([bufferedReflectionTokens], 0) + @tokenCount,
          [bufferedReflectionInputTokens] = COALESCE([bufferedReflectionInputTokens], 0) + @inputTokenCount,
          [reflectedObservationLineCount] = @reflectedObservationLineCount,
          [updatedAt] = @updatedAt
        WHERE id = @id`,
      );

      if (result.rowsAffected[0] === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'UPDATE_BUFFERED_REFLECTION', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_BUFFERED_REFLECTION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    try {
      const tableName = getTableName({ indexName: OM_TABLE, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();

      request.input('id', input.currentRecord.id);
      const currentResult = await request.query(`SELECT * FROM ${tableName} WHERE id = @id`);

      if (!currentResult.recordset || currentResult.recordset.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.currentRecord.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        });
      }

      const row = currentResult.recordset[0]!;
      const bufferedReflection = (row.bufferedReflection as string) || '';
      const reflectedLineCount = Number(row.reflectedObservationLineCount || 0);

      if (!bufferedReflection) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
          text: 'No buffered reflection to swap',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: input.currentRecord.id },
        });
      }

      const currentObservations = (row.activeObservations as string) || '';
      const allLines = currentObservations.split('\n');
      const unreflectedLines = allLines.slice(reflectedLineCount);
      const unreflectedContent = unreflectedLines.join('\n').trim();

      const newObservations = unreflectedContent
        ? `${bufferedReflection}\n\n${unreflectedContent}`
        : bufferedReflection;

      const newRecord = await this.createReflectionGeneration({
        currentRecord: input.currentRecord,
        reflection: newObservations,
        tokenCount: input.tokenCount,
      });

      const nowStr = new Date().toISOString();
      const updateRequest = this.pool.request();
      updateRequest.input('updatedAt', nowStr);
      updateRequest.input('id', input.currentRecord.id);

      await updateRequest.query(
        `UPDATE ${tableName} SET
          [bufferedReflection] = NULL,
          [bufferedReflectionTokens] = NULL,
          [bufferedReflectionInputTokens] = NULL,
          [reflectedObservationLineCount] = NULL,
          [updatedAt] = @updatedAt
        WHERE id = @id`,
      );

      return newRecord;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        },
        error,
      );
    }
  }
}
