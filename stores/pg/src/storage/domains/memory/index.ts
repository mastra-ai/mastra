import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
  createStorageErrorId,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';

// Database row type that includes timezone-aware columns
type MessageRowFromDB = {
  id: string;
  content: string | any;
  role: string;
  type?: string;
  createdAt: Date | string;
  createdAtZ?: Date | string;
  threadId: string;
  resourceId: string;
};

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const quotedIndexName = `"${indexName}"`;
  return schemaName ? `${schemaName}.${quotedIndexName}` : quotedIndexName;
}

export class MemoryPG extends MemoryStorage {
  #db: PgDB;
  #schema: string;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName });
    this.#schema = schemaName || 'public';
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.#db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.#db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });
    await this.#db.alterTable({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });
    await this.createDefaultIndexes();
  }

  /**
   * Returns default index definitions for the memory domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_threads_resourceid_createdat_idx`,
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_messages_thread_id_createdat_idx`,
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt DESC'],
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        console.warn(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_MESSAGES });
    await this.#db.clearTable({ tableName: TABLE_THREADS });
    await this.#db.clearTable({ tableName: TABLE_RESOURCES });
  }

  /**
   * Normalizes message row from database by applying createdAtZ fallback
   */
  private normalizeMessageRow(row: MessageRowFromDB): Omit<MessageRowFromDB, 'createdAtZ'> {
    return {
      id: row.id,
      content: row.content,
      role: row.role,
      type: row.type,
      createdAt: row.createdAtZ || row.createdAt,
      threadId: row.threadId,
      resourceId: row.resourceId,
    };
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });

      const thread = await this.#db.client.oneOrNone<StorageThreadType & { createdAtZ: Date; updatedAtZ: Date }>(
        `SELECT * FROM ${tableName} WHERE id = $1`,
        [threadId],
      );

      if (!thread) {
        return null;
      }

      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_THREAD_BY_ID', 'FAILED'),
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
        id: createStorageErrorId('PG', 'LIST_THREADS_BY_RESOURCE_ID', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Page number must be non-negative',
        details: {
          resourceId,
          page,
        },
      });
    }

    const { field, direction } = this.parseOrderBy(orderBy);
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
      const baseQuery = `FROM ${tableName} WHERE "resourceId" = $1`;
      const queryParams: any[] = [resourceId];

      const countQuery = `SELECT COUNT(*) ${baseQuery}`;
      const countResult = await this.#db.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataQuery = `SELECT id, "resourceId", title, metadata, "createdAt", "updatedAt" ${baseQuery} ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`;
      const rows = await this.#db.client.manyOrNone(dataQuery, [...queryParams, limitValue, offset]);

      const threads = (rows || []).map(thread => ({
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
          id: createStorageErrorId('PG', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED'),
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
      this.logger?.trackException(mastraError);
      return {
        threads: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "createdAtZ",
          "updatedAt",
          "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          "resourceId" = EXCLUDED."resourceId",
          title = EXCLUDED.title,
          metadata = EXCLUDED.metadata,
          "createdAt" = EXCLUDED."createdAt",
          "createdAtZ" = EXCLUDED."createdAtZ",
          "updatedAt" = EXCLUDED."updatedAt",
          "updatedAtZ" = EXCLUDED."updatedAtZ"`,
        [
          thread.id,
          thread.resourceId,
          thread.title,
          thread.metadata ? JSON.stringify(thread.metadata) : null,
          thread.createdAt,
          thread.createdAt,
          thread.updatedAt,
          thread.updatedAt,
        ],
      );

      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SAVE_THREAD', 'FAILED'),
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

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'UPDATE_THREAD', 'FAILED'),
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
      const thread = await this.#db.client.one<StorageThreadType & { createdAtZ: Date; updatedAtZ: Date }>(
        `UPDATE ${threadTableName}
                    SET
                        title = $1,
                        metadata = $2,
                        "updatedAt" = $3,
                        "updatedAtZ" = $3
                    WHERE id = $4
                    RETURNING *
                `,
        [title, mergedMetadata, new Date().toISOString(), id],
      );

      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_THREAD', 'FAILED'),
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
    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.tx(async t => {
        await t.none(`DELETE FROM ${tableName} WHERE thread_id = $1`, [threadId]);

        const schemaName = this.#schema || 'public';
        const vectorTables = await t.manyOrNone<{ tablename: string }>(
          `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = $1
          AND (tablename = 'memory_messages' OR tablename LIKE 'memory_messages_%')
        `,
          [schemaName],
        );

        for (const { tablename } of vectorTables) {
          const vectorTableName = getTableName({ indexName: tablename, schemaName: getSchemaName(this.#schema) });
          await t.none(`DELETE FROM ${vectorTableName} WHERE metadata->>'thread_id' = $1`, [threadId]);
        }

        await t.none(`DELETE FROM ${threadTableName} WHERE id = $1`, [threadId]);
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_THREAD', 'FAILED'),
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
    const params: any[] = [];
    let paramIdx = 1;
    const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      unionQueries.push(
        `
            SELECT * FROM (
              WITH target_thread AS (
                SELECT thread_id FROM ${tableName} WHERE id = $${paramIdx}
              ),
              ordered_messages AS (
                SELECT
                  *,
                  ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
                FROM ${tableName}
                WHERE thread_id = (SELECT thread_id FROM target_thread)
              )
              SELECT
                m.id,
                m.content,
                m.role,
                m.type,
                m."createdAt",
                m."createdAtZ",
                m.thread_id AS "threadId",
                m."resourceId"
              FROM ordered_messages m
              WHERE m.id = $${paramIdx}
              OR EXISTS (
                SELECT 1 FROM ordered_messages target
                WHERE target.id = $${paramIdx}
                AND (
                  (m.row_num < target.row_num AND m.row_num >= target.row_num - $${paramIdx + 1})
                  OR
                  (m.row_num > target.row_num AND m.row_num <= target.row_num + $${paramIdx + 2})
                )
              )
            ) AS query_${paramIdx}
            `,
      );
      params.push(id, withPreviousMessages, withNextMessages);
      paramIdx += 3;
    }
    const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" ASC';
    const includedRows = await this.#db.client.manyOrNone(finalQuery, params);
    const seen = new Set<string>();
    const dedupedRows = includedRows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return dedupedRows;
  }

  private parseRow(row: MessageRowFromDB): MastraDBMessage {
    const normalized = this.normalizeMessageRow(row);
    let content = normalized.content;
    try {
      content = JSON.parse(normalized.content);
    } catch {
      // use content as is if it's not JSON
    }
    return {
      id: normalized.id,
      content,
      role: normalized.role as MastraDBMessage['role'],
      createdAt: new Date(normalized.createdAt as string),
      threadId: normalized.threadId,
      resourceId: normalized.resourceId,
      ...(normalized.type && normalized.type !== 'v2' ? { type: normalized.type } : {}),
    } satisfies MastraDBMessage;
  }

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;

    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      const query = `
        ${selectStatement} FROM ${tableName}
        WHERE id IN (${messageIds.map((_, i) => `$${i + 1}`).join(', ')})
        ORDER BY "createdAt" DESC
      `;
      const resultRows = await this.#db.client.manyOrNone(query, messageIds);

      const list = new MessageList().add(
        resultRows.map(row => this.parseRow(row)) as (MastraMessageV1 | MastraDBMessage)[],
        'memory',
      );
      return { messages: list.get.all.db() };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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
      return { messages: [] };
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    const threadIds = (Array.isArray(threadId) ? threadId : [threadId]).filter(
      (id): id is string => typeof id === 'string',
    );

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? String(threadId) : String(threadId) },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    if (page < 0) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'LIST_MESSAGES', 'INVALID_PAGE'),
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
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderByStatement = `ORDER BY "${field}" ${direction}`;

      const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });

      const threadPlaceholders = threadIds.map((_, i) => `$${i + 1}`).join(', ');
      const conditions: string[] = [`thread_id IN (${threadPlaceholders})`];
      const queryParams: any[] = [...threadIds];
      let paramIndex = threadIds.length + 1;

      if (resourceId) {
        conditions.push(`"resourceId" = $${paramIndex++}`);
        queryParams.push(resourceId);
      }

      if (filter?.dateRange?.start) {
        conditions.push(`"createdAt" >= $${paramIndex++}`);
        queryParams.push(filter.dateRange.start);
      }

      if (filter?.dateRange?.end) {
        conditions.push(`"createdAt" <= $${paramIndex++}`);
        queryParams.push(filter.dateRange.end);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
      const countResult = await this.#db.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);

      const limitValue = perPageInput === false ? total : perPage;
      const dataQuery = `${selectStatement} FROM ${tableName} ${whereClause} ${orderByStatement} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      const rows = await this.#db.client.manyOrNone(dataQuery, [...queryParams, limitValue, offset]);
      const messages: MessageRowFromDB[] = [...(rows || [])];

      if (total === 0 && messages.length === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        if (includeMessages) {
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      const messagesWithParsedContent = messages.map(row => this.parseRow(row));

      const list = new MessageList().add(messagesWithParsedContent, 'memory');
      let finalMessages = list.get.all.db();

      finalMessages = finalMessages.sort((a, b) => {
        const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        if (aValue == null && bValue == null) return a.id.localeCompare(b.id);
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue === bValue) {
          return a.id.localeCompare(b.id);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageIds = new Set(
        finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).map(m => m.id),
      );
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore = perPageInput !== false && !allThreadMessagesReturned && offset + perPage < total;

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
          id: createStorageErrorId('PG', 'LIST_MESSAGES', 'FAILED'),
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
      this.logger?.trackException(mastraError);
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
        id: createStorageErrorId('PG', 'SAVE_MESSAGES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`,
      });
    }

    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'SAVE_MESSAGES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ${threadId} not found`,
        details: {
          threadId,
        },
      });
    }

    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.tx(async t => {
        const messageInserts = messages.map(message => {
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
          return t.none(
            `INSERT INTO ${tableName} (id, thread_id, content, "createdAt", "createdAtZ", role, type, "resourceId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
              thread_id = EXCLUDED.thread_id,
              content = EXCLUDED.content,
              role = EXCLUDED.role,
              type = EXCLUDED.type,
              "resourceId" = EXCLUDED."resourceId"`,
            [
              message.id,
              message.threadId,
              typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
              message.createdAt || new Date().toISOString(),
              message.createdAt || new Date().toISOString(),
              message.role,
              message.type || 'v2',
              message.resourceId,
            ],
          );
        });

        const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
        const threadUpdate = t.none(
          `UPDATE ${threadTableName}
                        SET
                            "updatedAt" = $1,
                            "updatedAtZ" = $1
                        WHERE id = $2
                    `,
          [new Date().toISOString(), threadId],
        );

        await Promise.all([...messageInserts, threadUpdate]);
      });

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
          id: createStorageErrorId('PG', 'SAVE_MESSAGES', 'FAILED'),
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
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);

    const selectQuery = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId" FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) })} WHERE id IN ($1:list)`;

    const existingMessagesDb = await this.#db.client.manyOrNone(selectQuery, [messageIds]);

    if (existingMessagesDb.length === 0) {
      return [];
    }

    const existingMessages: MastraDBMessage[] = existingMessagesDb.map(msg => {
      if (typeof msg.content === 'string') {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {
          // ignore if not valid json
        }
      }
      return msg as MastraDBMessage;
    });

    const threadIdsToUpdate = new Set<string>();

    await this.#db.client.tx(async t => {
      const queries = [];
      const columnMapping: Record<string, string> = {
        threadId: 'thread_id',
      };

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
        const values: any[] = [];
        let paramIndex = 1;

        const updatableFields = { ...fieldsToUpdate };

        if (updatableFields.content) {
          const newContent = {
            ...existingMessage.content,
            ...updatableFields.content,
            ...(existingMessage.content?.metadata && updatableFields.content.metadata
              ? {
                  metadata: {
                    ...existingMessage.content.metadata,
                    ...updatableFields.content.metadata,
                  },
                }
              : {}),
          };
          setClauses.push(`content = $${paramIndex++}`);
          values.push(newContent);
          delete updatableFields.content;
        }

        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = columnMapping[key] || key;
            setClauses.push(`"${dbColumn}" = $${paramIndex++}`);
            values.push(updatableFields[key as keyof typeof updatableFields]);
          }
        }

        if (setClauses.length > 0) {
          values.push(id);
          const sql = `UPDATE ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) })} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
          queries.push(t.none(sql, values));
        }
      }

      if (threadIdsToUpdate.size > 0) {
        queries.push(
          t.none(
            `UPDATE ${getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) })} SET "updatedAt" = NOW(), "updatedAtZ" = NOW() WHERE id IN ($1:list)`,
            [Array.from(threadIdsToUpdate)],
          ),
        );
      }

      if (queries.length > 0) {
        await t.batch(queries);
      }
    });

    const updatedMessages = await this.#db.client.manyOrNone<MessageRowFromDB>(selectQuery, [messageIds]);

    return (updatedMessages || []).map((row: MessageRowFromDB) => {
      const message = this.normalizeMessageRow(row);
      if (typeof message.content === 'string') {
        try {
          return { ...message, content: JSON.parse(message.content) } as MastraDBMessage;
        } catch {
          /* ignore */
        }
      }
      return message as MastraDBMessage;
    });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    try {
      const messageTableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });

      await this.#db.client.tx(async t => {
        const placeholders = messageIds.map((_, idx) => `$${idx + 1}`).join(',');
        const messages = await t.manyOrNone(
          `SELECT DISTINCT thread_id FROM ${messageTableName} WHERE id IN (${placeholders})`,
          messageIds,
        );

        const threadIds = messages?.map(msg => msg.thread_id).filter(Boolean) || [];

        await t.none(`DELETE FROM ${messageTableName} WHERE id IN (${placeholders})`, messageIds);

        if (threadIds.length > 0) {
          const updatePromises = threadIds.map(threadId =>
            t.none(`UPDATE ${threadTableName} SET "updatedAt" = NOW(), "updatedAtZ" = NOW() WHERE id = $1`, [threadId]),
          );
          await Promise.all(updatePromises);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.#schema) });
    const result = await this.#db.client.oneOrNone<StorageResourceType & { createdAtZ: Date; updatedAtZ: Date }>(
      `SELECT * FROM ${tableName} WHERE id = $1`,
      [resourceId],
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      createdAt: result.createdAtZ || result.createdAt,
      updatedAt: result.updatedAtZ || result.updatedAt,
      workingMemory: result.workingMemory,
      metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
    };
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.#db.insert({
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

    const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.#schema) });

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (workingMemory !== undefined) {
      updates.push(`"workingMemory" = $${paramIndex}`);
      values.push(workingMemory);
      paramIndex++;
    }

    if (metadata) {
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updatedResource.metadata));
      paramIndex++;
    }

    updates.push(`"updatedAt" = $${paramIndex}`);
    values.push(updatedResource.updatedAt.toISOString());
    updates.push(`"updatedAtZ" = $${paramIndex++}`);
    values.push(updatedResource.updatedAt.toISOString());

    paramIndex++;

    values.push(resourceId);

    await this.#db.client.none(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

    return updatedResource;
  }
}
