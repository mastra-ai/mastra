import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import {
  ensureDate,
  MemoryStorage,
  resolveMessageLimit,
  serializeDate,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
} from '@mastra/core/storage';
import type { PaginationInfo, StorageGetMessagesArg, StorageResourceType } from '@mastra/core/storage';
import { createSqlBuilder } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';
import { deserializeValue, isArrayOfRecords } from '../utils';

export class MemoryStorageD1 extends MemoryStorage {
  private operations: StoreOperationsD1;
  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const resource = await this.operations.load<StorageResourceType>({
      tableName: TABLE_RESOURCES,
      keys: { id: resourceId },
    });

    if (!resource) return null;

    try {
      return {
        ...resource,
        createdAt: ensureDate(resource.createdAt) as Date,
        updatedAt: ensureDate(resource.updatedAt) as Date,
        metadata:
          typeof resource.metadata === 'string'
            ? (JSON.parse(resource.metadata || '{}') as Record<string, any>)
            : resource.metadata,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_RESOURCE_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error processing resource ${resourceId}: ${error instanceof Error ? error.message : String(error)}`,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return null;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    const fullTableName = this.operations.getTableName(TABLE_RESOURCES);

    // Prepare the record for SQL insertion
    const resourceToSave = {
      id: resource.id,
      workingMemory: resource.workingMemory,
      metadata: resource.metadata ? JSON.stringify(resource.metadata) : null,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };

    // Process record for SQL insertion
    const processedRecord = await this.operations.processRecord(resourceToSave);

    const columns = Object.keys(processedRecord);
    const values = Object.values(processedRecord);

    // Specify which columns to update on conflict (all except id)
    const updateMap: Record<string, string> = {
      workingMemory: 'excluded.workingMemory',
      metadata: 'excluded.metadata',
      createdAt: 'excluded.createdAt',
      updatedAt: 'excluded.updatedAt',
    };

    // Use the new insert method with ON CONFLICT
    const query = createSqlBuilder().insert(fullTableName, columns, values, ['id'], updateMap);

    const { sql, params } = query.build();

    try {
      await this.operations.executeQuery({ sql, params });
      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_SAVE_RESOURCE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to save resource to ${fullTableName}: ${error instanceof Error ? error.message : String(error)}`,
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

    const updatedAt = new Date();
    const updatedResource = {
      ...existingResource,
      workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
      metadata: {
        ...existingResource.metadata,
        ...metadata,
      },
      updatedAt,
    };

    const fullTableName = this.operations.getTableName(TABLE_RESOURCES);

    const columns = ['workingMemory', 'metadata', 'updatedAt'];
    const values = [updatedResource.workingMemory, JSON.stringify(updatedResource.metadata), updatedAt.toISOString()];

    const query = createSqlBuilder().update(fullTableName, columns, values).where('id = ?', resourceId);

    const { sql, params } = query.build();

    try {
      await this.operations.executeQuery({ sql, params });
      return updatedResource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_UPDATE_RESOURCE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to update resource ${resourceId}: ${error instanceof Error ? error.message : String(error)}`,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.operations.load<StorageThreadType>({
      tableName: TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!thread) return null;

    try {
      return {
        ...thread,
        createdAt: ensureDate(thread.createdAt) as Date,
        updatedAt: ensureDate(thread.updatedAt) as Date,
        metadata:
          typeof thread.metadata === 'string'
            ? (JSON.parse(thread.metadata || '{}') as Record<string, any>)
            : thread.metadata || {},
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_THREAD_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error processing thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`,
          details: { threadId },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return null;
    }
  }

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const fullTableName = this.operations.getTableName(TABLE_THREADS);

    try {
      const query = createSqlBuilder().select('*').from(fullTableName).where('resourceId = ?', resourceId);

      const { sql, params } = query.build();
      const results = await this.operations.executeQuery({ sql, params });

      return (isArrayOfRecords(results) ? results : []).map((thread: any) => ({
        ...thread,
        createdAt: ensureDate(thread.createdAt) as Date,
        updatedAt: ensureDate(thread.updatedAt) as Date,
        metadata:
          typeof thread.metadata === 'string'
            ? (JSON.parse(thread.metadata || '{}') as Record<string, any>)
            : thread.metadata || {},
      }));
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_THREADS_BY_RESOURCE_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error getting threads by resourceId ${resourceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
    }
  }

  public async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page, perPage } = args;
    const fullTableName = this.operations.getTableName(TABLE_THREADS);

