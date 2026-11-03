import {
  assertActiveObservationsApplied,
  isAppendOnlySince,
  isBufferedChunkCoveredByCursor,
  maxObservationCursor,
  planReflectionGenerationText,
} from '@internal/core/memory';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  calculatePagination,
  createStorageErrorId,
  MemoryStorage,
  normalizePerPage,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  validateStorageMetadataFilter,
} from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  StorageCloneThreadInput,
  StorageCopyThreadOutput,
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
  UpdateActiveObservationsInput,
  UpdateActiveObservationsResult,
  UpdateBufferedObservationsInput,
  UpdateBufferedObservationsResult,
  UpdateBufferedReflectionInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';
import { RecordId } from 'surrealdb';
import { CONFLICT_MARKER, isConflictError, SurrealDBConnector } from '../../../shared/connector';
import type { SurrealDBDomainConfig } from '../../../shared/connector';
import { MEMORY_SCHEMA, TABLE_OBSERVATIONAL_MEMORY, TABLE_OBSERVATIONAL_MEMORY_KEYS } from '../../schema';
import { addDateRange, recordKey, toDate, toOptionalDate, toRecordContent, totalFrom } from '../utils';

const OM_TABLE = TABLE_OBSERVATIONAL_MEMORY;

/** Optimistic-concurrency retries for observational memory read-decide-write operations. */
const OM_MAX_ATTEMPTS = 50;
/** How many superseded generations a write may follow to reach the live head. */
const OM_MAX_HEAD_HOPS = 8;

const THREAD = (param: string) => `type::record('${TABLE_THREADS}', ${param})`;
const MESSAGE = (param: string) => `type::record('${TABLE_MESSAGES}', ${param})`;
const RESOURCE = (param: string) => `type::record('${TABLE_RESOURCES}', ${param})`;
const OM = (param: string) => `type::record('${OM_TABLE}', ${param})`;
const OM_KEY = (param: string) => `type::record('${TABLE_OBSERVATIONAL_MEMORY_KEYS}', ${param})`;

/** Canonical head order of observational memory generations. */
const OM_HEAD_ORDER = 'generationCount DESC, createdAt ASC, id ASC';

/** Messages with equal timestamps are ordered by id, so context windows are deterministic. */
const MESSAGE_ORDER_ASC = 'createdAt ASC, id ASC';

type Row = Record<string, unknown>;

/** Message content is stored as a plain JSON value, like the SQL stores. */
function toJsonValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function parseThread(row: Row): StorageThreadType {
  return {
    id: recordKey(row.id),
    resourceId: row.resourceId as string,
    title: (row.title as string | undefined) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function parseMessage(row: Row): MastraDBMessage {
  let content = row.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      content = { format: 2, content, parts: [{ type: 'text', text: content }] };
    }
  }
  return {
    id: recordKey(row.id),
    threadId: row.threadId as string,
    ...(row.resourceId ? { resourceId: row.resourceId as string } : {}),
    role: row.role as MastraDBMessage['role'],
    ...(row.type ? { type: row.type as string } : {}),
    content: content as MastraMessageContentV2,
    createdAt: toDate(row.createdAt),
  };
}

