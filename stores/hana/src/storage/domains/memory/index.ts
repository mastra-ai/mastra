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
  StorageListThreadsInput,
  StorageListThreadsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';

import { HANAClient, resolveHanaConfig } from '../../db';
import type { HANADomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

export class MemoryHANA extends MemoryStorage {
  private db: HANAClient;
  private schema?: string;
  private needsInit: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES] as const;

  constructor(config: HANADomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsInit } = resolveHanaConfig(config);
    this.schema = schemaName;
    this.db = new HANAClient({ pool, schemaName, skipDefaultIndexes });
    this.needsInit = needsInit;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (MemoryHANA.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  private _parseAndFormatMessages(messages: Record<string, unknown>[], format?: 'v1' | 'v2') {
    const messagesWithParsedContent = messages.map(message => {
      // Remap snake_case DB column to camelCase expected by MessageList
      const remapped: Record<string, unknown> = { ...message };
      if ('thread_id' in remapped && !('threadId' in remapped)) {
        remapped['threadId'] = remapped['thread_id'];
        delete remapped['thread_id'];
      }
      if (typeof remapped['content'] === 'string') {
        try {
          return { ...remapped, content: JSON.parse(remapped['content'] as string) };
        } catch {
          return remapped;
        }
      }
      return remapped;
    });

    const cleanMessages = messagesWithParsedContent.map(
      ({ seq_id: _seq_id, ...rest }: Record<string, unknown> & { seq_id?: unknown }) => rest,
    );
    const list = new MessageList().add(cleanMessages as any, 'memory');
    return format === 'v2' ? list.get.all.db() : list.get.all.v1();
  }

  async init(): Promise<void> {
    if (this.needsInit) {
      await this.db.pool.initialize();
      this.needsInit = false;
    }
    await this.db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });
    // Sync effective schema (may differ if CREATE SCHEMA fell back to CURRENT_USER)
    this.schema = this.db.schemaName;
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    // Truncate schema prefix so index name stays within the 63-char SQL identifier limit
    const MAX_PREFIX = 20;
    const rawPrefix = this.schema ?? '';
    const schemaPrefix = rawPrefix ? `${rawPrefix.slice(0, MAX_PREFIX)}_` : '';
    return [
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
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_MESSAGES });
    await this.db.clearTable({ tableName: TABLE_THREADS });
    await this.db.clearTable({ tableName: TABLE_RESOURCES });
  }

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const rows = await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${tableName} WHERE "id" = ?`, [threadId]),
      );
      const thread = (rows as Array<Record<string, unknown>>)[0] ?? null;
      if (!thread || (resourceId !== undefined && thread['resourceId'] !== resourceId)) {
        return null;
      }
      return {
        ...(thread as any),
        metadata:
          typeof thread['metadata'] === 'string' ? JSON.parse(thread['metadata'] as string) : thread['metadata'],
        createdAt: thread['createdAt'] instanceof Date ? thread['createdAt'] : new Date(thread['createdAt'] as string),
        updatedAt: thread['updatedAt'] instanceof Date ? thread['updatedAt'] : new Date(thread['updatedAt'] as string),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_THREAD_BY_ID', 'FAILED'),
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
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('HANA', 'LIST_THREADS', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid pagination parameters',
        details: { page },
      });
    }

    const perPage = normalizePerPage(perPageInput, 100);

    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('HANA', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
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
      const params: unknown[] = [];

      if (filter?.resourceId) {
        whereClauses.push('"resourceId" = ?');
        params.push(filter.resourceId);
      }

      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (value !== null && typeof value === 'object') {
            throw new MastraError({
              id: createStorageErrorId('HANA', 'LIST_THREADS', 'INVALID_METADATA_VALUE'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Metadata filter value for key "${key}" must be a scalar type`,
              details: { key },
            });
          }
          if (value === null) {
            whereClauses.push(`JSON_VALUE("metadata", '$.${key}') IS NULL`);
          } else {
            whereClauses.push(`JSON_VALUE("metadata", '$.${key}') = ?`);
            params.push(typeof value === 'string' ? value : typeof value === 'boolean' ? String(value) : String(value));
          }
        }
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const countRows = await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${tableName} ${whereClause}`, [...params]),
      );
      const total = Number((countRows as Array<{ CNT: number }>)[0]?.CNT ?? 0);

      if (total === 0) {
        return { threads: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const orderByField = field === 'createdAt' ? '"createdAt"' : '"updatedAt"';
      const dir = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const limitValue = perPageInput === false ? total : perPage;

      const listParams = [...params, limitValue, offset];
      const rows = await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT "id", "resourceId", "title", "metadata", "createdAt", "updatedAt" FROM ${tableName} ${whereClause} ORDER BY ${orderByField} ${dir} LIMIT ? OFFSET ?`,
          listParams,
        ),
      );

      const threads = (rows as Array<Record<string, unknown>>).map(thread => ({
        ...(thread as any),
        metadata:
          typeof thread['metadata'] === 'string' ? JSON.parse(thread['metadata'] as string) : thread['metadata'],
        createdAt: thread['createdAt'] instanceof Date ? thread['createdAt'] : new Date(thread['createdAt'] as string),
        updatedAt: thread['updatedAt'] instanceof Date ? thread['updatedAt'] : new Date(thread['updatedAt'] as string),
      }));

      return {
        threads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { page },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      return { threads: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
    }
  }

  public async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const table = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `UPSERT ${table} ("id", "resourceId", "title", "metadata", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?) WITH PRIMARY KEY`,
          [
            thread.id,
            thread.resourceId,
            thread.title,
            thread.metadata ? JSON.stringify(thread.metadata) : null,
            thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
            thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : thread.updatedAt,
          ],
        ),
      );
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'SAVE_THREAD', 'FAILED'),
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
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw new MastraError({
        id: createStorageErrorId('HANA', 'UPDATE_THREAD', 'NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: { threadId: id },
      });
    }

    const mergedMetadata = { ...existingThread.metadata, ...metadata };
    const updatedAt = new Date();

    try {
      const table = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn =>
        conn.execPromise(`UPDATE ${table} SET "title" = ?, "metadata" = ?, "updatedAt" = ? WHERE "id" = ?`, [
          title,
          JSON.stringify(mergedMetadata),
          updatedAt.toISOString(),
          id,
        ]),
      );
      const updated = await this.getThreadById({ threadId: id });
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('HANA', 'UPDATE_THREAD', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Thread ${id} not found after update`,
          details: { threadId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const messagesTable = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const threadsTable = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });

    try {
      await this.db.pool.withTransaction(async conn => {
        await conn.execPromise(`DELETE FROM ${messagesTable} WHERE "thread_id" = ?`, [threadId]);
        await conn.execPromise(`DELETE FROM ${threadsTable} WHERE "id" = ?`, [threadId]);
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async getMessages({
    threadId,
    include,
    threadMessages,
    format,
  }: {
    threadId: string;
    include?: { id: string; withPreviousMessages?: number; withNextMessages?: number }[];
    threadMessages?: number | 'all';
    format?: 'v1' | 'v2';
  }): Promise<MastraDBMessage[]> {
    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });

      let rows: Record<string, unknown>[];

      if (include && include.length > 0) {
        // Fetch specific messages with context windows

        // First get all thread messages ordered by seq_id
        const allMsgRows = await this.db.pool.withConnection(conn =>
          conn.execPromise(
            `SELECT *, ROW_NUMBER() OVER (ORDER BY "seq_id" ASC) AS row_num FROM ${tableName} WHERE "thread_id" = ? ORDER BY "seq_id" ASC`,
            [threadId],
          ),
        );
        const allMsgs = allMsgRows as Array<Record<string, unknown>>;

        // Build a set of seq_ids to include
        const seqIdSet = new Set<number>();
        for (const inc of include) {
          const target = allMsgs.find(m => m['id'] === inc.id);
          if (!target) continue;
          const rowNum = Number(target['row_num']);
          const prev = inc.withPreviousMessages ?? 0;
          const next = inc.withNextMessages ?? 0;

          allMsgs.forEach((m, i) => {
            const mRowNum = i + 1;
            if (mRowNum >= rowNum - prev && mRowNum <= rowNum + next) {
              seqIdSet.add(Number(m['seq_id']));
            }
          });
        }

        rows = allMsgs.filter(m => seqIdSet.has(Number(m['seq_id'])));

        // Also get last N messages if requested
        if (typeof threadMessages === 'number' && threadMessages > 0) {
          const lastN = allMsgs.slice(-threadMessages);
          for (const m of lastN) {
            if (!seqIdSet.has(Number(m['seq_id']))) {
              rows.push(m);
            }
          }
          rows.sort((a, b) => Number(a['seq_id']) - Number(b['seq_id']));
        }
      } else {
        // Simple fetch — last N or all
        let sql: string;
        const params: unknown[] = [threadId];

        if (typeof threadMessages === 'number' && threadMessages > 0) {
          // Get last N: subquery since HANA doesn't support LIMIT inside a subquery easily
          sql = `SELECT * FROM (SELECT * FROM ${tableName} WHERE "thread_id" = ? ORDER BY "seq_id" DESC LIMIT ?) ORDER BY "seq_id" ASC`;
          params.push(threadMessages);
        } else {
          sql = `SELECT * FROM ${tableName} WHERE "thread_id" = ? ORDER BY "seq_id" ASC`;
        }

        rows = (await this.db.pool.withConnection(conn => conn.execPromise(sql, params))) as Array<
          Record<string, unknown>
        >;
      }

      return this._parseAndFormatMessages(rows, format) as MastraDBMessage[];
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
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

  private async _getIncludedMessages({ include }: { include: StorageListMessagesInput['include'] }) {
    if (!include || include.length === 0) return null;
    const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const unionParts: string[] = [];
    const params: unknown[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // HANA supports ROW_NUMBER() in subqueries
      unionParts.push(`
        SELECT m."id", m."content", m."role", m."type", m."createdAt", m."thread_id" AS "threadId", m."resourceId", m."seq_id"
        FROM (
          SELECT *, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "seq_id" ASC) AS row_num
          FROM ${tableName}
          WHERE "thread_id" = (SELECT "thread_id" FROM ${tableName} WHERE "id" = ?)
        ) m
        WHERE m."id" = ?
        OR EXISTS (
          SELECT 1 FROM (
            SELECT *, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "seq_id" ASC) AS row_num
            FROM ${tableName}
            WHERE "thread_id" = (SELECT "thread_id" FROM ${tableName} WHERE "id" = ?)
          ) target
          WHERE target."id" = ?
          AND (
            (m.row_num < target.row_num AND m.row_num >= target.row_num - ?)
            OR
            (m.row_num > target.row_num AND m.row_num <= target.row_num + ?)
          )
        )
      `);
      params.push(id, id, id, id, withPreviousMessages, withNextMessages);
    }

    const finalSql = `SELECT * FROM (${unionParts.join(' UNION ALL ')}) ORDER BY "seq_id" ASC`;
    const rows = (await this.db.pool.withConnection(conn => conn.execPromise(finalSql, params))) as Array<
      Record<string, unknown>
    >;

    const seen = new Set<string>();
    return rows.filter(row => {
      const id = row['id'] as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id?.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }
    if (page < 0) {
      throw new MastraError({
        id: createStorageErrorId('HANA', 'LIST_MESSAGES', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { page },
      });
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });

      if (perPage === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      // include-only fast path
      if (perPage === 0 && include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        const messages = this._parseAndFormatMessages(includeMessages ?? [], 'v2') as MastraDBMessage[];
        return {
          messages: this._sortMessages(messages, field, direction),
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (threadIds.length === 1) {
        conditions.push(`"thread_id" = ?`);
        params.push(threadIds[0]);
      } else {
        conditions.push(`"thread_id" IN (${threadIds.map(() => '?').join(', ')})`);
        params.push(...threadIds);
      }
      if (resourceId) {
        conditions.push(`"resourceId" = ?`);
        params.push(resourceId);
      }
      if (filter?.dateRange?.start) {
        conditions.push(filter.dateRange.startExclusive ? `"createdAt" > ?` : `"createdAt" >= ?`);
        const start = filter.dateRange.start;
        params.push(start instanceof Date ? start.toISOString() : start);
      }
      if (filter?.dateRange?.end) {
        conditions.push(filter.dateRange.endExclusive ? `"createdAt" < ?` : `"createdAt" <= ?`);
        const end = filter.dateRange.end;
        params.push(end instanceof Date ? end.toISOString() : end);
      }

      const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

      const countRows = await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${tableName}${where}`, [...params]),
      );
      const total = Number((countRows as Array<{ CNT: number }>)[0]?.CNT ?? 0);

      let baseRows: Array<Record<string, unknown>>;
      const dbOrder = `"${field}" ${direction}, "seq_id" ${direction}`;
      if (perPage === 0) {
        baseRows = [];
      } else if (perPageInput === false) {
        baseRows = (await this.db.pool.withConnection(conn =>
          conn.execPromise(`SELECT * FROM ${tableName}${where} ORDER BY ${dbOrder}`, [...params]),
        )) as Array<Record<string, unknown>>;
      } else {
        baseRows = (await this.db.pool.withConnection(conn =>
          conn.execPromise(`SELECT * FROM ${tableName}${where} ORDER BY ${dbOrder} LIMIT ? OFFSET ?`, [
            ...params,
            perPage,
            offset,
          ]),
        )) as Array<Record<string, unknown>>;
      }

      if (total === 0 && baseRows.length === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const allRows = [...baseRows];
      const seqById = new Map<string, number>();
      allRows.forEach(row => {
        if (typeof row['seq_id'] === 'number') seqById.set(row['id'] as string, row['seq_id'] as number);
      });

      if (include?.length) {
        const messageIds = new Set(allRows.map(r => r['id'] as string));
        const includeMessages = await this._getIncludedMessages({ include });
        includeMessages?.forEach(msg => {
          if (!messageIds.has(msg['id'] as string)) {
            allRows.push(msg);
            messageIds.add(msg['id'] as string);
            if (typeof msg['seq_id'] === 'number') seqById.set(msg['id'] as string, msg['seq_id'] as number);
          }
        });
      }

      const parsed = this._parseAndFormatMessages(allRows, 'v2') as MastraDBMessage[];
      const mult = direction === 'ASC' ? 1 : -1;
      const finalMessages = parsed.sort((a, b) => {
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
      const hasMore = perPageInput !== false && returnedThreadMessageCount < total && offset + perPage < total;

      return { messages: finalMessages, total, page, perPage: perPageForResponse, hasMore };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        error,
      );
    }
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };
    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new MastraError({
        id: createStorageErrorId('HANA', 'SAVE_MESSAGES', 'INVALID_THREAD_ID'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`,
      });
    }
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new MastraError({
        id: createStorageErrorId('HANA', 'SAVE_MESSAGES', 'THREAD_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ${threadId} not found`,
        details: { threadId },
      });
    }
    const tableMessages = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const tableThreads = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
    try {
      await this.db.pool.withTransaction(async conn => {
        for (const message of messages) {
          if (!message.threadId) {
            throw new Error(`Expected to find a threadId for message, but couldn't find one.`);
          }
          if (!message.resourceId) {
            throw new Error(`Expected to find a resourceId for message, but couldn't find one.`);
          }
          const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
          await conn.execPromise(
            `UPSERT ${tableMessages} ("id", "thread_id", "content", "role", "type", "createdAt", "resourceId") VALUES (?, ?, ?, ?, ?, ?, ?) WITH PRIMARY KEY`,
            [
              message.id,
              message.threadId,
              content,
              message.role,
              (message as any).type ?? 'v2',
              message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
              message.resourceId,
            ],
          );
        }
        await conn.execPromise(`UPDATE ${tableThreads} SET "updatedAt" = ? WHERE "id" = ?`, [
          new Date().toISOString(),
          threadId,
        ]);
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
          id: createStorageErrorId('HANA', 'SAVE_MESSAGES', 'FAILED'),
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
    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const placeholders = messageIds.map(() => '?').join(', ');
      const rows = await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${tableName} WHERE "id" IN (${placeholders}) ORDER BY "seq_id" ASC`,
          messageIds,
        ),
      );
      return {
        messages: this._parseAndFormatMessages(rows as Array<Record<string, unknown>>, 'v2') as MastraDBMessage[],
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_MESSAGES_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
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
    if (messages.length === 0) return [];
    const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const threadTable = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });

    // Fetch existing messages to allow deep content merge
    const messageIds = messages.map(m => m.id);
    const selectPlaceholders = messageIds.map(() => '?').join(', ');
    const existingRows = (await this.db.pool.withConnection(conn =>
      conn.execPromise(
        `SELECT * FROM ${tableName} WHERE "id" IN (${selectPlaceholders}) ORDER BY "seq_id" ASC`,
        messageIds,
      ),
    )) as Array<Record<string, unknown>>;

    const existingMap = new Map<string, Record<string, unknown>>();
    for (const row of existingRows) {
      const id = row['id'] as string;
      // Parse stored content JSON
      if (typeof row['content'] === 'string') {
        try {
          row['content'] = JSON.parse(row['content'] as string);
        } catch {}
      }
      existingMap.set(id, row);
    }

    const threadIdsToUpdate = new Set<string>();
    try {
      await this.db.pool.withTransaction(async conn => {
        for (const message of messages) {
          const existing = existingMap.get(message.id);
          if (!existing) continue;
          const existingThreadId = (existing['thread_id'] ?? existing['threadId']) as string | undefined;
          if (existingThreadId) threadIdsToUpdate.add(existingThreadId);
          if (message.threadId && message.threadId !== existingThreadId) {
            threadIdsToUpdate.add(message.threadId);
          }

          const setClauses: string[] = [];
          const params: unknown[] = [];

          if ('content' in message && message.content !== undefined) {
            const existingContent = (existing['content'] as Record<string, unknown>) ?? {};
            const newContent = {
              ...existingContent,
              ...message.content,
              ...(existingContent['metadata'] && message.content.metadata
                ? {
                    metadata: {
                      ...(existingContent['metadata'] as Record<string, unknown>),
                      ...message.content.metadata,
                    },
                  }
                : {}),
            };
            setClauses.push(`"content" = ?`);
            params.push(JSON.stringify(newContent));
          }
          if ('role' in message && message.role !== undefined) {
            setClauses.push(`"role" = ?`);
            params.push(message.role);
          }
          if ('threadId' in message && message.threadId !== undefined) {
            setClauses.push(`"thread_id" = ?`);
            params.push(message.threadId);
          }
          if (setClauses.length === 0) continue;
          params.push(message.id);
          await conn.execPromise(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE "id" = ?`, params);
        }
        if (threadIdsToUpdate.size > 0) {
          const threadPlaceholders = Array.from(threadIdsToUpdate)
            .map(() => '?')
            .join(', ');
          await conn.execPromise(`UPDATE ${threadTable} SET "updatedAt" = ? WHERE "id" IN (${threadPlaceholders})`, [
            new Date().toISOString(),
            ...Array.from(threadIdsToUpdate),
          ]);
        }
      });
      const rows = await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${tableName} WHERE "id" IN (${selectPlaceholders}) ORDER BY "seq_id" ASC`,
          messageIds,
        ),
      );
      return this._parseAndFormatMessages(rows as Array<Record<string, unknown>>, 'v2') as MastraDBMessage[];
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    const messagesTable = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    const threadsTable = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.schema) });
    const placeholders = messageIds.map(() => '?').join(', ');
    try {
      // Fetch the thread IDs for these messages before deleting
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT DISTINCT "thread_id" FROM ${messagesTable} WHERE "id" IN (${placeholders})`,
          messageIds,
        ),
      )) as Array<{ thread_id: string }>;
      const threadIds = rows.map(r => r['thread_id']).filter(Boolean);

      await this.db.pool.withTransaction(async conn => {
        await conn.execPromise(`DELETE FROM ${messagesTable} WHERE "id" IN (${placeholders})`, messageIds);
        if (threadIds.length > 0) {
          const threadPlaceholders = threadIds.map(() => '?').join(', ');
          await conn.execPromise(`UPDATE ${threadsTable} SET "updatedAt" = ? WHERE "id" IN (${threadPlaceholders})`, [
            new Date().toISOString(),
            ...threadIds,
          ]);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
      const rows = await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${tableName} WHERE "id" = ?`, [resourceId]),
      );
      const row = (rows as Array<Record<string, unknown>>)[0];
      if (!row) return null;
      return {
        id: row['id'] as string,
        workingMemory:
          typeof row['workingMemory'] === 'string'
            ? (row['workingMemory'] as string)
            : (row['workingMemory'] as string | undefined),
        metadata: typeof row['metadata'] === 'string' ? JSON.parse(row['metadata'] as string) : row['metadata'],
        createdAt: row['createdAt'] instanceof Date ? row['createdAt'] : new Date(row['createdAt'] as string),
        updatedAt: row['updatedAt'] instanceof Date ? row['updatedAt'] : new Date(row['updatedAt'] as string),
      } as StorageResourceType;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_RESOURCE_BY_ID', 'FAILED'),
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
      const table = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `UPSERT ${table} ("id", "workingMemory", "metadata", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?) WITH PRIMARY KEY`,
          [
            resource.id,
            resource.workingMemory !== undefined ? resource.workingMemory : null,
            resource.metadata ? JSON.stringify(resource.metadata) : null,
            resource.createdAt instanceof Date ? resource.createdAt.toISOString() : resource.createdAt,
            resource.updatedAt instanceof Date ? resource.updatedAt.toISOString() : resource.updatedAt,
          ],
        ),
      );
      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'SAVE_RESOURCE', 'FAILED'),
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
        return this.saveResource({
          resource: {
            id: resourceId,
            workingMemory,
            metadata: metadata ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      const updatedResource: StorageResourceType = {
        ...existing,
        workingMemory: workingMemory !== undefined ? workingMemory : existing.workingMemory,
        metadata: { ...existing.metadata, ...metadata },
        updatedAt: new Date(),
      };
      const table = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
      const setClauses: string[] = [];
      const params: unknown[] = [];
      if (workingMemory !== undefined) {
        setClauses.push(`"workingMemory" = ?`);
        params.push(workingMemory);
      }
      if (metadata !== undefined) {
        setClauses.push(`"metadata" = ?`);
        params.push(JSON.stringify(updatedResource.metadata));
      }
      setClauses.push(`"updatedAt" = ?`);
      params.push(updatedResource.updatedAt.toISOString());
      params.push(resourceId);
      await this.db.pool.withConnection(conn =>
        conn.execPromise(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE "id" = ?`, params),
      );
      return updatedResource;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_RESOURCE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async deleteResource({ resourceId }: { resourceId: string }): Promise<void> {
    try {
      const table = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn => conn.execPromise(`DELETE FROM ${table} WHERE "id" = ?`, [resourceId]));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_RESOURCE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }
}
