import type { MastraMessageContentV2 } from '@mastra/core/agent';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  calculatePagination,
  MemoryStorage,
  normalizePerPage,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
  validateStorageMetadataFilter,
} from '@mastra/core/storage';
import type {
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageMetadataFilter,
  StorageResourceType,
} from '@mastra/core/storage';
import type { TursoConnection, TursoStatement } from '../db/connection';
import { parseJsonColumn, parseTimestamp, serializeRow } from '../db/rows';
import { buildDelete, buildInsert, quoteIdentifier } from '../db/sql';
import type { TursoValue } from '../db/values';

/** Default page sizes, matching the other storage adapters. */
const DEFAULT_MESSAGES_PER_PAGE = 40;
const DEFAULT_THREADS_PER_PAGE = 100;

type Row = Record<string, TursoValue>;

/**
 * Thread, message, and resource storage for Turso.
 *
 * Ordering and pagination follow the shared storage contract, so results are
 * interchangeable with the other SQL adapters.
 */
export class TursoMemory extends MemoryStorage {
  /** `updateThread` leaves omitted fields untouched. */
  readonly supportsPartialThreadUpdate = true;

  readonly #connection: TursoConnection;

  constructor({ connection }: { connection: TursoConnection }) {
    super();
    this.#connection = connection;
  }