function parseResource(row: Row): StorageResourceType {
  return {
    id: recordKey(row.id),
    workingMemory: (row.workingMemory as string | undefined) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function parseChunk(chunk: Row): BufferedObservationChunk {
  return {
    ...chunk,
    lastObservedAt: toDate(chunk.lastObservedAt),
    createdAt: toDate(chunk.createdAt),
  } as BufferedObservationChunk;
}

function parseOMRecord(row: Row): ObservationalMemoryRecord {
  return {
    id: recordKey(row.id),
    scope: row.scope as ObservationalMemoryRecord['scope'],
    threadId: (row.threadId as string | undefined) ?? null,
    resourceId: row.resourceId as string,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    lastObservedAt: toOptionalDate(row.lastObservedAt),
    originType: (row.originType as ObservationalMemoryRecord['originType']) ?? 'initial',
    generationCount: Number(row.generationCount ?? 0),
    supersededBy: (row.supersededBy as string | undefined) ?? null,
    activeObservations: (row.activeObservations as string | undefined) ?? '',
    bufferedObservationChunks: Array.isArray(row.bufferedObservationChunks)
      ? (row.bufferedObservationChunks as Row[]).map(parseChunk)
      : undefined,
    bufferedReflection: (row.bufferedReflection as string | undefined) ?? undefined,
    bufferedReflectionTokens: row.bufferedReflectionTokens as number | undefined,
    bufferedReflectionInputTokens: row.bufferedReflectionInputTokens as number | undefined,
    reflectedObservationLineCount: row.reflectedObservationLineCount as number | undefined,
    observedMessageIds: (row.observedMessageIds as string[] | undefined) ?? undefined,
    observedTimezone: (row.observedTimezone as string | undefined) ?? undefined,
    totalTokensObserved: Number(row.totalTokensObserved ?? 0),
    observationTokenCount: Number(row.observationTokenCount ?? 0),
    pendingMessageTokens: Number(row.pendingMessageTokens ?? 0),
    isReflecting: Boolean(row.isReflecting),
    isObserving: Boolean(row.isObserving),
    isBufferingObservation: Boolean(row.isBufferingObservation),
    isBufferingReflection: Boolean(row.isBufferingReflection),
    lastBufferedAtTokens: Number(row.lastBufferedAtTokens ?? 0),
    lastBufferedAtTime: toOptionalDate(row.lastBufferedAtTime) ?? null,
    config: (row.config as Record<string, unknown> | undefined) ?? {},
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
  };
}

function omLookupKey(threadId: string | null | undefined, resourceId: string): string {
  return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
}

/** Stored form of an observational memory record (absent and `null` values become `NONE`). */
function toOMContent(record: ObservationalMemoryRecord): Row {
  const {
    id: _id,
    bufferedObservations: _bufferedObservations,
    bufferedObservationTokens: _bufferedObservationTokens,
    bufferedMessageIds: _bufferedMessageIds,
    ...rest
  } = record;
  return toRecordContent({
    ...rest,
    lookupKey: omLookupKey(record.threadId, record.resourceId),
    metadata: record.metadata ?? {},
  });
}

/** SurrealQL for "the later of a stored cursor and `$param`" (the cursor never moves backward). */
function laterCursor(field: string, param: string): string {
  return `IF ${param} = NONE { ${field} } ELSE IF ${field} = NONE OR ${field} < ${param} { ${param} } ELSE { ${field} }`;
}

function inDateRange(
  createdAt: Date,
  range: NonNullable<StorageListMessagesInput['filter']>['dateRange'] | undefined,
): boolean {
  const time = toDate(createdAt).getTime();
  if (range?.start) {
    const start = toDate(range.start).getTime();
    if (range.startExclusive ? time <= start : time < start) return false;
  }
  if (range?.end) {
    const end = toDate(range.end).getTime();
    if (range.endExclusive ? time >= end : time > end) return false;
  }
  return true;
}

function sortMessages(messages: MastraDBMessage[], field: string, direction: 'ASC' | 'DESC'): MastraDBMessage[] {
  const factor = direction === 'ASC' ? 1 : -1;
  return messages.sort((a, b) => {
    const av = (a as Record<string, any>)[field];
    const bv = (b as Record<string, any>)[field];
    const diff = new Date(av).getTime() - new Date(bv).getTime();
    if (diff !== 0 && !Number.isNaN(diff)) return factor * diff;
    return factor * String(a.id).localeCompare(String(b.id));
  });
}

export class MemoryStorageSurrealDB extends MemoryStorage {
  override readonly supportsObservationalMemory = true;
  override readonly supportsObservationalMemoryHistorySearch = true;
  override readonly supportsPartialThreadUpdate = true;
  override readonly supportsAtomicWorkingMemoryMerge = true;

  #connector: SurrealDBConnector;

  constructor(config: SurrealDBDomainConfig) {
    super();
    this.#connector = SurrealDBConnector.from(config);
  }

  async init(): Promise<void> {
    await this.#connector.ensureDatabase();
    await this.#connector.query(MEMORY_SCHEMA);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#connector.query(
      `DELETE ${TABLE_MESSAGES}; DELETE ${TABLE_THREADS}; DELETE ${TABLE_RESOURCES}; DELETE ${OM_TABLE}; DELETE ${TABLE_OBSERVATIONAL_MEMORY_KEYS};`,
    );
  }

  // ============================================
  // Threads
  // ============================================

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    try {
      const [row] = await this.#connector.query<[Row | undefined]>(`SELECT * FROM ONLY ${THREAD('$id')}`, {
        id: threadId,
      });
      if (!row || (resourceId !== undefined && row.resourceId !== resourceId)) return null;
      return parseThread(row);
    } catch (error) {
      throw this.#error('GET_THREAD_BY_ID', error, { threadId });
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const now = new Date();
      await this.#connector.query(`UPSERT ${THREAD('$id')} CONTENT $data RETURN NONE`, {
        id: thread.id,
        data: toRecordContent({
          resourceId: thread.resourceId,
          title: thread.title,
          metadata: thread.metadata,
          createdAt: thread.createdAt ? toDate(thread.createdAt) : now,
          updatedAt: thread.updatedAt ? toDate(thread.updatedAt) : now,
        }),
      });
      return thread;
    } catch (error) {
      throw this.#error('SAVE_THREAD', error, { threadId: thread.id });
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
    let row: Row | undefined;
    try {
      // Omitted fields are left untouched; metadata is merged into the stored metadata.
      [row] = await this.#connector.query<[Row | undefined]>(
        `UPDATE ONLY ${THREAD('$id')} SET
           title = $title ?? title,
           metadata = object::extend(metadata ?? {}, $metadata ?? {}),
           updatedAt = $now
         RETURN AFTER`,
        { id, title, metadata, now: new Date() },
      );
    } catch (error) {
      throw this.#error('UPDATE_THREAD', error, { threadId: id });
    }
    if (!row) {
      throw new MastraError({
        id: createStorageErrorId('SURREALDB', 'UPDATE_THREAD', 'NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: { threadId: id },
      });
    }
    return parseThread(row);
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.#connector.transaction(
        [
          `DELETE ${TABLE_MESSAGES} WHERE threadId = $id`,
          `DELETE ${OM_TABLE} WHERE lookupKey = $omKey`,
          `DELETE ${OM_KEY('$omKey')}`,
          `DELETE ${THREAD('$id')}`,
        ],
        { id: threadId, omKey: omLookupKey(threadId, '') },
      );
    } catch (error) {
      throw this.#error('DELETE_THREAD', error, { threadId });
    }
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;
    try {
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw this.#error('LIST_THREADS', error, { page }, ErrorCategory.USER);
    }

    try {
      this.validateMetadataKeys(filter?.metadata);
      const { field, direction } = this.parseOrderBy(orderBy);
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const where: string[] = [];
      const bindings: Record<string, unknown> = { limit: perPage, offset };
      if (filter?.resourceId) {
        where.push('resourceId = $resourceId');
        bindings.resourceId = filter.resourceId;
      }
      Object.entries(filter?.metadata ?? {}).forEach(([key, value], i) => {
        where.push(`metadata[$mk${i}] = $mv${i}`);
        bindings[`mk${i}`] = key;
        bindings[`mv${i}`] = value;
      });

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const [rows, count] = await this.#connector.query<[Row[], unknown]>(
        `SELECT * FROM ${TABLE_THREADS} ${whereClause} ORDER BY ${field} ${direction}, id ${direction} LIMIT $limit START $offset;
         SELECT count() AS count FROM ${TABLE_THREADS} ${whereClause} GROUP ALL;`,
        bindings,
      );
      const total = totalFrom(count);
      return {
        threads: rows.map(parseThread),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: offset + perPage < total,
      };
    } catch (error) {
      throw this.#error('LIST_THREADS', error);
    }
  }

  async copyThread(args: StorageCloneThreadInput): Promise<StorageCopyThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;
    const newThreadId = providedThreadId || crypto.randomUUID();

    const [source, exists, sourceMessages] = await this.#connector.query<[Row | undefined, boolean, Row[]]>(
      `SELECT * FROM ONLY ${THREAD('$sourceId')};
       RETURN (SELECT VALUE id FROM ONLY ${THREAD('$newId')}) != NONE;
       SELECT id, createdAt FROM ${TABLE_MESSAGES}
         WHERE threadId = $sourceId
           ${options?.messageFilter?.messageIds?.length ? 'AND id INSIDE $messageIds' : ''}
           ${options?.messageFilter?.startDate ? 'AND createdAt >= $startDate' : ''}
           ${options?.messageFilter?.endDate ? 'AND createdAt <= $endDate' : ''}
         ORDER BY ${MESSAGE_ORDER_ASC};`,
      {
        sourceId: sourceThreadId,
        newId: newThreadId,
        messageIds: options?.messageFilter?.messageIds?.map(id => new RecordId(TABLE_MESSAGES, id)),
        startDate: options?.messageFilter?.startDate ? toDate(options.messageFilter.startDate) : undefined,
        endDate: options?.messageFilter?.endDate ? toDate(options.messageFilter.endDate) : undefined,
      },
    );

    if (!source) {
      throw new MastraError({
        id: createStorageErrorId('SURREALDB', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }
    if (exists) {
      throw new MastraError({
        id: createStorageErrorId('SURREALDB', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    try {
      let messageIds = sourceMessages.map(row => recordKey(row.id));
      if (options?.messageLimit && options.messageLimit > 0 && messageIds.length > options.messageLimit) {
        messageIds = messageIds.slice(-options.messageLimit);
      }

      const now = new Date();
      const sourceThread = parseThread(source);
      const lastMessageId = messageIds[messageIds.length - 1];
      const cloneMetadata: ThreadCloneMetadata = {
        sourceThreadId,
        clonedAt: now,
        ...(lastMessageId && { lastMessageId }),
      };
      const thread: StorageThreadType = {
        id: newThreadId,
        resourceId: resourceId || sourceThread.resourceId,
        title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : undefined),
        metadata: { ...metadata, clone: cloneMetadata },
        createdAt: now,
        updatedAt: now,
      };

      const messageIdMap: Record<string, string> = {};
      const pairs = messageIds.map(id => {
        messageIdMap[id] = crypto.randomUUID();
        return { from: id, to: messageIdMap[id] };
      });

      // Message payloads are copied inside the database and never travel to the client.
      await this.#connector.transaction(
        [
          `CREATE ${THREAD('$newId')} CONTENT $thread RETURN NONE`,
          `FOR $pair IN $pairs {
             LET $m = (SELECT * FROM ONLY ${MESSAGE('$pair.from')});
             CREATE ${MESSAGE('$pair.to')} CONTENT {
               threadId: $newId,
               resourceId: $resourceId ?? $m.resourceId,
               role: $m.role,
               type: $m.type,
               content: $m.content,
               createdAt: $m.createdAt
             } RETURN NONE;
           }`,
        ],
        {
          newId: newThreadId,
          thread: toRecordContent({ ...thread, id: undefined }),
          pairs,
          resourceId: resourceId || undefined,
        },
      );

      return { thread, messageIdMap };
    } catch (error) {
      throw this.#error('CLONE_THREAD', error, { sourceThreadId, newThreadId });
    }
  }

  async updateThreadResourceId({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId: string;
  }): Promise<StorageThreadType> {
    let row: Row | undefined;
    try {
      // The thread and every message move together, in one transaction.
      [row] = await this.#connector.transaction<[Row | undefined]>(
        [
          `UPDATE ONLY ${THREAD('$threadId')} SET resourceId = $resourceId, updatedAt = IF resourceId = $resourceId { updatedAt } ELSE { $now } RETURN AFTER`,
          `UPDATE ${TABLE_MESSAGES} SET resourceId = $resourceId WHERE threadId = $threadId AND resourceId != $resourceId RETURN NONE`,
        ],
        { threadId, resourceId, now: new Date() },
      );
    } catch (error) {
      throw this.#error('UPDATE_THREAD_RESOURCE_ID', error, { threadId, resourceId });
    }
    if (!row) throw new Error(`Thread "${threadId}" not found`);
    return parseThread(row);
  }

  // ============================================
  // Messages
  // ============================================

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const threadIds = Array.isArray(args.threadId) ? args.threadId : [args.threadId];
    if (threadIds.length === 0 || threadIds.some(id => typeof id !== 'string' || !id.trim())) {
      throw new MastraError({
        id: createStorageErrorId('SURREALDB', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'threadId must be a non-empty string or array of non-empty strings',
        details: { threadId: String(args.threadId) },
      });
    }
    return this.#listMessages('LIST_MESSAGES', args, ['threadId INSIDE $threadIds'], { threadIds }, args.resourceId);
  }

  async listMessagesByResourceId(args: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    return this.#listMessages(
      'LIST_MESSAGES_BY_RESOURCE_ID',
      args,
      ['resourceId = $resourceId'],
      { resourceId: args.resourceId },
      args.resourceId,
    );
  }

  async #listMessages(
    operation: string,
    args: Omit<StorageListMessagesInput, 'threadId'>,
    where: string[],
    bindings: Record<string, unknown>,
    resourceScope: string | undefined,
  ): Promise<StorageListMessagesOutput> {
    const { include, filter, perPage: perPageInput, page = 0, orderBy, includeTotal = true } = args;

    // Invalid metadata filters surface as the TypeError core raises.
    const metadataFilter: StorageMetadataFilter | undefined = validateStorageMetadataFilter(filter?.metadata);
    let perPage: number;
    let offset: number;
    let perPageForResponse: number | false;
    try {
      perPage = normalizePerPage(perPageInput, 40);
      if (page < 0) throw new Error('page must be >= 0');
      if (page * perPage > Number.MAX_SAFE_INTEGER / 2) throw new Error('page value too large');
      ({ offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage));
    } catch (error) {
      throw this.#error(operation, error, { page }, ErrorCategory.USER);
    }

    if (perPage === 0 && (!include || include.length === 0)) {
      return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
    }

    try {
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const conditions = [...where];
      const params: Record<string, unknown> = { ...bindings };
      if (resourceScope && !conditions.includes('resourceId = $resourceId')) {
        conditions.push('resourceId = $resourceId');
        params.resourceId = resourceScope;
      }
      addDateRange(conditions, params, filter?.dateRange);
      Object.entries(metadataFilter ?? {}).forEach(([key, value], i) => {
        conditions.push(`content.metadata[$mk${i}] = $mv${i}`);
        params[`mk${i}`] = key;
        params[`mv${i}`] = value;
      });

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      // Without a total, one extra row tells whether another page exists.
      const fetchLimit = perPage === 0 ? 0 : includeTotal ? perPage : Math.min(perPage + 1, Number.MAX_SAFE_INTEGER);
      params.limit = fetchLimit;
      params.offset = offset;

      const statements = [
        `SELECT * FROM ${TABLE_MESSAGES} ${whereClause} ORDER BY ${field} ${direction}, id ${direction} LIMIT $limit START $offset;`,
      ];
      if (includeTotal && perPage > 0) {
        statements.push(`SELECT count() AS count FROM ${TABLE_MESSAGES} ${whereClause} GROUP ALL;`);
      }
      const includeStart = statements.length;
      statements.push(...this.#includeStatements(include, resourceScope || undefined, params));

      const results = await this.#connector.query<unknown[]>(statements.join('\n'), params);
      let pageRows = (results[0] as Row[]) ?? [];
      const extraRow = !includeTotal && pageRows.length > perPage;
      if (extraRow) pageRows = pageRows.slice(0, perPage);
      const total = includeTotal ? (perPage > 0 ? totalFrom(results[1]) : 0) : offset + pageRows.length;

      const scopeThreadIds = bindings.threadIds as string[] | undefined;
      const matchesQuery = (m: MastraDBMessage) =>
        (scopeThreadIds ? scopeThreadIds.includes(m.threadId!) : true) &&
        (!resourceScope || m.resourceId === resourceScope) &&
        inDateRange(m.createdAt, filter?.dateRange);
      const messages = pageRows.map(parseMessage);
      const seen = new Set(messages.map(m => m.id));
      const pageIds = new Set(seen);
      for (const result of results.slice(includeStart)) {
        if (!Array.isArray(result)) continue;
        for (const row of result as Row[]) {
          const message = parseMessage(row);
          if (seen.has(message.id)) continue;
          seen.add(message.id);
          messages.push(message);
        }
      }

      let hasMore: boolean;
      if (perPage === 0) {
        hasMore = false;
      } else if (!includeTotal) {
        hasMore = extraRow;
      } else if (include?.length && !metadataFilter) {
        // Included messages can already cover what later pages would return: there are no more
        // pages once every matching message was returned.
        const matchingReturned = messages.filter(m => pageIds.has(m.id) || matchesQuery(m)).length;
        hasMore = matchingReturned < total && offset + perPage < total;
      } else {
        hasMore = offset + pageRows.length < total;
      }

      const sorted = sortMessages(messages, field, direction);
      const list = new MessageList().add(sorted, 'memory');
      return {
        messages: sortMessages(list.get.all.db(), field, direction),
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      throw this.#error(operation, error);
    }
  }

  /**
   * One SurrealQL statement per `include` entry, resolving the target message and its
   * surrounding context window inside the database. The window is taken from the target's own
   * thread, ordered by (createdAt, id) so messages with equal timestamps are not skipped.
   */
  #includeStatements(
    include: StorageListMessagesInput['include'],
    resourceId: string | undefined,
    params: Record<string, unknown>,
  ): string[] {
    if (!include?.length) return [];
    params.includeResourceId = resourceId;
    return include.map((item, i) => {
      params[`inc${i}`] = item.id;
      params[`prev${i}`] = Math.max(0, item.withPreviousMessages ?? 0);
      params[`next${i}`] = Math.max(0, item.withNextMessages ?? 0);
      const scope = `threadId = $t${i}.threadId AND ($includeResourceId = NONE OR resourceId = $includeResourceId)`;
      return `LET $t${i} = (SELECT * FROM ONLY ${MESSAGE(`$inc${i}`)});
        RETURN IF $t${i} = NONE OR ($includeResourceId != NONE AND $t${i}.resourceId != $includeResourceId) { [] } ELSE {
          array::concat(
            (SELECT * FROM ${TABLE_MESSAGES} WHERE ${scope}
               AND (createdAt < $t${i}.createdAt OR (createdAt = $t${i}.createdAt AND id < $t${i}.id))
               ORDER BY createdAt DESC, id DESC LIMIT $prev${i}),
            [$t${i}],
            (SELECT * FROM ${TABLE_MESSAGES} WHERE ${scope}
               AND (createdAt > $t${i}.createdAt OR (createdAt = $t${i}.createdAt AND id > $t${i}.id))
               ORDER BY ${MESSAGE_ORDER_ASC} LIMIT $next${i})
          )
        };`;
    });
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    try {
      const rows = await this.#connector.queryAll<Row>(`SELECT * FROM $ids ORDER BY ${MESSAGE_ORDER_ASC}`, {
        ids: messageIds.map(id => new RecordId(TABLE_MESSAGES, id)),
      });
      const list = new MessageList().add(rows.map(parseMessage), 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw this.#error('LIST_MESSAGES_BY_ID', error);
    }
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };
    try {
      const now = new Date();
      const rows = messages.map(message => {
        if (!message.threadId) {
          throw new Error(
            "Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.",
          );
        }
        if (!message.resourceId) {
          throw new Error(
            "Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.",
          );
        }
        return toRecordContent({
          id: message.id,
          threadId: message.threadId,
          resourceId: message.resourceId,
          role: message.role,
          type: message.type,
          content: toJsonValue(message.content),
          createdAt: message.createdAt ? toDate(message.createdAt) : now,
        });
      });

      // One request: upsert every message (a re-saved message keeps its createdAt) and touch each thread.
      await this.#connector.transaction(
        [
          `INSERT INTO ${TABLE_MESSAGES} $rows ON DUPLICATE KEY UPDATE
             threadId = $input.threadId,
             resourceId = $input.resourceId,
             role = $input.role,
             type = $input.type,
             content = $input.content
           RETURN NONE`,
          `FOR $threadId IN $threadIds { UPDATE ${THREAD('$threadId')} SET updatedAt = $now RETURN NONE; }`,
        ],
        { rows, threadIds: [...new Set(messages.map(m => m.threadId))], now },
      );

      const list = new MessageList().add(messages, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw this.#error('SAVE_MESSAGES', error);
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
    try {
      const bindings: Record<string, unknown> = { now: new Date() };
      const statements: string[] = [];
      messages.forEach((patch, i) => {
        const { id, content, ...fields } = patch;
        bindings[`id${i}`] = id;
        bindings[`p${i}`] = toRecordContent({
          role: fields.role,
          type: fields.type,
          threadId: fields.threadId,
          resourceId: fields.resourceId,
          createdAt: (fields as { createdAt?: Date }).createdAt
            ? toDate((fields as { createdAt?: Date }).createdAt)
            : undefined,
        });
        bindings[`c${i}`] = content === undefined ? undefined : toJsonValue(content);
        // Content is shallow-merged, and its metadata merged one level deeper, inside the database.
        statements.push(
          `LET $b${i} = (UPDATE ONLY ${MESSAGE(`$id${i}`)} SET
             role = $p${i}.role ?? role,
             type = $p${i}.type ?? type,
             threadId = $p${i}.threadId ?? threadId,
             resourceId = $p${i}.resourceId ?? resourceId,
             createdAt = $p${i}.createdAt ?? createdAt,
             content = IF $c${i} = NONE { content } ELSE {
               object::extend(
                 object::extend(IF type::is_object(content) { content } ELSE { {} }, $c${i}),
                 IF type::is_object(content.metadata) AND type::is_object($c${i}.metadata)
                   { { metadata: object::extend(content.metadata, $c${i}.metadata) } } ELSE { {} }
               )
             }
           RETURN BEFORE)`,
        );
      });
      const touched = messages.map((_, i) => `$b${i}.threadId, $p${i}.threadId`).join(', ');
      statements.push(
        `FOR $threadId IN array::distinct([${touched}]) { IF $threadId != NONE { UPDATE ${THREAD('$threadId')} SET updatedAt = $now RETURN NONE; } }`,
        `SELECT * FROM $updatedIds`,
      );
      bindings.updatedIds = messages.map(m => new RecordId(TABLE_MESSAGES, m.id));

      const results = await this.#connector.transaction<unknown[]>(statements, bindings);
      const rows = (results[results.length - 1] as Row[]) ?? [];
      const byId = new Map(rows.map(row => [recordKey(row.id), parseMessage(row)]));
      return messages.map(m => byId.get(m.id)).filter((m): m is MastraDBMessage => m !== undefined);
    } catch (error) {
      throw this.#error('UPDATE_MESSAGES', error);
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;
    try {
      await this.#connector.transaction(
        [
          `LET $threadIds = array::distinct((SELECT VALUE threadId FROM $ids))`,
          `DELETE $ids`,
          `FOR $threadId IN $threadIds { UPDATE ${THREAD('$threadId')} SET updatedAt = $now RETURN NONE; }`,
        ],
        { ids: messageIds.map(id => new RecordId(TABLE_MESSAGES, id)), now: new Date() },
      );
    } catch (error) {
      throw this.#error('DELETE_MESSAGES', error, { count: messageIds.length });
    }
  }

  // ============================================
  // Resources
  // ============================================

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const [row] = await this.#connector.query<[Row | undefined]>(`SELECT * FROM ONLY ${RESOURCE('$id')}`, {
        id: resourceId,
      });
      return row ? parseResource(row) : null;
    } catch (error) {
      throw this.#error('GET_RESOURCE_BY_ID', error, { resourceId });
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      const now = new Date();
      await this.#connector.query(`UPSERT ${RESOURCE('$id')} CONTENT $data RETURN NONE`, {
        id: resource.id,
        data: toRecordContent({
          workingMemory: resource.workingMemory,
          metadata: resource.metadata,
          createdAt: resource.createdAt ? toDate(resource.createdAt) : now,
          updatedAt: resource.updatedAt ? toDate(resource.updatedAt) : now,
        }),
      });
      return resource;
    } catch (error) {
      throw this.#error('SAVE_RESOURCE', error, { resourceId: resource.id });
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
      // Creates the resource when it does not exist yet; metadata is merged.
      const [row] = await this.#connector.query<[Row]>(
        `UPSERT ONLY ${RESOURCE('$id')} SET
           workingMemory = $workingMemory ?? workingMemory,
           metadata = object::extend(metadata ?? {}, $metadata ?? {}),
           createdAt = createdAt ?? $now,
           updatedAt = $now
         RETURN AFTER`,
        { id: resourceId, workingMemory, metadata, now: new Date() },
      );
      return parseResource(row);
    } catch (error) {
      throw this.#error('UPDATE_RESOURCE', error, { resourceId });
    }
  }

  async mergeResourceWorkingMemory({
    resourceId,
    merge,
  }: {
    resourceId: string;
    merge: (existing: string | undefined) => string;
  }): Promise<StorageResourceType> {
    try {
      // Compare-and-set on the working memory read: a concurrent merge makes this one re-read and merge again.
      for (let attempt = 0; attempt < OM_MAX_ATTEMPTS; attempt++) {
        const [existing] = await this.#connector.query<[string | undefined]>(
          `RETURN (SELECT VALUE workingMemory FROM ONLY ${RESOURCE('$id')})`,
          { id: resourceId },
        );
        try {
          const [, row] = await this.#connector.transaction<[unknown, Row]>(
            [
              `IF (SELECT VALUE workingMemory FROM ONLY ${RESOURCE('$id')}) != $expected { THROW '${CONFLICT_MARKER}' }`,
              `UPSERT ONLY ${RESOURCE('$id')} SET
                 workingMemory = $workingMemory,
                 metadata = metadata ?? {},
                 createdAt = createdAt ?? $now,
                 updatedAt = $now
               RETURN AFTER`,
            ],
            {
              id: resourceId,
              expected: existing ?? undefined,
              workingMemory: merge(existing ?? undefined),
              now: new Date(),
            },
          );
          return parseResource(row);
        } catch (error) {
          if (!isConflictError(error)) throw error;
        }
      }
      throw new Error(`Too many concurrent working memory updates for resource ${resourceId}`);
    } catch (error) {
      throw this.#error('MERGE_RESOURCE_WORKING_MEMORY', error, { resourceId });
    }
  }

  // ============================================
  // Observational Memory
  // ============================================

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const [row] = await this.#connector.query<[Row | undefined]>(
        `SELECT * FROM ONLY ${OM_TABLE} WHERE lookupKey = $key ORDER BY ${OM_HEAD_ORDER} LIMIT 1`,
        { key: omLookupKey(threadId, resourceId) },
      );
      return row ? parseOMRecord(row) : null;
    } catch (error) {
      throw this.#error('GET_OBSERVATIONAL_MEMORY', error, { threadId: threadId ?? '', resourceId });
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit?: number,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const where = ['lookupKey = $key'];
      const bindings: Record<string, unknown> = {
        key: omLookupKey(threadId, resourceId),
        limit: limit ?? Number.MAX_SAFE_INTEGER,
        offset: options?.offset ?? 0,
      };
      if (options?.recordId !== undefined) {
        where.push(`id = ${OM('$recordId')}`);
        bindings.recordId = options.recordId;
      }
      if (options?.from) {
        where.push('createdAt >= $from');
        bindings.from = toDate(options.from);
      }
      if (options?.to) {
        where.push('createdAt <= $to');
        bindings.to = toDate(options.to);
      }
      if (options?.groupId !== undefined) {
        where.push(
          `(string::contains(activeObservations ?? '', $group)
            OR (bufferedObservationChunks ?? [])[WHERE string::contains(observations ?? '', $group)] != [])`,
        );
        bindings.group = `<observation-group id="${options.groupId}"`;
      }
      if (options?.beforeGeneration !== undefined) {
        where.push('generationCount < $beforeGeneration');
        bindings.beforeGeneration = options.beforeGeneration;
      }
      if (options?.afterGeneration !== undefined) {
        where.push('generationCount > $afterGeneration');
        bindings.afterGeneration = options.afterGeneration;
      }
      const direction = options?.sortDirection === 'ASC' ? 'ASC' : 'DESC';
      const rows = await this.#connector.queryAll<Row>(
        `SELECT * FROM ${OM_TABLE} WHERE ${where.join(' AND ')}
           ORDER BY generationCount ${direction}, createdAt ASC, id ASC LIMIT $limit START $offset`,
        bindings,
      );
      return rows.map(parseOMRecord);
    } catch (error) {
      throw this.#error('GET_OBSERVATIONAL_MEMORY_HISTORY', error, { threadId: threadId ?? '', resourceId });
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    try {
      const existing = await this.getObservationalMemory(input.threadId, input.resourceId);
      if (existing) return existing;

      const now = new Date();
      const record: ObservationalMemoryRecord = {
        // Never reused: a write addressed to a cleared record must not land on its successor.
        id: crypto.randomUUID(),
        scope: input.scope,
        threadId: input.threadId,
        resourceId: input.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: undefined,
        originType: 'initial',
        generationCount: 0,
        supersededBy: null,
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
        metadata: {},
      };
      try {
        // Concurrent initializations all write the key's guard record, so they conflict and are
        // retried; the retry sees the first one's record and creates nothing.
        await this.#connector.transaction(
          [
            `UPSERT ${OM_KEY('$key')} SET initializedAt = $now RETURN NONE`,
            `IF (SELECT VALUE id FROM ${OM_TABLE} WHERE lookupKey = $key LIMIT 1) != [] { THROW '${CONFLICT_MARKER}' }`,
            `CREATE ${OM('$id')} CONTENT $data RETURN NONE`,
          ],
          { key: omLookupKey(input.threadId, input.resourceId), id: record.id, data: toOMContent(record), now },
        );
        return record;
      } catch (error) {
        if (!isConflictError(error)) throw error;
        const head = await this.getObservationalMemory(input.threadId, input.resourceId);
        if (head) return head;
        throw error;
      }
    } catch (error) {
      throw this.#error('INITIALIZE_OBSERVATIONAL_MEMORY', error, {
        threadId: input.threadId ?? '',
        resourceId: input.resourceId,
      });
    }
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    try {
      await this.#connector.query(`CREATE ${OM('$id')} CONTENT $data RETURN NONE`, {
        id: record.id,
        data: toOMContent(record),
      });
    } catch (error) {
      throw this.#error('INSERT_OBSERVATIONAL_MEMORY_RECORD', error, { id: record.id });
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    assertActiveObservationsApplied(await this.commitActiveObservations(input), input.id);
  }

  async commitActiveObservations(input: UpdateActiveObservationsInput): Promise<UpdateActiveObservationsResult> {
    try {
      const tokenCount = Number.isFinite(input.tokenCount) && input.tokenCount >= 0 ? input.tokenCount : 0;
      for (let attempt = 0; attempt < OM_MAX_ATTEMPTS; attempt++) {
        const stored = await this.#getOMRow(input.id);
        if (!stored) throw this.#omNotFound('UPDATE_ACTIVE_OBSERVATIONS', input.id);
        if (stored.supersededBy) return { applied: false, reason: 'retired' };
        if (
          input.expectedActiveObservations !== undefined &&
          input.expectedActiveObservations !== ((stored.activeObservations as string | undefined) ?? '')
        ) {
          return { applied: false, reason: 'conflict' };
        }

        const applied = await this.#casUpdate(
          input.id,
          stored,
          ['activeObservations', 'lastObservedAt'],
          `activeObservations = $observations,
           lastObservedAt = $cursor,
           pendingMessageTokens = 0,
           observationTokenCount = $tokenCount,
           totalTokensObserved = (totalTokensObserved ?? 0) + $tokenCount,
           observedMessageIds = $observedMessageIds ?? observedMessageIds,
           observedTimezone = $observedTimezone ?? observedTimezone,
           updatedAt = $now`,
          {
            observations: input.observations,
            cursor: maxObservationCursor(toOptionalDate(stored.lastObservedAt), input.lastObservedAt),
            tokenCount,
            observedMessageIds: input.observedMessageIds,
            observedTimezone: input.observedTimezone,
          },
        );
        if (applied) return { applied: true };
      }
      throw this.#omConflict('UPDATE_ACTIVE_OBSERVATIONS', input.id);
    } catch (error) {
      throw this.#error('UPDATE_ACTIVE_OBSERVATIONS', error, { id: input.id });
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    await this.appendBufferedObservations(input);
  }

  async appendBufferedObservations(input: UpdateBufferedObservationsInput): Promise<UpdateBufferedObservationsResult> {
    try {
      const chunk: BufferedObservationChunk = {
        id: `ombuf-${crypto.randomUUID()}`,
        cycleId: input.chunk.cycleId,
        observations: input.chunk.observations,
        tokenCount: input.chunk.tokenCount,
        messageIds: input.chunk.messageIds,
        messageTokens: input.chunk.messageTokens,
        lastObservedAt: toDate(input.chunk.lastObservedAt),
        createdAt: new Date(),
        suggestedContinuation: input.chunk.suggestedContinuation,
        currentTask: input.chunk.currentTask,
        threadTitle: input.chunk.threadTitle,
        extractedValues: input.chunk.extractedValues,
        extractionFailures: input.chunk.extractionFailures,
      };
      // A chunk stores max message time + 1ms; it is covered by the cursor iff cursor >= that - 1ms.
      const coverBound = new Date(chunk.lastObservedAt.getTime() - 1);

      let targetId = input.id;
      let hops = 0;
      for (let attempt = 0; attempt < OM_MAX_ATTEMPTS; attempt++) {
        // One conditional update carries every skip decision: live record, cycle not stored yet,
        // chunk not covered by the cursor.
        const [written] = await this.#connector.query<[unknown]>(
          `UPDATE ONLY ${OM('$id')} SET
             bufferedObservationChunks = array::concat(bufferedObservationChunks ?? [], [$chunk]),
             lastBufferedAtTime = ${laterCursor('lastBufferedAtTime', '$lastBufferedAtTime')},
             updatedAt = $now
           WHERE supersededBy = NONE
             AND $chunk.cycleId NOTINSIDE (bufferedObservationChunks ?? []).cycleId
             AND (lastObservedAt = NONE OR lastObservedAt < $coverBound)
           RETURN VALUE id`,
          {
            id: targetId,
            chunk: toRecordContent(chunk as unknown as Row),
            lastBufferedAtTime: input.lastBufferedAtTime ? toDate(input.lastBufferedAtTime) : undefined,
            coverBound,
            now: new Date(),
          },
        );
        if (written) return { persisted: true, recordId: targetId };

        // Nothing matched: classify from the stored record.
        const stored = await this.#getOMRow(targetId);
        if (!stored) throw this.#omNotFound('UPDATE_BUFFERED_OBSERVATIONS', targetId);
        if (stored.supersededBy) {
          const head = hops < OM_MAX_HEAD_HOPS ? await this.#getHeadRow(stored.lookupKey as string) : undefined;
          if (!head || head.supersededBy || recordKey(head.id) === targetId) {
            throw this.#omNoLiveHead('UPDATE_BUFFERED_OBSERVATIONS', input.id);
          }
          targetId = recordKey(head.id);
          hops++;
          continue;
        }
        const chunks = (stored.bufferedObservationChunks as Row[] | undefined) ?? [];
        if (chunks.some(c => c?.cycleId === chunk.cycleId)) return { persisted: false, recordId: targetId };
        if (isBufferedChunkCoveredByCursor(chunk.lastObservedAt, toOptionalDate(stored.lastObservedAt))) {
          return { persisted: false, recordId: targetId };
        }
      }
      throw this.#omConflict('UPDATE_BUFFERED_OBSERVATIONS', targetId);
    } catch (error) {
      throw this.#error('UPDATE_BUFFERED_OBSERVATIONS', error, { id: input.id });
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    const emptyResult: SwapBufferedToActiveResult = {
      chunksActivated: 0,
      messageTokensActivated: 0,
      observationTokensActivated: 0,
      messagesActivated: 0,
      activatedCycleIds: [],
      activatedMessageIds: [],
    };

    try {
      for (let attempt = 0; attempt < OM_MAX_ATTEMPTS; attempt++) {
        const stored = await this.#getOMRow(input.id);
        if (!stored) throw this.#omNotFound('SWAP_BUFFERED_TO_ACTIVE', input.id);
        // A retired record is frozen: activation reports it and writes nothing.
        if (stored.supersededBy) return { ...emptyResult, retired: true };

        // Activation works on the stored list, so a chunk appended after the caller read the record
        // is never dropped. Caller-provided chunks only override token weights.
        const persistedChunks = ((stored.bufferedObservationChunks as Row[] | undefined) ?? []).map(parseChunk);
        const refreshedWeights = new Map(
          (Array.isArray(input.bufferedChunks) ? input.bufferedChunks : []).map(c => [c.id, c.messageTokens]),
        );
        const chunks = persistedChunks.map(c =>
          refreshedWeights.has(c.id) ? { ...c, messageTokens: refreshedWeights.get(c.id)! } : c,
        );
        if (chunks.length === 0) return emptyResult;

        const chunksToActivate = selectActivationBoundary(chunks, input);
        const activatedChunks = chunks.slice(0, chunksToActivate);
        const remainingChunks = (stored.bufferedObservationChunks as Row[]).slice(chunksToActivate);

        const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
        const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
        const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
        const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
        const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
        const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

        const latestChunk = activatedChunks[activatedChunks.length - 1];
        const lastObservedAt =
          input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
        const existingActive = (stored.activeObservations as string | undefined) ?? '';
        const boundary = `\n\n--- message boundary (${lastObservedAt.toISOString()}) ---\n\n`;

        const applied = await this.#casUpdate(
          input.id,
          stored,
          [
            'bufferedObservationChunks',
            'activeObservations',
            'observationTokenCount',
            'pendingMessageTokens',
            'lastObservedAt',
          ],
          `activeObservations = $activeObservations,
           observationTokenCount = $observationTokenCount,
           pendingMessageTokens = $pendingMessageTokens,
           bufferedObservationChunks = $remainingChunks,
           lastObservedAt = $cursor,
           updatedAt = $now`,
          {
            activeObservations: existingActive ? `${existingActive}${boundary}${activatedContent}` : activatedContent,
            observationTokenCount: Number(stored.observationTokenCount ?? 0) + activatedTokens,
            pendingMessageTokens: Math.max(0, Number(stored.pendingMessageTokens ?? 0) - activatedMessageTokens),
            remainingChunks: remainingChunks.length > 0 ? remainingChunks : undefined,
            // The cursor never moves backward (a sync observation may already be past this chunk).
            cursor: maxObservationCursor(toOptionalDate(stored.lastObservedAt), lastObservedAt),
          },
        );
        if (!applied) continue;

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
          suggestedContinuation: latestChunk?.suggestedContinuation ?? undefined,
          currentTask: latestChunk?.currentTask ?? undefined,
        };
      }
      throw this.#omConflict('SWAP_BUFFERED_TO_ACTIVE', input.id);
    } catch (error) {
      throw this.#error('SWAP_BUFFERED_TO_ACTIVE', error, { id: input.id });
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    try {
      return await this.#rollOver(currentRecord, stored => {
        const plan = planReflectionGenerationText({
          storedObservations: stored.activeObservations,
          storedObservationTokenCount: stored.observationTokenCount,
          snapshotObservations: currentRecord.activeObservations,
          snapshotObservationTokenCount: currentRecord.observationTokenCount,
          reflection: input.reflection,
          tokenCount: input.tokenCount,
        });
        // The text was rewritten (not only appended to) since the snapshot: the reflection is stale.
        if (!plan) return null;
        return {
          newId: input.newRecordId ?? crypto.randomUUID(),
          observations: plan.observations,
          tokenCount: plan.tokenCount,
          clearBufferedReflection: false,
        };
      });
    } catch (error) {
      throw this.#error('CREATE_REFLECTION_GENERATION', error, { id: currentRecord.id });
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    let written: unknown;
    try {
      [written] = await this.#connector.query<[unknown]>(
        `UPDATE ONLY ${OM('$id')} SET
           bufferedReflection = IF bufferedReflection { bufferedReflection + "\\n\\n" + $reflection } ELSE { $reflection },
           bufferedReflectionTokens = (bufferedReflectionTokens ?? 0) + $tokenCount,
           bufferedReflectionInputTokens = (bufferedReflectionInputTokens ?? 0) + $inputTokenCount,
           reflectedObservationLineCount = $lineCount,
           updatedAt = $now
         RETURN VALUE id`,
        {
          id: input.id,
          reflection: input.reflection,
          tokenCount: input.tokenCount,
          inputTokenCount: input.inputTokenCount,
          lineCount: input.reflectedObservationLineCount,
          now: new Date(),
        },
      );
    } catch (error) {
      throw this.#error('UPDATE_BUFFERED_REFLECTION', error, { id: input.id });
    }
    if (!written) throw this.#omNotFound('UPDATE_BUFFERED_REFLECTION', input.id);
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    try {
      return await this.#rollOver(currentRecord, stored => {
        const bufferedReflection = stored.bufferedReflection || '';
        if (!bufferedReflection) {
          throw new MastraError({
            id: createStorageErrorId('SURREALDB', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: 'No buffered reflection to swap',
            details: { id: currentRecord.id },
          });
        }
        // Only appends may have happened since the caller's snapshot; a rewrite invalidates the
        // reflected line count.
        if (!isAppendOnlySince(stored.activeObservations, currentRecord.activeObservations)) return null;

        // Lines 0..reflectedLineCount were reflected on and are replaced by the buffered reflection.
        const unreflected = (stored.activeObservations || '')
          .split('\n')
          .slice(stored.reflectedObservationLineCount ?? 0)
          .join('\n')
          .trim();
        return {
          newId: input.newRecordId ?? crypto.randomUUID(),
          observations: unreflected ? `${bufferedReflection}\n\n${unreflected}` : bufferedReflection,
          // tokenCount is computed by the processor from its snapshot; add tokens appended since.
          tokenCount:
            input.tokenCount +
            Math.max(0, (stored.observationTokenCount ?? 0) - (currentRecord.observationTokenCount ?? 0)),
          clearBufferedReflection: true,
        };
      });
    } catch (error) {
      throw this.#error('SWAP_BUFFERED_REFLECTION_TO_ACTIVE', error, { id: currentRecord.id });
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    await this.#setOnRecord('SET_REFLECTING_FLAG', id, 'isReflecting = $value', { value: isReflecting });
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    await this.#setOnRecord('SET_OBSERVING_FLAG', id, 'isObserving = $value', { value: isObserving });
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    await this.#setOnRecord('SET_BUFFERING_REFLECTION_FLAG', id, 'isBufferingReflection = $value', {
      value: isBuffering,
    });
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    await this.#setOnLiveRecord(
      'SET_BUFFERING_OBSERVATION_FLAG',
      id,
      'isBufferingObservation = $value, lastBufferedAtTokens = $lastBufferedAtTokens ?? lastBufferedAtTokens',
      { value: isBuffering, lastBufferedAtTokens },
    );
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    if (typeof tokenCount !== 'number' || !Number.isFinite(tokenCount) || tokenCount < 0) {
      throw new MastraError({
        id: createStorageErrorId('SURREALDB', 'SET_PENDING_MESSAGE_TOKENS', 'INVALID_INPUT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Invalid tokenCount: must be a finite non-negative number, got ${tokenCount}`,
        details: { id, tokenCount },
      });
    }
    await this.#setOnLiveRecord('SET_PENDING_MESSAGE_TOKENS', id, 'pendingMessageTokens = $value', {
      value: tokenCount,
    });
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      await this.#connector.transaction([`DELETE ${OM_TABLE} WHERE lookupKey = $key`, `DELETE ${OM_KEY('$key')}`], {
        key: omLookupKey(threadId, resourceId),
      });
    } catch (error) {
      throw this.#error('CLEAR_OBSERVATIONAL_MEMORY', error, { threadId: threadId ?? '', resourceId });
    }
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    try {
      for (let attempt = 0; attempt < OM_MAX_ATTEMPTS; attempt++) {
        const stored = await this.#getOMRow(input.id);
        if (!stored) throw this.#omNotFound('UPDATE_OM_CONFIG', input.id);
        const [written] = await this.#connector.query<[unknown]>(
          `UPDATE ONLY ${OM('$id')} SET config = $config, updatedAt = $now WHERE config = $expected RETURN VALUE id`,
          {
            id: input.id,
            config: this.deepMergeConfig((stored.config as Record<string, unknown>) ?? {}, input.config),
            expected: stored.config,
            now: new Date(),
          },
        );
        if (written) return;
      }
      throw this.#omConflict('UPDATE_OM_CONFIG', input.id);
    } catch (error) {
      throw this.#error('UPDATE_OM_CONFIG', error, { id: input.id });
    }
  }

  // ============================================
  // Observational memory helpers
  // ============================================

  async #getOMRow(id: string): Promise<Row | undefined> {
    const [row] = await this.#connector.query<[Row | undefined]>(`SELECT * FROM ONLY ${OM('$id')}`, { id });
    return row ?? undefined;
  }

  async #getHeadRow(lookupKey: string): Promise<Row | undefined> {
    const [row] = await this.#connector.query<[Row | undefined]>(
      `SELECT * FROM ONLY ${OM_TABLE} WHERE lookupKey = $key ORDER BY ${OM_HEAD_ORDER} LIMIT 1`,
      { key: lookupKey },
    );
    return row ?? undefined;
  }

  /**
   * Applies `set` to a live record only if every field in `expectedFields` still holds the value
   * that was read; returns whether it was applied. The check and the write are one statement,
   * so they are atomic.
   */
  async #casUpdate(
    id: string,
    stored: Row,
    expectedFields: string[],
    set: string,
    bindings: Record<string, unknown>,
  ): Promise<boolean> {
    const params: Record<string, unknown> = { ...bindings, id, now: new Date() };
    const predicates = expectedFields.map(field => {
      params[`expected_${field}`] = stored[field] ?? undefined;
      return `${field} = $expected_${field}`;
    });
    const [written] = await this.#connector.query<[unknown]>(
      `UPDATE ONLY ${OM('$id')} SET ${set} WHERE supersededBy = NONE AND ${predicates.join(' AND ')} RETURN VALUE id`,
      params,
    );
    return Boolean(written);
  }

  /** A single update addressed to the record itself, whether live or superseded. */
  async #setOnRecord(operation: string, id: string, set: string, bindings: Record<string, unknown>): Promise<void> {
    let written: unknown;
    try {
      [written] = await this.#connector.query<[unknown]>(
        `UPDATE ONLY ${OM('$id')} SET ${set}, updatedAt = $now RETURN VALUE id`,
        { ...bindings, id, now: new Date() },
      );
    } catch (error) {
      throw this.#error(operation, error, { id });
    }
    if (!written) throw this.#omNotFound(operation, id);
  }

  /**
   * A single update aimed at a live record: a superseded id is redirected to the head of its
   * thread/resource, resolved and written in the same transaction.
   */
  async #setOnLiveRecord(operation: string, id: string, set: string, bindings: Record<string, unknown>): Promise<void> {
    let result: unknown[];
    try {
      result = await this.#connector.transaction(
        [
          `LET $record = (SELECT id, lookupKey, supersededBy FROM ONLY ${OM('$id')})`,
          `LET $target = IF $record = NONE { NONE } ELSE IF $record.supersededBy = NONE { $record.id } ELSE {
             (SELECT VALUE id FROM ${OM_TABLE} WHERE lookupKey = $record.lookupKey ORDER BY ${OM_HEAD_ORDER} LIMIT 1)[0]
           }`,
          `RETURN IF $target = NONE { NONE } ELSE { (UPDATE ONLY $target SET ${set}, updatedAt = $now WHERE supersededBy = NONE RETURN VALUE id) }`,
        ],
        { ...bindings, id, now: new Date() },
      );
    } catch (error) {
      throw this.#error(operation, error, { id });
    }
    if (!result[2]) {
      const stored = await this.#getOMRow(id);
      throw stored ? this.#omNoLiveHead(operation, id) : this.#omNotFound(operation, id);
    }
  }

  /**
   * Rolls the live record `currentRecord.id` over to a new generation in one transaction: the old
   * record is retired (`supersededBy`, its buffered chunks move to the successor) only if the fields
   * the decision read are unchanged, and the successor is built from the old record's final state.
   */
  async #rollOver(
    currentRecord: ObservationalMemoryRecord,
    decide: (stored: ObservationalMemoryRecord) => {
      newId: string;
      observations: string;
      tokenCount: number;
      clearBufferedReflection: boolean;
    } | null,
  ): Promise<ObservationalMemoryRecord> {
    for (let attempt = 0; attempt < OM_MAX_ATTEMPTS; attempt++) {
      const row = await this.#getOMRow(currentRecord.id);
      if (!row) return currentRecord;
      // A retired snapshot creates nothing; the caller adopts the head.
      if (row.supersededBy) {
        const head = await this.#getHeadRow(row.lookupKey as string);
        return head ? parseOMRecord(head) : currentRecord;
      }
      const stored = parseOMRecord(row);
      const plan = decide(stored);
      if (!plan) return stored;

      const now = new Date();
      try {
        const results = await this.#connector.transaction<unknown[]>(
          [
            `LET $old = (UPDATE ONLY ${OM('$oldId')} SET
               supersededBy = $newId,
               bufferedObservationChunks = NONE,
               ${
                 plan.clearBufferedReflection
                   ? `bufferedReflection = NONE, bufferedReflectionTokens = NONE,
                      bufferedReflectionInputTokens = NONE, reflectedObservationLineCount = NONE,`
                   : ''
               }
               updatedAt = $now
             WHERE supersededBy = NONE
               AND activeObservations = $expectedActive
               AND observationTokenCount = $expectedTokens
               AND bufferedReflection = $expectedReflection
               AND reflectedObservationLineCount = $expectedLineCount
             RETURN BEFORE)`,
            `IF $old = NONE { THROW '${CONFLICT_MARKER}' }`,
            `RETURN (CREATE ONLY ${OM('$newId')} CONTENT {
               scope: $old.scope,
               threadId: $old.threadId,
               resourceId: $old.resourceId,
               lookupKey: $old.lookupKey,
               createdAt: $now,
               updatedAt: $now,
               lastObservedAt: $old.lastObservedAt,
               originType: 'reflection',
               generationCount: $old.generationCount + 1,
               activeObservations: $observations,
               bufferedObservationChunks: IF ($old.bufferedObservationChunks ?? []) = [] { NONE } ELSE { $old.bufferedObservationChunks },
               config: $old.config,
               totalTokensObserved: $old.totalTokensObserved ?? 0,
               observationTokenCount: $tokenCount,
               pendingMessageTokens: $old.pendingMessageTokens ?? 0,
               isReflecting: false,
               isObserving: false,
               isBufferingObservation: $old.isBufferingObservation ?? false,
               isBufferingReflection: false,
               lastBufferedAtTokens: $old.lastBufferedAtTokens ?? 0,
               lastBufferedAtTime: $old.lastBufferedAtTime,
               observedTimezone: $old.observedTimezone,
               metadata: $old.metadata ?? {}
             })`,
          ],
          {
            oldId: stored.id,
            newId: plan.newId,
            observations: plan.observations,
            tokenCount: plan.tokenCount,
            expectedActive: row.activeObservations ?? undefined,
            expectedTokens: row.observationTokenCount ?? undefined,
            expectedReflection: row.bufferedReflection ?? undefined,
            expectedLineCount: row.reflectedObservationLineCount ?? undefined,
            now,
          },
        );
        return parseOMRecord(results[2] as Row);
      } catch (error) {
        // The record changed (another write or rollover won): decide again.
        if (isConflictError(error)) continue;
        throw error;
      }
    }
    throw this.#omConflict('CREATE_REFLECTION_GENERATION', currentRecord.id);
  }

  // ============================================
  // Errors
  // ============================================

  #omNotFound(operation: string, id: string): MastraError {
    return new MastraError({
      id: createStorageErrorId('SURREALDB', operation, 'NOT_FOUND'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      text: `Observational memory record not found: ${id}`,
      details: { id },
    });
  }

  #omNoLiveHead(operation: string, id: string): MastraError {
    return new MastraError({
      id: createStorageErrorId('SURREALDB', operation, 'NO_LIVE_HEAD'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      text: `Observational memory record ${id} was superseded and no live generation was found`,
      details: { id },
    });
  }

  #omConflict(operation: string, id: string): MastraError {
    return new MastraError({
      id: createStorageErrorId('SURREALDB', operation, 'CONFLICT'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      text: `Too many concurrent updates to observational memory record ${id}`,
      details: { id },
    });
  }

  #error(
    operation: string,
    error: unknown,
    details?: Record<string, string | number>,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ): MastraError {
    if (error instanceof MastraError) return error;
    return new MastraError(
      {
        id: createStorageErrorId('SURREALDB', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category,
        details,
      },
      error,
    );
  }
}

