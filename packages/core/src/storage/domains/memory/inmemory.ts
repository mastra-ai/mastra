import { MessageList } from '../../../agent/message-list';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '../../../memory/types';
import type {
  PaginationInfo,
  StorageGetMessagesArg,
  StorageMessageType,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  ThreadSortOptions,
} from '../../types';
import type { StoreOperations } from '../operations';
import { MemoryStorage } from './base';

export type InMemoryThreads = Map<string, StorageThreadType>;
export type InMemoryResources = Map<string, StorageResourceType>;
export type InMemoryMessages = Map<string, StorageMessageType>;

export class InMemoryMemory extends MemoryStorage {
  private collection: {
    threads: InMemoryThreads;
    resources: InMemoryResources;
    messages: InMemoryMessages;
  };
  private operations: StoreOperations;
  constructor({
    collection,
    operations,
  }: {
    collection: {
      threads: InMemoryThreads;
      resources: InMemoryResources;
      messages: InMemoryMessages;
    };
    operations: StoreOperations;
  }) {
    super();
    this.collection = collection;
    this.operations = operations;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    this.logger.debug(`MockStore: getThreadById called for ${threadId}`);
    const thread = this.collection.threads.get(threadId);
    return thread ? { ...thread, metadata: thread.metadata ? { ...thread.metadata } : thread.metadata } : null;
  }

  async getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    this.logger.debug(`MockStore: getThreadsByResourceId called for ${resourceId}`);
    // Mock implementation - find threads by resourceId
    const threads = Array.from(this.collection.threads.values()).filter((t: any) => t.resourceId === resourceId);
    const sortedThreads = this.sortThreads(
      threads,
      this.castThreadOrderBy(orderBy),
      this.castThreadSortDirection(sortDirection),
    );
    return sortedThreads.map(thread => ({
      ...thread,
      metadata: thread.metadata ? { ...thread.metadata } : thread.metadata,
    })) as StorageThreadType[];
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.logger.debug(`MockStore: saveThread called for ${thread.id}`);
    const key = thread.id;
    this.collection.threads.set(key, thread);
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
    this.logger.debug(`MockStore: updateThread called for ${id}`);
    const thread = this.collection.threads.get(id);

    if (!thread) {
      throw new Error(`Thread with id ${id} not found`);
    }

    if (thread) {
      thread.title = title;
      thread.metadata = { ...thread.metadata, ...metadata };
      thread.updatedAt = new Date();
    }
    return thread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    this.logger.debug(`MockStore: deleteThread called for ${threadId}`);
    this.collection.threads.delete(threadId);

