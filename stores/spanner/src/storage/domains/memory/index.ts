import type { Database } from '@google-cloud/spanner';
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
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageMetadataFilter,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { buildDateRangeFilter, transformFromSpannerRow } from '../utils';

function buildSpannerMessageMetadataFilter(metadataFilter: StorageMetadataFilter | undefined): {
  clauses: string[];
  params: Record<string, unknown>;
} {
  if (!metadataFilter) return { clauses: [], params: {} };

  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  Object.entries(metadataFilter).forEach(([key, value], index) => {
    const path = `$.metadata.${key}`;
    const valueExpr = `JSON_VALUE(SAFE.PARSE_JSON(content), '${path}')`;
    const queryExpr = `JSON_QUERY(SAFE.PARSE_JSON(content), '${path}')`;
    const typeExpr = `JSON_TYPE(${queryExpr})`;

    if (value === null) {
      clauses.push(`${queryExpr} = 'null'`);
      return;
    }

    const paramName = `metadataValue${index}`;
    if (typeof value === 'string') {
      params[paramName] = value;
      clauses.push(`${typeExpr} = 'string' AND ${valueExpr} = @${paramName}`);
      return;
    }

    if (typeof value === 'number') {
      params[paramName] = String(value);
      clauses.push(`${typeExpr} = 'number' AND ${valueExpr} = @${paramName}`);
      return;
    }

    params[paramName] = value ? 'true' : 'false';
    clauses.push(`${typeExpr} = 'boolean' AND ${valueExpr} = @${paramName}`);
  });

  return { clauses, params };
}

/**
 * Spanner-backed storage for memory primitives: threads, messages, and resources
 * (the durable state surface used by `@mastra/memory`).
 */
