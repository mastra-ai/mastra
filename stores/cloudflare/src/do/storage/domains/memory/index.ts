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
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from '@mastra/core/storage';

import { DODB } from '../../db';
import type { DODomainConfig } from '../../db';
import { createSqlBuilder } from '../../sql-builder';
import { deserializeValue, isArrayOfRecords } from '../utils';

export class MemoryStorageDO extends MemoryStorage {
  #db: DODB;

  constructor(config: DODomainConfig) {
    super();
    this.#db = new DODB(config);
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
            ? (JSON.parse(resource.metadata || '{}') as Record<string, unknown>)
            : resource.metadata,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'GET_RESOURCE_BY_ID', 'FAILED'),
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
    const query = createSqlBuilder().insert(
      fullTableName,
      columns,
      values as (string | number | boolean | null | undefined)[],
      ['id'],
      updateMap,
    );

    const { sql, params } = query.build();

    try {
      await this.#db.executeQuery({ sql, params });
      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'SAVE_RESOURCE', 'FAILED'),
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
          id: createStorageErrorId('CLOUDFLARE_DO', 'UPDATE_RESOURCE', 'FAILED'),
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
            ? (JSON.parse(thread.metadata || '{}') as Record<string, unknown>)
            : thread.metadata || {},
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'GET_THREAD_BY_ID', 'FAILED'),
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

  public async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;

    try {
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_THREADS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page, ...(perPageInput !== undefined && { perPage: perPageInput }) },
        },
        error instanceof Error ? error : new Error('Invalid pagination parameters'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);

    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
        },
        error instanceof Error ? error : new Error('Invalid metadata key'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);
    const fullTableName = this.#db.getTableName(TABLE_THREADS);

    const mapRowToStorageThreadType = (row: any): StorageThreadType => ({
      ...row,
      createdAt: ensureDate(row.createdAt) as Date,
      updatedAt: ensureDate(row.updatedAt) as Date,
      metadata:
        typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata || '{}') as Record<string, unknown>)
          : row.metadata || {},
    });

    try {
      let countQuery = createSqlBuilder().count().from(fullTableName);
      let selectQuery = createSqlBuilder().select('*').from(fullTableName);

      if (filter?.resourceId) {
        countQuery = countQuery.whereAnd('resourceId = ?', filter.resourceId);
        selectQuery = selectQuery.whereAnd('resourceId = ?', filter.resourceId);
      }

      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (value !== null && typeof value === 'object') {
            throw new MastraError(
              {
                id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_THREADS', 'INVALID_METADATA_VALUE'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                text: `Metadata filter value for key "${key}" must be a scalar type (string, number, boolean, or null), got ${Array.isArray(value) ? 'array' : 'object'}`,
                details: { key, valueType: Array.isArray(value) ? 'array' : 'object' },
              },
              new Error('Invalid metadata filter value type'),
            );
          }

          if (value === null) {
            const condition = `json_extract(metadata, '$.${key}') IS NULL`;
            countQuery = countQuery.whereAnd(condition);
            selectQuery = selectQuery.whereAnd(condition);
          } else {
            const condition = `json_extract(metadata, '$.${key}') = ?`;
            const filterValue = value as string | number | boolean;
            countQuery = countQuery.whereAnd(condition, filterValue);
            selectQuery = selectQuery.whereAnd(condition, filterValue);
          }
        }
      }

      const countResult = (await this.#db.executeQuery(countQuery.build())) as {
        count: number;
      }[];
      const total = Number(countResult?.[0]?.count ?? 0);

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
      selectQuery = selectQuery.orderBy(field, direction).limit(limitValue).offset(offset);

      const results = (await this.#db.executeQuery(selectQuery.build())) as Record<string, unknown>[];
      const threads = results.map(mapRowToStorageThreadType);

      return {
        threads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError && error.category === ErrorCategory.USER) {
        throw error;
      }
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error listing threads: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!filter?.metadata,
          },
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
    const query = createSqlBuilder().insert(
      fullTableName,
      columns,
      values as (string | number | boolean | null | undefined)[],
      ['id'],
      updateMap,
    );

    const { sql, params } = query.build();

    try {
      await this.#db.executeQuery({ sql, params });
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'SAVE_THREAD', 'FAILED'),
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
        ...thread.metadata,
        ...metadata,
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
        metadata: mergedMetadata,
        updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'UPDATE_THREAD', 'FAILED'),
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
      // Delete associated messages first to avoid orphaned data
      const messagesTableName = this.#db.getTableName(TABLE_MESSAGES);
      const deleteMessagesQuery = createSqlBuilder().delete(messagesTableName).where('thread_id = ?', threadId);

      const { sql: messagesSql, params: messagesParams } = deleteMessagesQuery.build();
      await this.#db.executeQuery({ sql: messagesSql, params: messagesParams });

      // Then delete the thread
      const deleteThreadQuery = createSqlBuilder().delete(fullTableName).where('id = ?', threadId);

      const { sql: threadSql, params: threadParams } = deleteThreadQuery.build();
      await this.#db.executeQuery({ sql: threadSql, params: threadParams });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'DELETE_THREAD', 'FAILED'),
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
      }

      // Batch validate thread existence to avoid N+1 queries
      const uniqueThreadIds = [...new Set(messages.map(m => m.threadId!))];
      const threads = await Promise.all(uniqueThreadIds.map(id => this.getThreadById({ threadId: id })));
      const missingThreadId = uniqueThreadIds.find((id, i) => !threads[i]);
      if (missingThreadId) {
        throw new Error(`Thread ${missingThreadId} not found`);
      }

      // Prepare all messages for insertion (set timestamps, thread_id, etc.)
      const messagesToInsert = messages.map(message => {
        const createdAt = message.createdAt ? new Date(message.createdAt) : now;
        return {
          id: message.id,
          thread_id: message.threadId!,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          createdAt: createdAt.toISOString(),
          role: message.role,
          type: message.type || 'v2',
          resourceId: message.resourceId,
        };
      });

      // Insert messages and update all affected threads' updatedAt in parallel
      await Promise.all([
        this.#db.batchUpsert({
          tableName: TABLE_MESSAGES,
          records: messagesToInsert,
        }),
        // Update updatedAt timestamp for all affected threads
        ...uniqueThreadIds.map(tid =>
          this.#db.executeQuery({
            sql: `UPDATE ${this.#db.getTableName(TABLE_THREADS)} SET updatedAt = ? WHERE id = ?`,
            params: [now.toISOString(), tid],
          }),
        ),
      ]);

      this.logger.debug(`Saved ${messages.length} messages`);
      const list = new MessageList().add(messages, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'SAVE_MESSAGES', 'FAILED'),
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
    const params: unknown[] = [];
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
    const messages = await this.#db.executeQuery({
      sql: finalQuery,
      params: params as (string | number | boolean | null | undefined)[],
    });

    if (!Array.isArray(messages)) {
      return [];
    }

    // Parse message content
    const processedMessages = messages.map((message: Record<string, unknown>) => {
      const processedMsg: Record<string, unknown> = {};

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
    const messages: unknown[] = [];

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
        const processedMsg: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(message as Record<string, unknown>)) {
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
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_MESSAGES_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve messages by ID: ${error instanceof Error ? error.message : String(error)}`,
          details: { messageIds: JSON.stringify(messageIds) },
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

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
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
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_MESSAGES', 'INVALID_PAGE'),
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

      // Step 1: Get paginated messages from the thread(s) first (without excluding included ones)
      const placeholders = threadIds.map(() => '?').join(', ');
      let query = `
        SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId
        FROM ${fullTableName}
        WHERE thread_id IN (${placeholders})
      `;
      const queryParams: unknown[] = [...threadIds];

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

      const results = await this.#db.executeQuery({
        sql: query,
        params: queryParams as (string | number | boolean | null | undefined)[],
      });

      // Parse message content
      const paginatedMessages = (isArrayOfRecords(results) ? results : []).map((message: Record<string, unknown>) => {
        const processedMsg: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(message)) {
          if (key === `type` && value === `v2`) continue;
          processedMsg[key] = deserializeValue(value);
        }
        return processedMsg;
      });

      const paginatedCount = paginatedMessages.length;

      // Get total count
      let countQuery = `SELECT count() as count FROM ${fullTableName} WHERE thread_id = ?`;
      const countParams: unknown[] = [threadId];

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

      const countResult = (await this.#db.executeQuery({
        sql: countQuery,
        params: countParams as (string | number | boolean | null | undefined)[],
      })) as {
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
      const messageIds = new Set(paginatedMessages.map((m: Record<string, unknown>) => m.id as string));
      let includeMessages: MastraDBMessage[] = [];

      if (include && include.length > 0) {
        // Use the existing _getIncludedMessages helper, but adapt it for listMessages format
        const includeResult = (await this._getIncludedMessages(include)) as MastraDBMessage[];
        if (Array.isArray(includeResult)) {
          includeMessages = includeResult;

          // Deduplicate: only add messages that aren't already in the paginated results
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              paginatedMessages.push(includeMsg as unknown as Record<string, unknown>);
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
        const aValue = isDateField
          ? new Date((a as Record<string, unknown>)[field] as string | Date).getTime()
          : (a as Record<string, unknown>)[field];
        const bValue = isDateField
          ? new Date((b as Record<string, unknown>)[field] as string | Date).getTime()
          : (b as Record<string, unknown>)[field];

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
    } catch (error: unknown) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'LIST_MESSAGES', 'FAILED'),
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
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
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
        let parsedContent = msg.content;
        if (typeof msg.content === 'string') {
          try {
            parsedContent = JSON.parse(msg.content);
          } catch {
            // Keep as string if parsing fails
          }
        }
        return { ...msg, content: parsedContent };
      });

      // Create a map of existing messages by ID for quick lookup
      const existingMessagesMap = new Map(parsedExistingMessages.map(msg => [msg.id, msg]));

      // Merge updates with existing messages
      const updatedMessages: any[] = [];
      const now = new Date().toISOString();

      for (const update of messages) {
        const existing = existingMessagesMap.get(update.id);
        if (!existing) continue;

        // Deep merge the content
        let mergedContent = existing.content;
        if (update.content) {
          if (typeof mergedContent === 'object' && mergedContent !== null) {
            mergedContent = {
              ...mergedContent,
              ...update.content,
              metadata: {
                ...mergedContent.metadata,
                ...update.content.metadata,
              },
            };
          } else {
            mergedContent = update.content;
          }
        }

        updatedMessages.push({
          ...existing,
          ...update,
          content: mergedContent,
        });
      }

      // Update each message
      for (const msg of updatedMessages) {
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const updateQuery = createSqlBuilder()
          .update(fullTableName, ['content', 'role', 'type'], [contentStr, msg.role as string, msg.type as string])
          .where('id = ?', msg.id);

        const { sql, params } = updateQuery.build();
        await this.#db.executeQuery({ sql, params });
      }

      // Update thread's updatedAt timestamp
      const threadIds = [...new Set(updatedMessages.map(m => m.threadId))];
      for (const tid of threadIds) {
        await this.#db.executeQuery({
          sql: `UPDATE ${threadsTableName} SET updatedAt = ? WHERE id = ?`,
          params: [now, tid],
        });
      }

      // Return updated messages in the expected format
      const list = new MessageList().add(updatedMessages, 'memory');
      return list.get.all.db();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'UPDATE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to update messages: ${error instanceof Error ? error.message : String(error)}`,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const fullTableName = this.#db.getTableName(TABLE_MESSAGES);

    try {
      const placeholders = messageIds.map(() => '?').join(',');
      const sql = `DELETE FROM ${fullTableName} WHERE id IN (${placeholders})`;
      await this.#db.executeQuery({ sql, params: messageIds });
      this.logger.debug(`Deleted ${messageIds.length} messages`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to delete messages: ${error instanceof Error ? error.message : String(error)}`,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }
}
