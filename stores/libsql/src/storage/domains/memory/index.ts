import { randomUUID } from 'node:crypto';
import type { Client, InValue } from '@libsql/client';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedReflectionInput,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
} from '@mastra/core/storage';
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

/**
 * Local constant for the observational memory table name.
 * Defined locally to avoid a static import that crashes on older @mastra/core
 * versions that don't export TABLE_OBSERVATIONAL_MEMORY.
 */
const OM_TABLE = 'mastra_observational_memory' as const;
import { parseSqlIdentifier } from '@mastra/core/utils';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class MemoryLibSQL extends MemoryStorage {
  readonly supportsObservationalMemory = true;

  #client: Client;
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.#db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.#db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });

    // Dynamically import OM schema to avoid crashing on older @mastra/core versions
    let omSchema: Record<string, any> | undefined;
    try {
      const { OBSERVATIONAL_MEMORY_TABLE_SCHEMA } = await import('@mastra/core/storage');
      omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];
    } catch {
      // Older @mastra/core without OM support
    }

    if (omSchema) {
      await this.#db.createTable({
        tableName: OM_TABLE as any,
        schema: omSchema,
      });
      // Add new OM columns for backwards compatibility with existing databases
      await this.#db.alterTable({
        tableName: OM_TABLE as any,
        schema: omSchema,
        ifNotExists: [
          'observedMessageIds',
          'observedTimezone',
          'bufferedObservations',
          'bufferedObservationTokens',
          'bufferedMessageIds',
          'bufferedReflection',
          'bufferedReflectionTokens',
          'bufferedReflectionInputTokens',
          'reflectedObservationLineCount',
          'bufferedObservationChunks',
          'isBufferingObservation',
          'isBufferingReflection',
          'lastBufferedAtTokens',
          'lastBufferedAtTime',
        ],
      });
    }
    // Add resourceId column for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });
    if (omSchema) {
      // Create index on lookupKey for efficient OM queries
      await this.#client.execute({
        sql: `CREATE INDEX IF NOT EXISTS idx_om_lookup_key ON "${OM_TABLE}" ("lookupKey")`,
        args: [],
      });
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_MESSAGES });
    await this.#db.deleteData({ tableName: TABLE_THREADS });
    await this.#db.deleteData({ tableName: TABLE_RESOURCES });
    if (OM_TABLE) {
      await this.#db.deleteData({ tableName: OM_TABLE as any });
    }
  }

  private parseRow(row: any): MastraDBMessage {
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
    } as MastraDBMessage;
    if (row.type && row.type !== `v2`) result.type = row.type;
    return result;
  }

  private async _getIncludedMessages({ include }: { include: StorageListMessagesInput['include'] }) {
    if (!include || include.length === 0) return null;

    const unionQueries: string[] = [];
    const params: any[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // Query by message ID directly - get the threadId from the message itself via subquery
      unionQueries.push(
        `
                SELECT * FROM (
                  WITH target_thread AS (
                    SELECT thread_id FROM "${TABLE_MESSAGES}" WHERE id = ?
                  ),
                  numbered_messages AS (
                    SELECT
                      id, content, role, type, "createdAt", thread_id, "resourceId",
                      ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
                    FROM "${TABLE_MESSAGES}"
                    WHERE thread_id = (SELECT thread_id FROM target_thread)
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
      params.push(id, id, withPreviousMessages, withNextMessages);
    }
    const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" ASC';
    const includedResult = await this.#client.execute({ sql: finalQuery, args: params });
    const includedRows = includedResult.rows?.map(row => this.parseRow(row));
    const seen = new Set<string>();
    const dedupedRows = includedRows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return dedupedRows;
  }

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

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
      const result = await this.#client.execute({ sql, args: messageIds });
      if (!result.rows) return { messages: [] };

      const list = new MessageList().add(result.rows.map(this.parseRow), 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
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
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES', 'INVALID_PAGE'),
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
      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderByStatement = `ORDER BY "${field}" ${direction}`;

      // Build WHERE conditions - use IN for multiple thread IDs
      const threadPlaceholders = threadIds.map(() => '?').join(', ');
      const conditions: string[] = [`thread_id IN (${threadPlaceholders})`];
      const queryParams: InValue[] = [...threadIds];

      if (resourceId) {
        conditions.push(`"resourceId" = ?`);
        queryParams.push(resourceId);
      }

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`"createdAt" ${startOp} ?`);
        queryParams.push(
          filter.dateRange.start instanceof Date ? filter.dateRange.start.toISOString() : filter.dateRange.start,
        );
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`"createdAt" ${endOp} ?`);
        queryParams.push(
          filter.dateRange.end instanceof Date ? filter.dateRange.end.toISOString() : filter.dateRange.end,
        );
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_MESSAGES} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      // Step 1: Get paginated messages from the thread first (without excluding included ones)
      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#client.execute({
        sql: `SELECT id, content, role, type, "createdAt", "resourceId", "thread_id" FROM ${TABLE_MESSAGES} ${whereClause} ${orderByStatement} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, offset],
      });
      const messages: MastraDBMessage[] = (dataResult.rows || []).map((row: any) => this.parseRow(row));

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

      // Step 2: Add included messages with context (if any), excluding duplicates
      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        if (includeMessages) {
          // Deduplicate: only add messages that aren't already in the paginated results
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(messages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output
      finalMessages = finalMessages.sort((a, b) => {
        const isDateField = field === 'createdAt' || field === 'updatedAt';
        const aValue = isDateField ? new Date((a as any)[field]).getTime() : (a as any)[field];
        const bValue = isDateField ? new Date((b as any)[field]).getTime() : (b as any)[field];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
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
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES', 'FAILED'),
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

  public async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    if (!resourceId || typeof resourceId !== 'string' || resourceId.trim().length === 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES', 'INVALID_QUERY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resourceId: resourceId ?? '' },
        },
        new Error('resourceId is required'),
      );
    }

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES', 'INVALID_PAGE'),
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
      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderByStatement = `ORDER BY "${field}" ${direction}`;

      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      // Add resourceId filter (required for listMessagesByResourceId)
      conditions.push(`"resourceId" = ?`);
      queryParams.push(resourceId);

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`"createdAt" ${startOp} ?`);
        queryParams.push(
          filter.dateRange.start instanceof Date ? filter.dateRange.start.toISOString() : filter.dateRange.start,
        );
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`"createdAt" ${endOp} ?`);
        queryParams.push(
          filter.dateRange.end instanceof Date ? filter.dateRange.end.toISOString() : filter.dateRange.end,
        );
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_MESSAGES} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      // Step 1: Get paginated messages
      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#client.execute({
        sql: `SELECT id, content, role, type, "createdAt", "resourceId", "thread_id" FROM ${TABLE_MESSAGES} ${whereClause} ${orderByStatement} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, offset],
      });
      const messages: MastraDBMessage[] = (dataResult.rows || []).map((row: any) => this.parseRow(row));

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

      // Step 2: Add included messages with context (if any), excluding duplicates
      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        if (includeMessages) {
          // Deduplicate: only add messages that aren't already in the paginated results
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(messages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output
      finalMessages = finalMessages.sort((a, b) => {
        const isDateField = field === 'createdAt' || field === 'updatedAt';
        const aValue = isDateField ? new Date((a as any)[field]).getTime() : (a as any)[field];
        const bValue = isDateField ? new Date((b as any)[field]).getTime() : (b as any)[field];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      // Calculate hasMore based on pagination window
      const hasMore = perPageInput !== false && offset + perPage < total;

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
          id: createStorageErrorId('LIBSQL', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
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
    if (messages.length === 0) return { messages };

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
          await this.#client.batch(batch, 'write');
        }
      }

      // Execute thread update separately
      if (threadUpdateStatement) {
        await this.#client.execute(threadUpdateStatement);
      }

      const list = new MessageList().add(messages as any, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_MESSAGES', 'FAILED'),
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
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const placeholders = messageIds.map(() => '?').join(',');

    const selectSql = `SELECT * FROM ${TABLE_MESSAGES} WHERE id IN (${placeholders})`;
    const existingResult = await this.#client.execute({ sql: selectSql, args: messageIds });
    const existingMessages: MastraDBMessage[] = existingResult.rows.map(row => this.parseRow(row));

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

    await this.#client.batch(batchStatements, 'write');

    const updatedResult = await this.#client.execute({ sql: selectSql, args: messageIds });
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
      const tx = await this.#client.transaction('write');

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
          id: createStorageErrorId('LIBSQL', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const result = await this.#db.select<StorageResourceType>({
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
    await this.#db.insert({
      tableName: TABLE_RESOURCES,
      record: {
        ...resource,
        // metadata is handled by prepareStatement which stringifies jsonb columns
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
      updates.push('metadata = jsonb(?)');
      values.push(JSON.stringify(updatedResource.metadata));
    }

    updates.push('updatedAt = ?');
    values.push(updatedResource.updatedAt.toISOString());

    values.push(resourceId);

    await this.#client.execute({
      sql: `UPDATE ${TABLE_RESOURCES} SET ${updates.join(', ')} WHERE id = ?`,
      args: values,
    });

    return updatedResource;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const result = await this.#db.select<
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
          id: createStorageErrorId('LIBSQL', 'GET_THREAD_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
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
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_THREADS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page, ...(perPageInput !== undefined && { perPage: perPageInput }) },
        },
        error instanceof Error ? error : new Error('Invalid pagination parameters'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);

    // Validate metadata keys to prevent SQL injection
    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
        },
        error instanceof Error ? error : new Error('Invalid metadata key'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);

    try {
      const whereClauses: string[] = [];
      const queryParams: InValue[] = [];

      // Add resourceId filter if provided
      if (filter?.resourceId) {
        whereClauses.push('resourceId = ?');
        queryParams.push(filter.resourceId);
      }

      // Add metadata filters if provided (AND logic)
      // Keys are validated above to prevent SQL injection
      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          // Handle null values specially: json_extract returns SQL NULL for JSON null,
          // and NULL = NULL evaluates to NULL (not true) in SQL
          if (value === null) {
            whereClauses.push(`json_extract(metadata, '$.${key}') IS NULL`);
          } else if (typeof value === 'boolean') {
            // json_extract returns 1 for true, 0 for false (integers, not strings)
            whereClauses.push(`json_extract(metadata, '$.${key}') = ?`);
            queryParams.push(value ? 1 : 0);
          } else if (typeof value === 'number') {
            // Numbers are returned as-is by json_extract
            whereClauses.push(`json_extract(metadata, '$.${key}') = ?`);
            queryParams.push(value);
          } else if (typeof value === 'string') {
            // Strings are returned unquoted by json_extract
            whereClauses.push(`json_extract(metadata, '$.${key}') = ?`);
            queryParams.push(value);
          } else {
            // Objects and arrays are not supported for filtering
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'LIST_THREADS', 'INVALID_METADATA_VALUE'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Metadata filter value for key "${key}" must be a scalar type (string, number, boolean, or null), got ${typeof value}`,
              details: { key, valueType: typeof value },
            });
          }
        }
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const baseQuery = `FROM ${TABLE_THREADS} ${whereClause}`;

      const mapRowToStorageThreadType = (row: any): StorageThreadType => ({
        id: row.id as string,
        resourceId: row.resourceId as string,
        title: row.title as string,
        createdAt: new Date(row.createdAt as string),
        updatedAt: new Date(row.updatedAt as string),
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      });

      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count ${baseQuery}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

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
      const dataResult = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_THREADS)} ${baseQuery} ORDER BY "${field}" ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, offset],
      });

      const threads = (dataResult.rows || []).map(mapRowToStorageThreadType);

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
          id: createStorageErrorId('LIBSQL', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!filter?.metadata,
          },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
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
      await this.#db.insert({
        tableName: TABLE_THREADS,
        record: {
          ...thread,
          // metadata is handled by prepareStatement which stringifies jsonb columns
        },
      });

      return thread;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_THREAD', 'FAILED'),
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
        id: createStorageErrorId('LIBSQL', 'UPDATE_THREAD', 'NOT_FOUND'),
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
      await this.#client.execute({
        sql: `UPDATE ${TABLE_THREADS} SET title = ?, metadata = jsonb(?) WHERE id = ?`,
        args: [title, JSON.stringify(updatedThread.metadata), id],
      });

      return updatedThread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_THREAD', 'FAILED'),
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
    try {
      // Delete messages first (child records), then thread
      // Note: Not using a transaction to avoid SQLITE_BUSY errors when multiple
      // deleteThread calls run concurrently. The two deletes are independent and
      // orphaned messages (if thread delete fails) would be cleaned up on next delete attempt.
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_MESSAGES} WHERE thread_id = ?`,
        args: [threadId],
      });
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_THREADS} WHERE id = ?`,
        args: [threadId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    // Get the source thread
    const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
    if (!sourceThread) {
      throw new MastraError({
        id: createStorageErrorId('LIBSQL', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }

    // Use provided ID or generate a new one
    const newThreadId = providedThreadId || crypto.randomUUID();

    // Check if the new thread ID already exists
    const existingThread = await this.getThreadById({ threadId: newThreadId });
    if (existingThread) {
      throw new MastraError({
        id: createStorageErrorId('LIBSQL', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    try {
      // Build message query with filters
      let messageQuery = `SELECT id, content, role, type, "createdAt", thread_id, "resourceId"
                          FROM "${TABLE_MESSAGES}" WHERE thread_id = ?`;
      const messageParams: InValue[] = [sourceThreadId];

      // Apply date filters
      if (options?.messageFilter?.startDate) {
        messageQuery += ` AND "createdAt" >= ?`;
        messageParams.push(
          options.messageFilter.startDate instanceof Date
            ? options.messageFilter.startDate.toISOString()
            : options.messageFilter.startDate,
        );
      }
      if (options?.messageFilter?.endDate) {
        messageQuery += ` AND "createdAt" <= ?`;
        messageParams.push(
          options.messageFilter.endDate instanceof Date
            ? options.messageFilter.endDate.toISOString()
            : options.messageFilter.endDate,
        );
      }

      // Apply message ID filter
      if (options?.messageFilter?.messageIds && options.messageFilter.messageIds.length > 0) {
        messageQuery += ` AND id IN (${options.messageFilter.messageIds.map(() => '?').join(', ')})`;
        messageParams.push(...options.messageFilter.messageIds);
      }

      messageQuery += ` ORDER BY "createdAt" ASC`;

      // Apply message limit (from most recent, so we need to reverse order for limit then sort back)
      if (options?.messageLimit && options.messageLimit > 0) {
        const limitQuery = `SELECT * FROM (${messageQuery.replace('ORDER BY "createdAt" ASC', 'ORDER BY "createdAt" DESC')} LIMIT ?) ORDER BY "createdAt" ASC`;
        messageParams.push(options.messageLimit);
        messageQuery = limitQuery;
      }

      const sourceMessagesResult = await this.#client.execute({ sql: messageQuery, args: messageParams });
      const sourceMessages = sourceMessagesResult.rows || [];

      const now = new Date();
      const nowStr = now.toISOString();

      // Determine the last message ID for clone metadata
      const lastMessageId =
        sourceMessages.length > 0 ? (sourceMessages[sourceMessages.length - 1]!.id as string) : undefined;

      // Create clone metadata
      const cloneMetadata: ThreadCloneMetadata = {
        sourceThreadId,
        clonedAt: now,
        ...(lastMessageId && { lastMessageId }),
      };

      // Create the new thread
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

      // Use transaction for consistency
      const tx = await this.#client.transaction('write');

      try {
        // Insert the new thread
        await tx.execute({
          sql: `INSERT INTO "${TABLE_THREADS}" (id, "resourceId", title, metadata, "createdAt", "updatedAt")
                VALUES (?, ?, ?, jsonb(?), ?, ?)`,
          args: [
            newThread.id,
            newThread.resourceId,
            newThread.title ?? '',
            JSON.stringify(newThread.metadata),
            nowStr,
            nowStr,
          ],
        });

        // Clone messages with new IDs
        const clonedMessages: MastraDBMessage[] = [];
        const targetResourceId = resourceId || sourceThread.resourceId;

        for (const sourceMsg of sourceMessages) {
          const newMessageId = crypto.randomUUID();
          const contentStr = sourceMsg.content as string;
          let parsedContent: MastraDBMessage['content'];
          try {
            parsedContent = JSON.parse(contentStr);
          } catch {
            // use content as is - wrap in format 2 structure if needed
            parsedContent = { format: 2, parts: [{ type: 'text', text: contentStr }] };
          }

          await tx.execute({
            sql: `INSERT INTO "${TABLE_MESSAGES}" (id, thread_id, content, role, type, "createdAt", "resourceId")
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
              newMessageId,
              newThreadId,
              contentStr,
              sourceMsg.role as string,
              (sourceMsg.type as string) || 'v2',
              sourceMsg.createdAt as string,
              targetResourceId,
            ],
          });

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
          id: createStorageErrorId('LIBSQL', 'CLONE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sourceThreadId, newThreadId },
        },
        error,
      );
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
      // Handle new chunk-based structure
      bufferedObservationChunks: row.bufferedObservationChunks
        ? typeof row.bufferedObservationChunks === 'string'
          ? JSON.parse(row.bufferedObservationChunks)
          : row.bufferedObservationChunks
        : undefined,
      // Deprecated fields (for backward compatibility)
      bufferedObservations: row.activeObservationsPendingUpdate || undefined,
      bufferedObservationTokens: row.bufferedObservationTokens ? Number(row.bufferedObservationTokens) : undefined,
      bufferedMessageIds: undefined, // Use bufferedObservationChunks instead
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
        row.isBufferingObservation === true ||
        row.isBufferingObservation === 'true' ||
        row.isBufferingObservation === 1,
      isBufferingReflection:
        row.isBufferingReflection === true || row.isBufferingReflection === 'true' || row.isBufferingReflection === 1,
      lastBufferedAtTokens:
        typeof row.lastBufferedAtTokens === 'number'
          ? row.lastBufferedAtTokens
          : parseInt(String(row.lastBufferedAtTokens ?? '0'), 10) || 0,
      lastBufferedAtTime: row.lastBufferedAtTime ? new Date(String(row.lastBufferedAtTime)) : null,
      config: row.config ? JSON.parse(row.config) : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      observedMessageIds: row.observedMessageIds ? JSON.parse(row.observedMessageIds) : undefined,
      observedTimezone: row.observedTimezone || undefined,
    };
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const result = await this.#client.execute({
        // Use generationCount DESC for reliable ordering (incremented for each new record)
        sql: `SELECT * FROM "${OM_TABLE}" WHERE "lookupKey" = ? ORDER BY "generationCount" DESC LIMIT 1`,
        args: [lookupKey],
      });
      if (!result.rows || result.rows.length === 0) return null;
      return this.parseOMRow(result.rows[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_OBSERVATIONAL_MEMORY', 'FAILED'),
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
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const result = await this.#client.execute({
        // Use generationCount DESC for reliable ordering (incremented for each new record)
        sql: `SELECT * FROM "${OM_TABLE}" WHERE "lookupKey" = ? ORDER BY "generationCount" DESC LIMIT ?`,
        args: [lookupKey, limit],
      });
      if (!result.rows) return [];
      return result.rows.map(row => this.parseOMRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_OBSERVATIONAL_MEMORY_HISTORY', 'FAILED'),
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
      const id = crypto.randomUUID();
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

      await this.#client.execute({
        sql: `INSERT INTO "${OM_TABLE}" (
          id, "lookupKey", scope, "resourceId", "threadId",
          "activeObservations", "activeObservationsPendingUpdate",
          "originType", config, "generationCount", "lastObservedAt", "lastReflectionAt",
          "pendingMessageTokens", "totalTokensObserved", "observationTokenCount",
          "isObserving", "isReflecting", "isBufferingObservation", "isBufferingReflection", "lastBufferedAtTokens", "lastBufferedAtTime",
          "observedTimezone", "createdAt", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          lookupKey,
          input.scope,
          input.resourceId,
          input.threadId || null,
          '',
          null,
          'initial',
          JSON.stringify(input.config),
          0,
          null,
          null,
          0,
          0,
          0,
          false,
          false,
          false, // isBufferingObservation
          false, // isBufferingReflection
          0, // lastBufferedAtTokens
          null, // lastBufferedAtTime
          input.observedTimezone || null,
          now.toISOString(),
          now.toISOString(),
        ],
      });

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'INITIALIZE_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: input.threadId, resourceId: input.resourceId },
        },
        error,
      );
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    try {
      const now = new Date();

      const observedMessageIdsJson = input.observedMessageIds ? JSON.stringify(input.observedMessageIds) : null;
      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET
          "activeObservations" = ?,
          "lastObservedAt" = ?,
          "pendingMessageTokens" = 0,
          "observationTokenCount" = ?,
          "totalTokensObserved" = "totalTokensObserved" + ?,
          "observedMessageIds" = ?,
          "updatedAt" = ?
        WHERE id = ?`,
        args: [
          input.observations,
          input.lastObservedAt.toISOString(),
          input.tokenCount,
          input.tokenCount,
          observedMessageIdsJson,
          now.toISOString(),
          input.id,
        ],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_ACTIVE_OBSERVATIONS', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'UPDATE_ACTIVE_OBSERVATIONS', 'FAILED'),
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
      const id = crypto.randomUUID();
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

      await this.#client.execute({
        sql: `INSERT INTO "${OM_TABLE}" (
          id, "lookupKey", scope, "resourceId", "threadId",
          "activeObservations", "activeObservationsPendingUpdate",
          "originType", config, "generationCount", "lastObservedAt", "lastReflectionAt",
          "pendingMessageTokens", "totalTokensObserved", "observationTokenCount",
          "isObserving", "isReflecting", "isBufferingObservation", "isBufferingReflection", "lastBufferedAtTokens", "lastBufferedAtTime",
          "observedTimezone", "createdAt", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          lookupKey,
          record.scope,
          record.resourceId,
          record.threadId || null,
          input.reflection,
          null,
          'reflection',
          JSON.stringify(record.config),
          input.currentRecord.generationCount + 1,
          record.lastObservedAt?.toISOString() || null,
          now.toISOString(),
          record.pendingMessageTokens,
          record.totalTokensObserved,
          record.observationTokenCount,
          false, // isObserving
          false, // isReflecting
          false, // isBufferingObservation
          false, // isBufferingReflection
          0, // lastBufferedAtTokens
          null, // lastBufferedAtTime
          record.observedTimezone || null,
          now.toISOString(),
          now.toISOString(),
        ],
      });

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_REFLECTION_GENERATION', 'FAILED'),
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
      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET "isReflecting" = ?, "updatedAt" = ? WHERE id = ?`,
        args: [isReflecting, new Date().toISOString(), id],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SET_REFLECTING_FLAG', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'SET_REFLECTING_FLAG', 'FAILED'),
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
      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET "isObserving" = ?, "updatedAt" = ? WHERE id = ?`,
        args: [isObserving, new Date().toISOString(), id],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SET_OBSERVING_FLAG', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'SET_OBSERVING_FLAG', 'FAILED'),
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
      const nowStr = new Date().toISOString();

      let sql: string;
      let args: InValue[];

      if (lastBufferedAtTokens !== undefined) {
        sql = `UPDATE "${OM_TABLE}" SET "isBufferingObservation" = ?, "lastBufferedAtTokens" = ?, "updatedAt" = ? WHERE id = ?`;
        args = [isBuffering, lastBufferedAtTokens, nowStr, id];
      } else {
        sql = `UPDATE "${OM_TABLE}" SET "isBufferingObservation" = ?, "updatedAt" = ? WHERE id = ?`;
        args = [isBuffering, nowStr, id];
      }

      const result = await this.#client.execute({ sql, args });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SET_BUFFERING_OBSERVATION_FLAG', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'SET_BUFFERING_OBSERVATION_FLAG', 'FAILED'),
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
      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET "isBufferingReflection" = ?, "updatedAt" = ? WHERE id = ?`,
        args: [isBuffering, new Date().toISOString(), id],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SET_BUFFERING_REFLECTION_FLAG', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'SET_BUFFERING_REFLECTION_FLAG', 'FAILED'),
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
      await this.#client.execute({
        sql: `DELETE FROM "${OM_TABLE}" WHERE "lookupKey" = ?`,
        args: [lookupKey],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CLEAR_OBSERVATIONAL_MEMORY', 'FAILED'),
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
      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET 
          "pendingMessageTokens" = ?, 
          "updatedAt" = ? 
        WHERE id = ?`,
        args: [tokenCount, new Date().toISOString(), id],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SET_PENDING_MESSAGE_TOKENS', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'SET_PENDING_MESSAGE_TOKENS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        },
        error,
      );
    }
  }

  // ============================================
  // Async Buffering Methods
  // ============================================

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    try {
      const nowStr = new Date().toISOString();

      // First get current record to get existing chunks
      const current = await this.#client.execute({
        sql: `SELECT "bufferedObservationChunks" FROM "${OM_TABLE}" WHERE id = ?`,
        args: [input.id],
      });

      if (!current.rows || current.rows.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_BUFFERED_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      const row = current.rows[0]!;
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

      // Create new chunk with ID and timestamp
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
      };

      const newChunks = [...existingChunks, newChunk];

      const lastBufferedAtTime = input.lastBufferedAtTime ? input.lastBufferedAtTime.toISOString() : null;
      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET
          "bufferedObservationChunks" = ?,
          "lastBufferedAtTime" = COALESCE(?, "lastBufferedAtTime"),
          "updatedAt" = ?
        WHERE id = ?`,
        args: [JSON.stringify(newChunks), lastBufferedAtTime, nowStr, input.id],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_BUFFERED_OBSERVATIONS', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'UPDATE_BUFFERED_OBSERVATIONS', 'FAILED'),
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

      // Get current record
      const current = await this.#client.execute({
        sql: `SELECT * FROM "${OM_TABLE}" WHERE id = ?`,
        args: [input.id],
      });

      if (!current.rows || current.rows.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SWAP_BUFFERED_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      const row = current.rows[0]!;

      // Parse buffered chunks
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

      // Calculate target message tokens to activate based on new formula:
      // retentionFloor = threshold * (1 - ratio) represents tokens to keep as raw messages
      // targetMessageTokens = max(0, currentPending - retentionFloor) represents tokens to activate
      const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
      const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

      // Find the closest chunk boundary to the target, biased over (prefer removing
      // slightly more than the target so remaining context lands at or below retentionFloor).
      // Track both best-over and best-under boundaries so we can fall back to under
      // if the over boundary would overshoot by too much.
      let cumulativeMessageTokens = 0;
      let bestOverBoundary = 0;
      let bestOverTokens = 0;
      let bestUnderBoundary = 0;
      let bestUnderTokens = 0;

      for (let i = 0; i < chunks.length; i++) {
        cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
        const boundary = i + 1;

        if (cumulativeMessageTokens >= targetMessageTokens) {
          // Over or equal — track the closest (lowest) over boundary
          if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
            bestOverBoundary = boundary;
            bestOverTokens = cumulativeMessageTokens;
          }
        } else {
          // Under — track the closest (highest) under boundary
          if (cumulativeMessageTokens > bestUnderTokens) {
            bestUnderBoundary = boundary;
            bestUnderTokens = cumulativeMessageTokens;
          }
        }
      }

      // Safeguard: if the over boundary would eat into more than 95% of the
      // retention floor, fall back to the best under boundary instead.
      // This prevents edge cases where a large chunk overshoots dramatically.
      // When forceMaxActivation is set (above blockAfter), still prefer the over
      // boundary, but never if it would leave fewer than the smaller of 1000
      // tokens or the retention floor remaining.
      const maxOvershoot = retentionFloor * 0.95;
      const overshoot = bestOverTokens - targetMessageTokens;
      const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
      const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
      // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
      const minRemaining = Math.min(1000, retentionFloor);

      let chunksToActivate: number;
      if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
        chunksToActivate = bestOverBoundary;
      } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
        chunksToActivate = bestOverBoundary;
      } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
        chunksToActivate = bestUnderBoundary;
      } else if (bestOverBoundary > 0) {
        // All boundaries are over and exceed the safeguard — still activate
        // the closest over boundary (better than nothing)
        chunksToActivate = bestOverBoundary;
      } else {
        chunksToActivate = 1;
      }

      // Split chunks
      const activatedChunks = chunks.slice(0, chunksToActivate);
      const remainingChunks = chunks.slice(chunksToActivate);

      // Combine activated observations
      const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
      const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
      const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
      const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
      const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
      const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

      // Derive lastObservedAt from the latest activated chunk, or use provided value
      const latestChunk = activatedChunks[activatedChunks.length - 1];
      const lastObservedAt =
        input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
      const lastObservedAtStr = lastObservedAt.toISOString();

      // Get existing values
      const existingActive = (row.activeObservations as string) || '';
      const existingTokenCount = Number(row.observationTokenCount || 0);

      // Calculate new values
      const newActive = existingActive ? `${existingActive}\n\n${activatedContent}` : activatedContent;
      const newTokenCount = existingTokenCount + activatedTokens;
      // NOTE: We intentionally do NOT add message IDs to observedMessageIds during buffered activation.
      // Buffered chunks represent observations of messages as they were at buffering time.
      // With streaming, messages grow after buffering, so we rely on lastObservedAt for filtering.
      // New content after lastObservedAt will be picked up in subsequent observations.

      // Decrement pending message tokens (clamped to zero)
      const existingPending = Number(row.pendingMessageTokens || 0);
      const newPending = Math.max(0, existingPending - activatedMessageTokens);

      await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET
          "activeObservations" = ?,
          "observationTokenCount" = ?,
          "pendingMessageTokens" = ?,
          "bufferedObservationChunks" = ?,
          "lastObservedAt" = ?,
          "updatedAt" = ?
        WHERE id = ?`,
        args: [
          newActive,
          newTokenCount,
          newPending,
          remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null,
          lastObservedAtStr,
          nowStr,
          input.id,
        ],
      });

      // Use hints from the most recent activated chunk only — stale hints from older chunks are discarded
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
          id: createStorageErrorId('LIBSQL', 'SWAP_BUFFERED_TO_ACTIVE', 'FAILED'),
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

      const result = await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET
          "bufferedReflection" = CASE
            WHEN "bufferedReflection" IS NOT NULL AND "bufferedReflection" != ''
            THEN "bufferedReflection" || char(10) || char(10) || ?
            ELSE ?
          END,
          "bufferedReflectionTokens" = COALESCE("bufferedReflectionTokens", 0) + ?,
          "bufferedReflectionInputTokens" = COALESCE("bufferedReflectionInputTokens", 0) + ?,
          "reflectedObservationLineCount" = ?,
          "updatedAt" = ?
        WHERE id = ?`,
        args: [
          input.reflection,
          input.reflection,
          input.tokenCount,
          input.inputTokenCount,
          input.reflectedObservationLineCount,
          nowStr,
          input.id,
        ],
      });

      if (result.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_BUFFERED_REFLECTION', 'NOT_FOUND'),
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
          id: createStorageErrorId('LIBSQL', 'UPDATE_BUFFERED_REFLECTION', 'FAILED'),
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
      // Get current record
      const current = await this.#client.execute({
        sql: `SELECT * FROM "${OM_TABLE}" WHERE id = ?`,
        args: [input.currentRecord.id],
      });

      if (!current.rows || current.rows.length === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.currentRecord.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        });
      }

      const row = current.rows[0]!;
      const bufferedReflection = (row.bufferedReflection as string) || '';
      const reflectedLineCount = Number(row.reflectedObservationLineCount || 0);

      if (!bufferedReflection) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
          text: 'No buffered reflection to swap',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: input.currentRecord.id },
        });
      }

      // Split current activeObservations by the recorded boundary.
      // Lines 0..reflectedLineCount were reflected on → replaced by bufferedReflection.
      // Lines after reflectedLineCount were added after reflection started → kept as-is.
      const currentObservations = (row.activeObservations as string) || '';
      const allLines = currentObservations.split('\n');
      const unreflectedLines = allLines.slice(reflectedLineCount);
      const unreflectedContent = unreflectedLines.join('\n').trim();

      // New activeObservations = bufferedReflection + unreflected observations
      const newObservations = unreflectedContent
        ? `${bufferedReflection}\n\n${unreflectedContent}`
        : bufferedReflection;

      // Create new generation with the merged content.
      // tokenCount is computed by the processor using its token counter on the combined content.
      const newRecord = await this.createReflectionGeneration({
        currentRecord: input.currentRecord,
        reflection: newObservations,
        tokenCount: input.tokenCount,
      });

      // Clear buffered state on old record
      const nowStr = new Date().toISOString();
      await this.#client.execute({
        sql: `UPDATE "${OM_TABLE}" SET
          "bufferedReflection" = NULL,
          "bufferedReflectionTokens" = NULL,
          "bufferedReflectionInputTokens" = NULL,
          "reflectedObservationLineCount" = NULL,
          "updatedAt" = ?
        WHERE id = ?`,
        args: [nowStr, input.currentRecord.id],
      });

      return newRecord;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        },
        error,
      );
    }
  }
}
