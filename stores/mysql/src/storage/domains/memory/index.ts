import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  OBSERVATIONAL_MEMORY_TABLE_SCHEMA,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
  calculatePagination,
  normalizePerPage,
  validateStorageMetadataFilter,
  createStorageErrorId,
  getObservationalMemoryGeneration0Id,
  isAppendOnlySince,
  isBufferedChunkCoveredByCursor,
  maxObservationCursor,
  planReflectionGenerationText,
} from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  CreateIndexOptions,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  PaginationArgs,
  PaginationInfo,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageMetadataFilter,
  StorageResourceType,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  ThreadCloneMetadata,
  ThreadSortOptions,
  UpdateActiveObservationsInput,
  UpdateActiveObservationsResult,
  UpdateBufferedObservationsInput,
  UpdateBufferedObservationsResult,
  UpdateBufferedReflectionInput,
} from '@mastra/core/storage';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { indexKey } from '../../db/schema-snapshot';
import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL, generateIndexSQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier, transformToSqlValue } from '../utils';

const OM_TABLE = 'mastra_observational_memory' as const;
const OM_TABLE_QUOTED = quoteIdentifier(OM_TABLE, 'table name');

/** Canonical head order: newest generation, then earliest createdAt, then lowest id. */
const OM_HEAD_ORDER = `${quoteIdentifier('generationCount', 'column name')} DESC, ${quoteIdentifier('createdAt', 'column name')} ASC, ${quoteIdentifier('id', 'column name')} ASC`;
/** Max `supersededBy` hops when redirecting a write aimed at a retired record. */
const OM_MAX_HEAD_HOPS = 3;
/** Attempts for an OM transaction that hits a deadlock or lock-wait timeout. */
const OM_MAX_TRANSACTION_ATTEMPTS = 3;

/** ER_LOCK_DEADLOCK (1213) or ER_LOCK_WAIT_TIMEOUT (1205): the transaction was rolled back and can be retried. */
function isRetryableLockError(error: unknown): boolean {
  const errno = (error as { errno?: number } | null)?.errno;
  return errno === 1213 || errno === 1205;
}

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

function addMySQLMessageMetadataFilter(
  conditions: string[],
  params: any[],
  metadataFilter: StorageMetadataFilter | undefined,
): void {
  if (!metadataFilter) return;

  for (const [key, value] of Object.entries(metadataFilter)) {
    const path = `$.metadata.${key}`;
    conditions.push(`JSON_VALID(${quoteIdentifier('content', 'column name')})`);
    conditions.push(`JSON_CONTAINS_PATH(${quoteIdentifier('content', 'column name')}, 'one', ?)`);
    params.push(path);
    if (value === null) {
      conditions.push(`JSON_TYPE(JSON_EXTRACT(${quoteIdentifier('content', 'column name')}, ?)) = 'NULL'`);
      params.push(path);
    } else {
      conditions.push(`JSON_EXTRACT(${quoteIdentifier('content', 'column name')}, ?) = CAST(? AS JSON)`);
      params.push(path, JSON.stringify(value));
    }
  }
}