  async init(): Promise<void> {
    await this.#connection.batch([
      createTable(TABLE_THREADS),
      createTable(TABLE_MESSAGES),
      createTable(TABLE_RESOURCES),
      // Message reads are always scoped to a thread and ordered by time.
      `CREATE INDEX IF NOT EXISTS mastra_messages_thread_created_idx ON ${quoteIdentifier(TABLE_MESSAGES)} ("thread_id", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS mastra_messages_resource_idx ON ${quoteIdentifier(TABLE_MESSAGES)} ("resourceId")`,
      `CREATE INDEX IF NOT EXISTS mastra_threads_resource_idx ON ${quoteIdentifier(TABLE_THREADS)} ("resourceId", "createdAt")`,
    ]);
  }

  // ---------------------------------------------------------------- threads

  async getThreadById({ threadId, resourceId }: { threadId: string; resourceId?: string }) {
    const result = await this.#connection.execute({
      sql: `SELECT * FROM ${quoteIdentifier(TABLE_THREADS)} WHERE "id" = ?${resourceId ? ' AND "resourceId" = ?' : ''}`,
      params: resourceId ? [threadId, resourceId] : [threadId],
    });

    const row = result.rows[0];
    return row ? toThread(row) : null;
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const now = new Date();
    const record = serializeRow(TABLE_THREADS, {
      ...thread,
      metadata: thread.metadata ?? {},
      createdAt: thread.createdAt ?? now,
      updatedAt: thread.updatedAt ?? now,
    });

    // Saving an existing thread refreshes it rather than failing.
    await this.#connection.execute(buildInsert(TABLE_THREADS, record, { upsertOn: ['id'] }));

    const saved = await this.getThreadById({ threadId: thread.id });
    if (!saved) {
      throw new Error(`Thread ${thread.id} vanished immediately after being saved.`);
    }
    return saved;
  }

  /**
   * Updates a thread's title and/or metadata.
   *
   * Omitted fields are left untouched, so a caller changing only metadata
   * cannot clobber a title written concurrently.
   */
  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (metadata !== undefined) updates.metadata = metadata;

    const serialized = serializeRow(TABLE_THREADS, updates);
    const columns = Object.keys(serialized);

    const result = await this.#connection.execute({
      sql: `UPDATE ${quoteIdentifier(TABLE_THREADS)} SET ${columns
        .map(column => `${quoteIdentifier(column)} = ?`)
        .join(', ')} WHERE "id" = ?`,
      params: [...columns.map(column => serialized[column]!), id],
    });

    if (result.rowsAffected === 0) {
      throw new Error(`Thread ${id} not found.`);
    }

    const updated = await this.getThreadById({ threadId: id });
    if (!updated) {
      throw new Error(`Thread ${id} not found after update.`);
    }
    return updated;
  }

  /** Deletes a thread and its messages. */
  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // One transaction, so a thread is never left without its messages.
    await this.#connection.batch([
      buildDelete(TABLE_MESSAGES, { thread_id: threadId }),
      buildDelete(TABLE_THREADS, { id: threadId }),
    ]);
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { filter, perPage: perPageInput, page = 0, orderBy } = args;

    const conditions: string[] = [];
    const params: TursoValue[] = [];

    if (filter?.resourceId) {
      conditions.push('"resourceId" = ?');
      params.push(filter.resourceId);
    }

    const metadataFilter = validateStorageMetadataFilter(filter?.metadata as StorageMetadataFilter | undefined);
    if (metadataFilter) {
      appendMetadataConditions(conditions, params, 'metadata', metadataFilter);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const perPage = normalizePerPage(perPageInput, DEFAULT_THREADS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const totalResult = await this.#connection.execute({
      sql: `SELECT COUNT(*) AS total FROM ${quoteIdentifier(TABLE_THREADS)}${where}`,
      params,
    });
    const total = Number(totalResult.rows[0]?.total ?? 0);

    if (perPage === 0) {
      return { threads: [], total, page, perPage: perPageForResponse, hasMore: false };
    }

    const result = await this.#connection.execute({
      sql: `SELECT * FROM ${quoteIdentifier(TABLE_THREADS)}${where} ORDER BY ${orderClause(orderBy)} LIMIT ? OFFSET ?`,
      params: [...params, perPage, offset],
    });

    return {
      threads: result.rows.map(toThread),
      total,
      page,
      perPage: perPageForResponse,
      hasMore: perPageInput !== false && offset + result.rows.length < total,
    };
  }

  // --------------------------------------------------------------- messages

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };

    const now = new Date();
    const statements: TursoStatement[] = messages.map(message =>
      buildInsert(
        TABLE_MESSAGES,
        serializeRow(TABLE_MESSAGES, {
          id: message.id,
          thread_id: message.threadId,
          resourceId: message.resourceId ?? null,
          content: message.content,
          role: message.role,
          type: message.type ?? 'v2',
          createdAt: message.createdAt ?? now,
        }),
        { upsertOn: ['id'] },
      ),
    );

    // A thread's updatedAt reflects its newest message.
    const threadIds = [...new Set(messages.map(message => message.threadId).filter(Boolean))] as string[];
    for (const threadId of threadIds) {
      statements.push({
        sql: `UPDATE ${quoteIdentifier(TABLE_THREADS)} SET "updatedAt" = ? WHERE "id" = ?`,
        params: [now.toISOString(), threadId],
      });
    }

    await this.#connection.batch(statements);
    return { messages };
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

    const result = await this.#connection.execute({
      sql: `SELECT * FROM ${quoteIdentifier(TABLE_MESSAGES)} WHERE "id" IN (${messageIds.map(() => '?').join(', ')}) ORDER BY "createdAt" ASC`,
      params: messageIds,
    });

    return { messages: result.rows.map(toMessage) };
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    const conditions: string[] = [`"thread_id" IN (${threadIds.map(() => '?').join(', ')})`];
    const params: TursoValue[] = [...threadIds];

    if (resourceId) {
      conditions.push('"resourceId" = ?');
      params.push(resourceId);
    }

    const range = filter?.dateRange;
    if (range?.start) {
      conditions.push(`"createdAt" ${range.startExclusive ? '>' : '>='} ?`);
      params.push(range.start.toISOString());
    }
    if (range?.end) {
      conditions.push(`"createdAt" ${range.endExclusive ? '<' : '<='} ?`);
      params.push(range.end.toISOString());
    }

    const metadataFilter = validateStorageMetadataFilter(filter?.metadata as StorageMetadataFilter | undefined);
    if (metadataFilter) {
      // Message metadata lives inside the serialized content document.
      appendMetadataConditions(conditions, params, 'content', metadataFilter, '$.metadata.');
    }

    const where = ` WHERE ${conditions.join(' AND ')}`;
    const perPage = normalizePerPage(perPageInput, DEFAULT_MESSAGES_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const totalResult = await this.#connection.execute({
      sql: `SELECT COUNT(*) AS total FROM ${quoteIdentifier(TABLE_MESSAGES)}${where}`,
      params,
    });
    const total = Number(totalResult.rows[0]?.total ?? 0);

    if (perPage === 0) {
      return { messages: [], total, page, perPage: perPageForResponse, hasMore: false };
    }

    const result = await this.#connection.execute({
      sql: `SELECT * FROM ${quoteIdentifier(TABLE_MESSAGES)}${where} ORDER BY ${orderClause(orderBy, 'createdAt')} LIMIT ? OFFSET ?`,
      params: [...params, perPage, offset],
    });

    return {
      messages: result.rows.map(toMessage),
      total,
      page,
      perPage: perPageForResponse,
      hasMore: perPageInput !== false && offset + result.rows.length < total,
    };
  }

  /**
   * Applies partial updates to messages.
   *
   * `content` is merged field-by-field rather than replaced, so an update
   * carrying only `metadata` keeps the existing parts.
   */
  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;
    if (messages.length === 0) return [];

    const existing = await this.listMessagesById({ messageIds: messages.map(message => message.id) });
    const byId = new Map(existing.messages.map(message => [message.id, message]));

    const statements: TursoStatement[] = [];
    const updated: MastraDBMessage[] = [];

    for (const update of messages) {
      const current = byId.get(update.id);
      if (!current) continue;

      const content = update.content
        ? {
            ...current.content,
            ...(update.content.content === undefined ? {} : { content: update.content.content }),
            ...(update.content.metadata === undefined
              ? {}
              : { metadata: { ...current.content.metadata, ...update.content.metadata } }),
          }
        : current.content;

      const next: MastraDBMessage = {
        ...current,
        ...(update.role === undefined ? {} : { role: update.role }),
        ...(update.threadId === undefined ? {} : { threadId: update.threadId }),
        ...(update.resourceId === undefined ? {} : { resourceId: update.resourceId }),
        content,
      };

      const record = serializeRow(TABLE_MESSAGES, {
        content: next.content,
        role: next.role,
        thread_id: next.threadId,
        resourceId: next.resourceId ?? null,
      });
      const columns = Object.keys(record);

      statements.push({
        sql: `UPDATE ${quoteIdentifier(TABLE_MESSAGES)} SET ${columns
          .map(column => `${quoteIdentifier(column)} = ?`)
          .join(', ')} WHERE "id" = ?`,
        params: [...columns.map(column => record[column]!), update.id],
      });
      updated.push(next);
    }

    if (statements.length > 0) await this.#connection.batch(statements);
    return updated;
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    await this.#connection.execute({
      sql: `DELETE FROM ${quoteIdentifier(TABLE_MESSAGES)} WHERE "id" IN (${messageIds.map(() => '?').join(', ')})`,
      params: messageIds,
    });
  }

  // -------------------------------------------------------------- resources

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const result = await this.#connection.execute({
      sql: `SELECT * FROM ${quoteIdentifier(TABLE_RESOURCES)} WHERE "id" = ?`,
      params: [resourceId],
    });

    const row = result.rows[0];
    return row ? toResource(row) : null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    const record = serializeRow(TABLE_RESOURCES, {
      ...resource,
      metadata: resource.metadata ?? {},
      createdAt: resource.createdAt ?? new Date(),
      updatedAt: resource.updatedAt ?? new Date(),
    });

    await this.#connection.execute(buildInsert(TABLE_RESOURCES, record, { upsertOn: ['id'] }));
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
    const existing = await this.getResourceById({ resourceId });

    if (!existing) {
      // Updating an absent resource creates it, matching the other adapters.
      return this.saveResource({
        resource: {
          id: resourceId,
          workingMemory,
          metadata: metadata ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        } as StorageResourceType,
      });
    }

    const next: StorageResourceType = {
      ...existing,
      ...(workingMemory === undefined ? {} : { workingMemory }),
      metadata: metadata === undefined ? existing.metadata : { ...existing.metadata, ...metadata },
      updatedAt: new Date(),
    };

    await this.saveResource({ resource: next });
    return next;
  }

  /** Removes every row this domain owns. */
  async dangerouslyClearAll(): Promise<void> {
    await this.#connection.batch([
      buildDelete(TABLE_MESSAGES),
      buildDelete(TABLE_THREADS),
      buildDelete(TABLE_RESOURCES),
    ]);
  }
}

