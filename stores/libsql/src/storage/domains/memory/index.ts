import type { Client, InValue } from '@libsql/client';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type {
  PaginationInfo,
  StorageResourceType,
  ThreadSortOptions,
  StorageListMessagesInput,
  StorageListMessagesOutput,
} from '@mastra/core/storage';
import { MemoryStorage, TABLE_MESSAGES, TABLE_RESOURCES, TABLE_THREADS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { StoreOperationsLibSQL } from '../operations';

export class MemoryLibSQL extends MemoryStorage {
  private client: Client;
  private operations: StoreOperationsLibSQL;
  constructor({ client, operations }: { client: Client; operations: StoreOperationsLibSQL }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  private parseRow(row: any): MastraMessageV2 {
    let content = row.content;
    try {
      content = JSON.parse(row.content);
    } catch {
      // use content as is if it's not JSON
    }
    const result = {
      id: row.id,
      content,
      role: row.role,
      createdAt: new Date(row.createdAt as string),
      threadId: row.thread_id,
      resourceId: row.resourceId,
    } as MastraMessageV2;
    if (row.type) result.type = row.type;
    return result;
  }

  private async _getIncludedMessages({
    threadId,
    include,
  }: {
    threadId: string;
    include: StorageListMessagesInput['include'];
  }) {
    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

    if (!include) return null;

    const unionQueries: string[] = [];
    const params: any[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // if threadId is provided, use it, otherwise use threadId from args
      const searchId = inc.threadId || threadId;
      unionQueries.push(
        `
                SELECT * FROM (
                  WITH numbered_messages AS (
                    SELECT
                      id, content, role, type, "createdAt", thread_id, "resourceId",
                      ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
                    FROM "${TABLE_MESSAGES}"
                    WHERE thread_id = ?
                  ),
                  target_positions AS (
                    SELECT row_num as target_pos
                    FROM numbered_messages
                    WHERE id = ?
                  )
                  SELECT DISTINCT m.*
                  FROM numbered_messages m
                  CROSS JOIN target_positions t
                  WHERE m.row_num BETWEEN (t.target_pos - ?) AND (t.target_pos + ?)
                ) 
                `, // Keep ASC for final sorting after fetching context
      );
      params.push(searchId, id, withPreviousMessages, withNextMessages);
    }
    const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" ASC';
    const includedResult = await this.client.execute({ sql: finalQuery, args: params });
    const includedRows = includedResult.rows?.map(row => this.parseRow(row));
    const seen = new Set<string>();
    const dedupedRows = includedRows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return dedupedRows;
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
      const sql = `
        SELECT 
          id, 
          content, 
          role, 
          type,
          "createdAt", 
          thread_id,
          "resourceId"
        FROM "${TABLE_MESSAGES}"
        WHERE id IN (${messageIds.map(() => '?').join(', ')})
        ORDER BY "createdAt" DESC
      `;
      const result = await this.client.execute({ sql, args: messageIds });
      if (!result.rows) return [];

      const list = new MessageList().add(result.rows.map(this.parseRow), 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const threadId = args.threadId;
    if (!threadId.trim()) {
      const mastraError = new MastraError({
        id: 'LIBSQL_STORE_LIST_MESSAGES_THREAD_ID_REQUIRED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'threadId must be a non-empty string',
        details: { threadId },
      });
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      throw mastraError;
    }

    const include = args.include;
    const offset = args.offset || 0;
    // Handle limit: false means get ALL messages, undefined means default to 40
    let limit = 40;
    if (args.limit !== undefined) {
      if (args.limit === false) {
        limit = Number.MAX_SAFE_INTEGER; // Get all messages
      } else if (typeof args.limit === 'number' && args.limit > 0) {
        limit = args.limit;
      }
    }
    // offset is the number of items to skip, not a page number
    const currentOffset = offset;
    const filter = args.filter;
    // Determine sort field and direction, default to DESC (newest first)
    const sortField = args.orderBy?.field || 'createdAt';
    const sortDirection = args.orderBy?.direction || 'DESC';

    const fromDate = filter?.dateRange?.start;
    const toDate = filter?.dateRange?.end;

    const messages: MastraMessageV2[] = [];
    const messageIds = new Set<string>();

    try {
      // Step 1: Get paginated messages from the thread first
      const conditions: string[] = [`thread_id = ?`];
      const queryParams: InValue[] = [threadId];

      if (args.resourceId) {
        conditions.push(`"resourceId" = ?`);
        queryParams.push(args.resourceId);
      }

      if (fromDate) {
        conditions.push(`"createdAt" >= ?`);
        queryParams.push(fromDate.toISOString());
      }

      if (toDate) {
        conditions.push(`"createdAt" <= ?`);
        queryParams.push(toDate.toISOString());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_MESSAGES} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          messages: [],
          total: 0,
          page: Math.floor(offset / limit),
          perPage: limit,
          hasMore: false,
        };
      }

      const dataResult = await this.client.execute({
        sql: `SELECT id, content, role, type, "createdAt", "resourceId", "thread_id" FROM ${TABLE_MESSAGES} ${whereClause} ORDER BY "${sortField}" ${sortDirection} LIMIT ? OFFSET ?`,
        args: [...queryParams, limit, currentOffset],
      });

      // Add paginated messages to the result
      for (const row of dataResult.rows || []) {
        const msg = this.parseRow(row);
        messages.push(msg);
        messageIds.add(msg.id);
      }

      // Step 2: Add included messages (if any), excluding duplicates
      if (include?.length) {
        try {
          const includeMessages = await this._getIncludedMessages({ threadId, include });
          if (includeMessages) {
            for (const msg of includeMessages) {
              if (!messageIds.has(msg.id)) {
                messages.push(msg);
                messageIds.add(msg.id);
              }
            }
          }
        } catch (error) {
          const mastraError = new MastraError(
            {
              id: 'LIBSQL_STORE_LIST_MESSAGES_INCLUDE_MESSAGES_FAILED',
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.THIRD_PARTY,
              details: { threadId },
            },
            error,
          );
          this.logger?.trackException?.(mastraError);
          this.logger?.error?.(mastraError.toString());
          throw mastraError;
        }
      }

      const messagesToReturn = new MessageList().add(messages, 'memory').get.all.v2();

      // Calculate page from offset and limit
      const page = Math.floor(offset / limit);

      // Calculate hasMore
      let hasMore;
      if (include && include.length > 0) {
        // When using include, check if we've returned all messages from the thread
        // because include might bring in messages beyond the pagination window
        const returnedThreadMessageIds = new Set(messagesToReturn.filter(m => m.threadId === threadId).map(m => m.id));
        hasMore = returnedThreadMessageIds.size < total;
      } else {
        // Standard pagination: check if there are more pages
        hasMore = offset + limit < total;
      }

      return {
        messages: messagesToReturn,
        total,
        page,
        perPage: limit,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      return { messages: [], total: 0, page: offset, perPage: limit, hasMore: false };
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

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      // Prepare batch statements for all messages
      const batchStatements = messages.map(message => {
        const time = message.createdAt || new Date();
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
        return {
          sql: `INSERT INTO "${TABLE_MESSAGES}" (id, thread_id, content, role, type, "createdAt", "resourceId") 
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    thread_id=excluded.thread_id,
                    content=excluded.content,
                    role=excluded.role,
                    type=excluded.type,
                    "resourceId"=excluded."resourceId"
                `,
          args: [
            message.id,
            message.threadId!,
            typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
            message.role,
            message.type || 'v2',
            time instanceof Date ? time.toISOString() : time,
            message.resourceId,
          ],
        };
      });

      const now = new Date().toISOString();
      batchStatements.push({
        sql: `UPDATE "${TABLE_THREADS}" SET "updatedAt" = ? WHERE id = ?`,
        args: [now, threadId],
      });

      // Execute in batches to avoid potential limitations
      const BATCH_SIZE = 50; // Safe batch size for libsql

      // Separate message statements from thread update
      const messageStatements = batchStatements.slice(0, -1);
      const threadUpdateStatement = batchStatements[batchStatements.length - 1];

      // Process message statements in batches
      for (let i = 0; i < messageStatements.length; i += BATCH_SIZE) {
        const batch = messageStatements.slice(i, i + BATCH_SIZE);
        if (batch.length > 0) {
          await this.client.batch(batch, 'write');
        }
      }

      // Execute thread update separately
      if (threadUpdateStatement) {
        await this.client.execute(threadUpdateStatement);
      }

      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraMessageV2[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const placeholders = messageIds.map(() => '?').join(',');

    const selectSql = `SELECT * FROM ${TABLE_MESSAGES} WHERE id IN (${placeholders})`;
    const existingResult = await this.client.execute({ sql: selectSql, args: messageIds });
    const existingMessages: MastraMessageV2[] = existingResult.rows.map(row => this.parseRow(row));

    if (existingMessages.length === 0) {
      return [];
    }

    const batchStatements = [];
    const threadIdsToUpdate = new Set<string>();
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

      const setClauses = [];
      const args: InValue[] = [];
      const updatableFields = { ...fieldsToUpdate };

      // Special handling for the 'content' field to merge instead of overwrite
      if (updatableFields.content) {
        const newContent = {
          ...existingMessage.content,
          ...updatableFields.content,
          // Deep merge metadata if it exists on both
          ...(existingMessage.content?.metadata && updatableFields.content.metadata
            ? {
                metadata: {
                  ...existingMessage.content.metadata,
                  ...updatableFields.content.metadata,
                },
              }
            : {}),
        };
        setClauses.push(`${parseSqlIdentifier('content', 'column name')} = ?`);
        args.push(JSON.stringify(newContent));
        delete updatableFields.content;
      }

      for (const key in updatableFields) {
        if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
          const dbKey = columnMapping[key] || key;
          setClauses.push(`${parseSqlIdentifier(dbKey, 'column name')} = ?`);
          let value = updatableFields[key as keyof typeof updatableFields];

          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          args.push(value as InValue);
        }
      }

      if (setClauses.length === 0) continue;

      args.push(id);

      const sql = `UPDATE ${TABLE_MESSAGES} SET ${setClauses.join(', ')} WHERE id = ?`;
      batchStatements.push({ sql, args });
    }

    if (batchStatements.length === 0) {
      return existingMessages;
    }

    const now = new Date().toISOString();
    for (const threadId of threadIdsToUpdate) {
      if (threadId) {
        batchStatements.push({
          sql: `UPDATE ${TABLE_THREADS} SET updatedAt = ? WHERE id = ?`,
          args: [now, threadId],
        });
      }
    }

    await this.client.batch(batchStatements, 'write');

    const updatedResult = await this.client.execute({ sql: selectSql, args: messageIds });
    return updatedResult.rows.map(row => this.parseRow(row));
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    try {
      // Process in batches to avoid SQL parameter limits
      const BATCH_SIZE = 100;
      const threadIds = new Set<string>();

      // Use a transaction to ensure consistency
      const tx = await this.client.transaction('write');

      try {
        for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
          const batch = messageIds.slice(i, i + BATCH_SIZE);
          const placeholders = batch.map(() => '?').join(',');

          // Get thread IDs for this batch
          const result = await tx.execute({
            sql: `SELECT DISTINCT thread_id FROM "${TABLE_MESSAGES}" WHERE id IN (${placeholders})`,
            args: batch,
          });

          result.rows?.forEach(row => {
            if (row.thread_id) threadIds.add(row.thread_id as string);
          });

          // Delete messages in this batch
          await tx.execute({
            sql: `DELETE FROM "${TABLE_MESSAGES}" WHERE id IN (${placeholders})`,
            args: batch,
          });
        }

        // Update thread timestamps within the transaction
        if (threadIds.size > 0) {
          const now = new Date().toISOString();
          for (const threadId of threadIds) {
            await tx.execute({
              sql: `UPDATE "${TABLE_THREADS}" SET "updatedAt" = ? WHERE id = ?`,
              args: [now, threadId],
            });
          }
        }

        // Commit the transaction
        await tx.commit();
      } catch (error) {
        // Rollback on error
        await tx.rollback();
        throw error;
      }

      // TODO: Delete from vector store if semantic recall is enabled
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_DELETE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const result = await this.operations.load<StorageResourceType>({
      tableName: TABLE_RESOURCES,
      keys: { id: resourceId },
    });

    if (!result) {
      return null;
    }

    return {
      ...result,
      // Ensure workingMemory is always returned as a string, even if auto-parsed as JSON
      workingMemory:
        result.workingMemory && typeof result.workingMemory === 'object'
          ? JSON.stringify(result.workingMemory)
          : result.workingMemory,
      metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
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

    const updates: string[] = [];
    const values: InValue[] = [];

    if (workingMemory !== undefined) {
      updates.push('workingMemory = ?');
      values.push(workingMemory);
    }

    if (metadata) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(updatedResource.metadata));
    }

    updates.push('updatedAt = ?');
    values.push(updatedResource.updatedAt.toISOString());

    values.push(resourceId);

    await this.client.execute({
      sql: `UPDATE ${TABLE_RESOURCES} SET ${updates.join(', ')} WHERE id = ?`,
      args: values,
    });

    return updatedResource;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const result = await this.operations.load<
        Omit<StorageThreadType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
      >({
        tableName: TABLE_THREADS,
        keys: { id: threadId },
      });

      if (!result) {
        return null;
      }

      return {
        ...result,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.updatedAt),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead for paginated results.
   */
  public async getThreadsByResourceId(args: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    const resourceId = args.resourceId;
    const orderBy = this.castThreadOrderBy(args.orderBy);
    const sortDirection = this.castThreadSortDirection(args.sortDirection);

    try {
      const baseQuery = `FROM ${TABLE_THREADS} WHERE resourceId = ?`;
      const queryParams: InValue[] = [resourceId];

      const mapRowToStorageThreadType = (row: any): StorageThreadType => ({
        id: row.id as string,
        resourceId: row.resourceId as string,
        title: row.title as string,
        createdAt: new Date(row.createdAt as string), // Convert string to Date
        updatedAt: new Date(row.updatedAt as string), // Convert string to Date
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      });

      // Non-paginated path
      const result = await this.client.execute({
        sql: `SELECT * ${baseQuery} ORDER BY ${orderBy} ${sortDirection}`,
        args: queryParams,
      });

      if (!result.rows) {
        return [];
      }
      return result.rows.map(mapRowToStorageThreadType);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      return [];
    }
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage = 100 } = args;
    const orderBy = this.castThreadOrderBy(args.orderBy);
    const sortDirection = this.castThreadSortDirection(args.sortDirection);

    try {
      const baseQuery = `FROM ${TABLE_THREADS} WHERE resourceId = ?`;
      const queryParams: InValue[] = [resourceId];

      const mapRowToStorageThreadType = (row: any): StorageThreadType => ({
        id: row.id as string,
        resourceId: row.resourceId as string,
        title: row.title as string,
        createdAt: new Date(row.createdAt as string), // Convert string to Date
        updatedAt: new Date(row.updatedAt as string), // Convert string to Date
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      });

      const currentOffset = page * perPage;

      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count ${baseQuery}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataResult = await this.client.execute({
        sql: `SELECT * ${baseQuery} ORDER BY ${orderBy} ${sortDirection} LIMIT ? OFFSET ?`,
        args: [...queryParams, perPage, currentOffset],
      });

      const threads = (dataResult.rows || []).map(mapRowToStorageThreadType);

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
          id: 'LIBSQL_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      return { threads: [], total: 0, page, perPage, hasMore: false };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.operations.insert({
        tableName: TABLE_THREADS,
        record: {
          ...thread,
          metadata: JSON.stringify(thread.metadata),
        },
      });

      return thread;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: thread.id },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      throw mastraError;
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
        id: 'LIBSQL_STORE_UPDATE_THREAD_FAILED_THREAD_NOT_FOUND',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          status: 404,
          threadId: id,
        },
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
      await this.client.execute({
        sql: `UPDATE ${TABLE_THREADS} SET title = ?, metadata = ? WHERE id = ?`,
        args: [title, JSON.stringify(updatedThread.metadata), id],
      });

      return updatedThread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to update thread ${id}`,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // Delete messages for this thread (manual step)
    try {
      await this.client.execute({
        sql: `DELETE FROM ${TABLE_MESSAGES} WHERE thread_id = ?`,
        args: [threadId],
      });
      await this.client.execute({
        sql: `DELETE FROM ${TABLE_THREADS} WHERE id = ?`,
        args: [threadId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
    // TODO: Need to check if CASCADE is enabled so that messages will be automatically deleted due to CASCADE constraint
  }
}