    this.collection.messages.forEach((msg, key) => {
      if (msg.thread_id === threadId) {
        this.collection.messages.delete(key);
      }
    });
  }

  async getMessages<T extends MastraMessageV2[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    this.logger.debug(`MockStore: getMessages called for thread ${threadId}`);

    // Handle include messages first
    const messages: MastraMessageV2[] = [];

    if (selectBy?.include && selectBy.include.length > 0) {
      for (const includeItem of selectBy.include) {
        const targetMessage = this.collection.messages.get(includeItem.id);
        if (targetMessage) {
          // Convert StorageMessageType to MastraMessageV2
          const convertedMessage = {
            id: targetMessage.id,
            threadId: targetMessage.thread_id,
            content:
              typeof targetMessage.content === 'string' ? JSON.parse(targetMessage.content) : targetMessage.content,
            role: targetMessage.role as 'user' | 'assistant' | 'system' | 'tool',
            type: targetMessage.type,
            createdAt: targetMessage.createdAt,
            resourceId: targetMessage.resourceId,
          } as MastraMessageV2;

          messages.push(convertedMessage);

          // Add previous messages if requested
          if (includeItem.withPreviousMessages) {
            const allThreadMessages = Array.from(this.collection.messages.values())
              .filter((msg: any) => msg.thread_id === includeItem.threadId)
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const targetIndex = allThreadMessages.findIndex(msg => msg.id === includeItem.id);
            if (targetIndex !== -1) {
              const startIndex = Math.max(0, targetIndex - (includeItem.withPreviousMessages || 0));
              for (let i = startIndex; i < targetIndex; i++) {
                const message = allThreadMessages[i];
                if (message && !messages.some(m => m.id === message.id)) {
                  const convertedPrevMessage = {
                    id: message.id,
                    threadId: message.thread_id,
                    content: typeof message.content === 'string' ? JSON.parse(message.content) : message.content,
                    role: message.role as 'user' | 'assistant' | 'system' | 'tool',
                    type: message.type,
                    createdAt: message.createdAt,
                    resourceId: message.resourceId,
                  } as MastraMessageV2;
                  messages.push(convertedPrevMessage);
                }
              }
            }
          }

          // Add next messages if requested
          if (includeItem.withNextMessages) {
            const allThreadMessages = Array.from(this.collection.messages.values())
              .filter((msg: any) => msg.thread_id === includeItem.threadId)
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const targetIndex = allThreadMessages.findIndex(msg => msg.id === includeItem.id);
            if (targetIndex !== -1) {
              const endIndex = Math.min(
                allThreadMessages.length,
                targetIndex + (includeItem.withNextMessages || 0) + 1,
              );
              for (let i = targetIndex + 1; i < endIndex; i++) {
                const message = allThreadMessages[i];
                if (message && !messages.some(m => m.id === message.id)) {
                  const convertedNextMessage = {
                    id: message.id,
                    threadId: message.thread_id,
                    content: typeof message.content === 'string' ? JSON.parse(message.content) : message.content,
                    role: message.role as 'user' | 'assistant' | 'system' | 'tool',
                    type: message.type,
                    createdAt: message.createdAt,
                    resourceId: message.resourceId,
                  } as MastraMessageV2;
                  messages.push(convertedNextMessage);
                }
              }
            }
          }
        }
      }
    }

    // Get regular messages from the thread only if no include items or if last is specified
    if (!selectBy?.include || selectBy.include.length === 0 || selectBy?.last) {
      let threadMessages = Array.from(this.collection.messages.values())
        .filter((msg: any) => msg.thread_id === threadId)
        .filter((msg: any) => !messages.some(m => m.id === msg.id)); // Exclude already included messages

      // Apply selectBy logic
      if (selectBy?.last) {
        threadMessages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const lastMessages = threadMessages.slice(-selectBy.last);
        // Convert and add last messages
        for (const msg of lastMessages) {
          const convertedMessage = {
            id: msg.id,
            threadId: msg.thread_id,
            content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            type: msg.type,
            createdAt: msg.createdAt,
            resourceId: msg.resourceId,
          } as MastraMessageV2;
          messages.push(convertedMessage);
        }
      } else if (!selectBy?.include || selectBy.include.length === 0) {
        // Convert and add all thread messages only if no include items
        for (const msg of threadMessages) {
          const convertedMessage = this.parseStoredMessage(msg);
          messages.push(convertedMessage);
        }
      }
    }

    // Sort by createdAt
    messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return messages as T;
  }

  protected parseStoredMessage(message: StorageMessageType): MastraMessageV2 {
    const { resourceId, content, role, thread_id, ...rest } = message;
    return {
      ...rest,
      threadId: thread_id,
      ...(message.resourceId && { resourceId: message.resourceId }),
      content: typeof content === 'string' ? content : JSON.parse(content),
      role: role as MastraMessageV2['role'],
    } satisfies MastraMessageV2;
  }

  async getMessagesById({ messageIds, format }: { messageIds: string[]; format: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessagesById({ messageIds, format }: { messageIds: string[]; format?: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    this.logger.debug(`MockStore: getMessagesById called`);

    const rawMessages = messageIds.map(id => this.collection.messages.get(id)).filter(message => !!message);

    const list = new MessageList().add(rawMessages.map(this.parseStoredMessage), 'memory');
    if (format === 'v1') return list.get.all.v1();
    return list.get.all.v2();
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    this.logger.debug(`MockStore: saveMessages called with ${messages.length} messages`);
    // Simulate error handling for testing - check before saving
    if (messages.some(msg => msg.id === 'error-message' || msg.resourceId === null)) {
      throw new Error('Simulated error for testing');
    }

    // Update thread timestamps for each unique threadId
    const threadIds = new Set(messages.map(msg => msg.threadId).filter((id): id is string => Boolean(id)));
    for (const threadId of threadIds) {
      const thread = this.collection.threads.get(threadId);
      if (thread) {
        thread.updatedAt = new Date();
      }
    }

    for (const message of messages) {
      const key = message.id;
      // Convert MastraMessageV2 to StorageMessageType
      const storageMessage: StorageMessageType = {
        id: message.id,
        thread_id: message.threadId || '',
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
        role: message.role || 'user',
        type: message.type || 'text',
        createdAt: message.createdAt,
        resourceId: message.resourceId || null,
      };
      this.collection.messages.set(key, storageMessage);
    }

    const list = new MessageList().add(messages, 'memory');
    if (format === `v2`) return list.get.all.v2();
    return list.get.all.v1();
  }

  async updateMessages(args: { messages: (Partial<MastraMessageV2> & { id: string })[] }): Promise<MastraMessageV2[]> {
    const updatedMessages: MastraMessageV2[] = [];
    for (const update of args.messages) {
      const storageMsg = this.collection.messages.get(update.id);
      if (!storageMsg) continue;

      // Track old threadId for possible move
      const oldThreadId = storageMsg.thread_id;
      const newThreadId = update.threadId || oldThreadId;
      let threadIdChanged = false;
      if (update.threadId && update.threadId !== oldThreadId) {
        threadIdChanged = true;
      }

      // Update fields
      if (update.role !== undefined) storageMsg.role = update.role;
      if (update.type !== undefined) storageMsg.type = update.type;
      if (update.createdAt !== undefined) storageMsg.createdAt = update.createdAt;
      if (update.resourceId !== undefined) storageMsg.resourceId = update.resourceId;
      // Deep merge content if present
      if (update.content !== undefined) {
        let oldContent = typeof storageMsg.content === 'string' ? JSON.parse(storageMsg.content) : storageMsg.content;
        let newContent = update.content;
        if (typeof newContent === 'object' && typeof oldContent === 'object') {
          // Deep merge for metadata/content fields
          newContent = { ...oldContent, ...newContent };
          if (oldContent.metadata && newContent.metadata) {
            newContent.metadata = { ...oldContent.metadata, ...newContent.metadata };
          }
        }
        storageMsg.content = JSON.stringify(newContent);
      }
      // Handle threadId change
      if (threadIdChanged) {
        storageMsg.thread_id = newThreadId;
        // Update updatedAt for both threads, ensuring strictly greater and not equal
        const base = Date.now();
        let oldThreadNewTime: number | undefined;
        const oldThread = this.collection.threads.get(oldThreadId);
        if (oldThread) {
          const prev = new Date(oldThread.updatedAt).getTime();
          oldThreadNewTime = Math.max(base, prev + 1);
          oldThread.updatedAt = new Date(oldThreadNewTime);
        }
        const newThread = this.collection.threads.get(newThreadId);
        if (newThread) {
          const prev = new Date(newThread.updatedAt).getTime();
          let newThreadNewTime = Math.max(base + 1, prev + 1);
          if (oldThreadNewTime !== undefined && newThreadNewTime <= oldThreadNewTime) {
            newThreadNewTime = oldThreadNewTime + 1;
          }
          newThread.updatedAt = new Date(newThreadNewTime);
        }
      } else {
        // Only update the thread's updatedAt if not a move
        const thread = this.collection.threads.get(oldThreadId);
        if (thread) {
          const prev = new Date(thread.updatedAt).getTime();
          let newTime = Date.now();
          if (newTime <= prev) newTime = prev + 1;
          thread.updatedAt = new Date(newTime);
        }
      }
      // Save the updated message
      this.collection.messages.set(update.id, storageMsg);
      // Return as MastraMessageV2
      updatedMessages.push({
        id: storageMsg.id,
        threadId: storageMsg.thread_id,
        content: typeof storageMsg.content === 'string' ? JSON.parse(storageMsg.content) : storageMsg.content,
        role: storageMsg.role === 'user' || storageMsg.role === 'assistant' ? storageMsg.role : 'user',
        type: storageMsg.type,
        createdAt: storageMsg.createdAt,
        resourceId: storageMsg.resourceId === null ? undefined : storageMsg.resourceId,
      });
    }
    return updatedMessages;
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    this.logger.debug(`MockStore: deleteMessages called for ${messageIds.length} messages`);

    // Collect thread IDs to update
    const threadIds = new Set<string>();

    for (const messageId of messageIds) {
      const message = this.collection.messages.get(messageId);
      if (message && message.thread_id) {
        threadIds.add(message.thread_id);
      }
      // Delete the message
      this.collection.messages.delete(messageId);
    }

    // Update thread timestamps
    const now = new Date();
    for (const threadId of threadIds) {
      const thread = this.collection.threads.get(threadId);
      if (thread) {
        thread.updatedAt = now;
      }
    }
  }

  async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page, perPage, orderBy, sortDirection } = args;
    this.logger.debug(`MockStore: getThreadsByResourceIdPaginated called for ${resourceId}`);
    // Mock implementation - find threads by resourceId
    const threads = Array.from(this.collection.threads.values()).filter((t: any) => t.resourceId === resourceId);
    const sortedThreads = this.sortThreads(
      threads,
      this.castThreadOrderBy(orderBy),
      this.castThreadSortDirection(sortDirection),
    );
    const clonedThreads = sortedThreads.map(thread => ({
      ...thread,
      metadata: thread.metadata ? { ...thread.metadata } : thread.metadata,
    })) as StorageThreadType[];
    return {
      threads: clonedThreads.slice(page * perPage, (page + 1) * perPage),
      total: clonedThreads.length,
      page: page,
      perPage: perPage,
      hasMore: clonedThreads.length > (page + 1) * perPage,
    };
  }

  async getMessagesPaginated({
    threadId,
    selectBy,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<
    PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }
  > {
    this.logger.debug(`MockStore: getMessagesPaginated called for thread ${threadId}`);

    const { page = 0, perPage = 40 } = selectBy?.pagination || {};

    // Handle include messages first
    const messages: MastraMessageV2[] = [];

    if (selectBy?.include && selectBy.include.length > 0) {
      for (const includeItem of selectBy.include) {
        const targetMessage = this.collection.messages.get(includeItem.id);
        if (targetMessage) {
          // Convert StorageMessageType to MastraMessageV2
          const convertedMessage = {
            id: targetMessage.id,
            threadId: targetMessage.thread_id,
            content:
              typeof targetMessage.content === 'string' ? JSON.parse(targetMessage.content) : targetMessage.content,
            role: targetMessage.role as 'user' | 'assistant' | 'system' | 'tool',
            type: targetMessage.type,
            createdAt: targetMessage.createdAt,
            resourceId: targetMessage.resourceId,
          } as MastraMessageV2;

          messages.push(convertedMessage);

          // Add previous messages if requested
          if (includeItem.withPreviousMessages) {
            const allThreadMessages = Array.from(this.collection.messages.values())
              .filter((msg: any) => msg.thread_id === includeItem.threadId)
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const targetIndex = allThreadMessages.findIndex(msg => msg.id === includeItem.id);
            if (targetIndex !== -1) {
              const startIndex = Math.max(0, targetIndex - (includeItem.withPreviousMessages || 0));
              for (let i = startIndex; i < targetIndex; i++) {
                const message = allThreadMessages[i];
                if (message && !messages.some(m => m.id === message.id)) {
                  const convertedPrevMessage = {
                    id: message.id,
                    threadId: message.thread_id,
                    content: typeof message.content === 'string' ? JSON.parse(message.content) : message.content,
                    role: message.role as 'user' | 'assistant' | 'system' | 'tool',
                    type: message.type,
                    createdAt: message.createdAt,
                    resourceId: message.resourceId,
                  } as MastraMessageV2;
                  messages.push(convertedPrevMessage);
                }
              }
            }
          }

          // Add next messages if requested
          if (includeItem.withNextMessages) {
            const allThreadMessages = Array.from(this.collection.messages.values())
              .filter((msg: any) => msg.thread_id === includeItem.threadId)
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const targetIndex = allThreadMessages.findIndex(msg => msg.id === includeItem.id);
            if (targetIndex !== -1) {
              const endIndex = Math.min(
                allThreadMessages.length,
                targetIndex + (includeItem.withNextMessages || 0) + 1,
              );
              for (let i = targetIndex + 1; i < endIndex; i++) {
                const message = allThreadMessages[i];
                if (message && !messages.some(m => m.id === message.id)) {
                  const convertedNextMessage = {
                    id: message.id,
                    threadId: message.thread_id,
                    content: typeof message.content === 'string' ? JSON.parse(message.content) : message.content,
                    role: message.role as 'user' | 'assistant' | 'system' | 'tool',
                    type: message.type,
                    createdAt: message.createdAt,
                    resourceId: message.resourceId,
                  } as MastraMessageV2;
                  messages.push(convertedNextMessage);
                }
              }
            }
          }
        }
      }
    }

    // Get regular messages from the thread only if no include items or if last is specified
    if (!selectBy?.include || selectBy.include.length === 0 || selectBy?.last) {
      let threadMessages = Array.from(this.collection.messages.values())
        .filter((msg: any) => msg.thread_id === threadId)
        .filter((msg: any) => !messages.some(m => m.id === msg.id)); // Exclude already included messages

      // Apply date filtering
      if (selectBy?.pagination?.dateRange) {
        const { start: from, end: to } = selectBy.pagination.dateRange;
        threadMessages = threadMessages.filter((msg: any) => {
          const msgDate = new Date(msg.createdAt);
          const fromDate = from ? new Date(from) : null;
          const toDate = to ? new Date(to) : null;

          if (fromDate && msgDate < fromDate) return false;
          if (toDate && msgDate > toDate) return false;
          return true;
        });
      }

      // Apply selectBy logic
      if (selectBy?.last) {
        threadMessages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const lastMessages = threadMessages.slice(-selectBy.last);
        // Convert and add last messages
        for (const msg of lastMessages) {
          const convertedMessage = {
            id: msg.id,
            threadId: msg.thread_id,
            content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            type: msg.type,
            createdAt: msg.createdAt,
            resourceId: msg.resourceId,
          } as MastraMessageV2;
          messages.push(convertedMessage);
        }
      } else if (!selectBy?.include || selectBy.include.length === 0) {
        // Convert and add all thread messages only if no include items
        for (const msg of threadMessages) {
          const convertedMessage = {
            id: msg.id,
            threadId: msg.thread_id,
            content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            type: msg.type,
            createdAt: msg.createdAt,
            resourceId: msg.resourceId,
          } as MastraMessageV2;
          messages.push(convertedMessage);
        }
      }
    }

    // Sort by createdAt
    messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const start = page * perPage;
    const end = start + perPage;
    return {
      messages: messages.slice(start, end),
      total: messages.length,
      page,
      perPage,
      hasMore: messages.length > end,
    };
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    this.logger.debug(`MockStore: getResourceById called for ${resourceId}`);
    const resource = this.collection.resources.get(resourceId);
    return resource
      ? { ...resource, metadata: resource.metadata ? { ...resource.metadata } : resource.metadata }
      : null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    this.logger.debug(`MockStore: saveResource called for ${resource.id}`);
    this.collection.resources.set(resource.id, resource);
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
    this.logger.debug(`MockStore: updateResource called for ${resourceId}`);
    let resource = this.collection.resources.get(resourceId);

    if (!resource) {
      // Create new resource if it doesn't exist
      resource = {
        id: resourceId,
        workingMemory,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      resource = {
        ...resource,
        workingMemory: workingMemory !== undefined ? workingMemory : resource.workingMemory,
        metadata: {
          ...resource.metadata,
          ...metadata,
        },
        updatedAt: new Date(),
      };
    }

    this.collection.resources.set(resourceId, resource);
    return resource;
  }

  private sortThreads(threads: any[], orderBy: ThreadOrderBy, sortDirection: ThreadSortDirection): any[] {
    return threads.sort((a, b) => {
      const aValue = new Date(a[orderBy]).getTime();
      const bValue = new Date(b[orderBy]).getTime();

      if (sortDirection === 'ASC') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }
}