/**
 * Picks how many buffered chunks to activate (ported from `@mastra/core`'s in-memory store):
 * the closest chunk boundary to the target, biased to remove slightly more than the target
 * unless that would overshoot the retention floor by too much.
 */
function selectActivationBoundary(chunks: BufferedObservationChunk[], input: SwapBufferedToActiveInput): number {
  const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
  const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

  let cumulative = 0;
  let bestOverBoundary = 0;
  let bestOverTokens = 0;
  let bestUnderBoundary = 0;
  let bestUnderTokens = 0;
  for (let i = 0; i < chunks.length; i++) {
    cumulative += chunks[i]!.messageTokens ?? 0;
    const boundary = i + 1;
    if (cumulative >= targetMessageTokens) {
      if (bestOverBoundary === 0 || cumulative < bestOverTokens) {
        bestOverBoundary = boundary;
        bestOverTokens = cumulative;
      }
    } else if (cumulative > bestUnderTokens) {
      bestUnderBoundary = boundary;
      bestUnderTokens = cumulative;
    }
  }

  const maxOvershoot = retentionFloor * 0.95;
  const overshoot = bestOverTokens - targetMessageTokens;
  const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
  const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
  const minRemaining = Math.min(1000, retentionFloor);

  if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) return bestOverBoundary;
  if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) return bestOverBoundary;
  if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) return bestUnderBoundary;
  if (bestOverBoundary > 0) return bestOverBoundary;
  return 1;
}
