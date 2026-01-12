import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  createStorageErrorId,
  ensureDate,
  MemoryStorage,
  serializeDate,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCHEMAS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import { D1DB, resolveD1Config } from '../../db';
import type { D1DomainConfig } from '../../db';
import { createSqlBuilder } from '../../sql-builder';
import { deserializeValue, isArrayOfRecords } from '../utils';

export class MemoryStorageD1 extends MemoryStorage {
  #db: D1DB;

  constructor(config: D1DomainConfig) {
    super();
    this.#db = new D1DB(resolveD1Config(config));
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.#db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.#db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });
    // Add resourceId column for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_MESSAGES });
    await this.#db.clearTable({ tableName: TABLE_THREADS });
    await this.#db.clearTable({ tableName: TABLE_RESOURCES });
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const resource = await this.#db.load<StorageResourceType>({
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
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_RESOURCE_BY_ID', 'FAILED'),
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
    const fullTableName = this.#db.getTableName(TABLE_RESOURCES);

    // Prepare the record for SQL insertion
    const resourceToSave = {
      id: resource.id,
      workingMemory: resource.workingMemory,
      metadata: resource.metadata ? JSON.stringify(resource.metadata) : null,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };

    // Process record for SQL insertion
    const processedRecord = await this.#db.processRecord(resourceToSave);

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
      await this.#db.executeQuery({ sql, params });
      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'SAVE_RESOURCE', 'FAILED'),
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

    const fullTableName = this.#db.getTableName(TABLE_RESOURCES);

    const columns = ['workingMemory', 'metadata', 'updatedAt'];
    const values = [updatedResource.workingMemory, JSON.stringify(updatedResource.metadata), updatedAt.toISOString()];

    const query = createSqlBuilder().update(fullTableName, columns, values).where('id = ?', resourceId);

    const { sql, params } = query.build();

    try {
      await this.#db.executeQuery({ sql, params });
      return updatedResource;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'UPDATE_RESOURCE', 'FAILED'),
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
    const thread = await this.#db.load<StorageThreadType>({
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
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_THREAD_BY_ID', 'FAILED'),
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

  public async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_THREADS_BY_RESOURCE_ID', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);
    const fullTableName = this.#db.getTableName(TABLE_THREADS);

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
      const countResult = (await this.#db.executeQuery(countQuery.build())) as {
        count: number;
      }[];
      const total = Number(countResult?.[0]?.count ?? 0);

      const limitValue = perPageInput === false ? total : perPage;
      const selectQuery = createSqlBuilder()
        .select('*')
        .from(fullTableName)
        .where('resourceId = ?', resourceId)
        .orderBy(field, direction)
        .limit(limitValue)
        .offset(offset);

      const results = (await this.#db.executeQuery(selectQuery.build())) as Record<string, any>[];
      const threads = results.map(mapRowToStorageThreadType);

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED'),
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
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const fullTableName = this.#db.getTableName(TABLE_THREADS);

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
    const processedRecord = await this.#db.processRecord(threadToSave);

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
      await this.#db.executeQuery({ sql, params });
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'SAVE_THREAD', 'FAILED'),
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
      const fullTableName = this.#db.getTableName(TABLE_THREADS);

      const mergedMetadata = {
        ...(typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata),
        ...(metadata as Record<string, any>),
      };

      const updatedAt = new Date();
      const columns = ['title', 'metadata', 'updatedAt'];
      const values = [title, JSON.stringify(mergedMetadata), updatedAt.toISOString()];

      const query = createSqlBuilder().update(fullTableName, columns, values).where('id = ?', id);

      const { sql, params } = query.build();