    const mapRowToStorageThreadType = (row: Record<string, any>): StorageThreadType => ({
      ...(row as StorageThreadType),
      createdAt: ensureDate(row.createdAt) as Date,
      updatedAt: ensureDate(row.updatedAt) as Date,
      metadata:
        typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata || '{}') as Record<string, any>)
          : row.metadata || {},
    });

    try {
      const countQuery = createSqlBuilder().count().from(fullTableName).where('resourceId = ?', resourceId);
      const countResult = (await this.operations.executeQuery(countQuery.build())) as {
        count: number;
      }[];
      const total = Number(countResult?.[0]?.count ?? 0);

      const selectQuery = createSqlBuilder()
        .select('*')
        .from(fullTableName)
        .where('resourceId = ?', resourceId)
        .orderBy('createdAt', 'DESC')
        .limit(perPage)
        .offset(page * perPage);

      const results = (await this.operations.executeQuery(selectQuery.build())) as Record<string, any>[];
      const threads = results.map(mapRowToStorageThreadType);

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: page * perPage + threads.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error getting threads by resourceId ${resourceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        threads: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const fullTableName = this.operations.getTableName(TABLE_THREADS);

    // Prepare the record for SQL insertion
    const threadToSave = {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      metadata: thread.metadata ? JSON.stringify(thread.metadata) : null,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };

    // Process record for SQL insertion
    const processedRecord = await this.operations.processRecord(threadToSave);

    const columns = Object.keys(processedRecord);
    const values = Object.values(processedRecord);

    // Specify which columns to update on conflict (all except id)
    const updateMap: Record<string, string> = {
      resourceId: 'excluded.resourceId',
      title: 'excluded.title',
      metadata: 'excluded.metadata',
      createdAt: 'excluded.createdAt',
      updatedAt: 'excluded.updatedAt',
    };

    // Use the new insert method with ON CONFLICT
    const query = createSqlBuilder().insert(fullTableName, columns, values, ['id'], updateMap);

    const { sql, params } = query.build();

    try {
      await this.operations.executeQuery({ sql, params });
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_SAVE_THREAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to save thread to ${fullTableName}: ${error instanceof Error ? error.message : String(error)}`,
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
    try {
      if (!thread) {
        throw new Error(`Thread ${id} not found`);
      }
      const fullTableName = this.operations.getTableName(TABLE_THREADS);

      const mergedMetadata = {
        ...(typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata),
        ...(metadata as Record<string, any>),
      };

      const updatedAt = new Date();
      const columns = ['title', 'metadata', 'updatedAt'];
      const values = [title, JSON.stringify(mergedMetadata), updatedAt.toISOString()];

      const query = createSqlBuilder().update(fullTableName, columns, values).where('id = ?', id);

      const { sql, params } = query.build();

      await this.operations.executeQuery({ sql, params });

      return {
        ...thread,
        title,
        metadata: {
          ...(typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata),
          ...(metadata as Record<string, any>),
        },
        updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_UPDATE_THREAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to update thread ${id}: ${error instanceof Error ? error.message : String(error)}`,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const fullTableName = this.operations.getTableName(TABLE_THREADS);

    try {
      // Delete the thread
      const deleteThreadQuery = createSqlBuilder().delete(fullTableName).where('id = ?', threadId);

      const { sql: threadSql, params: threadParams } = deleteThreadQuery.build();
      await this.operations.executeQuery({ sql: threadSql, params: threadParams });

      // Also delete associated messages
      const messagesTableName = this.operations.getTableName(TABLE_MESSAGES);
      const deleteMessagesQuery = createSqlBuilder().delete(messagesTableName).where('thread_id = ?', threadId);

      const { sql: messagesSql, params: messagesParams } = deleteMessagesQuery.build();
      await this.operations.executeQuery({ sql: messagesSql, params: messagesParams });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_DELETE_THREAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to delete thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`,
          details: { threadId },
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
    if (messages.length === 0) return [];

    try {
      const now = new Date();
      const threadId = messages[0]?.threadId;

      // Validate all messages before insert
      for (const [i, message] of messages.entries()) {
        if (!message.id) throw new Error(`Message at index ${i} missing id`);
        if (!message.threadId) {
          throw new Error(`Message at index ${i} missing threadId`);
        }
        if (!message.content) {
          throw new Error(`Message at index ${i} missing content`);
        }
        if (!message.role) {
          throw new Error(`Message at index ${i} missing role`);
        }
        if (!message.resourceId) {
          throw new Error(`Message at index ${i} missing resourceId`);
        }
        const thread = await this.getThreadById({ threadId: message.threadId });
        if (!thread) {
          throw new Error(`Thread ${message.threadId} not found`);
        }
      }

      // Prepare all messages for insertion (set timestamps, thread_id, etc.)
      const messagesToInsert = messages.map(message => {
        const createdAt = message.createdAt ? new Date(message.createdAt) : now;
        return {
          id: message.id,
          thread_id: message.threadId,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          createdAt: createdAt.toISOString(),
          role: message.role,
          type: message.type || 'v2',
          resourceId: message.resourceId,
        };
      });

      // Insert messages and update thread's updatedAt in parallel
      await Promise.all([
        this.operations.batchUpsert({
          tableName: TABLE_MESSAGES,
          records: messagesToInsert,
        }),
        // Update thread's updatedAt timestamp
        this.operations.executeQuery({
          sql: `UPDATE ${this.operations.getTableName(TABLE_THREADS)} SET updatedAt = ? WHERE id = ?`,
          params: [now.toISOString(), threadId],
        }),
      ]);

      this.logger.debug(`Saved ${messages.length} messages`);
      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_SAVE_MESSAGES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to save messages: ${error instanceof Error ? error.message : String(error)}`,
        },
        error,
      );
    }
  }

  private async _getIncludedMessages(threadId: string, selectBy: StorageGetMessagesArg['selectBy']) {
    const include = selectBy?.include;
    if (!include) return null;

    const unionQueries: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // if threadId is provided, use it, otherwise use threadId from args
      const searchId = inc.threadId || threadId;

      unionQueries.push(`
                SELECT * FROM (
                  WITH ordered_messages AS (
                    SELECT
                      *,
                      ROW_NUMBER() OVER (ORDER BY createdAt ASC) AS row_num
                    FROM ${this.operations.getTableName(TABLE_MESSAGES)}
                    WHERE thread_id = ?
                  )
                  SELECT
                    m.id,
                    m.content,
                    m.role,
                    m.type,
                    m.createdAt,
                    m.thread_id AS threadId,
                    m.resourceId
                  FROM ordered_messages m
                  WHERE m.id = ?
                  OR EXISTS (
                    SELECT 1 FROM ordered_messages target
                    WHERE target.id = ?
                    AND (
                      (m.row_num <= target.row_num + ? AND m.row_num > target.row_num)
                      OR
                      (m.row_num >= target.row_num - ? AND m.row_num < target.row_num)
                    )
                  )
                ) AS query_${paramIdx}
            `);

      params.push(searchId, id, id, withNextMessages, withPreviousMessages);
      paramIdx++;
    }

    const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY createdAt ASC';
    const messages = await this.operations.executeQuery({ sql: finalQuery, params });

    if (!Array.isArray(messages)) {
      return [];
    }

    // Parse message content
    const processedMessages = messages.map((message: Record<string, any>) => {
      const processedMsg: Record<string, any> = {};

      for (const [key, value] of Object.entries(message)) {
        if (key === `type` && value === `v2`) continue;
        processedMsg[key] = deserializeValue(value);
      }

      return processedMsg;
    });

    return processedMessages;
  }

  /**
   * @deprecated use getMessagesPaginated instead
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const fullTableName = this.operations.getTableName(TABLE_MESSAGES);
    const limit = resolveMessageLimit({
      last: selectBy?.last,
      defaultLimit: 40,
    });
    const include = selectBy?.include || [];
    const messages: any[] = [];

    try {
      if (include.length) {
        const includeResult = await this._getIncludedMessages(threadId, selectBy);
        if (Array.isArray(includeResult)) messages.push(...includeResult);
      }

      // Exclude already fetched ids
      const excludeIds = messages.map(m => m.id);
      const query = createSqlBuilder()
        .select(['id', 'content', 'role', 'type', 'createdAt', 'thread_id AS threadId'])
        .from(fullTableName)
        .where('thread_id = ?', threadId);

      if (excludeIds.length > 0) {
        query.andWhere(`id NOT IN (${excludeIds.map(() => '?').join(',')})`, ...excludeIds);
      }

      query.orderBy('createdAt', 'DESC').limit(limit);

      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params });

      if (Array.isArray(result)) messages.push(...result);

      // Sort by creation time to ensure proper order
      messages.sort((a, b) => {
        const aRecord = a as Record<string, any>;
        const bRecord = b as Record<string, any>;
        const timeA = new Date(aRecord.createdAt as string).getTime();
        const timeB = new Date(bRecord.createdAt as string).getTime();
        return timeA - timeB;
      });

      // Parse message content
      const processedMessages = messages.map(message => {
        const processedMsg: Record<string, any> = {};

        for (const [key, value] of Object.entries(message)) {
          if (key === `type` && value === `v2`) continue;
          processedMsg[key] = deserializeValue(value);
        }

        return processedMsg;
      });
      this.logger.debug(`Retrieved ${messages.length} messages for thread ${threadId}`);
      const list = new MessageList().add(processedMessages as MastraMessageV1[] | MastraMessageV2[], 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_MESSAGES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve messages for thread ${threadId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { threadId },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
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
    const fullTableName = this.operations.getTableName(TABLE_MESSAGES);
    const messages: any[] = [];

    try {
      const query = createSqlBuilder()
        .select(['id', 'content', 'role', 'type', 'createdAt', 'thread_id AS threadId', 'resourceId'])
        .from(fullTableName)
        .where(`id in (${messageIds.map(() => '?').join(',')})`, ...messageIds);

      query.orderBy('createdAt', 'DESC');

      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params });

      if (Array.isArray(result)) messages.push(...result);

      // Parse message content
      const processedMessages = messages.map(message => {
        const processedMsg: Record<string, any> = {};

        for (const [key, value] of Object.entries(message)) {
          if (key === `type` && value === `v2`) continue;
          processedMsg[key] = deserializeValue(value);
        }

        return processedMsg;
      });
      this.logger.debug(`Retrieved ${messages.length} messages`);
      const list = new MessageList().add(processedMessages as MastraMessageV1[] | MastraMessageV2[], 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_MESSAGES_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve messages by ID: ${error instanceof Error ? error.message : String(error)}`,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  public async getMessagesPaginated({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<
    PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }
  > {
    const { dateRange, page = 0, perPage: perPageInput } = selectBy?.pagination || {};
    const { start: fromDate, end: toDate } = dateRange || {};
    const perPage =
      perPageInput !== undefined ? perPageInput : resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });

    const fullTableName = this.operations.getTableName(TABLE_MESSAGES);
    const messages: any[] = [];

    try {
      if (selectBy?.include?.length) {
        const includeResult = await this._getIncludedMessages(threadId, selectBy);
        if (Array.isArray(includeResult)) messages.push(...includeResult);
      }

      const countQuery = createSqlBuilder().count().from(fullTableName).where('thread_id = ?', threadId);

      if (fromDate) {
        countQuery.andWhere('createdAt >= ?', serializeDate(fromDate));
      }
      if (toDate) {
        countQuery.andWhere('createdAt <= ?', serializeDate(toDate));
      }

      const countResult = (await this.operations.executeQuery(countQuery.build())) as {
        count: number;
      }[];
      const total = Number(countResult[0]?.count ?? 0);

      if (total === 0 && messages.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Exclude already included messages
      const excludeIds = messages.map(m => m.id);
      const excludeCondition = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';

      let query: any;
      let queryParams: any[] = [threadId];

      if (fromDate) {
        queryParams.push(serializeDate(fromDate));
      }
      if (toDate) {
        queryParams.push(serializeDate(toDate));
      }

      if (excludeIds.length > 0) {
        queryParams.push(...excludeIds);
      }

      if (selectBy?.last && selectBy.last > 0) {
        // Handle selectBy.last: get last N messages
        query = `
                    SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId
                    FROM ${fullTableName}
                    WHERE thread_id = ?
                    ${fromDate ? 'AND createdAt >= ?' : ''}
                    ${toDate ? 'AND createdAt <= ?' : ''}
                    ${excludeCondition}
                    ORDER BY createdAt DESC
                    LIMIT ?
                `;
        queryParams.push(selectBy.last);
      } else {
        // Regular pagination
        query = `
                    SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId
                    FROM ${fullTableName}
                    WHERE thread_id = ?
                    ${fromDate ? 'AND createdAt >= ?' : ''}
                    ${toDate ? 'AND createdAt <= ?' : ''}
                    ${excludeCondition}
                    ORDER BY createdAt DESC
                    LIMIT ? OFFSET ?
                `;
        queryParams.push(perPage, page * perPage);
      }

      const results = (await this.operations.executeQuery({ sql: query, params: queryParams })) as any[];

      // Parse message content
      const processedMessages = results.map(message => {
        const processedMsg: Record<string, any> = {};

        for (const [key, value] of Object.entries(message)) {
          if (key === `type` && value === `v2`) continue;
          processedMsg[key] = deserializeValue(value);
        }

        return processedMsg;
      });

      // For last N functionality, sort messages chronologically
      if (selectBy?.last) {
        processedMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      const list = new MessageList().add(processedMessages as MastraMessageV1[] | MastraMessageV2[], 'memory');
      messages.push(...(format === `v2` ? list.get.all.v2() : list.get.all.v1()));

      return {
        messages,
        total,
        page,
        perPage,
        hasMore: selectBy?.last ? false : page * perPage + messages.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_MESSAGES_PAGINATED_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve messages for thread ${threadId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { threadId },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        messages: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }
  }

  async updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: {
          metadata?: MastraMessageContentV2['metadata'];
          content?: MastraMessageContentV2['content'];
        };
      }[];
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;
    this.logger.debug('Updating messages', { count: messages.length });

    if (!messages.length) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const fullTableName = this.operations.getTableName(TABLE_MESSAGES);
    const threadsTableName = this.operations.getTableName(TABLE_THREADS);

    try {
      // Get existing messages
      const placeholders = messageIds.map(() => '?').join(',');
      const selectQuery = `SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId FROM ${fullTableName} WHERE id IN (${placeholders})`;
      const existingMessages = (await this.operations.executeQuery({ sql: selectQuery, params: messageIds })) as any[];

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
      const updateQueries: { sql: string; params: any[] }[] = [];

      for (const existingMessage of parsedExistingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) continue;

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

        threadIdsToUpdate.add(existingMessage.threadId!);
        if (
          'threadId' in updatePayload &&
          updatePayload.threadId &&
          updatePayload.threadId !== existingMessage.threadId
        ) {
          threadIdsToUpdate.add(updatePayload.threadId as string);
        }

        const setClauses: string[] = [];
        const values: any[] = [];

        const updatableFields = { ...fieldsToUpdate };

        // Special handling for content: merge in code, then update the whole field
        if (updatableFields.content) {
          const existingContent = existingMessage.content || {};
          const newContent = {
            ...existingContent,
            ...updatableFields.content,
            // Deep merge metadata if it exists on both
            ...(existingContent?.metadata && updatableFields.content.metadata
              ? {
                  metadata: {
                    ...existingContent.metadata,
                    ...updatableFields.content.metadata,
                  },
                }
              : {}),
          };
          setClauses.push(`content = ?`);
          values.push(JSON.stringify(newContent));
          delete updatableFields.content;
        }

        // Handle other fields
        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = key === 'threadId' ? 'thread_id' : key;
            setClauses.push(`${dbColumn} = ?`);
            values.push(updatableFields[key as keyof typeof updatableFields]);
          }
        }

        if (setClauses.length > 0) {
          values.push(id);
          const updateQuery = `UPDATE ${fullTableName} SET ${setClauses.join(', ')} WHERE id = ?`;
          updateQueries.push({ sql: updateQuery, params: values });
        }
      }

      // Execute all updates
      for (const query of updateQueries) {
        await this.operations.executeQuery(query);
      }

      // Update thread timestamps
      if (threadIdsToUpdate.size > 0) {
        const threadPlaceholders = Array.from(threadIdsToUpdate)
          .map(() => '?')
          .join(',');
        const threadUpdateQuery = `UPDATE ${threadsTableName} SET updatedAt = ? WHERE id IN (${threadPlaceholders})`;
        const threadUpdateParams = [new Date().toISOString(), ...Array.from(threadIdsToUpdate)];
        await this.operations.executeQuery({ sql: threadUpdateQuery, params: threadUpdateParams });
      }

      // Re-fetch updated messages
      const updatedMessages = (await this.operations.executeQuery({ sql: selectQuery, params: messageIds })) as any[];

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
          id: 'CLOUDFLARE_D1_STORAGE_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
        },
        error,
      );
    }
  }
}
