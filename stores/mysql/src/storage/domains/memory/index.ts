import { randomUUID } from 'node:crypto';
import { MessageList, type MastraDBMessage, type MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
  calculatePagination,
  normalizePerPage,
  createStorageErrorId,
} from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryRecord,
  PaginationArgs,
  PaginationInfo,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageResourceType,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  ThreadSortOptions,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
} from '@mastra/core/storage';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier, transformToSqlValue } from '../utils';

const OM_TABLE = 'mastra_observational_memory' as const;
const OM_TABLE_QUOTED = quoteIdentifier(OM_TABLE, 'table name');

function emitValidationError(message: string): MastraError {
  return new MastraError({
    id: 'MYSQL_MEMORY_VALIDATION_ERROR',
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text: message,
  });
}

function omCol(name: string): string {
  return quoteIdentifier(name, 'column name');
}

function rethrowOrWrapOM(error: unknown, id: string, operation: string, details?: Record<string, any>): never {
  if (error instanceof MastraError) {
    throw error;
  }
  throw new MastraError(
    {
      id: createStorageErrorId('MYSQL', operation, 'FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: details ?? { id },
    },
    error,
  );
}

function throwOMNotFound(id: string, operation: string, details?: Record<string, any>): never {
  throw new MastraError({
    id: createStorageErrorId('MYSQL', operation, 'NOT_FOUND'),
    text: `Observational memory record not found: ${id}`,
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.THIRD_PARTY,
    details: details ?? { id },
  });
}

function parseMySQLBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function parseJSONColumn<T>(value: unknown): T | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

function parseBufferedChunks(raw: unknown): BufferedObservationChunk[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ThreadRow {
  id: string;
  resourceId: string;
  title: string;
  metadata: string | Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MessageRow {
  id: string;
  thread_id: string;
  content: string | Record<string, unknown>;
  role: MastraDBMessage['role'];
  type: string | null;
  createdAt: Date | string;
  resourceId: string | null;
}

interface ResourceRow {
  id: string;
  workingMemory: string | null;
  metadata: string | Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function parseJSON<T>(value: T | string | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return null;
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export class MemoryMySQL extends MemoryStorage {
  readonly supportsObservationalMemory = true;

  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.operations.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.operations.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });

    // Dynamically import OM schema to avoid crashing on older @mastra/core versions
    let omSchema: Record<string, any> | undefined;
    try {
      const { OBSERVATIONAL_MEMORY_TABLE_SCHEMA } = await import('@mastra/core/storage');
      omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];
    } catch {
      // Older @mastra/core without OM support
    }

    if (omSchema) {
      await this.operations.createTable({
        tableName: OM_TABLE as any,
        schema: omSchema,
      });
      await this.operations.alterTable({
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
    await this.operations.alterTable({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });

    if (omSchema) {
      // Create index on lookupKey for efficient OM queries
      // MySQL does not support CREATE INDEX IF NOT EXISTS, so catch ER_DUP_KEYNAME (errno 1061)
      try {
        await this.pool.execute(
          `CREATE INDEX idx_om_lookup_key ON ${OM_TABLE_QUOTED} (${quoteIdentifier('lookupKey', 'column name')}(191))`,
        );
      } catch (err: any) {
        if (err?.errno !== 1061) {
          throw err;
        }
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_MESSAGES)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_THREADS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_RESOURCES)}`);
    try {
      await this.pool.execute(`DELETE FROM ${OM_TABLE_QUOTED}`);
    } catch (err: any) {
      // errno 1146 = ER_NO_SUCH_TABLE — table may not exist yet
      if (err?.errno !== 1146) {
        throw err;
      }
    }
  }

  private mapThread(row: ThreadRow): StorageThreadType {
    return {
      id: row.id,
      resourceId: row.resourceId,
      title: row.title,
      metadata: parseJSON<Record<string, unknown>>(row.metadata) ?? undefined,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    } satisfies StorageThreadType;
  }

  private mapMessage(row: MessageRow): MastraDBMessage {
    const createdAt = parseDateTime(row.createdAt) ?? new Date();
    let content: MastraMessageContentV2;
    if (typeof row.content === 'string') {
      try {
        const parsed = JSON.parse(row.content);
        content = parsed as MastraMessageContentV2;
      } catch {
        // Wrap legacy v1 string content into v2 shape
        content = {
          format: 2,
          parts: [{ type: 'text', text: row.content } as any],
          content: row.content,
        } as MastraMessageContentV2;
      }
    } else {
      content = row.content as MastraMessageContentV2;
    }

    const message: MastraDBMessage = {
      id: row.id,
      threadId: row.thread_id,
      resourceId: row.resourceId ?? undefined,
      role: row.role,
      content,
      createdAt,
    };

    if (row.type && row.type !== 'v2') {
      message.type = row.type;
    }

    return message;
  }

  private async fetchMessagesForThread(threadId: string, limit?: number): Promise<MessageRow[]> {
    let sql = `SELECT id, thread_id, content, role, type, createdAt, resourceId FROM ${formatTableName(TABLE_MESSAGES)} WHERE ${quoteIdentifier('thread_id', 'column name')} = ? ORDER BY ${quoteIdentifier('createdAt', 'column name')} ASC`;
    const params: any[] = [threadId];
    if (limit && limit > 0) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as unknown as MessageRow[];
  }

  private async collectIncludeMessages({
    threadId,
    include,
    messagesByThread,
  }: {
    threadId: string;
    include?: StorageListMessagesInput['include'];
    messagesByThread: Map<string, MastraDBMessage[]>;
  }): Promise<MastraDBMessage[]> {
    if (!include?.length) return [];

    const includeMessages: MastraDBMessage[] = [];
    const seenIds = new Set<string>();

    for (const inc of include) {
      const targetThreadId = inc.threadId ?? threadId;

      let threadMessages = messagesByThread.get(targetThreadId);
      if (!threadMessages) {
        const rows = await this.fetchMessagesForThread(targetThreadId);
        threadMessages = rows.map(row => this.mapMessage(row));
        messagesByThread.set(targetThreadId, threadMessages);
      }

      // If the current cached set might be partial (e.g., paginated main thread), reload full thread
      const needsContext =
        (inc.withPreviousMessages ?? 0) > 0 ||
        (inc.withNextMessages ?? 0) > 0 ||
        threadMessages.length < (inc.withNextMessages ?? 0) + (inc.withPreviousMessages ?? 0) + 1;
      if (needsContext) {
        const rows = await this.fetchMessagesForThread(targetThreadId);
        threadMessages = rows.map(row => this.mapMessage(row));
        messagesByThread.set(targetThreadId, threadMessages);
      }

      const targetIndex = threadMessages.findIndex(msg => msg.id === inc.id);
      if (targetIndex === -1) continue;

      // Add the target message itself if not already included
      if (!seenIds.has(inc.id)) {
        seenIds.add(inc.id);
        includeMessages.push(threadMessages[targetIndex]!);
      }

      // Add previous messages
      if (inc.withPreviousMessages) {
        const start = Math.max(0, targetIndex - inc.withPreviousMessages);
        for (let i = start; i < targetIndex; i++) {
          const message = threadMessages[i]!;
          if (!seenIds.has(message.id)) {
            seenIds.add(message.id);
            includeMessages.push(message);
          }
        }
      }

      // Add next messages
      if (inc.withNextMessages) {
        const end = Math.min(threadMessages.length, targetIndex + inc.withNextMessages + 1);
        for (let i = targetIndex + 1; i < end; i++) {
          const message = threadMessages[i]!;
          if (!seenIds.has(message.id)) {
            seenIds.add(message.id);
            includeMessages.push(message);
          }
        }
      }
    }

    return includeMessages;
  }

  private async upsertThread(thread: StorageThreadType): Promise<void> {
    await this.operations.insert({
      tableName: TABLE_THREADS,
      record: {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: thread.metadata ? JSON.stringify(thread.metadata) : null,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
    });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const row = await this.operations.load<ThreadRow>({
        tableName: TABLE_THREADS,
        keys: { id: threadId },
      });
      return row ? this.mapThread(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_GET_THREAD_BY_ID_FAILED',
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
    const { field, direction } = this.parseOrderBy(orderBy, 'DESC');
    const perPageNormalized = normalizePerPage(perPageInput, 100);
    const { offset, perPage } = calculatePagination(page, perPageInput, perPageNormalized);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.resourceId) {
      conditions.push(`${quoteIdentifier('resourceId', 'column name')} = ?`);
      params.push(filter.resourceId);
    }

    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        conditions.push(`JSON_EXTRACT(\`metadata\`, ?) = CAST(? AS JSON)`);
        params.push(`$.${key}`, JSON.stringify(value));
      }
    }

    const whereClause = conditions.length > 0
      ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: params }
      : { sql: '', args: [] };

    try {
      const total = await this.operations.loadTotalCount({ tableName: TABLE_THREADS, whereClause });
      if (total === 0) {
        return { threads: [], total: 0, page, perPage, hasMore: false };
      }

      const limitValue = perPageInput === false ? total : perPageNormalized;
      const rows = await this.operations.loadMany<ThreadRow>({
        tableName: TABLE_THREADS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
      });
      const threads = rows.map(row => this.mapThread(row));

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: perPageInput === false ? false : offset + perPageNormalized < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_LIST_THREADS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { filter: JSON.stringify(filter ?? {}) },
        },
        error,
      );
    }
  }

  public async getThreadsByResourceId(args: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    const { threads } = await this.listThreads({
      filter: { resourceId: args.resourceId },
      orderBy: args.orderBy || args.sortDirection ? { field: args.orderBy, direction: args.sortDirection } : undefined,
      page: 0,
      perPage: false,
    });

    return threads;
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
    } & PaginationArgs &
      ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    return this.listThreads({
      filter: { resourceId: args.resourceId },
      page: args.page,
      perPage: args.perPage,
      orderBy: args.orderBy || args.sortDirection ? { field: args.orderBy, direction: args.sortDirection } : undefined,
    });
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.upsertThread(thread);
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_SAVE_THREAD_FAILED',
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
      const existing = await this.getThreadById({ threadId: id });
      if (!existing) {
        throw new Error(`Thread ${id} not found`);
      }

      const mergedMetadata = {
        ...(existing.metadata ?? {}),
        ...(metadata ?? {}),
      } as Record<string, unknown>;

      const updatedAt = new Date();
      await this.operations.update({
        tableName: TABLE_THREADS,
        keys: { id },
        data: {
          title,
          metadata: JSON.stringify(mergedMetadata),
          updatedAt,
        },
      });

      return {
        ...existing,
        title,
        metadata: mergedMetadata,
        updatedAt,
      } satisfies StorageThreadType;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.operations.batchDelete({
        tableName: TABLE_MESSAGES,
        keys: [{ thread_id: threadId }],
      });
      await this.operations.delete({ tableName: TABLE_THREADS, keys: { id: threadId } });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

    const placeholders = messageIds.map(() => '?').join(', ');
    const sql = `SELECT id, thread_id, content, role, type, createdAt, resourceId FROM ${formatTableName(TABLE_MESSAGES)} WHERE id IN (${placeholders}) ORDER BY ${quoteIdentifier('createdAt', 'column name')} ASC`;

    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, messageIds);
      const messages = (rows as unknown as MessageRow[]).map(row => this.mapMessage(row));
      return { messages };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_LIST_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const messages = args.messages;
    if (messages.length === 0) {
      return { messages: [] };
    }

    const threadIds = new Set<string>();
    for (const message of messages) {
      if (!message.threadId || !message.threadId.trim()) {
        throw new Error('Thread ID is required');
      }
      threadIds.add(message.threadId);
      if (!message.resourceId) {
        throw new Error(
          `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
        );
      }
    }

    for (const threadId of threadIds) {
      const existingThread = await this.getThreadById({ threadId });
      if (!existingThread) {
        throw new Error(`Thread ${threadId} not found`);
      }
    }

    const connection = await this.pool.getConnection();
    const affectedThreads = new Map<string, Date>();
    const insertedIds: string[] = [];

    try {
      await connection.beginTransaction();

      for (const message of messages) {
        if (!message.threadId) {
          throw new Error('Message must have threadId');
        }
        const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();
        const id = message.id ?? randomUUID();
        const record = {
          id,
          thread_id: message.threadId,
          content: JSON.stringify(message.content ?? message),
          role: message.role,
          type: message.type ?? 'v2',
          createdAt,
          resourceId: message.resourceId ?? null,
        } satisfies Record<string, any>;
        const statement = {
          sql: `INSERT INTO ${formatTableName(TABLE_MESSAGES)} (id, thread_id, content, role, type, createdAt, resourceId)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE thread_id = VALUES(thread_id), content = VALUES(content), role = VALUES(role), type = VALUES(type), resourceId = VALUES(resourceId)`,
          args: [
            record.id,
            record.thread_id,
            record.content,
            record.role,
            record.type,
            transformToSqlValue(record.createdAt),
            record.resourceId,
          ],
        };
        await connection.execute(statement.sql, statement.args);
        const currentMax = affectedThreads.get(record.thread_id);
        if (!currentMax || currentMax.getTime() < createdAt.getTime()) {
          affectedThreads.set(record.thread_id, createdAt);
        }
        insertedIds.push(record.id);
      }

      for (const [threadId, updatedAt] of affectedThreads.entries()) {
        await connection.execute(
          `UPDATE ${formatTableName(TABLE_THREADS)} SET ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE id = ?`,
          [transformToSqlValue(updatedAt), threadId],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }

    const { messages: persisted } = await this.listMessagesById({ messageIds: insertedIds });
    const ordered = insertedIds
      .map(id => persisted.find(msg => msg.id === id))
      .filter(Boolean) as MastraDBMessage[];
    return { messages: ordered };
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: Partial<MastraMessageContentV2>;
    })[];
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;
    if (!messages.length) return [];

    try {
      const { messages: existing } = await this.listMessagesById({
        messageIds: messages.map(m => m.id),
      });
      const existingMap = new Map(existing.map(msg => [msg.id, msg]));

      const updates: { keys: Record<string, any>; data: Record<string, any> }[] = [];
      const affectedThreads = new Map<string, Date>();

      for (const update of messages) {
        const current = existingMap.get(update.id);
        if (!current) continue;

        const targetThreadId = update.threadId ?? current.threadId;
        if (!targetThreadId) {
          // If threadId is somehow missing, skip this update safely
          continue;
        }
        const data: Record<string, any> = {};

        if (update.threadId && update.threadId !== current.threadId) {
          data.thread_id = update.threadId;
        }
        if (update.role) {
          data.role = update.role;
        }
        if (update.type) {
          data.type = update.type;
        }
        if (update.resourceId !== undefined) {
          data.resourceId = update.resourceId;
        }

        if (update.content) {
          const existingContent = (current.content ?? {}) as Record<string, any>;
          const mergedContent: Record<string, any> = { ...existingContent, ...update.content };
          if (
            existingContent.metadata &&
            typeof existingContent.metadata === 'object' &&
            update.content.metadata &&
            typeof update.content.metadata === 'object'
          ) {
            mergedContent.metadata = {
              ...(existingContent.metadata as Record<string, any>),
              ...(update.content.metadata as Record<string, any>),
            };
          }
          data.content = JSON.stringify(mergedContent);
        }

        updates.push({ keys: { id: update.id }, data });

        const now = new Date();
        affectedThreads.set(targetThreadId, now);
        if (update.threadId && update.threadId !== current.threadId && current.threadId) {
          affectedThreads.set(current.threadId, now);
        }
      }

      if (!updates.length) {
        return existing;
      }

      await this.operations.batchUpdate({
        tableName: TABLE_MESSAGES,
        items: updates,
      });

      for (const [threadId, timestamp] of affectedThreads.entries()) {
        await this.operations.update({
          tableName: TABLE_THREADS,
          keys: { id: threadId },
          data: { updatedAt: timestamp },
        });
      }

      const { messages: updated } = await this.listMessagesById({ messageIds: messages.map(m => m.id) });
      return updated;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds.length) return;
    try {
      const placeholders = messageIds.map(() => '?').join(', ');
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT thread_id FROM ${formatTableName(TABLE_MESSAGES)} WHERE id IN (${placeholders})`,
        messageIds,
      );
      const threadIds = (rows as { thread_id: string | null }[])
        .map(row => row.thread_id)
        .filter((threadId): threadId is string => Boolean(threadId));

      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_MESSAGES)} WHERE id IN (${placeholders})`,
        messageIds,
      );

      if (threadIds.length) {
        const threadPlaceholders = threadIds.map(() => '?').join(', ');
        const timestamp = transformToSqlValue(new Date());
        await this.pool.execute(
          `UPDATE ${formatTableName(TABLE_THREADS)} SET ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE id IN (${threadPlaceholders})`,
          [timestamp, ...threadIds],
        );
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_DELETE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, filter, orderBy, page = 0, perPage: perPageInput } = args;
    const selectBy = (args as StorageListMessagesInput & {
      selectBy?: { include?: StorageListMessagesInput['include']; last?: number; vectorSearchString?: string };
    }).selectBy;
    const include = args.include ?? selectBy?.include;

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw emitValidationError('threadId must be a non-empty string or array of non-empty strings');
    }

    const primaryThreadId = threadIds[0]!;

    const normalizedPerPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage } = calculatePagination(page, perPageInput, normalizedPerPage);

    const field = orderBy?.field ?? 'createdAt';
    const direction = (orderBy?.direction ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const comparator = (a: MastraDBMessage, b: MastraDBMessage) => {
      const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
      const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

      if (aValue == null && bValue == null) return a.id.localeCompare(b.id);
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (aValue === bValue) return a.id.localeCompare(b.id);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    };

    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (threadIds.length === 1) {
        conditions.push(`${quoteIdentifier('thread_id', 'column name')} = ?`);
        params.push(threadIds[0]!);
      } else {
        const placeholders = threadIds.map(() => '?').join(', ');
        conditions.push(`${quoteIdentifier('thread_id', 'column name')} IN (${placeholders})`);
        params.push(...threadIds);
      }

      if (resourceId) {
        conditions.push(`${quoteIdentifier('resourceId', 'column name')} = ?`);
        params.push(resourceId);
      }

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`${quoteIdentifier('createdAt', 'column name')} ${startOp} ?`);
        params.push(transformToSqlValue(filter.dateRange.start));
      }
      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`${quoteIdentifier('createdAt', 'column name')} ${endOp} ?`);
        params.push(transformToSqlValue(filter.dateRange.end));
      }

      if (selectBy?.vectorSearchString) {
        conditions.push(`${quoteIdentifier('content', 'column name')} LIKE ?`);
        params.push(`%${selectBy.vectorSearchString}%`);
      }

      const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const tableName = formatTableName(TABLE_MESSAGES);

      const [countRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM ${tableName}${whereSql}`,
        params,
      );
      const total = Number(countRows[0]?.count ?? 0);

      // If nothing to return and no include, short circuit
      if (total === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // last takes precedence over perPage
      const lastLimit =
        selectBy?.last !== undefined
          ? (typeof selectBy.last === 'number' && selectBy.last > 0 ? selectBy.last : Number.MAX_SAFE_INTEGER)
          : undefined;

      const limitValue =
        lastLimit !== undefined
          ? lastLimit
          : perPageInput === false
            ? total
            : normalizedPerPage;
      const safeLimit = Math.max(0, Number(limitValue));
      const safeOffset = lastLimit !== undefined ? Math.max(0, total - safeLimit) : Math.max(0, Number(offset));

      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT id, thread_id, content, role, type, createdAt, resourceId FROM ${tableName}${whereSql} ORDER BY ${quoteIdentifier(field, 'column name')} ${direction} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params,
      );

      const messagesByThread = new Map<string, MastraDBMessage[]>();
      const paginatedMain = (rows as unknown as MessageRow[]).map(row => this.mapMessage(row));
      messagesByThread.set(primaryThreadId, paginatedMain);

      const includeMessages = await this.collectIncludeMessages({ threadId: primaryThreadId, include, messagesByThread });

      const combinedMap = new Map<string, MastraDBMessage>();
      for (const msg of paginatedMain) combinedMap.set(msg.id, msg);
      for (const msg of includeMessages) combinedMap.set(msg.id, msg);

      const combinedMessages = Array.from(combinedMap.values()).sort(comparator);

      const list = new MessageList();
      list.add(combinedMessages, 'memory');
      const normalizedMessages = list.get.all.db();
      const messages = [...normalizedMessages].sort(comparator);

      const baseHasMore =
        perPageInput === false ? false : safeOffset + safeLimit < total;

      const threadIdSet = new Set(threadIds);
      const mainThreadMessageCount = messages.filter(msg => msg.threadId !== undefined && threadIdSet.has(msg.threadId)).length;
      const hasMore =
        include && include.length
          ? mainThreadMessageCount >= total
            ? false
            : baseHasMore
          : baseHasMore;

      return {
        messages,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MYSQL_MEMORY_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
            resourceId: resourceId ?? '',
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return { messages: [], total: 0, page, perPage, hasMore: false };
    }
  }

  public async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    if (!resourceId || typeof resourceId !== 'string' || resourceId.trim().length === 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_MESSAGES', 'INVALID_QUERY'),
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
          id: createStorageErrorId('MYSQL', 'LIST_MESSAGES', 'INVALID_PAGE'),
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
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      const conditions: string[] = [];
      const params: any[] = [];

      conditions.push(`${quoteIdentifier('resourceId', 'column name')} = ?`);
      params.push(resourceId);

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`${quoteIdentifier('createdAt', 'column name')} ${startOp} ?`);
        params.push(transformToSqlValue(filter.dateRange.start));
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`${quoteIdentifier('createdAt', 'column name')} ${endOp} ?`);
        params.push(transformToSqlValue(filter.dateRange.end));
      }

      const whereSql = `WHERE ${conditions.join(' AND ')}`;
      const tableName = formatTableName(TABLE_MESSAGES);

      const [countRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereSql}`,
        params,
      );
      const total = Number(countRows[0]?.count ?? 0);

      if (total === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;

      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT id, thread_id, content, role, type, createdAt, resourceId FROM ${tableName} ${whereSql} ORDER BY ${quoteIdentifier(field, 'column name')} ${direction} LIMIT ${Number(limitValue)} OFFSET ${Number(offset)}`,
        params,
      );
      const messages: MastraDBMessage[] = (rows as unknown as MessageRow[]).map(row => this.mapMessage(row));

      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        // For listMessagesByResourceId, resolve threadId for include items that don't have one
        const resolvedInclude = await Promise.all(
          include.map(async inc => {
            if (inc.threadId) return inc;
            // Look up the message's thread_id
            const [msgRows] = await this.pool.execute<RowDataPacket[]>(
              `SELECT thread_id FROM ${tableName} WHERE id = ? LIMIT 1`,
              [inc.id],
            );
            const threadId = msgRows?.[0]?.thread_id as string | undefined;
            return threadId ? { ...inc, threadId } : inc;
          }),
        );
        const validInclude = resolvedInclude.filter(inc => inc.threadId);
        if (validInclude.length > 0) {
          const messagesByThread = new Map<string, MastraDBMessage[]>();
          const includeMessages = await this.collectIncludeMessages({
            threadId: validInclude[0]!.threadId!,
            include: validInclude,
            messagesByThread,
          });
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      const list = new MessageList().add(messages, 'memory');
      let finalMessages = list.get.all.db();

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
          id: createStorageErrorId('MYSQL', 'LIST_MESSAGES', 'FAILED'),
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

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const row = await this.operations.load<ResourceRow>({
        tableName: TABLE_RESOURCES,
        keys: { id: resourceId },
      });
      if (!row) return null;

      const parsedMetadata =
        typeof row.metadata === 'string'
          ? parseJSON<Record<string, unknown>>(row.metadata)
          : (row.metadata as Record<string, unknown> | null | undefined);

      return {
        id: row.id,
        workingMemory: row.workingMemory ?? undefined,
        metadata: parsedMetadata ?? undefined,
        createdAt: parseDateTime(row.createdAt) ?? new Date(),
        updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
      } satisfies StorageResourceType;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_GET_RESOURCE_FAILED',
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
      const metadataValue =
        resource.metadata === undefined || resource.metadata === null
          ? null
          : JSON.stringify(resource.metadata);
      await this.operations.insert({
        tableName: TABLE_RESOURCES,
        record: {
          id: resource.id,
          workingMemory: resource.workingMemory ?? null,
          metadata: metadataValue,
          createdAt: resource.createdAt ?? new Date(),
          updatedAt: resource.updatedAt ?? new Date(),
        },
      });
      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_SAVE_RESOURCE_FAILED',
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
      const existing = await this.getResourceById({ resourceId });

      if (!existing) {
        // Create new resource if not exists
        const newResource: StorageResourceType = {
          id: resourceId,
          workingMemory: workingMemory ?? '',
          metadata: metadata ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return await this.saveResource({ resource: newResource });
      }

      const mergedMetadata =
        metadata !== undefined ? { ...(existing.metadata ?? {}), ...(metadata ?? {}) } : existing.metadata;
      const metadataValue =
        metadata !== undefined ? (metadata === null ? null : JSON.stringify(mergedMetadata ?? {})) : undefined;

      await this.operations.update({
        tableName: TABLE_RESOURCES,
        keys: { id: resourceId },
        data: {
          ...(workingMemory !== undefined ? { workingMemory } : {}),
          ...(metadataValue !== undefined ? { metadata: metadataValue } : {}),
          updatedAt: new Date(),
        },
      });
      const updated = await this.getResourceById({ resourceId });
      if (!updated) {
        throw new Error(`Resource ${resourceId} not found after update`);
      }
      return updated;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_UPDATE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  // ============================================
  // Observational Memory Methods
  // ============================================

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ? ORDER BY ${omCol('generationCount')} DESC LIMIT 1`,
        [lookupKey],
      );
      if (!rows || rows.length === 0) return null;
      return this.parseOMRow(rows[0]);
    } catch (error) {
      rethrowOrWrapOM(error, '', 'GET_OBSERVATIONAL_MEMORY', { threadId, resourceId });
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit: number = 10,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const safeLimit = Math.max(1, Math.floor(Number(limit)) || 10);
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ? ORDER BY ${omCol('generationCount')} DESC LIMIT ?`,
        [lookupKey, String(safeLimit)],
      );
      if (!rows) return [];
      return rows.map(row => this.parseOMRow(row));
    } catch (error) {
      rethrowOrWrapOM(error, '', 'GET_OBSERVATIONAL_MEMORY_HISTORY', { threadId, resourceId, limit });
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

      const nowSql = transformToSqlValue(now);
      const cols = [
        'id', 'lookupKey', 'scope', 'resourceId', 'threadId',
        'activeObservations', 'activeObservationsPendingUpdate',
        'originType', 'config', 'generationCount', 'lastObservedAt', 'lastReflectionAt',
        'pendingMessageTokens', 'totalTokensObserved', 'observationTokenCount',
        'isObserving', 'isReflecting', 'isBufferingObservation', 'isBufferingReflection', 'lastBufferedAtTokens', 'lastBufferedAtTime',
        'observedTimezone', 'createdAt', 'updatedAt',
      ].map(omCol).join(', ');
      const placeholders = Array.from({ length: 24 }, () => '?').join(', ');

      await this.pool.execute(
        `INSERT INTO ${OM_TABLE_QUOTED} (${cols}) VALUES (${placeholders})`,
        [
          id, lookupKey, input.scope, input.resourceId, input.threadId || null,
          '', null, 'initial', JSON.stringify(input.config), 0, null, null,
          0, 0, 0, false, false, false, false, 0, null,
          input.observedTimezone || null, nowSql, nowSql,
        ],
      );

      return record;
    } catch (error) {
      rethrowOrWrapOM(error, '', 'INITIALIZE_OBSERVATIONAL_MEMORY', { threadId: input.threadId, resourceId: input.resourceId });
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    try {
      const now = new Date();
      const observedMessageIdsJson = input.observedMessageIds ? JSON.stringify(input.observedMessageIds) : null;

      const [result] = await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET
          ${omCol('activeObservations')} = ?,
          ${omCol('lastObservedAt')} = ?,
          ${omCol('pendingMessageTokens')} = 0,
          ${omCol('observationTokenCount')} = ?,
          ${omCol('totalTokensObserved')} = ${omCol('totalTokensObserved')} + ?,
          ${omCol('observedMessageIds')} = ?,
          ${omCol('updatedAt')} = ?
        WHERE ${omCol('id')} = ?`,
        [
          input.observations,
          transformToSqlValue(input.lastObservedAt),
          input.tokenCount,
          input.tokenCount,
          observedMessageIdsJson,
          transformToSqlValue(now),
          input.id,
        ],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        throwOMNotFound(input.id, 'UPDATE_ACTIVE_OBSERVATIONS');
      }
    } catch (error) {
      rethrowOrWrapOM(error, input.id, 'UPDATE_ACTIVE_OBSERVATIONS');
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

      const nowSql = transformToSqlValue(now);
      const cols = [
        'id', 'lookupKey', 'scope', 'resourceId', 'threadId',
        'activeObservations', 'activeObservationsPendingUpdate',
        'originType', 'config', 'generationCount', 'lastObservedAt', 'lastReflectionAt',
        'pendingMessageTokens', 'totalTokensObserved', 'observationTokenCount',
        'isObserving', 'isReflecting', 'isBufferingObservation', 'isBufferingReflection', 'lastBufferedAtTokens', 'lastBufferedAtTime',
        'observedTimezone', 'createdAt', 'updatedAt',
      ].map(omCol).join(', ');
      const placeholders = Array.from({ length: 24 }, () => '?').join(', ');

      await this.pool.execute(
        `INSERT INTO ${OM_TABLE_QUOTED} (${cols}) VALUES (${placeholders})`,
        [
          id, lookupKey, record.scope, record.resourceId, record.threadId || null,
          input.reflection, null, 'reflection', JSON.stringify(record.config),
          input.currentRecord.generationCount + 1,
          record.lastObservedAt ? transformToSqlValue(record.lastObservedAt) : null, nowSql,
          record.pendingMessageTokens, record.totalTokensObserved, record.observationTokenCount,
          false, false, false, false, 0, null,
          record.observedTimezone || null, nowSql, nowSql,
        ],
      );

      return record;
    } catch (error) {
      rethrowOrWrapOM(error, input.currentRecord.id, 'CREATE_REFLECTION_GENERATION', { currentRecordId: input.currentRecord.id });
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    await this.updateOMFlag(id, 'isReflecting', isReflecting, 'SET_REFLECTING_FLAG');
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    await this.updateOMFlag(id, 'isObserving', isObserving, 'SET_OBSERVING_FLAG');
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    try {
      const nowSql = transformToSqlValue(new Date());
      const sets = [
        `${omCol('isBufferingObservation')} = ?`,
        ...(lastBufferedAtTokens !== undefined ? [`${omCol('lastBufferedAtTokens')} = ?`] : []),
        `${omCol('updatedAt')} = ?`,
      ].join(', ');
      const params = [
        isBuffering,
        ...(lastBufferedAtTokens !== undefined ? [lastBufferedAtTokens] : []),
        nowSql,
        id,
      ];

      const [result] = await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET ${sets} WHERE ${omCol('id')} = ?`,
        params,
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        throwOMNotFound(id, 'SET_BUFFERING_OBSERVATION_FLAG');
      }
    } catch (error) {
      rethrowOrWrapOM(error, id, 'SET_BUFFERING_OBSERVATION_FLAG');
    }
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    await this.updateOMFlag(id, 'isBufferingReflection', isBuffering, 'SET_BUFFERING_REFLECTION_FLAG');
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      await this.pool.execute(
        `DELETE FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ?`,
        [lookupKey],
      );
    } catch (error) {
      rethrowOrWrapOM(error, '', 'CLEAR_OBSERVATIONAL_MEMORY', { threadId, resourceId });
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    try {
      const [result] = await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET
          ${omCol('pendingMessageTokens')} = ?,
          ${omCol('updatedAt')} = ?
        WHERE ${omCol('id')} = ?`,
        [tokenCount, transformToSqlValue(new Date()), id],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        throwOMNotFound(id, 'SET_PENDING_MESSAGE_TOKENS');
      }
    } catch (error) {
      rethrowOrWrapOM(error, id, 'SET_PENDING_MESSAGE_TOKENS');
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    try {
      const nowSql = transformToSqlValue(new Date());

      const [currentRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ${omCol('bufferedObservationChunks')} FROM ${OM_TABLE_QUOTED} WHERE ${omCol('id')} = ?`,
        [input.id],
      );

      if (!currentRows || currentRows.length === 0) {
        throwOMNotFound(input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
      }

      const existingChunks = parseBufferedChunks(currentRows[0]!.bufferedObservationChunks);

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
      const lastBufferedAtTime = input.lastBufferedAtTime ? transformToSqlValue(input.lastBufferedAtTime) : null;

      const [result] = await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET
          ${omCol('bufferedObservationChunks')} = ?,
          ${omCol('lastBufferedAtTime')} = COALESCE(?, ${omCol('lastBufferedAtTime')}),
          ${omCol('updatedAt')} = ?
        WHERE ${omCol('id')} = ?`,
        [JSON.stringify(newChunks), lastBufferedAtTime, nowSql, input.id],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        throwOMNotFound(input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
      }
    } catch (error) {
      rethrowOrWrapOM(error, input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      const nowSql = transformToSqlValue(new Date());

      const [currentRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${omCol('id')} = ?`,
        [input.id],
      );

      if (!currentRows || currentRows.length === 0) {
        throwOMNotFound(input.id, 'SWAP_BUFFERED_TO_ACTIVE');
      }

      const row = currentRows[0]!;
      const chunks = parseBufferedChunks(row.bufferedObservationChunks);

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

      // Calculate target message tokens to activate
      const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
      const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

      // Find the closest chunk boundary to the target
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

      // Split chunks
      const activatedChunks = chunks.slice(0, chunksToActivate);
      const remainingChunks = chunks.slice(chunksToActivate);

      // Combine activated observations
      const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
      const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
      const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
      const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
      const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((cid): cid is string => !!cid);
      const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

      // Derive lastObservedAt from the latest activated chunk
      const latestChunk = activatedChunks[activatedChunks.length - 1];
      const lastObservedAt =
        input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
      const lastObservedAtSql = transformToSqlValue(lastObservedAt);

      // Get existing values
      const existingActive = (row.activeObservations as string) || '';
      const existingTokenCount = Number(row.observationTokenCount || 0);

      // Calculate new values
      const newActive = existingActive ? `${existingActive}\n\n${activatedContent}` : activatedContent;
      const newTokenCount = existingTokenCount + activatedTokens;

      // Decrement pending message tokens (clamped to zero)
      const existingPending = Number(row.pendingMessageTokens || 0);
      const newPending = Math.max(0, existingPending - activatedMessageTokens);

      await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET
          ${omCol('activeObservations')} = ?,
          ${omCol('observationTokenCount')} = ?,
          ${omCol('pendingMessageTokens')} = ?,
          ${omCol('bufferedObservationChunks')} = ?,
          ${omCol('lastObservedAt')} = ?,
          ${omCol('updatedAt')} = ?
        WHERE ${omCol('id')} = ?`,
        [
          newActive,
          newTokenCount,
          newPending,
          remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null,
          lastObservedAtSql,
          nowSql,
          input.id,
        ],
      );

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
      rethrowOrWrapOM(error, input.id, 'SWAP_BUFFERED_TO_ACTIVE');
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    try {
      const nowSql = transformToSqlValue(new Date());
      const br = omCol('bufferedReflection');

      const [result] = await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET
          ${br} = CASE
            WHEN ${br} IS NOT NULL AND ${br} != ''
            THEN CONCAT(${br}, CHAR(10), CHAR(10), ?)
            ELSE ?
          END,
          ${omCol('bufferedReflectionTokens')} = COALESCE(${omCol('bufferedReflectionTokens')}, 0) + ?,
          ${omCol('bufferedReflectionInputTokens')} = COALESCE(${omCol('bufferedReflectionInputTokens')}, 0) + ?,
          ${omCol('reflectedObservationLineCount')} = ?,
          ${omCol('updatedAt')} = ?
        WHERE ${omCol('id')} = ?`,
        [
          input.reflection,
          input.reflection,
          input.tokenCount,
          input.inputTokenCount,
          input.reflectedObservationLineCount,
          nowSql,
          input.id,
        ],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        throwOMNotFound(input.id, 'UPDATE_BUFFERED_REFLECTION');
      }
    } catch (error) {
      rethrowOrWrapOM(error, input.id, 'UPDATE_BUFFERED_REFLECTION');
    }
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    try {
      const [currentRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${omCol('id')} = ?`,
        [input.currentRecord.id],
      );

      if (!currentRows || currentRows.length === 0) {
        throwOMNotFound(input.currentRecord.id, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE');
      }

      const row = currentRows[0]!;
      const bufferedReflection = (row.bufferedReflection as string) || '';
      const reflectedLineCount = Number(row.reflectedObservationLineCount || 0);

      if (!bufferedReflection) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
          text: 'No buffered reflection to swap',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: input.currentRecord.id },
        });
      }

      const currentObservations = (row.activeObservations as string) || '';
      const unreflectedContent = currentObservations.split('\n').slice(reflectedLineCount).join('\n').trim();

      const newObservations = unreflectedContent
        ? `${bufferedReflection}\n\n${unreflectedContent}`
        : bufferedReflection;

      const newRecord = await this.createReflectionGeneration({
        currentRecord: input.currentRecord,
        reflection: newObservations,
        tokenCount: input.tokenCount,
      });

      const nowSql = transformToSqlValue(new Date());
      await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET
          ${omCol('bufferedReflection')} = NULL,
          ${omCol('bufferedReflectionTokens')} = NULL,
          ${omCol('bufferedReflectionInputTokens')} = NULL,
          ${omCol('reflectedObservationLineCount')} = NULL,
          ${omCol('updatedAt')} = ?
        WHERE ${omCol('id')} = ?`,
        [nowSql, input.currentRecord.id],
      );

      return newRecord;
    } catch (error) {
      rethrowOrWrapOM(error, input.currentRecord.id, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE');
    }
  }

  private async updateOMFlag(id: string, column: string, value: boolean, operation: string): Promise<void> {
    try {
      const [result] = await this.pool.execute(
        `UPDATE ${OM_TABLE_QUOTED} SET ${omCol(column)} = ?, ${omCol('updatedAt')} = ? WHERE ${omCol('id')} = ?`,
        [value, transformToSqlValue(new Date()), id],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        throwOMNotFound(id, operation);
      }
    } catch (error) {
      rethrowOrWrapOM(error, id, operation);
    }
  }

  private getOMKey(threadId: string | null, resourceId: string): string {
    return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
  }

  private parseOMRow(row: any): ObservationalMemoryRecord {
    return {
      id: row.id,
      scope: row.scope,
      threadId: row.threadId || null,
      resourceId: row.resourceId,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
      lastObservedAt: row.lastObservedAt ? parseDateTime(row.lastObservedAt) : undefined,
      originType: row.originType || 'initial',
      generationCount: Number(row.generationCount || 0),
      activeObservations: row.activeObservations || '',
      bufferedObservationChunks: parseJSONColumn<BufferedObservationChunk[]>(row.bufferedObservationChunks),
      bufferedObservations: row.activeObservationsPendingUpdate || undefined,
      bufferedObservationTokens: row.bufferedObservationTokens ? Number(row.bufferedObservationTokens) : undefined,
      bufferedMessageIds: undefined,
      bufferedReflection: row.bufferedReflection || undefined,
      bufferedReflectionTokens: row.bufferedReflectionTokens ? Number(row.bufferedReflectionTokens) : undefined,
      bufferedReflectionInputTokens: row.bufferedReflectionInputTokens ? Number(row.bufferedReflectionInputTokens) : undefined,
      reflectedObservationLineCount: row.reflectedObservationLineCount ? Number(row.reflectedObservationLineCount) : undefined,
      totalTokensObserved: Number(row.totalTokensObserved || 0),
      observationTokenCount: Number(row.observationTokenCount || 0),
      pendingMessageTokens: Number(row.pendingMessageTokens || 0),
      isReflecting: parseMySQLBool(row.isReflecting),
      isObserving: parseMySQLBool(row.isObserving),
      isBufferingObservation: parseMySQLBool(row.isBufferingObservation),
      isBufferingReflection: parseMySQLBool(row.isBufferingReflection),
      lastBufferedAtTokens: typeof row.lastBufferedAtTokens === 'number' ? row.lastBufferedAtTokens : parseInt(String(row.lastBufferedAtTokens ?? '0'), 10) || 0,
      lastBufferedAtTime: row.lastBufferedAtTime ? parseDateTime(row.lastBufferedAtTime) ?? null : null,
      config: parseJSONColumn(row.config) ?? {},
      metadata: parseJSONColumn(row.metadata),
      observedMessageIds: parseJSONColumn<string[]>(row.observedMessageIds),
      observedTimezone: row.observedTimezone || undefined,
    };
  }
}