/**
 * Appends one `json_extract` condition per metadata filter entry.
 *
 * `null` uses `IS NULL` because `= NULL` is never true in SQL, and booleans
 * bind as 1/0 to match how `json_extract` returns them.
 */
function appendMetadataConditions(
  conditions: string[],
  params: TursoValue[],
  column: string,
  filter: StorageMetadataFilter,
  prefix = '$.',
): void {
  for (const [key, value] of Object.entries(filter)) {
    const path = `${prefix}${key}`;

    if (value === null) {
      // Also matches rows where the key is absent, as in the other adapters.
      conditions.push(`json_extract(${quoteIdentifier(column)}, ?) IS NULL`);
      params.push(path);
      continue;
    }

    conditions.push(`json_extract(${quoteIdentifier(column)}, ?) = ?`);
    params.push(path, typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }
}

/** Builds a `CREATE TABLE` from the canonical schema for `tableName`. */
function createTable(tableName: typeof TABLE_THREADS | typeof TABLE_MESSAGES | typeof TABLE_RESOURCES): string {
  const schema = TABLE_SCHEMAS[tableName];
  const columns = Object.entries(schema).map(([name, column]) => {
    const parts = [quoteIdentifier(name), column.type === 'integer' ? 'INTEGER' : 'TEXT'];
    if (column.primaryKey) parts.push('PRIMARY KEY');
    if (column.nullable === false && !column.primaryKey) parts.push('NOT NULL');
    return parts.join(' ');
  });

  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (${columns.join(', ')})`;
}

/** Renders an ORDER BY clause, defaulting to newest-first. */
function orderClause(
  orderBy: { field?: string; direction?: string } | undefined,
  defaultField = 'createdAt',
): string {
  const field = orderBy?.field ?? defaultField;
  const direction = String(orderBy?.direction ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Only known sortable columns are accepted, so the clause cannot be injected.
  const allowed = new Set(['createdAt', 'updatedAt']);
  const column = allowed.has(field) ? field : defaultField;

  return `${quoteIdentifier(column)} ${direction}`;
}

function toThread(row: Row): StorageThreadType {
  return {
    id: String(row.id),
    resourceId: String(row.resourceId),
    title: String(row.title ?? ''),
    metadata: parseJsonColumn(row.metadata, {} as Record<string, unknown>),
    createdAt: parseTimestamp(row.createdAt) ?? new Date(0),
    updatedAt: parseTimestamp(row.updatedAt) ?? new Date(0),
  };
}

function toMessage(row: Row): MastraDBMessage {
  return {
    id: String(row.id),
    threadId: row.thread_id === null ? undefined : String(row.thread_id),
    resourceId: row.resourceId === null ? undefined : String(row.resourceId),
    content: parseJsonColumn(row.content, { format: 2, parts: [] } as unknown as MastraMessageContentV2),
    role: String(row.role) as MastraDBMessage['role'],
    type: row.type === null ? undefined : (String(row.type) as MastraDBMessage['type']),
    createdAt: parseTimestamp(row.createdAt) ?? new Date(0),
  } as MastraDBMessage;
}

function toResource(row: Row): StorageResourceType {
  return {
    id: String(row.id),
    workingMemory: row.workingMemory === null ? undefined : String(row.workingMemory),
    metadata: parseJsonColumn(row.metadata, {} as Record<string, unknown>),
    createdAt: parseTimestamp(row.createdAt) ?? new Date(0),
    updatedAt: parseTimestamp(row.updatedAt) ?? new Date(0),
  } as StorageResourceType;
}
