import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  calculatePagination,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageResourceType,
} from '@mastra/core/storage';

import { safelyParseJSON } from '@mastra/core/storage/utils';

import type { StoreOperationsConvex } from '../operations';

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
  constructor(private readonly operations: StoreOperationsConvex) {
    super();
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const row = await this.operations.load<
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
    await this.operations.insert({
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
        id: 'CONVEX_STORAGE_THREAD_NOT_FOUND',
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
    const messages = await this.operations.queryTable<StoredMessage>(TABLE_MESSAGES, [
      { field: 'thread_id', value: threadId },
    ]);
    await this.operations.deleteMany(
      TABLE_MESSAGES,
      messages.map(msg => msg.id),
    );
    await this.operations.deleteMany(TABLE_THREADS, [threadId]);
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;
    const perPage = normalizePerPage(perPageInput, 100);
    const { field, direction } = this.parseOrderBy(orderBy);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const rows = await this.operations.queryTable<
      Omit<StorageThreadType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
    >(TABLE_THREADS, [{ field: 'resourceId', value: resourceId }]);

    const threads = rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));

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

    if (!threadId.trim()) {
      throw new MastraError(
        {
          id: 'CONVEX_STORAGE_LIST_MESSAGES_INVALID_THREAD_ID',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { threadId },
        },
        new Error('threadId must be a non-empty string'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

    let rows = await this.operations.queryTable<StoredMessage>(TABLE_MESSAGES, [
      { field: 'thread_id', value: threadId },
    ]);

    if (resourceId) {
      rows = rows.filter(row => row.resourceId === resourceId);
    }

    if (filter?.dateRange) {
      const { start, end } = filter.dateRange;
      rows = rows.filter(row => {
        const created = new Date(row.createdAt).getTime();
        if (start && created < start.getTime()) return false;
        if (end && created > end.getTime()) return false;
        return true;
      });
    }

    rows.sort((a, b) => {
      const aValue = field === 'createdAt' || field === 'updatedAt' ? new Date(a[field]).getTime() : (a as any)[field];
      const bValue = field === 'createdAt' || field === 'updatedAt' ? new Date(b[field]).getTime() : (b as any)[field];
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
      for (const includeItem of include) {
        const target = rows.find(row => row.id === includeItem.id);
        if (target && !messageIds.has(target.id)) {
          messages.push(this.parseStoredMessage(target));
          messageIds.add(target.id);
        }
        await this.addContextMessages({
          includeItem,
          allMessages: rows,
          targetThreadId: includeItem.threadId || threadId,
          messageIds,
          messages,
        });
      }
    }

    messages.sort((a, b) => {
      const aValue = field === 'createdAt' || field === 'updatedAt' ? new Date((a as any)[field]).getTime() : (a as any)[field];
      const bValue = field === 'createdAt' || field === 'updatedAt' ? new Date((b as any)[field]).getTime() : (b as any)[field];
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
    const rows = await this.operations.queryTable<StoredMessage>(TABLE_MESSAGES, undefined);
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

    await this.operations.batchInsert({
      tableName: TABLE_MESSAGES,
      records: normalized,
    });

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

    const existing = await this.operations.queryTable<StoredMessage>(TABLE_MESSAGES, undefined);
    const updated: MastraDBMessage[] = [];
    for (const update of messages) {
      const current = existing.find(row => row.id === update.id);
      if (!current) continue;

      if (update.threadId) {
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
      if (update.createdAt) {
        current.createdAt = update.createdAt instanceof Date ? update.createdAt.toISOString() : (update.createdAt as string);
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

      await this.operations.insert({
        tableName: TABLE_MESSAGES,
        record: current,
      });
      updated.push(this.parseStoredMessage(current));
    }

    return updated;
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    await this.operations.deleteMany(TABLE_MESSAGES, messageIds);
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.operations.insert({
      tableName: TABLE_RESOURCES,
      record: {
        ...resource,
        metadata: resource.metadata ?? {},
        createdAt: resource.createdAt instanceof Date ? resource.createdAt.toISOString() : resource.createdAt,
        updatedAt: resource.updatedAt instanceof Date ? resource.updatedAt.toISOString() : resource.updatedAt,
      },
    });
    return resource;
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const record = await this.operations.load<
      (Omit<StorageResourceType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }) | null
    >({
      tableName: TABLE_RESOURCES,
      keys: { id: resourceId },
    });
    if (!record) return null;

    return {
      ...record,
      metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
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