      await this.#db.executeQuery({ sql, params });

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'UPDATE_THREAD', 'FAILED'),
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
    const fullTableName = this.#db.getTableName(TABLE_THREADS);

    try {
      // Delete the thread
      const deleteThreadQuery = createSqlBuilder().delete(fullTableName).where('id = ?', threadId);

      const { sql: threadSql, params: threadParams } = deleteThreadQuery.build();
      await this.#db.executeQuery({ sql: threadSql, params: threadParams });

      // Also delete associated messages
      const messagesTableName = this.#db.getTableName(TABLE_MESSAGES);
      const deleteMessagesQuery = createSqlBuilder().delete(messagesTableName).where('thread_id = ?', threadId);

      const { sql: messagesSql, params: messagesParams } = deleteMessagesQuery.build();
      await this.#db.executeQuery({ sql: messagesSql, params: messagesParams });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to delete thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`,
          details: { threadId },
        },
        error,
      );
    }
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    if (messages.length === 0) return { messages: [] };

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
        this.#db.batchUpsert({
          tableName: TABLE_MESSAGES,
          records: messagesToInsert,
        }),
        // Update thread's updatedAt timestamp
        this.#db.executeQuery({
          sql: `UPDATE ${this.#db.getTableName(TABLE_THREADS)} SET updatedAt = ? WHERE id = ?`,
          params: [now.toISOString(), threadId],
        }),
      ]);

      this.logger.debug(`Saved ${messages.length} messages`);
      const list = new MessageList().add(messages, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to save messages: ${error instanceof Error ? error.message : String(error)}`,
        },
        error,
      );
    }
  }

  private async _getIncludedMessages(include: StorageListMessagesInput['include']) {
    if (!include || include.length === 0) return null;

    const unionQueries: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;
    const tableName = this.#db.getTableName(TABLE_MESSAGES);

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // Query by message ID directly - get the threadId from the message itself via subquery

      unionQueries.push(`
                SELECT * FROM (
                  WITH target_thread AS (
                    SELECT thread_id FROM ${tableName} WHERE id = ?
                  ),
                  ordered_messages AS (
                    SELECT
                      *,
                      ROW_NUMBER() OVER (ORDER BY createdAt ASC) AS row_num
                    FROM ${tableName}
                    WHERE thread_id = (SELECT thread_id FROM target_thread)
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

      params.push(id, id, id, withNextMessages, withPreviousMessages);
      paramIdx++;
    }

    const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY createdAt ASC';
    const messages = await this.#db.executeQuery({ sql: finalQuery, params });

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

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    const fullTableName = this.#db.getTableName(TABLE_MESSAGES);
    const messages: any[] = [];

    try {
      const query = createSqlBuilder()
        .select(['id', 'content', 'role', 'type', 'createdAt', 'thread_id AS threadId', 'resourceId'])
        .from(fullTableName)
        .where(`id in (${messageIds.map(() => '?').join(',')})`, ...messageIds);

      query.orderBy('createdAt', 'DESC');

      const { sql, params } = query.build();

      const result = await this.#db.executeQuery({ sql, params });

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
      const list = new MessageList().add(processedMessages as MastraMessageV1[] | MastraDBMessage[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_MESSAGES', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const fullTableName = this.#db.getTableName(TABLE_MESSAGES);

      // Step 1: Get paginated messages from the thread first (without excluding included ones)
      let query = `
        SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId
        FROM ${fullTableName}
        WHERE thread_id = ?
      `;
      const queryParams: any[] = [threadId];

      if (resourceId) {
        query += ` AND resourceId = ?`;
        queryParams.push(resourceId);
      }

      const dateRange = filter?.dateRange;
      if (dateRange?.start) {
        const startDate =
          dateRange.start instanceof Date ? serializeDate(dateRange.start) : serializeDate(new Date(dateRange.start));
        const startOp = dateRange.startExclusive ? '>' : '>=';
        query += ` AND createdAt ${startOp} ?`;
        queryParams.push(startDate);
      }

      if (dateRange?.end) {
        const endDate =
          dateRange.end instanceof Date ? serializeDate(dateRange.end) : serializeDate(new Date(dateRange.end));
        const endOp = dateRange.endExclusive ? '<' : '<=';
        query += ` AND createdAt ${endOp} ?`;
        queryParams.push(endDate);
      }

      // Build ORDER BY clause
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      query += ` ORDER BY "${field}" ${direction}`;

      // Apply pagination
      if (perPage !== Number.MAX_SAFE_INTEGER) {
        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(perPage, offset);
      }

      const results = await this.#db.executeQuery({ sql: query, params: queryParams });

      // Parse message content
      const paginatedMessages = (isArrayOfRecords(results) ? results : []).map((message: Record<string, any>) => {
        const processedMsg: Record<string, any> = {};
        for (const [key, value] of Object.entries(message)) {
          if (key === `type` && value === `v2`) continue;
          processedMsg[key] = deserializeValue(value);
        }
        return processedMsg;
      });

      const paginatedCount = paginatedMessages.length;

      // Get total count
      let countQuery = `SELECT count() as count FROM ${fullTableName} WHERE thread_id = ?`;
      const countParams: any[] = [threadId];

      if (resourceId) {
        countQuery += ` AND resourceId = ?`;
        countParams.push(resourceId);
      }

      if (dateRange?.start) {
        const startDate =
          dateRange.start instanceof Date ? serializeDate(dateRange.start) : serializeDate(new Date(dateRange.start));
        const startOp = dateRange.startExclusive ? '>' : '>=';
        countQuery += ` AND createdAt ${startOp} ?`;
        countParams.push(startDate);
      }

      if (dateRange?.end) {
        const endDate =
          dateRange.end instanceof Date ? serializeDate(dateRange.end) : serializeDate(new Date(dateRange.end));
        const endOp = dateRange.endExclusive ? '<' : '<=';
        countQuery += ` AND createdAt ${endOp} ?`;
        countParams.push(endDate);
      }

      const countResult = (await this.#db.executeQuery({ sql: countQuery, params: countParams })) as {
        count: number;
      }[];
      const total = Number(countResult[0]?.count ?? 0);

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
      const messageIds = new Set(paginatedMessages.map((m: Record<string, any>) => m.id as string));
      let includeMessages: MastraDBMessage[] = [];

      if (include && include.length > 0) {
        // Use the existing _getIncludedMessages helper, but adapt it for listMessages format
        const includeResult = (await this._getIncludedMessages(include)) as MastraDBMessage[];
        if (Array.isArray(includeResult)) {
          includeMessages = includeResult;

          // Deduplicate: only add messages that aren't already in the paginated results
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              paginatedMessages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(paginatedMessages as MastraMessageV1[] | MastraDBMessage[], 'memory');
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
        perPageInput === false ? false : allThreadMessagesReturned ? false : offset + paginatedCount < total;

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to list messages for thread ${Array.isArray(threadId) ? threadId.join(',') : threadId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
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

  async updateMessages(args: {
    messages: Partial<Omit<MastraDBMessage, 'createdAt'>> &
      {
        id: string;
        content?: {
          metadata?: MastraMessageContentV2['metadata'];
          content?: MastraMessageContentV2['content'];
        };
      }[];
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;
    this.logger.debug('Updating messages', { count: messages.length });

    if (!messages.length) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const fullTableName = this.#db.getTableName(TABLE_MESSAGES);
    const threadsTableName = this.#db.getTableName(TABLE_THREADS);

    try {
      // Get existing messages
      const placeholders = messageIds.map(() => '?').join(',');
      const selectQuery = `SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId FROM ${fullTableName} WHERE id IN (${placeholders})`;
      const existingMessages = (await this.#db.executeQuery({ sql: selectQuery, params: messageIds })) as any[];

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
        await this.#db.executeQuery(query);
      }

      // Update thread timestamps
      if (threadIdsToUpdate.size > 0) {
        const threadPlaceholders = Array.from(threadIdsToUpdate)
          .map(() => '?')
          .join(',');
        const threadUpdateQuery = `UPDATE ${threadsTableName} SET updatedAt = ? WHERE id IN (${threadPlaceholders})`;
        const threadUpdateParams = [new Date().toISOString(), ...Array.from(threadIdsToUpdate)];
        await this.#db.executeQuery({ sql: threadUpdateQuery, params: threadUpdateParams });
      }

      // Re-fetch updated messages
      const updatedMessages = (await this.#db.executeQuery({ sql: selectQuery, params: messageIds })) as any[];

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'UPDATE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
        },
        error,
      );
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const fullTableName = this.#db.getTableName(TABLE_MESSAGES);
    const threadsTableName = this.#db.getTableName(TABLE_THREADS);

    try {
      // Get unique thread IDs from messages before deleting
      const placeholders = messageIds.map(() => '?').join(',');
      const selectQuery = `SELECT DISTINCT thread_id FROM ${fullTableName} WHERE id IN (${placeholders})`;
      const threadResults = (await this.#db.executeQuery({ sql: selectQuery, params: messageIds })) as any[];
      const threadIds = threadResults.map((r: any) => r.thread_id).filter(Boolean);

      // Delete the messages
      const deleteQuery = createSqlBuilder()
        .delete(fullTableName)
        .where(`id IN (${placeholders})`, ...messageIds);
      const { sql, params } = deleteQuery.build();
      await this.#db.executeQuery({ sql, params });

      // Update thread timestamps for affected threads
      if (threadIds.length > 0) {
        const threadPlaceholders = threadIds.map(() => '?').join(',');
        const threadUpdateQuery = `UPDATE ${threadsTableName} SET updatedAt = ? WHERE id IN (${threadPlaceholders})`;
        const threadUpdateParams = [new Date().toISOString(), ...threadIds];
        await this.#db.executeQuery({ sql: threadUpdateQuery, params: threadUpdateParams });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }
}
