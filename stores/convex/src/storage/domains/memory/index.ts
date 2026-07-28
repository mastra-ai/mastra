import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  filterByDateRange,
  MemoryStorage,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  safelyParseJSON,
  storageMessageMatchesMetadataFilter,
  validateStorageMetadataFilter,
} from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageResourceType,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';
import { TABLE_OBSERVATIONAL_MEMORY } from '../../types';
import type { SerializedOMChunk, SerializedOMCurrentRecord } from '../../types';

type StoredMessage = {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: string;
  createdAt: string;
  resourceId: string | null;
};

type StoredMetadata = Record<string, unknown> | string | null | undefined;
type StoredThread = Omit<StorageThreadType, 'createdAt' | 'updatedAt' | 'metadata'> & {
  createdAt: string;
  updatedAt: string;
  metadata?: StoredMetadata;
};
type StoredResource = Omit<StorageResourceType, 'createdAt' | 'updatedAt' | 'metadata'> & {
  createdAt: string;
  updatedAt: string;
  metadata?: StoredMetadata;
};

function parseStoredThread(row: StoredThread): StorageThreadType {
  return {
    ...row,
    metadata: typeof row.metadata === 'string' ? safelyParseJSON(row.metadata) : row.metadata,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function parseStoredResource(record: StoredResource): StorageResourceType {
  const metadata = typeof record.metadata === 'string' ? safelyParseJSON(record.metadata) : record.metadata;
  return {
    ...record,
    metadata: metadata ?? {},
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * Stored (Convex document) shape of an observational memory record.
 * Timestamps are ISO strings; config/metadata/bufferedObservationChunks are
 * JSON strings. Mirrors mastraObservationalMemoryTable in schema.ts.
 */
type StoredOMRecord = {
  id: string;
  lookupKey: string;
  scope: string;
  resourceId: string;
  threadId?: string | null;
  activeObservations: string;
  activeObservationsPendingUpdate?: string | null;
  originType: string;
  config: string;
  generationCount: number;
  lastObservedAt?: string | null;
  lastReflectionAt?: string | null;
  pendingMessageTokens: number;
  totalTokensObserved: number;
  observationTokenCount: number;
  isObserving: boolean;
  isReflecting: boolean;
  observedMessageIds?: string[] | null;
  observedTimezone?: string | null;
  bufferedObservations?: string | null;
  bufferedObservationTokens?: number | null;
  bufferedMessageIds?: string[] | null;
  bufferedReflection?: string | null;
  bufferedReflectionTokens?: number | null;
  bufferedReflectionInputTokens?: number | null;
  reflectedObservationLineCount?: number | null;
  bufferedObservationChunks?: string | null;
  isBufferingObservation: boolean;
  isBufferingReflection: boolean;
  lastBufferedAtTokens: number;
  lastBufferedAtTime?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
};

function toISO(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeOMChunk(chunk: BufferedObservationChunk): SerializedOMChunk {
  return {
    ...chunk,
    lastObservedAt: toISO(chunk.lastObservedAt),
    createdAt: toISO(chunk.createdAt),
  };
}

function parseOMChunk(chunk: SerializedOMChunk): BufferedObservationChunk {
  return {
    ...chunk,
    lastObservedAt: new Date(chunk.lastObservedAt),
    createdAt: new Date(chunk.createdAt),
  };
}

function parseStoredOMChunks(value: string | null | undefined): BufferedObservationChunk[] | undefined {
  if (!value) return undefined;
  const parsed = safelyParseJSON(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.map(chunk => parseOMChunk(chunk));
}

function parseStoredOMRecord(doc: StoredOMRecord): ObservationalMemoryRecord {
  const config = safelyParseJSON(doc.config);
  const metadata = doc.metadata ? safelyParseJSON(doc.metadata) : undefined;
  return {
    id: doc.id,
    scope: doc.scope as ObservationalMemoryRecord['scope'],
    threadId: doc.threadId || null,
    resourceId: doc.resourceId,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    lastObservedAt: doc.lastObservedAt ? new Date(doc.lastObservedAt) : undefined,
    originType: (doc.originType || 'initial') as ObservationalMemoryRecord['originType'],
    generationCount: Number(doc.generationCount || 0),
    activeObservations: doc.activeObservations || '',
    bufferedObservationChunks: parseStoredOMChunks(doc.bufferedObservationChunks),
    // Deprecated fields (for backward compatibility)
    bufferedObservations: doc.activeObservationsPendingUpdate || undefined,
    bufferedObservationTokens: doc.bufferedObservationTokens ? Number(doc.bufferedObservationTokens) : undefined,
    bufferedMessageIds: undefined, // Use bufferedObservationChunks instead
    bufferedReflection: doc.bufferedReflection || undefined,
    bufferedReflectionTokens: doc.bufferedReflectionTokens ? Number(doc.bufferedReflectionTokens) : undefined,
    bufferedReflectionInputTokens: doc.bufferedReflectionInputTokens
      ? Number(doc.bufferedReflectionInputTokens)
      : undefined,
    reflectedObservationLineCount: doc.reflectedObservationLineCount
      ? Number(doc.reflectedObservationLineCount)
      : undefined,
    totalTokensObserved: Number(doc.totalTokensObserved || 0),
    observationTokenCount: Number(doc.observationTokenCount || 0),
    pendingMessageTokens: Number(doc.pendingMessageTokens || 0),
    isReflecting: Boolean(doc.isReflecting),
    isObserving: Boolean(doc.isObserving),
    isBufferingObservation: Boolean(doc.isBufferingObservation),
    isBufferingReflection: Boolean(doc.isBufferingReflection),
    lastBufferedAtTokens: Number(doc.lastBufferedAtTokens || 0),
    lastBufferedAtTime: doc.lastBufferedAtTime ? new Date(doc.lastBufferedAtTime) : null,
    config: (config as Record<string, unknown>) ?? {},
    metadata: (metadata as Record<string, unknown>) ?? undefined,
    observedMessageIds: doc.observedMessageIds || undefined,
    observedTimezone: doc.observedTimezone || undefined,
  };
}

export class MemoryConvex extends MemoryStorage {
  readonly supportsObservationalMemory = true;

  #db: ConvexDB;
  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_THREADS });
    await this.#db.clearTable({ tableName: TABLE_MESSAGES });
    await this.#db.clearTable({ tableName: TABLE_RESOURCES });
    await this.#db.clearTable({ tableName: TABLE_OBSERVATIONAL_MEMORY });
  }

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    const row = await this.#db.load<StoredThread | null>({
      tableName: TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!row || (resourceId !== undefined && row.resourceId !== resourceId)) return null;

    return parseStoredThread(row);
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.#db.insert({
      tableName: TABLE_THREADS,
      record: {
        ...thread,
        metadata: thread.metadata ?? {},
      },
    });
    return thread;
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
    const updated = await this.#db.updateThread({
      id,
      title,
      metadata,
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new MastraError({
        id: createStorageErrorId('CONVEX', 'UPDATE_THREAD', 'THREAD_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
      });
    }

    return parseStoredThread(updated);
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const messages = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [
      { field: 'thread_id', value: threadId },
    ]);
    await this.#db.deleteMany(
      TABLE_MESSAGES,
      messages.map(msg => msg.id),
    );
    await this.#db.deleteMany(TABLE_THREADS, [threadId]);
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;

    try {
      // Validate pagination input before normalization
      // This ensures page === 0 when perPageInput === false
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CONVEX', 'LIST_THREADS', 'INVALID_PAGE'),
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
          id: createStorageErrorId('CONVEX', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
        },
        error instanceof Error ? error : new Error('Invalid metadata key'),
      );
    }

    const { field, direction } = this.parseOrderBy(orderBy);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Build query filters
    const queryFilters: Array<{ field: string; value: any }> = [];

    if (filter?.resourceId) {
      queryFilters.push({ field: 'resourceId', value: filter.resourceId });
    }

    const rows = await this.#db.queryTable<StoredThread>(TABLE_THREADS, queryFilters);

    let threads = rows.map(row => parseStoredThread(row));

    // Apply metadata filters if provided (AND logic)
    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      threads = threads.filter(thread => {
        if (!thread.metadata || typeof thread.metadata !== 'object' || Array.isArray(thread.metadata)) return false;
        return Object.entries(filter.metadata!).every(([key, value]) => thread.metadata![key] === value);
      });
    }

    threads.sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      const aTime = aValue instanceof Date ? aValue.getTime() : new Date(aValue as any).getTime();
      const bTime = bValue instanceof Date ? bValue.getTime() : new Date(bValue as any).getTime();
      return direction === 'ASC' ? aTime - bTime : bTime - aTime;
    });

    const total = threads.length;
    const paginated = perPageInput === false ? threads : threads.slice(offset, offset + perPage);

    return {
      threads: paginated,
      total,
      page,
      perPage: perPageForResponse,
      hasMore: perPageInput === false ? false : offset + perPage < total,
    };
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('CONVEX', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

    // When perPage is 0 with no includes, there's nothing to return.
    if (perPage === 0 && (!include || include.length === 0)) {
      return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
    }

    // When perPage is 0, we only need included messages — skip full thread load
    if (perPage === 0 && include && include.length > 0) {
      const messages = await this._getIncludedMessages(include);
      const list = new MessageList().add(messages, 'memory');
      return {
        messages: this._sortMessages(list.get.all.db(), field, direction),
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }

    // Fetch messages from all threads
    let rows: StoredMessage[] = [];
    for (const tid of threadIds) {
      const threadRows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [{ field: 'thread_id', value: tid }]);
      rows.push(...threadRows);
    }

    if (resourceId) {
      rows = rows.filter(row => row.resourceId === resourceId);
    }

    // Apply date range filter
    rows = filterByDateRange(rows, row => new Date(row.createdAt), filter?.dateRange);
    rows = rows.filter(row => storageMessageMatchesMetadataFilter(row.content, metadataFilter));

    rows.sort((a, b) => {
      const aValue =
        field === 'createdAt' || field === 'updatedAt'
          ? new Date((a as Record<string, any>)[field]).getTime()
          : (a as Record<string, any>)[field];
      const bValue =
        field === 'createdAt' || field === 'updatedAt'
          ? new Date((b as Record<string, any>)[field]).getTime()
          : (b as Record<string, any>)[field];
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    const totalThreadMessages = rows.length;
    const paginatedRows = perPageInput === false ? rows : rows.slice(offset, offset + perPage);
    let messages = paginatedRows.map(row => this.parseStoredMessage(row));
    const messageIds = new Set(messages.map(msg => msg.id));

    if (include && include.length > 0) {
      // Pre-populate cache with already-fetched thread messages, but only when
      // rows represent a full unfiltered thread snapshot. When resourceId or
      // dateRange filters are active, the rows are a subset and would cause
      // addContextMessages() to compute neighbors from a truncated snapshot.
      const preloadedThreads = new Map<string, StoredMessage[]>();
      if (!resourceId && !filter?.dateRange && !metadataFilter) {
        for (const tid of threadIds) {
          preloadedThreads.set(
            tid,
            rows.filter(r => r.thread_id === tid),
          );
        }
      }

      const includedMessages = await this._getIncludedMessages(include, preloadedThreads);
      for (const msg of includedMessages) {
        if (!messageIds.has(msg.id)) {
          messages.push(msg);
          messageIds.add(msg.id);
        }
      }
    }

    messages = this._sortMessages(messages, field, direction);

    const hasMore = metadataFilter
      ? perPageInput !== false && offset + perPage < totalThreadMessages
      : include && include.length > 0
        ? new Set(messages.filter(m => m.threadId === threadId).map(m => m.id)).size < totalThreadMessages
        : perPageInput === false
          ? false
          : offset + perPage < totalThreadMessages;

    return {
      messages,
      total: totalThreadMessages,
      page,
      perPage: perPageForResponse,
      hasMore,
    };
  }

  async listMessagesByResourceId(args: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    const { resourceId, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);
    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 40)
    const perPage = normalizePerPage(perPageInput, 40);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('CONVEX', 'LIST_MESSAGES_BY_RESOURCE_ID', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    // Prevent unreasonably large page values that could cause performance issues
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new MastraError(
        {
          id: createStorageErrorId('CONVEX', 'LIST_MESSAGES_BY_RESOURCE_ID', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page, perPage },
        },
        new Error('page value too large'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Get all messages for the resource across all threads (hits the by_resource index)
    let rows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [{ field: 'resourceId', value: resourceId }]);

    // Apply date range filter
    rows = filterByDateRange(rows, row => new Date(row.createdAt), filter?.dateRange);
    rows = rows.filter(row => storageMessageMatchesMetadataFilter(row.content, metadataFilter));

    rows = this._sortStoredMessages(rows, field, direction);

    const total = rows.length;
    const paginatedRows = rows.slice(offset, offset + perPage);

    const list = new MessageList().add(
      paginatedRows.map(row => this.parseStoredMessage(row)),
      'memory',
    );

    return {
      messages: list.get.all.db(),
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + paginatedRows.length < total,
    };
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) {
      return { messages: [] };
    }
    const rows = await this.#db.loadMany<StoredMessage>(TABLE_MESSAGES, messageIds);
    const filtered = rows.map(row => this.parseStoredMessage(row));
    const list = new MessageList().add(filtered, 'memory');
    return { messages: list.get.all.db() };
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };

    const normalized = messages.map(message => {
      if (!message.threadId) {
        throw new Error('Thread ID is required');
      }
      if (!message.resourceId) {
        throw new Error('Resource ID is required');
      }
      const createdAt = message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt;
      return {
        id: message.id,
        thread_id: message.threadId,
        content: JSON.stringify(message.content),
        role: message.role,
        type: message.type || 'v2',
        createdAt,
        resourceId: message.resourceId,
      };
    });

    await this.#db.batchInsert({
      tableName: TABLE_MESSAGES,
      records: normalized,
    });

    // Update thread updatedAt timestamps for all affected threads
    const threadIds = [...new Set(messages.map(m => m.threadId).filter(Boolean) as string[])];
    const now = new Date();
    for (const threadId of threadIds) {
      await this.#db.patch({
        tableName: TABLE_THREADS,
        id: threadId,
        record: { updatedAt: now.toISOString() },
      });
    }

    const list = new MessageList().add(messages, 'memory');
    return { messages: list.get.all.db() };
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

    const existingRows = await this.#db.loadMany<StoredMessage>(
      TABLE_MESSAGES,
      messages.map(message => message.id),
    );
    const existing = new Map(existingRows.map(row => [row.id, row]));
    const updated: MastraDBMessage[] = [];
    const affectedThreadIds = new Set<string>();

    for (const update of messages) {
      const current = existing.get(update.id);
      if (!current) continue;

      // Track old thread for timestamp update
      affectedThreadIds.add(current.thread_id);

      if (update.threadId) {
        // Track new thread for timestamp update when moving messages
        affectedThreadIds.add(update.threadId);
        current.thread_id = update.threadId;
      }
      if (update.resourceId !== undefined) {
        current.resourceId = update.resourceId ?? null;
      }
      if (update.role) {
        current.role = update.role;
      }
      if (update.type) {
        current.type = update.type;
      }
      if (update.content) {
        const existingContent = safelyParseJSON(current.content) || {};
        const mergedContent = {
          ...existingContent,
          ...update.content,
          ...(existingContent.metadata && update.content.metadata
            ? { metadata: { ...existingContent.metadata, ...update.content.metadata } }
            : {}),
        };
        current.content = JSON.stringify(mergedContent);
      }

      await this.#db.insert({
        tableName: TABLE_MESSAGES,
        record: current,
      });
      updated.push(this.parseStoredMessage(current));
    }

    // Update thread updatedAt timestamps for all affected threads
    const now = new Date();
    for (const threadId of affectedThreadIds) {
      await this.#db.patch({
        tableName: TABLE_THREADS,
        id: threadId,
        record: { updatedAt: now.toISOString() },
      });
    }

    return updated;
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    await this.#db.deleteMany(TABLE_MESSAGES, messageIds);
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    const record: Record<string, unknown> = {
      ...resource,
      createdAt: resource.createdAt instanceof Date ? resource.createdAt.toISOString() : resource.createdAt,
      updatedAt: resource.updatedAt instanceof Date ? resource.updatedAt.toISOString() : resource.updatedAt,
    };
    // Only include metadata if it's defined
    if (resource.metadata !== undefined) {
      record.metadata = resource.metadata;
    }
    await this.#db.insert({
      tableName: TABLE_RESOURCES,
      record,
    });
    return resource;
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const record = await this.#db.load<StoredResource | null>({
      tableName: TABLE_RESOURCES,
      keys: { id: resourceId },
    });
    if (!record) return null;

    return parseStoredResource(record);
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
    const now = new Date();
    const updated = await this.#db.updateResource({
      resourceId,
      workingMemory,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    return parseStoredResource(updated);
  }

  private _sortStoredMessages(rows: StoredMessage[], field: string, direction: string): StoredMessage[] {
    return rows.sort((a, b) => {
      const aValue =
        field === 'createdAt' || field === 'updatedAt'
          ? new Date((a as Record<string, any>)[field]).getTime()
          : (a as Record<string, any>)[field];
      const bValue =
        field === 'createdAt' || field === 'updatedAt'
          ? new Date((b as Record<string, any>)[field]).getTime()
          : (b as Record<string, any>)[field];
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }

  private _sortMessages(messages: MastraDBMessage[], field: string, direction: string): MastraDBMessage[] {
    return messages.sort((a, b) => {
      const aValue =
        field === 'createdAt' || field === 'updatedAt' ? new Date((a as any)[field]).getTime() : (a as any)[field];
      const bValue =
        field === 'createdAt' || field === 'updatedAt' ? new Date((b as any)[field]).getTime() : (b as any)[field];
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }

  private async _getIncludedMessages(
    include: NonNullable<StorageListMessagesInput['include']>,
    preloadedThreads?: Map<string, StoredMessage[]>,
  ): Promise<MastraDBMessage[]> {
    if (include.length === 0) return [];

    const messages: MastraDBMessage[] = [];
    const messageIds = new Set<string>();
    const threadMessagesCache = new Map<string, StoredMessage[]>(preloadedThreads ?? []);
    const cachedTargets = new Map<string, { threadId: string; row: StoredMessage }>();

    for (const [threadId, rows] of threadMessagesCache) {
      for (const row of rows) {
        cachedTargets.set(row.id, { threadId, row });
      }
    }

    for (const includeItem of include) {
      let targetThreadId: string | undefined;
      let target: StoredMessage | undefined;

      const cached = cachedTargets.get(includeItem.id);
      if (cached) {
        target = cached.row;
        targetThreadId = cached.threadId;
      }

      // If not found, query by message ID directly
      if (!target) {
        const messageRows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [
          { field: 'id', value: includeItem.id },
        ]);
        if (messageRows.length > 0) {
          target = messageRows[0];
          targetThreadId = target!.thread_id;

          if (targetThreadId && !threadMessagesCache.has(targetThreadId)) {
            const otherThreadRows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [
              { field: 'thread_id', value: targetThreadId },
            ]);
            threadMessagesCache.set(targetThreadId, otherThreadRows);
            for (const row of otherThreadRows) {
              cachedTargets.set(row.id, { threadId: targetThreadId, row });
            }
          }
        }
      }

      if (!target || !targetThreadId) continue;

      if (!messageIds.has(target.id)) {
        messages.push(this.parseStoredMessage(target));
        messageIds.add(target.id);
      }

      const targetThreadRows = threadMessagesCache.get(targetThreadId) || [];
      await this.addContextMessages({
        includeItem,
        allMessages: targetThreadRows,
        targetThreadId,
        messageIds,
        messages,
      });
    }

    return messages;
  }

  private parseStoredMessage(message: StoredMessage): MastraDBMessage {
    const content = safelyParseJSON(message.content);
    return {
      id: message.id,
      threadId: message.thread_id,
      content,
      role: message.role as MastraDBMessage['role'],
      type: message.type,
      createdAt: new Date(message.createdAt),
      resourceId: message.resourceId ?? undefined,
    };
  }

  private async addContextMessages({
    includeItem,
    allMessages,
    targetThreadId,
    messageIds,
    messages,
  }: {
    includeItem: NonNullable<StorageListMessagesInput['include']>[number];
    allMessages: StoredMessage[];
    targetThreadId: string;
    messageIds: Set<string>;
    messages: MastraDBMessage[];
  }): Promise<void> {
    const ordered = allMessages
      .filter(row => row.thread_id === targetThreadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const targetIndex = ordered.findIndex(row => row.id === includeItem.id);
    if (targetIndex === -1) return;

    if (includeItem.withPreviousMessages) {
      const start = Math.max(0, targetIndex - includeItem.withPreviousMessages);
      for (let i = start; i < targetIndex; i++) {
        const row = ordered[i];
        if (row && !messageIds.has(row.id)) {
          messages.push(this.parseStoredMessage(row));
          messageIds.add(row.id);
        }
      }
    }

    if (includeItem.withNextMessages) {
      const end = Math.min(ordered.length, targetIndex + includeItem.withNextMessages + 1);
      for (let i = targetIndex + 1; i < end; i++) {
        const row = ordered[i];
        if (row && !messageIds.has(row.id)) {
          messages.push(this.parseStoredMessage(row));
          messageIds.add(row.id);
        }
      }
    }
  }

  // ============================================
  // Observational Memory Methods
  // ============================================

  private getOMKey(threadId: string | null, resourceId: string): string {
    return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
  }

  private omRecordNotFound(operation: string, id: string): MastraError {
    return new MastraError({
      id: createStorageErrorId('CONVEX', operation, 'NOT_FOUND'),
      text: `Observational memory record not found: ${id}`,
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: { id },
    });
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    const lookupKey = this.getOMKey(threadId, resourceId);
    const doc = await this.#db.omGetLatest<StoredOMRecord>(lookupKey);
    return doc ? parseStoredOMRecord(doc) : null;
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit: number = 10,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    const lookupKey = this.getOMKey(threadId, resourceId);
    const docs = await this.#db.omGetHistory<StoredOMRecord>({
      lookupKey,
      limit,
      from: options?.from ? options.from.toISOString() : undefined,
      to: options?.to ? options.to.toISOString() : undefined,
      offset: options?.offset ?? undefined,
    });
    return docs.map(doc => parseStoredOMRecord(doc));
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
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
      // lastObservedAt starts undefined - all messages are "unobserved" initially
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

    await this.#db.insert({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      record: {
        id,
        lookupKey,
        scope: input.scope,
        resourceId: input.resourceId,
        threadId: input.threadId || null,
        activeObservations: '',
        activeObservationsPendingUpdate: null,
        originType: 'initial',
        config: JSON.stringify(input.config ?? {}),
        generationCount: 0,
        lastObservedAt: null,
        lastReflectionAt: null,
        pendingMessageTokens: 0,
        totalTokensObserved: 0,
        observationTokenCount: 0,
        isObserving: false,
        isReflecting: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        observedTimezone: input.observedTimezone || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

    return record;
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    const lookupKey = this.getOMKey(record.threadId, record.resourceId);
    await this.#db.insert({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      record: {
        id: record.id,
        lookupKey,
        scope: record.scope,
        resourceId: record.resourceId,
        threadId: record.threadId || null,
        activeObservations: record.activeObservations || '',
        activeObservationsPendingUpdate: null,
        originType: record.originType || 'initial',
        config: JSON.stringify(record.config ?? {}),
        generationCount: record.generationCount || 0,
        lastObservedAt: record.lastObservedAt ? toISO(record.lastObservedAt) : null,
        lastReflectionAt: null,
        pendingMessageTokens: record.pendingMessageTokens || 0,
        totalTokensObserved: record.totalTokensObserved || 0,
        observationTokenCount: record.observationTokenCount || 0,
        observedMessageIds: record.observedMessageIds || null,
        bufferedObservationChunks: JSON.stringify(
          (Array.isArray(record.bufferedObservationChunks) ? record.bufferedObservationChunks : []).map(chunk =>
            serializeOMChunk(chunk),
          ),
        ),
        bufferedReflection: record.bufferedReflection || null,
        bufferedReflectionTokens: record.bufferedReflectionTokens ?? null,
        bufferedReflectionInputTokens: record.bufferedReflectionInputTokens ?? null,
        reflectedObservationLineCount: record.reflectedObservationLineCount ?? null,
        isObserving: record.isObserving || false,
        isReflecting: record.isReflecting || false,
        isBufferingObservation: record.isBufferingObservation || false,
        isBufferingReflection: record.isBufferingReflection || false,
        lastBufferedAtTokens: record.lastBufferedAtTokens || 0,
        lastBufferedAtTime: record.lastBufferedAtTime ? toISO(record.lastBufferedAtTime) : null,
        observedTimezone: record.observedTimezone || null,
        metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        createdAt: toISO(record.createdAt),
        updatedAt: toISO(record.updatedAt),
      },
    });
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    await this.#db.omUpdateActive({
      id: input.id,
      observations: input.observations,
      tokenCount: input.tokenCount,
      lastObservedAt: toISO(input.lastObservedAt),
      observedMessageIds: input.observedMessageIds ?? null,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    const chunk: SerializedOMChunk = {
      id: `ombuf-${crypto.randomUUID()}`,
      cycleId: input.chunk.cycleId,
      observations: input.chunk.observations,
      tokenCount: input.chunk.tokenCount,
      messageIds: input.chunk.messageIds,
      messageTokens: input.chunk.messageTokens,
      lastObservedAt: toISO(input.chunk.lastObservedAt),
      createdAt: new Date().toISOString(),
      suggestedContinuation: input.chunk.suggestedContinuation,
      currentTask: input.chunk.currentTask,
      threadTitle: input.chunk.threadTitle,
      extractedValues: input.chunk.extractedValues,
      extractionFailures: input.chunk.extractionFailures,
    };

    await this.#db.omAppendBufferedChunk({
      id: input.id,
      chunk,
      lastBufferedAtTime: input.lastBufferedAtTime ? toISO(input.lastBufferedAtTime) : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    return this.#db.omSwapBuffered<SwapBufferedToActiveResult>({
      id: input.id,
      activationRatio: input.activationRatio,
      messageTokensThreshold: input.messageTokensThreshold,
      currentPendingTokens: input.currentPendingTokens,
      forceMaxActivation: input.forceMaxActivation,
      lastObservedAt: input.lastObservedAt ? toISO(input.lastObservedAt) : undefined,
      bufferedChunks: Array.isArray(input.bufferedChunks)
        ? input.bufferedChunks.map(chunk => serializeOMChunk(chunk))
        : undefined,
      now: new Date().toISOString(),
    });
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
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

    await this.#db.insert({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      record: {
        id,
        lookupKey,
        scope: record.scope,
        resourceId: record.resourceId,
        threadId: record.threadId || null,
        activeObservations: input.reflection,
        activeObservationsPendingUpdate: null,
        originType: 'reflection',
        config: JSON.stringify(record.config ?? {}),
        generationCount: record.generationCount,
        lastObservedAt: record.lastObservedAt ? toISO(record.lastObservedAt) : null,
        lastReflectionAt: now.toISOString(),
        pendingMessageTokens: 0,
        totalTokensObserved: record.totalTokensObserved,
        observationTokenCount: record.observationTokenCount,
        isObserving: false,
        isReflecting: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        observedTimezone: record.observedTimezone || null,
        metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

    return record;
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    await this.#db.omUpdateBufferedReflection({
      id: input.id,
      reflection: input.reflection,
      tokenCount: input.tokenCount,
      inputTokenCount: input.inputTokenCount,
      reflectedObservationLineCount: input.reflectedObservationLineCount,
      updatedAt: new Date().toISOString(),
    });
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    const serializedCurrentRecord: SerializedOMCurrentRecord = {
      id: currentRecord.id,
      lookupKey: this.getOMKey(currentRecord.threadId, currentRecord.resourceId),
      scope: currentRecord.scope,
      threadId: currentRecord.threadId || null,
      resourceId: currentRecord.resourceId,
      config: JSON.stringify(currentRecord.config ?? {}),
      metadata: currentRecord.metadata ? JSON.stringify(currentRecord.metadata) : null,
      observedTimezone: currentRecord.observedTimezone || null,
      lastObservedAt: currentRecord.lastObservedAt ? toISO(currentRecord.lastObservedAt) : null,
      totalTokensObserved: currentRecord.totalTokensObserved,
      generationCount: currentRecord.generationCount,
    };

    const doc = await this.#db.omSwapBufferedReflection<StoredOMRecord>({
      currentRecord: serializedCurrentRecord,
      newId: crypto.randomUUID(),
      tokenCount: input.tokenCount,
      now: new Date().toISOString(),
    });

    return parseStoredOMRecord(doc);
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    const found = await this.#db.patch({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      id,
      record: { isReflecting, updatedAt: new Date() },
    });
    if (!found) {
      throw this.omRecordNotFound('SET_REFLECTING_FLAG', id);
    }
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    const found = await this.#db.patch({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      id,
      record: { isObserving, updatedAt: new Date() },
    });
    if (!found) {
      throw this.omRecordNotFound('SET_OBSERVING_FLAG', id);
    }
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    const found = await this.#db.patch({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      id,
      record: {
        isBufferingObservation: isBuffering,
        ...(lastBufferedAtTokens !== undefined ? { lastBufferedAtTokens } : {}),
        updatedAt: new Date(),
      },
    });
    if (!found) {
      throw this.omRecordNotFound('SET_BUFFERING_OBSERVATION_FLAG', id);
    }
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    const found = await this.#db.patch({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      id,
      record: { isBufferingReflection: isBuffering, updatedAt: new Date() },
    });
    if (!found) {
      throw this.omRecordNotFound('SET_BUFFERING_REFLECTION_FLAG', id);
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    if (typeof tokenCount !== 'number' || !Number.isFinite(tokenCount) || tokenCount < 0) {
      throw new MastraError({
        id: createStorageErrorId('CONVEX', 'SET_PENDING_MESSAGE_TOKENS', 'INVALID_INPUT'),
        text: `Invalid tokenCount: must be a finite non-negative number, got ${tokenCount}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { id, tokenCount },
      });
    }

    const found = await this.#db.patch({
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      id,
      record: { pendingMessageTokens: tokenCount, updatedAt: new Date() },
    });
    if (!found) {
      throw this.omRecordNotFound('SET_PENDING_MESSAGE_TOKENS', id);
    }
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    const lookupKey = this.getOMKey(threadId, resourceId);
    const docs = await this.#db.queryTable<StoredOMRecord>(TABLE_OBSERVATIONAL_MEMORY, [
      { field: 'lookupKey', value: lookupKey },
    ]);
    await this.#db.deleteMany(
      TABLE_OBSERVATIONAL_MEMORY,
      docs.map(doc => doc.id),
    );
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    await this.#db.omUpdateConfig({
      id: input.id,
      config: JSON.stringify(input.config ?? {}),
      updatedAt: new Date().toISOString(),
    });
  }
}