export class MemoryMySQL extends MemoryStorage {
  override readonly supportsPartialThreadUpdate = true;
  readonly supportsObservationalMemory = true;
  readonly supportsObservationalMemoryHistorySearch = true;

  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES] as const;

  constructor({
    pool,
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    pool: Pool;
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (MemoryMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.operations.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.operations.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });

    // Static import — `await import('@mastra/core/storage')` deadlocks
    // `mastra build` output: bundlers rewrite the dynamic import to point at
    // the entry chunk that statically depends on this file, so the cycle never
    // resolves when storage initializes during module evaluation (#18298). The
    // peerDependency on `@mastra/core` is already `>=1.42.1` (the version that
    // introduced `OBSERVATIONAL_MEMORY_TABLE_SCHEMA`), so the older-core compat
    // the dynamic import was guarding against can no longer occur via npm
    // resolution.
    const omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];

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
          'supersededBy',
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
      // Create index on lookupKey for efficient OM queries. Consult the
      // init-scoped snapshot (held by the operations domain) first so a warm
      // boot does not re-issue DDL that is doomed to fail; the errno-1061
      // swallow below stays as the concurrent-boot safety net.
      const snapshot = this.operations.getInitSchemaSnapshot();
      if (!snapshot?.indexes.has(indexKey(OM_TABLE, 'idx_om_lookup_key'))) {
        // MySQL does not support CREATE INDEX IF NOT EXISTS, so catch ER_DUP_KEYNAME (errno 1061)
        try {
          await this.pool.execute(
            `CREATE INDEX idx_om_lookup_key ON ${OM_TABLE_QUOTED} (${quoteIdentifier('lookupKey', 'column name')}(191))`,
          );
          snapshot?.indexes.add(indexKey(OM_TABLE, 'idx_om_lookup_key'));
        } catch (err: any) {
          if (err?.errno !== 1061) {
            throw err;
          }
        }
      }
    }

    if (omSchema) {
      await this.backfillSupersededBy();
    }

    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}mastra_threads_resourceid_createdat_idx`,
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt DESC'],
      },
      {
        name: `${prefix}mastra_messages_thread_id_createdat_idx`,
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt DESC'],
      },
    ];
  }

  static getExportDDL(): string[] {
    const statements: string[] = [];

    for (const tableName of [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES] as const) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
        }),
      );
    }

    for (const idx of MemoryMySQL.getDefaultIndexDefs()) {
      statements.push(generateIndexSQL(idx));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return MemoryMySQL.getDefaultIndexDefs('');
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
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
    content = row.content as MastraMessageContentV2;
    if (typeof row.content === 'string') {
      try {
        content = JSON.parse(row.content) as MastraMessageContentV2;
      } catch {
        // Wrap legacy v1 string content into v2 shape
        content = {
          format: 2,
          parts: [{ type: 'text', text: row.content } as any],
          content: row.content,
        } as MastraMessageContentV2;
      }
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

  /**
   * Loads a thread's messages in chronological order.
   *
   * @param threadId - Thread to read.
   * @param limit - Optional cap on the number of rows.
   * @param resourceId - When set, returns only the rows owned by that resource.
   */
  private async fetchMessagesForThread(threadId: string, limit?: number, resourceId?: string): Promise<MessageRow[]> {
    const resourceCondition = resourceId ? ` AND ${quoteIdentifier('resourceId', 'column name')} = ?` : '';
    let sql = `SELECT id, thread_id, content, role, type, createdAt, resourceId FROM ${formatTableName(TABLE_MESSAGES)} WHERE ${quoteIdentifier('thread_id', 'column name')} = ?${resourceCondition} ORDER BY ${quoteIdentifier('createdAt', 'column name')} ASC`;
    const params: any[] = resourceId ? [threadId, resourceId] : [threadId];
    if (limit && limit > 0) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as unknown as MessageRow[];
  }

  /**
   * Fetches included messages by ID, discovering their thread automatically.
   * This handles cross-thread includes where the include item doesn't specify a threadId.
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
  }): Promise<MessageRow[] | null> {
    if (!include || include.length === 0) return null;

    const tableName = formatTableName(TABLE_MESSAGES);
    const selectColumns = `id, thread_id, content, role, type, createdAt, resourceId`;
    const resourceCondition = resourceId ? ` AND m.${quoteIdentifier('resourceId', 'column name')} = ?` : '';

    // Phase 1: Batch-fetch metadata for all target messages
    const targetIds = include.map(inc => inc.id).filter(Boolean);
    if (targetIds.length === 0) return null;

    const idPlaceholders = targetIds.map(() => '?').join(', ');
    const [targetRows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, thread_id, createdAt FROM ${tableName} WHERE id IN (${idPlaceholders})${
        resourceId ? ` AND ${quoteIdentifier('resourceId', 'column name')} = ?` : ''
      }`,
      resourceId ? [...targetIds, resourceId] : targetIds,
    );

    if (!targetRows || targetRows.length === 0) return null;

    const targetMap = new Map(targetRows.map(r => [r.id, { threadId: r.thread_id, createdAt: r.createdAt }]));

    // Phase 2: Build UNION queries for each include item
    const unionQueries: string[] = [];
    const params: any[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      const target = targetMap.get(id);
      if (!target) continue;

      // Validate LIMIT values are safe integers
      const prevLimit = Math.max(0, Math.floor(withPreviousMessages + 1));
      const nextLimit = Math.max(0, Math.floor(withNextMessages));

      // Fetch the target message plus previous messages
      unionQueries.push(`(
        SELECT ${selectColumns}
        FROM ${tableName} m
        WHERE m.thread_id = ?
          AND m.createdAt <= ?${resourceCondition}
        ORDER BY m.createdAt DESC, m.id DESC
        LIMIT ${prevLimit}
      )`);
      params.push(target.threadId, target.createdAt);
      if (resourceId) params.push(resourceId);

      // Fetch messages after the target (only if requested)
      if (nextLimit > 0) {
        unionQueries.push(`(
          SELECT ${selectColumns}
          FROM ${tableName} m
          WHERE m.thread_id = ?
            AND m.createdAt > ?${resourceCondition}
          ORDER BY m.createdAt ASC, m.id ASC
          LIMIT ${nextLimit}
        )`);
        params.push(target.threadId, target.createdAt);
        if (resourceId) params.push(resourceId);
      }
    }

    if (unionQueries.length === 0) return null;

    // Combine queries with UNION ALL and sort
    const finalQuery = `SELECT * FROM (${unionQueries.join(' UNION ALL ')}) AS combined ORDER BY createdAt ASC, id ASC`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(finalQuery, params);

    return rows as unknown as MessageRow[];
  }

  /**
   * Resolves include items against loaded threads, adding each pinned message and its
   * before/after window.
   *
   * @param threadId - Thread used when an include item names no thread of its own.
   * @param include - Message ids to pin, each with an optional before/after window.
   * @param messagesByThread - Cache of thread snapshots, reused and filled as threads load.
   * @param resourceId - When set, restricts both the pinned messages and their context
   * to that resource so an id from another resource returns nothing.
   */
  private async collectIncludeMessages({
    threadId,
    include,
    messagesByThread,
    resourceId,
  }: {
    threadId: string;
    include?: StorageListMessagesInput['include'];
    messagesByThread: Map<string, MastraDBMessage[]>;
    resourceId?: string;
  }): Promise<MastraDBMessage[]> {
    if (!include?.length) return [];

    const includeMessages: MastraDBMessage[] = [];
    const seenIds = new Set<string>();
    const unresolvedIds = include.filter(inc => !inc.threadId).map(inc => inc.id);
    const resolvedThreadIds = new Map<string, string>();

    if (unresolvedIds.length > 0) {
      const placeholders = unresolvedIds.map(() => '?').join(', ');
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT id, thread_id FROM ${formatTableName(TABLE_MESSAGES)} WHERE id IN (${placeholders})${
          resourceId ? ` AND ${quoteIdentifier('resourceId', 'column name')} = ?` : ''
        }`,
        resourceId ? [...unresolvedIds, resourceId] : unresolvedIds,
      );
      for (const row of rows) {
        resolvedThreadIds.set(row.id, row.thread_id);
      }
    }

    for (const inc of include) {
      const targetThreadId = inc.threadId ?? resolvedThreadIds.get(inc.id) ?? threadId;

      let threadMessages = messagesByThread.get(targetThreadId);
      if (!threadMessages) {
        const rows = await this.fetchMessagesForThread(targetThreadId, undefined, resourceId);
        threadMessages = rows.map(row => this.mapMessage(row));
        messagesByThread.set(targetThreadId, threadMessages);
      }

      // If the current cached set might be partial (e.g., paginated main thread), reload full thread
      const needsContext =
        !threadMessages.some(message => message.id === inc.id) ||
        (inc.withPreviousMessages ?? 0) > 0 ||
        (inc.withNextMessages ?? 0) > 0 ||
        threadMessages.length < (inc.withNextMessages ?? 0) + (inc.withPreviousMessages ?? 0) + 1;
      if (needsContext) {
        const rows = await this.fetchMessagesForThread(targetThreadId, undefined, resourceId);
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

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    try {
      let sql = `SELECT * FROM ${formatTableName(TABLE_THREADS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`;
      const params: any[] = [threadId];

      if (resourceId !== undefined) {
        sql += ` AND ${quoteIdentifier('resourceId', 'column name')} = ?`;
        params.push(resourceId);
      }

      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
      const row = rows[0];
      return row ? this.mapThread(row as ThreadRow) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_MEMORY_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, ...(resourceId !== undefined && { resourceId }) },
        },
        error,
      );
    }
  }

  /**
   * Atomically reassign a thread and all of its messages to a different resource.
   *
   * Runs inside a single transaction and takes a `SELECT ... FOR UPDATE` row lock on the
   * thread, so overlapping transfers of the same thread serialize and can never interleave
   * the thread update with the message update. Either both the thread and every message move
   * to the new resource, or neither does — there is no split-ownership window. The thread's
   * `createdAt` is preserved. Callers are responsible for authorizing the reassignment.
   */
  async updateThreadResourceId({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId: string;
  }): Promise<StorageThreadType> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Lock the thread row for the duration of the transaction. Concurrent transfers of the
      // same thread block here until this transaction commits, so they cannot interleave.
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_THREADS)} WHERE ${quoteIdentifier('id', 'column name')} = ? FOR UPDATE`,
        [threadId],
      );
      const row = rows[0];
      if (!row) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_THREAD_RESOURCE_ID', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Thread "${threadId}" not found`,
          details: { threadId },
        });
      }

      const thread = this.mapThread(row as ThreadRow);

      if (thread.resourceId === resourceId) {
        await connection.commit();
        return thread;
      }

      const updatedAt = new Date();
      await connection.execute(
        `UPDATE ${formatTableName(TABLE_THREADS)} SET ${quoteIdentifier('resourceId', 'column name')} = ?, ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [resourceId, transformToSqlValue(updatedAt), threadId],
      );
      await connection.execute(
        `UPDATE ${formatTableName(TABLE_MESSAGES)} SET ${quoteIdentifier('resourceId', 'column name')} = ? WHERE ${quoteIdentifier('thread_id', 'column name')} = ?`,
        [resourceId, threadId],
      );

      await connection.commit();
      return { ...thread, resourceId, updatedAt };
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'UPDATE_THREAD_RESOURCE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    } finally {
      connection.release();
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

    const whereClause =
      conditions.length > 0 ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: params } : { sql: '', args: [] };

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
      // Re-throw USER errors (validation errors) directly so callers get proper 400 responses
      if (error instanceof MastraError && error.category === ErrorCategory.USER) {
        throw error;
      }
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { filter: JSON.stringify(filter ?? {}) },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      throw mastraError;
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
      page: args.page as number | undefined,
      perPage: args.perPage as number | false | undefined,
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
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    try {
      const existing = await this.getThreadById({ threadId: id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_THREAD', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Thread ${id} not found`,
          details: { threadId: id },
        });
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
          title: title ?? existing.title,
          metadata: JSON.stringify(mergedMetadata),
          updatedAt,
        },
      });

      return {
        ...existing,
        title: title ?? existing.title,
        metadata: mergedMetadata,
        updatedAt,
      } satisfies StorageThreadType;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
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
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'SAVE_MESSAGES', 'INVALID_INPUT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Thread ID is required',
          details: { messageId: message.id ?? null },
        });
      }
      threadIds.add(message.threadId);
      if (!message.resourceId) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'SAVE_MESSAGES', 'INVALID_INPUT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
          details: { messageId: message.id ?? null, threadId: message.threadId },
        });
      }
    }

    for (const threadId of threadIds) {
      const existingThread = await this.getThreadById({ threadId });
      if (!existingThread) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'SAVE_MESSAGES', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Thread ${threadId} not found`,
          details: { threadId },
        });
      }
    }

    const connection = await this.pool.getConnection();
    const affectedThreads = new Map<string, Date>();
    const insertedIds: string[] = [];

    try {
      await connection.beginTransaction();

      for (const message of messages) {
        if (!message.threadId) {
          throw new MastraError({
            id: createStorageErrorId('MYSQL', 'SAVE_MESSAGES', 'INVALID_INPUT'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: 'Message must have threadId',
            details: { messageId: message.id ?? null },
          });
        }
        const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();
        const id = message.id ?? globalThis.crypto.randomUUID();
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
      if (error instanceof MastraError) {
        throw error;
      }
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
    const ordered = insertedIds.map(id => persisted.find(msg => msg.id === id)).filter(Boolean) as MastraDBMessage[];
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

        if (Object.keys(data).length === 0) {
          continue;
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

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    // Get the source thread
    const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
    if (!sourceThread) {
      throw new MastraError({
        id: createStorageErrorId('MYSQL', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }

    // Use provided ID or generate a new one
    const newThreadId = providedThreadId || globalThis.crypto.randomUUID();

    // Check if the new thread ID already exists
    const existingThread = await this.getThreadById({ threadId: newThreadId });
    if (existingThread) {
      throw new MastraError({
        id: createStorageErrorId('MYSQL', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Build message query with filters
      let messageQuery = `SELECT id, thread_id, content, role, type, createdAt, resourceId
                          FROM ${formatTableName(TABLE_MESSAGES)} WHERE thread_id = ?`;
      const messageParams: any[] = [sourceThreadId];

      // Apply date filters
      if (options?.messageFilter?.startDate) {
        messageQuery += ` AND createdAt >= ?`;
        messageParams.push(transformToSqlValue(options.messageFilter.startDate));
      }
      if (options?.messageFilter?.endDate) {
        messageQuery += ` AND createdAt <= ?`;
        messageParams.push(transformToSqlValue(options.messageFilter.endDate));
      }

      // Apply message ID filter
      if (options?.messageFilter?.messageIds && options.messageFilter.messageIds.length > 0) {
        const placeholders = options.messageFilter.messageIds.map(() => '?').join(', ');
        messageQuery += ` AND id IN (${placeholders})`;
        messageParams.push(...options.messageFilter.messageIds);
      }

      messageQuery += ` ORDER BY createdAt ASC`;

      // Apply message limit (from most recent, so we need to reverse order for limit then sort back)
      if (options?.messageLimit && options.messageLimit > 0) {
        const limitQuery = `SELECT * FROM (${messageQuery.replace('ORDER BY createdAt ASC', 'ORDER BY createdAt DESC')} LIMIT ?) AS limited ORDER BY createdAt ASC`;
        messageParams.push(options.messageLimit);
        messageQuery = limitQuery;
      }

      const [sourceMessageRows] = await connection.execute<RowDataPacket[]>(messageQuery, messageParams);

      const now = new Date();

      // Determine the last message ID for clone metadata
      const lastMessageId =
        sourceMessageRows.length > 0 ? (sourceMessageRows[sourceMessageRows.length - 1] as any).id : undefined;

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

      // Insert the new thread
      await connection.execute(
        `INSERT INTO ${formatTableName(TABLE_THREADS)} (id, resourceId, title, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newThread.id,
          newThread.resourceId,
          newThread.title,
          newThread.metadata ? JSON.stringify(newThread.metadata) : null,
          transformToSqlValue(now),
          transformToSqlValue(now),
        ],
      );

      // Clone messages with new IDs
      const clonedMessages: MastraDBMessage[] = [];
      const messageIdMap: Record<string, string> = {};
      const targetResourceId = resourceId || sourceThread.resourceId;

      for (const sourceRow of sourceMessageRows) {
        const row = sourceRow as MessageRow;
        const newMessageId = globalThis.crypto.randomUUID();
        messageIdMap[row.id] = newMessageId;

        let content = row.content;
        try {
          content = typeof content === 'string' ? JSON.parse(content) : content;
        } catch {
          // use content as-is
        }

        const msgCreatedAt = parseDateTime(row.createdAt) ?? now;

        await connection.execute(
          `INSERT INTO ${formatTableName(TABLE_MESSAGES)} (id, thread_id, content, createdAt, role, type, resourceId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newMessageId,
            newThreadId,
            typeof row.content === 'string' ? row.content : JSON.stringify(row.content),
            transformToSqlValue(msgCreatedAt),
            row.role,
            row.type || 'v2',
            targetResourceId,
          ],
        );

        clonedMessages.push({
          id: newMessageId,
          threadId: newThreadId,
          content: content as MastraMessageContentV2,
          role: row.role as MastraDBMessage['role'],
          type: row.type ?? undefined,
          createdAt: msgCreatedAt,
          resourceId: targetResourceId,
        });
      }

      await connection.commit();

      return {
        thread: newThread,
        clonedMessages,
        messageIdMap,
      };
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'CLONE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sourceThreadId, newThreadId },
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, filter, orderBy, page = 0, perPage: perPageInput } = args;
    const selectBy = (
      args as StorageListMessagesInput & {
        selectBy?: { include?: StorageListMessagesInput['include']; last?: number; vectorSearchString?: string };
      }
    ).selectBy;
    const include = args.include ?? selectBy?.include;
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);

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

      addMySQLMessageMetadataFilter(conditions, params, metadataFilter);

      if (selectBy?.vectorSearchString) {
        conditions.push(`${quoteIdentifier('content', 'column name')} LIKE ?`);
        params.push(`%${selectBy.vectorSearchString}%`);
      }

      const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const tableName = formatTableName(TABLE_MESSAGES);

      // Fast path: perPage=0 with no includes returns empty immediately
      if (perPage === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Fast path: perPage=0 with includes skips COUNT and main query
      if (perPage === 0 && include && include.length > 0) {
        const includeRows = await this._getIncludedMessages({ include, resourceId });
        if (!includeRows || includeRows.length === 0) {
          return {
            messages: [],
            total: 0,
            page,
            perPage,
            hasMore: false,
          };
        }

        const includeMessages = includeRows.map(row => this.mapMessage(row));
        const list = new MessageList();
        list.add(includeMessages, 'memory');
        const messages = list.get.all.db().sort(comparator);

        return {
          messages,
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

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
          ? typeof selectBy.last === 'number' && selectBy.last > 0
            ? selectBy.last
            : Number.MAX_SAFE_INTEGER
          : undefined;

      const limitValue = lastLimit !== undefined ? lastLimit : perPageInput === false ? total : normalizedPerPage;
      const safeLimit = Math.max(0, Number(limitValue));
      const safeOffset = lastLimit !== undefined ? Math.max(0, total - safeLimit) : Math.max(0, Number(offset));

      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT id, thread_id, content, role, type, createdAt, resourceId FROM ${tableName}${whereSql} ORDER BY ${quoteIdentifier(field, 'column name')} ${direction} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params,
      );

      const messagesByThread = new Map<string, MastraDBMessage[]>();
      const paginatedMain = (rows as unknown as MessageRow[]).map(row => this.mapMessage(row));
      messagesByThread.set(primaryThreadId, paginatedMain);

      const includeMessages = await this.collectIncludeMessages({
        threadId: primaryThreadId,
        include,
        messagesByThread,
        resourceId,
      });

      const combinedMap = new Map<string, MastraDBMessage>();
      for (const msg of paginatedMain) combinedMap.set(msg.id, msg);
      for (const msg of includeMessages) combinedMap.set(msg.id, msg);

      const combinedMessages = Array.from(combinedMap.values()).sort(comparator);

      const list = new MessageList();
      list.add(combinedMessages, 'memory');
      const normalizedMessages = list.get.all.db();
      const messages = [...normalizedMessages].sort(comparator);

      const baseHasMore = perPageInput === false ? false : safeOffset + safeLimit < total;

      const threadIdSet = new Set(threadIds);
      const mainThreadMessageCount = messages.filter(
        msg => msg.threadId !== undefined && threadIdSet.has(msg.threadId),
      ).length;
      const hasMore = metadataFilter || !include?.length || mainThreadMessageCount < total ? baseHasMore : false;

      return {
        messages,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      // Re-throw USER errors (validation errors) directly so callers get proper 400 responses
      if (error instanceof MastraError && error.category === ErrorCategory.USER) {
        throw error;
      }
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_MESSAGES', 'FAILED'),
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
      throw mastraError;
    }
  }

  public async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);

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

      addMySQLMessageMetadataFilter(conditions, params, metadataFilter);

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
              `SELECT thread_id FROM ${tableName} WHERE id = ? AND ${quoteIdentifier('resourceId', 'column name')} = ? LIMIT 1`,
              [inc.id, resourceId],
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
            resourceId,
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
      // Re-throw USER errors (validation errors) directly so callers get proper 400 responses
      if (error instanceof MastraError && error.category === ErrorCategory.USER) {
        throw error;
      }
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_MESSAGES_BY_RESOURCE_ID', 'FAILED'),
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
        resource.metadata === undefined || resource.metadata === null ? null : JSON.stringify(resource.metadata);
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
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_RESOURCE', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Resource ${resourceId} not found after update`,
          details: { resourceId },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
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
        `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ? ORDER BY ${OM_HEAD_ORDER} LIMIT 1`,
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
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const safeLimit = Math.max(1, Math.floor(Number(limit)) || 10);

      const conditions: string[] = [`${omCol('lookupKey')} = ?`];
      const params: any[] = [lookupKey];

      if (options?.recordId !== undefined) {
        conditions.push(`${omCol('id')} = ?`);
        params.push(options.recordId);
      }
      if (options?.from) {
        conditions.push(`${omCol('createdAt')} >= ?`);
        params.push(transformToSqlValue(options.from));
      }
      if (options?.to) {
        conditions.push(`${omCol('createdAt')} <= ?`);
        params.push(transformToSqlValue(options.to));
      }

      if (options?.groupId !== undefined) {
        conditions.push(`(LOCATE(CAST(? AS BINARY), CAST(${omCol('activeObservations')} AS BINARY)) > 0 OR EXISTS (
          SELECT 1 FROM JSON_TABLE(${omCol('bufferedObservationChunks')}, '$[*]'
            COLUMNS (observations LONGTEXT PATH '$.observations')) AS chunk
          WHERE LOCATE(CAST(? AS BINARY), CAST(chunk.observations AS BINARY)) > 0
        ))`);
        const prefix = `<observation-group id="${options.groupId}"`;
        params.push(prefix, prefix);
      }
      if (options?.beforeGeneration !== undefined) {
        conditions.push(`${omCol('generationCount')} < ?`);
        params.push(options.beforeGeneration);
      }
      if (options?.afterGeneration !== undefined) {
        conditions.push(`${omCol('generationCount')} > ?`);
        params.push(options.afterGeneration);
      }
      const direction = options?.sortDirection === 'ASC' ? 'ASC' : 'DESC';
      const whereClause = conditions.join(' AND ');
      let sql = `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${whereClause} ORDER BY ${omCol('generationCount')} ${direction}, ${omCol('createdAt')} ASC, id ASC LIMIT ${safeLimit}`;

      if (options?.offset != null && options.offset > 0) {
        sql += ` OFFSET ${options.offset}`;
      }

      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
      if (!rows) return [];
      return rows.map(row => this.parseOMRow(row));
    } catch (error) {
      rethrowOrWrapOM(error, '', 'GET_OBSERVATIONAL_MEMORY_HISTORY', { threadId, resourceId, limit });
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    try {
      const lookupKey = this.getOMKey(input.threadId, input.resourceId);
      // Deterministic generation-0 id: concurrent initializations of a key insert the same row,
      // and the primary key turns every insert after the first into a no-op.
      const id = getObservationalMemoryGeneration0Id(lookupKey);
      const now = new Date();

      const existing = await this.getObservationalMemory(input.threadId, input.resourceId);
      if (existing) return existing;

      const nowSql = transformToSqlValue(now);
      const cols = [
        'id',
        'lookupKey',
        'scope',
        'resourceId',
        'threadId',
        'activeObservations',
        'activeObservationsPendingUpdate',
        'originType',
        'config',
        'generationCount',
        'lastObservedAt',
        'lastReflectionAt',
        'pendingMessageTokens',
        'totalTokensObserved',
        'observationTokenCount',
        'isObserving',
        'isReflecting',
        'isBufferingObservation',
        'isBufferingReflection',
        'lastBufferedAtTokens',
        'lastBufferedAtTime',
        'observedTimezone',
        'createdAt',
        'updatedAt',
        'supersededBy',
      ]
        .map(omCol)
        .join(', ');
      const placeholders = Array.from({ length: 25 }, () => '?').join(', ');

      await this.pool.execute(`INSERT IGNORE INTO ${OM_TABLE_QUOTED} (${cols}) VALUES (${placeholders})`, [
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
        false,
        false,
        0,
        null,
        input.observedTimezone || null,
        nowSql,
        nowSql,
        null,
      ]);

      // Whoever inserted first (this call or a concurrent one), the head is now the answer.
      const head = await this.getObservationalMemory(input.threadId, input.resourceId);
      if (!head) throwOMNotFound(id, 'INITIALIZE_OBSERVATIONAL_MEMORY');
      return head;
    } catch (error) {
      rethrowOrWrapOM(error, '', 'INITIALIZE_OBSERVATIONAL_MEMORY', {
        threadId: input.threadId,
        resourceId: input.resourceId,
      });
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<UpdateActiveObservationsResult> {
    try {
      const observedMessageIdsJson = input.observedMessageIds ? JSON.stringify(input.observedMessageIds) : null;

      return await this.withOMTransaction(async connection => {
        const row = await this.lockOMRow(connection, input.id);
        if (!row) throwOMNotFound(input.id, 'UPDATE_ACTIVE_OBSERVATIONS');
        if (row.supersededBy) return { applied: false, reason: 'retired' as const };
        if (
          input.expectedActiveObservations !== undefined &&
          input.expectedActiveObservations !== ((row.activeObservations as string) || '')
        ) {
          return { applied: false, reason: 'conflict' as const };
        }

        // The cursor never moves backward.
        const lastObservedAt = maxObservationCursor(parseDateTime(row.lastObservedAt), input.lastObservedAt)!;
        await connection.execute(
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
            transformToSqlValue(lastObservedAt),
            input.tokenCount,
            input.tokenCount,
            observedMessageIdsJson,
            transformToSqlValue(new Date()),
            input.id,
          ],
        );
        return { applied: true };
      });
    } catch (error) {
      rethrowOrWrapOM(error, input.id, 'UPDATE_ACTIVE_OBSERVATIONS');
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    try {
      const { currentRecord } = input;
      return await this.withOMTransaction(async connection => {
        const row = await this.lockOMRow(connection, currentRecord.id);
        if (!row) return currentRecord;
        // A retired snapshot creates nothing; the caller adopts the head.
        if (row.supersededBy) return this.parseOMRow(await this.resolveLiveOMRow(connection, row));
        const stored = this.parseOMRow(row);
        const plan = planReflectionGenerationText({
          storedObservations: stored.activeObservations,
          storedObservationTokenCount: stored.observationTokenCount,
          snapshotObservations: currentRecord.activeObservations,
          snapshotObservationTokenCount: currentRecord.observationTokenCount,
          reflection: input.reflection,
          tokenCount: input.tokenCount,
        });
        // The text was rewritten (not only appended to) since the snapshot: the reflection is stale.
        if (!plan) return stored;
        return this.rollOverOMRow(connection, stored.id, plan.observations, plan.tokenCount, input.newRecordId, false);
      });
    } catch (error) {
      rethrowOrWrapOM(error, input.currentRecord.id, 'CREATE_REFLECTION_GENERATION', {
        currentRecordId: input.currentRecord.id,
      });
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
      await this.withOMTransaction(async connection => {
        const row = await this.lockOMRow(connection, id);
        if (!row) throwOMNotFound(id, 'SET_BUFFERING_OBSERVATION_FLAG');
        // A retired id is redirected to the head.
        const target = await this.resolveLiveOMRow(connection, row);
        const sets = [
          `${omCol('isBufferingObservation')} = ?`,
          ...(lastBufferedAtTokens !== undefined ? [`${omCol('lastBufferedAtTokens')} = ?`] : []),
          `${omCol('updatedAt')} = ?`,
        ].join(', ');
        await connection.execute(`UPDATE ${OM_TABLE_QUOTED} SET ${sets} WHERE ${omCol('id')} = ?`, [
          isBuffering,
          ...(lastBufferedAtTokens !== undefined ? [lastBufferedAtTokens] : []),
          transformToSqlValue(new Date()),
          target.id,
        ]);
      });
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
      await this.pool.execute(`DELETE FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ?`, [lookupKey]);
    } catch (error) {
      rethrowOrWrapOM(error, '', 'CLEAR_OBSERVATIONAL_MEMORY', { threadId, resourceId });
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    try {
      await this.withOMTransaction(async connection => {
        const row = await this.lockOMRow(connection, id);
        if (!row) throwOMNotFound(id, 'SET_PENDING_MESSAGE_TOKENS');
        // A retired id is redirected to the head.
        const target = await this.resolveLiveOMRow(connection, row);
        await connection.execute(
          `UPDATE ${OM_TABLE_QUOTED} SET
            ${omCol('pendingMessageTokens')} = ?,
            ${omCol('updatedAt')} = ?
          WHERE ${omCol('id')} = ?`,
          [tokenCount, transformToSqlValue(new Date()), target.id],
        );
      });
    } catch (error) {
      rethrowOrWrapOM(error, id, 'SET_PENDING_MESSAGE_TOKENS');
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<UpdateBufferedObservationsResult> {
    try {
      const newChunk: BufferedObservationChunk = {
        id: `ombuf-${globalThis.crypto.randomUUID()}`,
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

      return await this.withOMTransaction(async connection => {
        const row = await this.lockOMRow(connection, input.id);
        if (!row) throwOMNotFound(input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
        // A retired id is redirected to the head.
        const target = await this.resolveLiveOMRow(connection, row);
        const existingChunks = parseBufferedChunks(target.bufferedObservationChunks);

        // Skip a retried append (same cycle) and a chunk the cursor already wholly covers.
        if (
          existingChunks.some(existing => existing.cycleId === input.chunk.cycleId) ||
          isBufferedChunkCoveredByCursor(input.chunk.lastObservedAt, parseDateTime(target.lastObservedAt))
        ) {
          return { persisted: false, recordId: target.id as string };
        }

        // lastBufferedAtTime never moves backward.
        const lastBufferedAtTime = maxObservationCursor(
          parseDateTime(target.lastBufferedAtTime),
          input.lastBufferedAtTime ?? undefined,
        );
        await connection.execute(
          `UPDATE ${OM_TABLE_QUOTED} SET
            ${omCol('bufferedObservationChunks')} = ?,
            ${omCol('lastBufferedAtTime')} = ?,
            ${omCol('updatedAt')} = ?
          WHERE ${omCol('id')} = ?`,
          [
            JSON.stringify([...existingChunks, newChunk]),
            transformToSqlValue(lastBufferedAtTime),
            transformToSqlValue(new Date()),
            target.id,
          ],
        );
        return { persisted: true, recordId: target.id as string };
      });
    } catch (error) {
      rethrowOrWrapOM(error, input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      return await this.withOMTransaction(async connection => {
        // Lock the record: activation is computed from (and written back to) the stored state.
        const row = await this.lockOMRow(connection, input.id);
        if (!row) throwOMNotFound(input.id, 'SWAP_BUFFERED_TO_ACTIVE');

        const emptyResult: SwapBufferedToActiveResult = {
          chunksActivated: 0,
          messageTokensActivated: 0,
          observationTokensActivated: 0,
          messagesActivated: 0,
          activatedCycleIds: [],
          activatedMessageIds: [],
        };
        // A retired record is frozen: activation reports it and writes nothing.
        if (row.supersededBy) return { ...emptyResult, retired: true };

        // Activation always works on the stored list, so a chunk appended after the caller read
        // the record is never dropped. Caller-provided chunks only override token weights.
        const persistedChunks = parseBufferedChunks(row.bufferedObservationChunks);
        const refreshedWeights = new Map(
          (Array.isArray(input.bufferedChunks) ? input.bufferedChunks : []).map(c => [c.id, c.messageTokens]),
        );
        const chunks = persistedChunks.map(c =>
          refreshedWeights.has(c.id) ? { ...c, messageTokens: refreshedWeights.get(c.id)! } : c,
        );

        if (chunks.length === 0) {
          return emptyResult;
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

        // Split chunks: activate a stored prefix, keep the rest of the stored list.
        const activatedChunks = chunks.slice(0, chunksToActivate);
        const remainingChunks = persistedChunks.slice(chunksToActivate);

        // Combine activated observations
        const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
        const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
        const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
        const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
        const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((cid): cid is string => !!cid);
        const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

        // Derive lastObservedAt from the latest activated chunk; the stored cursor never moves
        // backward (a sync observation may already be past this chunk).
        const latestChunk = activatedChunks[activatedChunks.length - 1];
        const derivedLastObservedAt =
          input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
        const lastObservedAt = maxObservationCursor(parseDateTime(row.lastObservedAt), derivedLastObservedAt)!;

        // Get existing values
        const existingActive = (row.activeObservations as string) || '';
        const existingTokenCount = Number(row.observationTokenCount || 0);

        // Calculate new values
        const newActive = existingActive ? `${existingActive}\n\n${activatedContent}` : activatedContent;
        const newTokenCount = existingTokenCount + activatedTokens;

        // Decrement pending message tokens (clamped to zero)
        const existingPending = Number(row.pendingMessageTokens || 0);
        const newPending = Math.max(0, existingPending - activatedMessageTokens);

        await connection.execute(
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
            transformToSqlValue(lastObservedAt),
            transformToSqlValue(new Date()),
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
      });
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
      const { currentRecord } = input;
      return await this.withOMTransaction(async connection => {
        const row = await this.lockOMRow(connection, currentRecord.id);
        if (!row) return currentRecord;
        // A retired snapshot creates nothing; the caller adopts the head.
        if (row.supersededBy) return this.parseOMRow(await this.resolveLiveOMRow(connection, row));
        const stored = this.parseOMRow(row);

        const bufferedReflection = stored.bufferedReflection || '';
        if (!bufferedReflection) {
          throw new MastraError({
            id: createStorageErrorId('MYSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
            text: 'No buffered reflection to swap',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { id: currentRecord.id },
          });
        }
        // Only appends may have happened since the caller's snapshot; a rewrite invalidates the
        // reflected line count.
        if (!isAppendOnlySince(stored.activeObservations, currentRecord.activeObservations)) {
          return stored;
        }

        // Lines 0..reflectedLineCount were reflected on → replaced by bufferedReflection.
        // Lines after reflectedLineCount were added after reflection started → kept as-is.
        const reflectedLineCount = stored.reflectedObservationLineCount ?? 0;
        const unreflectedContent = (stored.activeObservations || '')
          .split('\n')
          .slice(reflectedLineCount)
          .join('\n')
          .trim();
        const newObservations = unreflectedContent
          ? `${bufferedReflection}\n\n${unreflectedContent}`
          : bufferedReflection;
        // tokenCount is computed by the processor from its snapshot; add tokens appended since.
        const tokenCount =
          input.tokenCount +
          Math.max(0, (stored.observationTokenCount ?? 0) - (currentRecord.observationTokenCount ?? 0));

        return this.rollOverOMRow(connection, stored.id, newObservations, tokenCount, input.newRecordId, true);
      });
    } catch (error) {
      rethrowOrWrapOM(error, input.currentRecord.id, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE');
    }
  }

  /**
   * Runs `fn` in one transaction on a dedicated connection. Every OM lifecycle write locks its
   * target row by primary key (`SELECT … FOR UPDATE`, a record lock — never a range), so the
   * only expected lock conflict is a wait; a deadlock or lock-wait timeout (e.g. against the
   * startup backfill's scan) is retried a bounded number of times.
   */
  private async withOMTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback().catch(() => {});
        if (attempt < OM_MAX_TRANSACTION_ATTEMPTS && isRetryableLockError(error)) continue;
        throw error;
      } finally {
        connection.release();
      }
    }
  }

  /** Row-locks one OM record by primary key for the rest of the transaction. */
  private async lockOMRow(connection: PoolConnection, id: string): Promise<RowDataPacket | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM ${OM_TABLE_QUOTED} WHERE ${omCol('id')} = ? FOR UPDATE`,
      [id],
    );
    return rows?.[0] ?? null;
  }

  /**
   * The live, row-locked record a lifecycle write aimed at `row` lands on: `row` itself while
   * live, otherwise the head. The head is found with a plain (non-locking, so no range locks)
   * canonical head read, then locked by primary key. Under REPEATABLE READ that read can predate
   * a rollover committed after this transaction started; the locking read sees the latest
   * committed row, so a head retired since is followed through `supersededBy` (bounded).
   */
  private async resolveLiveOMRow(connection: PoolConnection, row: RowDataPacket): Promise<RowDataPacket> {
    if (!row.supersededBy) return row;
    const [heads] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ? ORDER BY ${OM_HEAD_ORDER} LIMIT 1`,
      [row.lookupKey],
    );
    const headId = (heads?.[0]?.id as string | undefined) ?? (row.supersededBy as string);
    let current: RowDataPacket = (await this.lockOMRow(connection, headId)) ?? row;
    for (let hop = 0; current.supersededBy; hop++) {
      const next = hop < OM_MAX_HEAD_HOPS ? await this.lockOMRow(connection, current.supersededBy as string) : null;
      if (!next) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'RESOLVE_OBSERVATIONAL_MEMORY_HEAD', 'FAILED'),
          text: `Observational memory record ${row.id} is superseded but no live head was found`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: row.id as string },
        });
      }
      current = next;
    }
    return current;
  }

  /**
   * Create the next generation from the stored (live, row-locked) record and retire the stored
   * record in the same transaction. Carried columns are copied in SQL from the stored row, so
   * nothing round-trips through a client-side date conversion. Buffered chunks move to the new
   * generation; the cursor, buffering markers, flags, and counters carry over; buffered
   * reflection state does not (and is cleared on the retired row after a buffered swap).
   */
  private async rollOverOMRow(
    connection: PoolConnection,
    storedId: string,
    observations: string,
    tokenCount: number,
    newRecordId: string | undefined,
    clearBufferedReflection: boolean,
  ): Promise<ObservationalMemoryRecord> {
    const id = newRecordId ?? globalThis.crypto.randomUUID();
    const nowSql = transformToSqlValue(new Date());
    const c = omCol;
    await connection.execute(
      `INSERT INTO ${OM_TABLE_QUOTED} (
        ${c('id')}, ${c('lookupKey')}, ${c('scope')}, ${c('resourceId')}, ${c('threadId')},
        ${c('activeObservations')}, ${c('activeObservationsPendingUpdate')},
        ${c('originType')}, ${c('config')}, ${c('generationCount')}, ${c('lastObservedAt')}, ${c('lastReflectionAt')},
        ${c('pendingMessageTokens')}, ${c('totalTokensObserved')}, ${c('observationTokenCount')}, ${c('bufferedObservationChunks')},
        ${c('isObserving')}, ${c('isReflecting')}, ${c('isBufferingObservation')}, ${c('isBufferingReflection')},
        ${c('lastBufferedAtTokens')}, ${c('lastBufferedAtTime')},
        ${c('observedTimezone')}, ${c('metadata')}, ${c('supersededBy')}, ${c('createdAt')}, ${c('updatedAt')}
      )
      SELECT
        ?, ${c('lookupKey')}, ${c('scope')}, ${c('resourceId')}, ${c('threadId')},
        ?, NULL,
        'reflection', ${c('config')}, ${c('generationCount')} + 1, ${c('lastObservedAt')}, ?,
        ${c('pendingMessageTokens')}, ${c('totalTokensObserved')}, ?, ${c('bufferedObservationChunks')},
        false, false, ${c('isBufferingObservation')}, false,
        ${c('lastBufferedAtTokens')}, ${c('lastBufferedAtTime')},
        ${c('observedTimezone')}, ${c('metadata')}, NULL, ?, ?
      FROM ${OM_TABLE_QUOTED} WHERE ${c('id')} = ?`,
      [id, observations, nowSql, Math.round(tokenCount), nowSql, nowSql, storedId],
    );

    // Retire the stored record: chunks moved, liveness marker set (never cleared).
    const [retired] = await connection.execute(
      `UPDATE ${OM_TABLE_QUOTED} SET
        ${c('supersededBy')} = ?,
        ${c('bufferedObservationChunks')} = NULL,
        ${
          clearBufferedReflection
            ? `${c('bufferedReflection')} = NULL, ${c('bufferedReflectionTokens')} = NULL,
        ${c('bufferedReflectionInputTokens')} = NULL, ${c('reflectedObservationLineCount')} = NULL,`
            : ''
        }
        ${c('updatedAt')} = ?
      WHERE ${c('id')} = ? AND ${c('supersededBy')} IS NULL`,
      [id, nowSql, storedId],
    );
    if ((retired as ResultSetHeader).affectedRows !== 1) {
      throw new MastraError({
        id: createStorageErrorId('MYSQL', 'CREATE_REFLECTION_GENERATION', 'RETIRE_FAILED'),
        text: `Failed to retire observational memory record ${storedId}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { id: storedId },
      });
    }

    const inserted = await this.lockOMRow(connection, id);
    if (!inserted) throwOMNotFound(id, 'CREATE_REFLECTION_GENERATION');
    return this.parseOMRow(inserted);
  }

  /**
   * Retire every live row that sorts after its key's canonical head, marking it superseded by
   * the head. Rows retired by older adapter versions (which never set `supersededBy`) become
   * frozen. Only keys with more than one live row are touched; each update embeds the head's
   * ordering key, so a row created by a concurrent rollover (a newer generation) never matches.
   * Runs at READ COMMITTED so the scan takes no gap locks.
   */
  private async backfillSupersededBy(): Promise<void> {
    const [keys] = await this.pool.execute<RowDataPacket[]>(
      `SELECT ${omCol('lookupKey')} AS lookupKey FROM ${OM_TABLE_QUOTED}
      WHERE ${omCol('supersededBy')} IS NULL GROUP BY ${omCol('lookupKey')} HAVING COUNT(*) > 1`,
    );
    for (const { lookupKey } of keys ?? []) {
      for (let attempt = 1; ; attempt++) {
        const connection = await this.pool.getConnection();
        try {
          await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
          await connection.beginTransaction();
          await connection.execute(
            `UPDATE ${OM_TABLE_QUOTED} AS r
            JOIN (
              SELECT ${omCol('id')} AS id, ${omCol('generationCount')} AS generationCount, ${omCol('createdAt')} AS createdAt
              FROM ${OM_TABLE_QUOTED} WHERE ${omCol('lookupKey')} = ? ORDER BY ${OM_HEAD_ORDER} LIMIT 1
            ) AS h
            SET r.${omCol('supersededBy')} = h.id
            WHERE r.${omCol('lookupKey')} = ?
              AND r.${omCol('supersededBy')} IS NULL
              AND (
                r.${omCol('generationCount')} < h.generationCount
                OR (r.${omCol('generationCount')} = h.generationCount AND r.${omCol('createdAt')} > h.createdAt)
                OR (r.${omCol('generationCount')} = h.generationCount AND r.${omCol('createdAt')} = h.createdAt AND r.${omCol('id')} > h.id)
              )`,
            [lookupKey, lookupKey],
          );
          await connection.commit();
          break;
        } catch (error) {
          await connection.rollback().catch(() => {});
          if (attempt < OM_MAX_TRANSACTION_ATTEMPTS && isRetryableLockError(error)) continue;
          throw error;
        } finally {
          connection.release();
        }
      }
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
      bufferedReflectionInputTokens: row.bufferedReflectionInputTokens
        ? Number(row.bufferedReflectionInputTokens)
        : undefined,
      reflectedObservationLineCount: row.reflectedObservationLineCount
        ? Number(row.reflectedObservationLineCount)
        : undefined,
      totalTokensObserved: Number(row.totalTokensObserved || 0),
      observationTokenCount: Number(row.observationTokenCount || 0),
      pendingMessageTokens: Number(row.pendingMessageTokens || 0),
      isReflecting: parseMySQLBool(row.isReflecting),
      isObserving: parseMySQLBool(row.isObserving),
      isBufferingObservation: parseMySQLBool(row.isBufferingObservation),
      isBufferingReflection: parseMySQLBool(row.isBufferingReflection),
      lastBufferedAtTokens:
        typeof row.lastBufferedAtTokens === 'number'
          ? row.lastBufferedAtTokens
          : parseInt(String(row.lastBufferedAtTokens ?? '0'), 10) || 0,
      lastBufferedAtTime: row.lastBufferedAtTime ? (parseDateTime(row.lastBufferedAtTime) ?? null) : null,
      config: parseJSONColumn(row.config) ?? {},
      metadata: parseJSONColumn(row.metadata),
      observedMessageIds: parseJSONColumn<string[]>(row.observedMessageIds),
      observedTimezone: row.observedTimezone || undefined,
      supersededBy: row.supersededBy ?? null,
    };
  }
}