export class MemorySpanner extends MemoryStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (MemorySpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /** Creates the threads/messages/resources tables and any indexes. */
  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /** Returns the default index set this domain creates during `init()`. */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_threads_resourceid_createdat_idx',
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt DESC'],
      },
      {
        name: 'mastra_messages_thread_id_createdat_idx',
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt DESC'],
      },
    ];
  }

  /** Creates the default indexes; no-op when `skipDefaultIndexes` was set. */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  /** Creates custom indexes routed to this domain's tables; no-op when none supplied. */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  /** Removes every row from threads/messages/resources tables. Intended for tests. */
  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_MESSAGES });
    await this.db.clearTable({ tableName: TABLE_THREADS });
    await this.db.clearTable({ tableName: TABLE_RESOURCES });
  }

  /**
   * Fetches a thread row by id, or `null` when absent.
   *
   * When `resourceId` is supplied (including the empty string) it scopes the
   * lookup so callers can enforce multi-tenant isolation: a thread that
   * exists under a different resourceId is reported as missing rather than
   * leaking across tenants.
   */
  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    try {
      const params: Record<string, any> = { threadId };
      let where = `id = @threadId`;
      if (resourceId !== undefined) {
        where += ` AND ${quoteIdent('resourceId', 'column name')} = @resourceId`;
        params.resourceId = resourceId;
      }
      const [rows] = await this.database.run({
        sql: `SELECT id, ${quoteIdent('resourceId', 'column name')}, title, metadata, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('updatedAt', 'column name')}
              FROM ${quoteIdent(TABLE_THREADS, 'table name')}
              WHERE ${where}`,
        params,
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      return this.formatThreadRow(row);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_THREAD_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  private formatThreadRow(row: Record<string, any>): StorageThreadType {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_THREADS, row });
    return {
      id: transformed.id,
      resourceId: transformed.resourceId,
      title: transformed.title,
      metadata: transformed.metadata ?? {},
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    };
  }

  /** Paginated thread listing with optional resourceId/metadata/date-range filters. */
  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;
    try {
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('SPANNER', 'LIST_THREADS', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid pagination parameters',
        details: { page, ...(perPageInput !== undefined && { perPage: perPageInput }) },
      });
    }
    const perPage = normalizePerPage(perPageInput, 100);

    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('SPANNER', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid metadata key',
        details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
      });
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);

    try {
      const tableName = quoteIdent(TABLE_THREADS, 'table name');
      const whereClauses: string[] = [];
      const params: Record<string, any> = {};

      if (filter?.resourceId) {
        whereClauses.push(`${quoteIdent('resourceId', 'column name')} = @resourceId`);
        params.resourceId = filter.resourceId;
      }

      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        let metadataIndex = 0;
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (value !== null && typeof value === 'object') {
            throw new MastraError({
              id: createStorageErrorId('SPANNER', 'LIST_THREADS', 'INVALID_METADATA_VALUE'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Metadata filter value for key "${key}" must be a scalar type, got ${Array.isArray(value) ? 'array' : 'object'}`,
              details: { key, valueType: Array.isArray(value) ? 'array' : 'object' },
            });
          }
          if (value === null) {
            whereClauses.push(`JSON_VALUE(metadata, '$.${key}') IS NULL`);
          } else {
            const paramName = `metadata${metadataIndex}`;
            whereClauses.push(`JSON_VALUE(metadata, '$.${key}') = @${paramName}`);
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

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS total FROM ${tableName} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ total: number | string }>)[0]?.total ?? 0);
      if (total === 0) {
        return { threads: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const orderField = field === 'createdAt' ? 'createdAt' : 'updatedAt';
      const dir = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const limit = perPageInput === false ? total : perPage;
      const dataSql = `SELECT id, ${quoteIdent('resourceId', 'column name')}, title, metadata, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('updatedAt', 'column name')}
                       FROM ${tableName} ${whereSql}
                       ORDER BY ${quoteIdent(orderField, 'column name')} ${dir}, id ${dir}
                       LIMIT @limit OFFSET @offset`;
      const [rows] = await this.database.run({
        sql: dataSql,
        params: { ...params, limit, offset },
        json: true,
      });
      const threads = (rows as Array<Record<string, any>>).map(r => this.formatThreadRow(r));
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
          id: createStorageErrorId('SPANNER', 'LIST_THREADS', 'FAILED'),
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

  /** Upserts a thread row by id (`INSERT OR UPDATE` semantics). */
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.db.upsert({
        tableName: TABLE_THREADS,
        record: {
          id: thread.id,
          resourceId: thread.resourceId,
          title: thread.title,
          metadata: thread.metadata ?? {},
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        },
      });
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'SAVE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: thread.id },
        },
        error,
      );
    }
  }

  /** Updates a thread's title and merges the metadata payload. */
  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const tableThreads = quoteIdent(TABLE_THREADS, 'table name');
    const now = new Date();
    let merged: Record<string, unknown> = {};
    let existingThread: StorageThreadType | null = null;
    try {
      // Read the row inside the transaction so it acquires a row lock; this
      // protects the metadata merge from a lost-update race against another
      // concurrent updateThread call.
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [rows] = await tx.run({
              sql: `SELECT * FROM ${tableThreads} WHERE id = @id LIMIT 1`,
              params: { id },
              json: true,
            });
            const row = (rows as Array<Record<string, any>>)[0];
            if (!row) {
              throw new MastraError({
                id: createStorageErrorId('SPANNER', 'UPDATE_THREAD', 'NOT_FOUND'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                text: `Thread ${id} not found`,
                details: { threadId: id, title },
              });
            }
            existingThread = this.formatThreadRow(row);
            merged = { ...(existingThread.metadata ?? {}), ...metadata };
            await this.db.update({
              tableName: TABLE_THREADS,
              keys: { id },
              data: {
                title,
                metadata: merged,
                updatedAt: now,
              },
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
      return {
        ...(existingThread as unknown as StorageThreadType),
        title,
        metadata: merged,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id, title },
        },
        error,
      );
    }
  }

  /** Deletes a thread and all its messages atomically. */
  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const messagesTable = quoteIdent(TABLE_MESSAGES, 'table name');
    const threadsTable = quoteIdent(TABLE_THREADS, 'table name');
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${messagesTable} WHERE ${quoteIdent('thread_id', 'column name')} = @threadId`,
              params: { threadId },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${threadsTable} WHERE id = @threadId`,
              params: { threadId },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  /** Parses raw message rows and converts them into the requested API format ('v1' or 'v2'). */
  private parseAndFormatMessages(messages: any[], format?: 'v1' | 'v2') {
    const parsed = messages.map(message => {
      if (typeof message.content === 'string') {
        try {
          return { ...message, content: JSON.parse(message.content) };
        } catch {
          return message;
        }
      }
      return message;
    });
    const list = new MessageList().add(parsed as (MastraMessageV1 | MastraDBMessage)[], 'memory');
    return format === 'v2' ? list.get.all.db() : list.get.all.v1();
  }

  /** Fetches a batch of messages by id; missing ids are silently dropped. */
  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    try {
      const params: Record<string, any> = {};
      const placeholders = messageIds
        .map((id, i) => {
          const name = `id${i}`;
          params[name] = id;
          return `@${name}`;
        })
        .join(', ');
      const sql = `SELECT id, content, role, type, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('thread_id', 'column name')} AS threadId, ${quoteIdent('resourceId', 'column name')}
                   FROM ${quoteIdent(TABLE_MESSAGES, 'table name')}
                   WHERE id IN (${placeholders})
                   ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, id DESC`;
      const [rows] = await this.database.run({ sql, params, json: true });
      const transformed = (rows as Array<Record<string, any>>).map(r =>
        transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_MESSAGES, row: r }),
      );
      transformed.sort((a, b) => {
        const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        if (at !== bt) return at - bt;
        return String(a.id).localeCompare(String(b.id));
      });
      return { messages: this.parseAndFormatMessages(transformed, 'v2') as MastraDBMessage[] };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_MESSAGES_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return { messages: [] };
    }
  }

  /** Resolves the `include` clause: pinned messages plus their before/after windows. */
  private async getIncludedMessages({ include }: { include: StorageListMessagesInput['include'] }) {
    if (!include || include.length === 0) return null;

    const ids = include.map(i => i.id);
    const placeholders: string[] = [];
    const idParams: Record<string, any> = {};
    ids.forEach((id, i) => {
      const name = `tid${i}`;
      placeholders.push(`@${name}`);
      idParams[name] = id;
    });
    const targetsSql = `SELECT id, content, role, type, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('thread_id', 'column name')} AS threadId, ${quoteIdent('resourceId', 'column name')}
                        FROM ${quoteIdent(TABLE_MESSAGES, 'table name')}
                        WHERE id IN (${placeholders.join(', ')})`;
    const [targetRows] = await this.database.run({ sql: targetsSql, params: idParams, json: true });
    const targetsById = new Map<string, Record<string, any>>();
    for (const t of targetRows as Array<Record<string, any>>) targetsById.set(t.id as string, t);

    const allRows: Record<string, any>[] = [];
    const seen = new Set<string>();
    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      const target = targetsById.get(id);
      if (!target) continue;

      const threadId = target.threadId as string;
      const targetCreatedAt =
        target.createdAt instanceof Date ? target.createdAt.toISOString() : (target.createdAt as string);

      if (!seen.has(target.id)) {
        seen.add(target.id);
        allRows.push(target);
      }

      if (withPreviousMessages > 0) {
        const [prev] = await this.database.run({
          sql: `SELECT id, content, role, type, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('thread_id', 'column name')} AS threadId, ${quoteIdent('resourceId', 'column name')}
                FROM ${quoteIdent(TABLE_MESSAGES, 'table name')}
                WHERE ${quoteIdent('thread_id', 'column name')} = @threadId
                  AND (${quoteIdent('createdAt', 'column name')} < @ts OR (${quoteIdent('createdAt', 'column name')} = @ts AND id < @id))
                ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, id DESC
                LIMIT @lim`,
          params: { threadId, ts: targetCreatedAt, id: target.id, lim: withPreviousMessages },
          json: true,
        });
        for (const row of (prev as Array<Record<string, any>>).reverse()) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            allRows.push(row);
          }
        }
      }

      if (withNextMessages > 0) {
        const [next] = await this.database.run({
          sql: `SELECT id, content, role, type, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('thread_id', 'column name')} AS threadId, ${quoteIdent('resourceId', 'column name')}
                FROM ${quoteIdent(TABLE_MESSAGES, 'table name')}
                WHERE ${quoteIdent('thread_id', 'column name')} = @threadId
                  AND (${quoteIdent('createdAt', 'column name')} > @ts OR (${quoteIdent('createdAt', 'column name')} = @ts AND id > @id))
                ORDER BY ${quoteIdent('createdAt', 'column name')} ASC, id ASC
                LIMIT @lim`,
          params: { threadId, ts: targetCreatedAt, id: target.id, lim: withNextMessages },
          json: true,
        });
        for (const row of next as Array<Record<string, any>>) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            allRows.push(row);
          }
        }
      }
    }

    return allRows.map(r => transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_MESSAGES, row: r }));
  }

  /** Paginated message listing for a thread, with optional pinned-include and date-range filters. */
  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];
    if (threadIds.length === 0 || threadIds.some(id => !id || !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }
    // Reuse the base-class pagination contract (matches listThreads above).
    // It throws a clear Error which the outer try/catch wraps into a typed
    // MastraError below.
    this.validatePaginationInput(page, perPageInput ?? 40);

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderClause = `ORDER BY ${quoteIdent(field, 'column name')} ${direction}, id ${direction}`;
      const tableName = quoteIdent(TABLE_MESSAGES, 'table name');

      const filters: Record<string, any> = {
        thread_id: threadIds.length === 1 ? threadIds[0] : { $in: threadIds },
        ...(resourceId ? { resourceId } : {}),
        ...buildDateRangeFilter(filter?.dateRange, 'createdAt'),
      };
      const {
        sql: preparedWhereSql,
        params: whereParams,
        types: whereTypes,
      } = this.db.prepareWhereClause(filters, TABLE_MESSAGES);
      const metadataWhere = buildSpannerMessageMetadataFilter(metadataFilter);
      const whereSql = [preparedWhereSql, ...metadataWhere.clauses].reduce((sql, clause) => {
        if (!clause) return sql;
        return sql ? `${sql} AND ${clause}` : ` WHERE ${clause}`;
      }, '');
      Object.assign(whereParams, metadataWhere.params);

      if (perPage === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      // perPage=0 with includes: skip COUNT and base queries; only fetch the
      // included messages.
      if (perPage === 0 && include && include.length > 0) {
        const includeMessages = (await this.getIncludedMessages({ include })) ?? [];
        const parsedIncludes = this.parseAndFormatMessages(includeMessages, 'v2') as MastraDBMessage[];
        const dirMul = direction === 'ASC' ? 1 : -1;
        const sortedIncludes = parsedIncludes.sort((a, b) => {
          const aVal = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
          const bVal = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];
          if (aVal == null || bVal == null) {
            return aVal == null && bVal == null ? a.id.localeCompare(b.id) : aVal == null ? 1 : -1;
          }
          const diff =
            (typeof aVal === 'number' && typeof bVal === 'number'
              ? aVal - bVal
              : String(aVal).localeCompare(String(bVal))) * dirMul;
          return diff !== 0 ? diff : a.id.localeCompare(b.id) * dirMul;
        });
        return {
          messages: sortedIncludes,
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Total count
      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS total FROM ${tableName}${whereSql}`,
        params: whereParams,
        types: whereTypes,
        json: true,
      });
      const total = Number((countRows as Array<{ total: number | string }>)[0]?.total ?? 0);

      // Paginated rows
      const baseRows: Record<string, any>[] = [];
      if (perPage > 0) {
        const baseQuery = `SELECT id, content, role, type, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('thread_id', 'column name')} AS threadId, ${quoteIdent('resourceId', 'column name')}
                           FROM ${tableName}${whereSql}
                           ${orderClause}
                           ${perPageInput === false ? '' : 'LIMIT @limit OFFSET @offset'}`;
        const dataParams: Record<string, any> = { ...whereParams };
        const dataTypes: Record<string, any> = { ...whereTypes };
        if (perPageInput !== false) {
          dataParams.limit = perPage;
          dataParams.offset = offset;
        }
        const [rows] = await this.database.run({
          sql: baseQuery,
          params: dataParams,
          types: dataTypes,
          json: true,
        });
        baseRows.push(...(rows as Array<Record<string, any>>));
      }

      const messages: Record<string, any>[] = baseRows.map(r =>
        transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_MESSAGES, row: r }),
      );
      const primaryPageCount = messages.length;

      if (total === 0 && messages.length === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      // Includes
      if (include?.length) {
        const seen = new Set(messages.map(m => m.id));
        const includeMessages = await this.getIncludedMessages({ include });
        includeMessages?.forEach(msg => {
          if (!seen.has(msg.id)) {
            messages.push(msg);
            seen.add(msg.id);
          }
        });
      }

      const parsed = this.parseAndFormatMessages(messages, 'v2') as MastraDBMessage[];
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
        return a.id.localeCompare(b.id) * mult;
      });

      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageIds = new Set(
        finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).map(m => m.id),
      );
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore = metadataFilter
        ? perPageInput !== false && offset + primaryPageCount < total
        : perPageInput !== false && !allThreadMessagesReturned && offset + perPage < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_MESSAGES', 'FAILED'),
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

  /** Upserts a batch of messages and bumps every touched thread's `updatedAt` in a single transaction. */
  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };

    // Collect every distinct threadId touched by this batch and verify each
    // one exists. Previously only messages[0] was validated, so a batch
    // spanning multiple threads could insert orphaned messages and only bump
    // one parent's updatedAt.
    const threadIds = new Set<string>();
    for (const message of messages) {
      if (!message.threadId) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'SAVE_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Thread ID is required for every message',
          details: { messageId: message.id ?? '' },
        });
      }
      threadIds.add(message.threadId);
    }
    const orderedThreadIds = Array.from(threadIds);
    const errorContext = orderedThreadIds.join(',');

    for (const tid of orderedThreadIds) {
      const thread = await this.getThreadById({ threadId: tid });
      if (!thread) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'SAVE_MESSAGES', 'THREAD_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Thread ${tid} not found`,
          details: { threadId: tid },
        });
      }
    }

    const tableMessages = quoteIdent(TABLE_MESSAGES, 'table name');
    const tableThreads = quoteIdent(TABLE_THREADS, 'table name');
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            for (const message of messages) {
              if (!message.resourceId) {
                throw new Error('Expected to find a resourceId for message');
              }
              const sql = `INSERT OR UPDATE INTO ${tableMessages} (id, ${quoteIdent('thread_id', 'column name')}, content, ${quoteIdent('createdAt', 'column name')}, role, type, ${quoteIdent('resourceId', 'column name')})
                           VALUES (@id, @thread_id, @content, @createdAt, @role, @type, @resourceId)`;
              await tx.runUpdate({
                sql,
                params: {
                  id: message.id,
                  thread_id: message.threadId,
                  content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
                  createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
                  role: message.role,
                  type: message.type || 'v2',
                  resourceId: message.resourceId,
                },
              });
            }
            // Bump updatedAt for every thread touched by this batch using a
            // single IN-list UPDATE (cheaper than per-thread round-trips and
            // keeps the change atomic with the message inserts).
            const updatedAt = new Date().toISOString();
            const inParams: Record<string, any> = { updatedAt };
            const placeholders = orderedThreadIds.map((tid, i) => {
              const name = `tid${i}`;
              inParams[name] = tid;
              return `@${name}`;
            });
            await tx.runUpdate({
              sql: `UPDATE ${tableThreads} SET ${quoteIdent('updatedAt', 'column name')} = @updatedAt WHERE id IN (${placeholders.join(', ')})`,
              params: inParams,
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
      const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: errorContext },
        },
        error,
      );
    }
  }

  /** Merges partial updates onto existing messages and bumps affected thread `updatedAt`. */
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
    if (!messages || messages.length === 0) return [];
    const messageIds = messages.map(m => m.id);

    const params: Record<string, any> = {};
    const placeholders = messageIds
      .map((id, i) => {
        const name = `id${i}`;
        params[name] = id;
        return `@${name}`;
      })
      .join(', ');

    const selectSql = `SELECT id, content, role, type, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('thread_id', 'column name')} AS threadId, ${quoteIdent('resourceId', 'column name')}
                       FROM ${quoteIdent(TABLE_MESSAGES, 'table name')}
                       WHERE id IN (${placeholders})`;

    const payloadById = new Map<string, (typeof messages)[number]>();
    for (const m of messages) payloadById.set(m.id, m);

    const threadIdsToUpdate = new Set<string>();
    let anyExisting = false;
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            // Re-read existing rows on every retry. Doing this *outside* the
            // retry let an aborted transaction merge stale row state on the next
            // attempt, under contention that produces lost updates.
            const [existingRows] = await tx.run({ sql: selectSql, params, json: true });
            const existingMessages = (existingRows as Array<Record<string, any>>).map(msg => {
              if (typeof msg.content === 'string') {
                try {
                  msg.content = JSON.parse(msg.content);
                } catch {
                  // leave as-is
                }
              }
              return msg as MastraDBMessage;
            });
            if (existingMessages.length === 0) {
              await tx.commit();
              return;
            }
            anyExisting = true;
            for (const existing of existingMessages) {
              const updatePayload = payloadById.get(existing.id);
              if (!updatePayload) continue;
              const { id, ...fields } = updatePayload;
              if (Object.keys(fields).length === 0) continue;
              if (existing.threadId) threadIdsToUpdate.add(existing.threadId);
              if (updatePayload.threadId && updatePayload.threadId !== existing.threadId) {
                threadIdsToUpdate.add(updatePayload.threadId);
              }
              const setClauses: string[] = [];
              const updateParams: Record<string, any> = { id };
              const columnMapping: Record<string, string> = { threadId: 'thread_id' };
              const updatable: Record<string, any> = { ...fields };
              if (updatable.content) {
                const newContent = {
                  ...existing.content,
                  ...updatable.content,
                  ...(existing.content?.metadata && updatable.content.metadata
                    ? { metadata: { ...existing.content.metadata, ...updatable.content.metadata } }
                    : {}),
                };
                setClauses.push('content = @content');
                updateParams.content = JSON.stringify(newContent);
                delete updatable.content;
              }
              for (const key of Object.keys(updatable)) {
                const dbColumn = columnMapping[key] || key;
                setClauses.push(`${quoteIdent(dbColumn, 'column name')} = @${dbColumn}`);
                updateParams[dbColumn] = updatable[key];
              }
              if (setClauses.length === 0) continue;
              await tx.runUpdate({
                sql: `UPDATE ${quoteIdent(TABLE_MESSAGES, 'table name')} SET ${setClauses.join(', ')} WHERE id = @id`,
                params: updateParams,
              });
            }
            if (threadIdsToUpdate.size > 0) {
              const threadParams: Record<string, any> = {};
              const inClauses = Array.from(threadIdsToUpdate).map((tid, i) => {
                const name = `tid${i}`;
                threadParams[name] = tid;
                return `@${name}`;
              });
              await tx.runUpdate({
                sql: `UPDATE ${quoteIdent(TABLE_THREADS, 'table name')} SET ${quoteIdent('updatedAt', 'column name')} = @updatedAt WHERE id IN (${inClauses.join(', ')})`,
                params: { ...threadParams, updatedAt: new Date().toISOString() },
              });
            }
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    if (!anyExisting) return [];
    const [refetched] = await this.database.run({ sql: selectSql, params, json: true });
    return (refetched as Array<Record<string, any>>).map(msg => {
      if (typeof msg.content === 'string') {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {
          // leave as-is
        }
      }
      const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_MESSAGES, row: msg });
      return transformed as MastraDBMessage;
    });
  }

  /** Deletes a batch of messages and bumps the affected threads' `updatedAt`. */
  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;
    try {
      const messageTableName = quoteIdent(TABLE_MESSAGES, 'table name');
      const threadTableName = quoteIdent(TABLE_THREADS, 'table name');
      const params: Record<string, any> = {};
      const placeholders = messageIds
        .map((id, i) => {
          const name = `p${i}`;
          params[name] = id;
          return `@${name}`;
        })
        .join(', ');

      const [threadRows] = await this.database.run({
        sql: `SELECT DISTINCT ${quoteIdent('thread_id', 'column name')} AS thread_id FROM ${messageTableName} WHERE id IN (${placeholders})`,
        params,
        json: true,
      });
      const threadIds = (threadRows as Array<Record<string, any>>).map(r => r.thread_id).filter(Boolean) as string[];

      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${messageTableName} WHERE id IN (${placeholders})`,
              params,
            });
            if (threadIds.length > 0) {
              for (const tid of threadIds) {
                await tx.runUpdate({
                  sql: `UPDATE ${threadTableName} SET ${quoteIdent('updatedAt', 'column name')} = CURRENT_TIMESTAMP() WHERE id = @id`,
                  params: { id: tid },
                });
              }
            }
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  /** Fetches a resource row by id, or `null` when absent. */
  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT id, ${quoteIdent('workingMemory', 'column name')}, metadata, ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('updatedAt', 'column name')}
              FROM ${quoteIdent(TABLE_RESOURCES, 'table name')}
              WHERE id = @id LIMIT 1`,
        params: { id: resourceId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_RESOURCES, row });
      return {
        id: transformed.id,
        workingMemory: transformed.workingMemory,
        metadata: transformed.metadata,
        createdAt: transformed.createdAt,
        updatedAt: transformed.updatedAt,
      } as StorageResourceType;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_RESOURCE_BY_ID', 'FAILED'),
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

  /** Upserts a resource row by id (`INSERT OR UPDATE` semantics). */
  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.db.upsert({
      tableName: TABLE_RESOURCES,
      record: {
        id: resource.id,
        workingMemory: resource.workingMemory ?? null,
        metadata: resource.metadata ?? {},
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      },
    });
    return resource;
  }

  /** Updates a resource's `workingMemory` and merges its `metadata`. */
  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    const tableResources = quoteIdent(TABLE_RESOURCES, 'table name');
    const now = new Date();
    let updated: StorageResourceType | null = null;
    let createdNew = false;
    try {
      // Read the row inside the transaction so the metadata merge can't lose
      // updates from a concurrent updateResource call.
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [rows] = await tx.run({
              sql: `SELECT * FROM ${tableResources} WHERE id = @id LIMIT 1`,
              params: { id: resourceId },
              json: true,
            });
            const row = (rows as Array<Record<string, any>>)[0];
            if (!row) {
              const newResource: StorageResourceType = {
                id: resourceId,
                workingMemory,
                metadata: metadata || {},
                createdAt: now,
                updatedAt: now,
              };
              await this.db.upsert({
                tableName: TABLE_RESOURCES,
                record: {
                  id: newResource.id,
                  workingMemory: newResource.workingMemory ?? null,
                  metadata: newResource.metadata ?? {},
                  createdAt: newResource.createdAt,
                  updatedAt: newResource.updatedAt,
                },
                transaction: tx,
              });
              updated = newResource;
              createdNew = true;
              await tx.commit();
              return;
            }

            const existing = transformFromSpannerRow<Record<string, any>>({
              tableName: TABLE_RESOURCES,
              row,
            });
            const merged: StorageResourceType = {
              id: existing.id,
              workingMemory: workingMemory !== undefined ? workingMemory : existing.workingMemory,
              metadata: { ...(existing.metadata ?? {}), ...metadata },
              createdAt: existing.createdAt,
              updatedAt: now,
            };
            const data: Record<string, any> = { updatedAt: merged.updatedAt };
            if (workingMemory !== undefined) data.workingMemory = workingMemory;
            if (metadata) data.metadata = merged.metadata;
            await this.db.update({
              tableName: TABLE_RESOURCES,
              keys: { id: resourceId },
              data,
              transaction: tx,
            });
            updated = merged;
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
      // `createdNew` is set inside the closure so subsequent reads in tests
      // don't rely on a stale row image.
      void createdNew;
      return updated as unknown as StorageResourceType;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_RESOURCE', 'FAILED'),
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
}
