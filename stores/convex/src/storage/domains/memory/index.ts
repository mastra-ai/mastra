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
} from '@mastra/core/storage';
import type {
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageResourceType,
} from '@mastra/core/storage';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type StoredMessage = {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: string;
  createdAt: string;
  resourceId: string | null;
};

export class MemoryConvex extends MemoryStorage {
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
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const row = await this.#db.load<
      (Omit<StorageThreadType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }) | null
    >({
      tableName: TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!row) return null;

    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
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
    const existing = await this.getThreadById({ threadId: id });
    if (!existing) {
      throw new MastraError({
        id: createStorageErrorId('CONVEX', 'UPDATE_THREAD', 'THREAD_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
      });
    }

    const updated: StorageThreadType = {
      ...existing,
      title,
      metadata: {
        ...existing.metadata,
        ...metadata,
      },
      updatedAt: new Date(),
    };

    await this.saveThread({ thread: updated });
    return updated;
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
    const perPage = normalizePerPage(perPageInput, 100);

    try {
      // Validate pagination parameters (throws on invalid input)
      this.validatePagination(page, perPage);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CONVEX', 'LIST_THREADS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page, perPage },
        },
        error instanceof Error ? error : new Error('Invalid pagination parameters'),
      );
    }

    const { field, direction } = this.parseOrderBy(orderBy);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Build query filters
    const queryFilters: Array<{ field: string; value: any }> = [];

    if (filter?.resourceId) {
      queryFilters.push({ field: 'resourceId', value: filter.resourceId });
    }

    const rows = await this.#db.queryTable<
      Omit<StorageThreadType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
    >(TABLE_THREADS, queryFilters);

    let threads = rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));

    // Apply metadata filters if provided (AND logic)
    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      threads = threads.filter(thread => {
        if (!thread.metadata) return false;
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
    const messages = paginatedRows.map(row => this.parseStoredMessage(row));
    const messageIds = new Set(messages.map(msg => msg.id));

    if (include && include.length > 0) {
      // Cache messages from threads as needed
      const threadMessagesCache = new Map<string, StoredMessage[]>();
      // Pre-populate cache with already-fetched thread messages
      for (const tid of threadIds) {
        const tidRows = rows.filter(r => r.thread_id === tid);
        threadMessagesCache.set(tid, tidRows);
      }

      for (const includeItem of include) {
        // First, find the message to get its threadId
        let targetThreadId: string | undefined;
        let target: StoredMessage | undefined;

        // Check in cached threads first
        for (const [tid, cachedRows] of threadMessagesCache) {
          target = cachedRows.find(row => row.id === includeItem.id);
          if (target) {
            targetThreadId = tid;
            break;
          }
        }

        // If not found, query by message ID directly
        if (!target) {
          const messageRows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [
            { field: 'id', value: includeItem.id },
          ]);
          if (messageRows.length > 0) {
            target = messageRows[0];
            targetThreadId = target!.thread_id;

            // Cache the thread's messages for context lookup
            if (targetThreadId && !threadMessagesCache.has(targetThreadId)) {
              const otherThreadRows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, [
                { field: 'thread_id', value: targetThreadId },
              ]);
              threadMessagesCache.set(targetThreadId, otherThreadRows);
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
    }

    messages.sort((a, b) => {
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

    const hasMore =
      include && include.length > 0
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

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) {
      return { messages: [] };
    }
    const rows = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, undefined);
    const filtered = rows.filter(row => messageIds.includes(row.id)).map(row => this.parseStoredMessage(row));
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
      const thread = await this.getThreadById({ threadId });
      if (thread) {
        await this.#db.insert({
          tableName: TABLE_THREADS,
          record: {
            ...thread,
            id: thread.id,
            updatedAt: now.toISOString(),
            createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
            metadata: thread.metadata ?? {},
          },
        });
      }
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

    const existing = await this.#db.queryTable<StoredMessage>(TABLE_MESSAGES, undefined);
    const updated: MastraDBMessage[] = [];
    const affectedThreadIds = new Set<string>();

    for (const update of messages) {
      const current = existing.find(row => row.id === update.id);
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
      const thread = await this.getThreadById({ threadId });
      if (thread) {
        await this.#db.insert({
          tableName: TABLE_THREADS,
          record: {
            ...thread,
            id: thread.id,
            updatedAt: now.toISOString(),
            createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
            metadata: thread.metadata ?? {},
          },
        });
      }
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
    const record = await this.#db.load<
      (Omit<StorageResourceType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }) | null
    >({
      tableName: TABLE_RESOURCES,
      keys: { id: resourceId },
    });
    if (!record) return null;

    return {
      ...record,
      metadata: typeof record.metadata === 'string' ? safelyParseJSON(record.metadata) : record.metadata,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
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
    const now = new Date();
    if (!existing) {
      const created: StorageResourceType = {
        id: resourceId,
        workingMemory,
        metadata: metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };
      return this.saveResource({ resource: created });
    }

    const updated: StorageResourceType = {
      ...existing,
      workingMemory: workingMemory ?? existing.workingMemory,
      metadata: {
        ...existing.metadata,
        ...metadata,
      },
      updatedAt: now,
    };

    await this.saveResource({ resource: updated });
    return updated;
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
}
