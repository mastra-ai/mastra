import { MessageList } from '../../../agent/message-list';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageMessageType,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '../../types';
import { safelyParseJSON } from '../../utils';
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

  async listMessages({
    threadId,
    resourceId,
    include,
    filter,
    perPage: perPageInput,
    page = 0,
    orderBy,
  }: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    this.logger.debug(`MockStore: listMessages called for thread ${threadId}`);

    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 40)
    const perPage = normalizePerPage(perPageInput, 40);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values that could cause performance issues
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Calculate offset from page

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Step 1: Get regular paginated messages from the thread first
    let threadMessages = Array.from(this.collection.messages.values()).filter((msg: any) => {
      if (msg.thread_id !== threadId) return false;
      if (resourceId && msg.resourceId !== resourceId) return false;
      return true;
    });

    // Apply date filtering
    if (filter?.dateRange) {
      const { start: from, end: to } = filter.dateRange;
      threadMessages = threadMessages.filter((msg: any) => {
        const msgDate = new Date(msg.createdAt);
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;

        if (fromDate && msgDate < fromDate) return false;
        if (toDate && msgDate > toDate) return false;
        return true;
      });
    }

    // Sort thread messages before pagination
    threadMessages.sort((a: any, b: any) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    // Get total count of thread messages (for pagination metadata)
    const totalThreadMessages = threadMessages.length;

    // Apply pagination to thread messages
    const start = offset;
    const end = start + perPage;
    const paginatedThreadMessages = threadMessages.slice(start, end);

    // Convert paginated thread messages to MastraDBMessage
    const messages: MastraDBMessage[] = [];
    const messageIds = new Set<string>();

    for (const msg of paginatedThreadMessages) {
      const convertedMessage = this.parseStoredMessage(msg);
      messages.push(convertedMessage);
      messageIds.add(msg.id);
    }

    // Step 2: Add included messages with context (if any), excluding duplicates
    if (include && include.length > 0) {
      for (const includeItem of include) {
        const targetMessage = this.collection.messages.get(includeItem.id);
        if (targetMessage) {
          // Convert StorageMessageType to MastraDBMessage
          const convertedMessage = {
            id: targetMessage.id,
            threadId: targetMessage.thread_id,
            content: safelyParseJSON(targetMessage.content),
            role: targetMessage.role as 'user' | 'assistant' | 'system' | 'tool',
            type: targetMessage.type,
            createdAt: targetMessage.createdAt,
            resourceId: targetMessage.resourceId,
          } as MastraDBMessage;

          // Only add if not already in messages array (deduplication)
          if (!messageIds.has(convertedMessage.id)) {
            messages.push(convertedMessage);
            messageIds.add(convertedMessage.id);
          }

          // Add previous messages if requested
          if (includeItem.withPreviousMessages) {
            const allThreadMessages = Array.from(this.collection.messages.values())
              .filter((msg: any) => msg.thread_id === (includeItem.threadId || threadId))
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const targetIndex = allThreadMessages.findIndex(msg => msg.id === includeItem.id);
            if (targetIndex !== -1) {
              const startIndex = Math.max(0, targetIndex - (includeItem.withPreviousMessages || 0));
              for (let i = startIndex; i < targetIndex; i++) {
                const message = allThreadMessages[i];
                if (message && !messageIds.has(message.id)) {
                  const convertedPrevMessage = {
                    id: message.id,
                    threadId: message.thread_id,
                    content: safelyParseJSON(message.content),
                    role: message.role as 'user' | 'assistant' | 'system' | 'tool',
                    type: message.type,
                    createdAt: message.createdAt,
                    resourceId: message.resourceId,
                  } as MastraDBMessage;
                  messages.push(convertedPrevMessage);
                  messageIds.add(message.id);
                }
              }
            }
          }

          // Add next messages if requested
          if (includeItem.withNextMessages) {
            const allThreadMessages = Array.from(this.collection.messages.values())
              .filter((msg: any) => msg.thread_id === (includeItem.threadId || threadId))
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const targetIndex = allThreadMessages.findIndex(msg => msg.id === includeItem.id);
            if (targetIndex !== -1) {
              const endIndex = Math.min(
                allThreadMessages.length,
                targetIndex + (includeItem.withNextMessages || 0) + 1,
              );
              for (let i = targetIndex + 1; i < endIndex; i++) {
                const message = allThreadMessages[i];
                if (message && !messageIds.has(message.id)) {
                  const convertedNextMessage = {
                    id: message.id,
                    threadId: message.thread_id,
                    content: safelyParseJSON(message.content),
                    role: message.role as 'user' | 'assistant' | 'system' | 'tool',
                    type: message.type,
                    createdAt: message.createdAt,
                    resourceId: message.resourceId,
                  } as MastraDBMessage;
                  messages.push(convertedNextMessage);
                  messageIds.add(message.id);
                }
              }
            }
          }
        }
      }
    }

    // Sort all messages (paginated + included) for final output
    messages.sort((a: any, b: any) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    // Calculate hasMore
    let hasMore;
    if (include && include.length > 0) {
      // When using include, check if we've returned all messages from the thread
      // because include might bring in messages beyond the pagination window
      const returnedThreadMessageIds = new Set(messages.filter(m => m.threadId === threadId).map(m => m.id));
      hasMore = returnedThreadMessageIds.size < totalThreadMessages;
    } else {
      // Standard pagination: check if there are more pages
      hasMore = end < totalThreadMessages;
    }

    return {
      messages,
      total: totalThreadMessages,
      page,
      perPage: perPageForResponse,
      hasMore,
    };
  }

  protected parseStoredMessage(message: StorageMessageType): MastraDBMessage {
    const { resourceId, content, role, thread_id, ...rest } = message;

    // Parse content using safelyParseJSON utility
    let parsedContent = safelyParseJSON(content);

    // If the result is a plain string (V1 format), wrap it in V2 structure
    if (typeof parsedContent === 'string') {
      parsedContent = {
        format: 2,
        content: parsedContent,
        parts: [{ type: 'text', text: parsedContent }],
      };
    }

    return {
      ...rest,
      threadId: thread_id,
      ...(message.resourceId && { resourceId: message.resourceId }),
      content: parsedContent,
      role: role as MastraDBMessage['role'],
    } satisfies MastraDBMessage;
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    this.logger.debug(`MockStore: listMessagesById called`);

    const rawMessages = messageIds.map(id => this.collection.messages.get(id)).filter(message => !!message);

    const list = new MessageList().add(rawMessages.map(this.parseStoredMessage), 'memory');
    return { messages: list.get.all.db() };
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
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
      // Convert MastraDBMessage to StorageMessageType
      const storageMessage: StorageMessageType = {
        id: message.id,
        thread_id: message.threadId || '',
        content: JSON.stringify(message.content),
        role: message.role || 'user',
        type: message.type || 'text',
        createdAt: message.createdAt,
        resourceId: message.resourceId || null,
      };
      this.collection.messages.set(key, storageMessage);
    }

    const list = new MessageList().add(messages, 'memory');
    return { messages: list.get.all.db() };
  }

  async updateMessages(args: { messages: (Partial<MastraDBMessage> & { id: string })[] }): Promise<MastraDBMessage[]> {
    const updatedMessages: MastraDBMessage[] = [];
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
        let oldContent = safelyParseJSON(storageMsg.content);
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
      // Return as MastraDBMessage
      updatedMessages.push({
        id: storageMsg.id,
        threadId: storageMsg.thread_id,
        content: safelyParseJSON(storageMsg.content),
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

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;
    const { field, direction } = this.parseOrderBy(orderBy);
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values that could cause performance issues
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    this.logger.debug(`MockStore: listThreadsByResourceId called for ${resourceId}`);
    // Mock implementation - find threads by resourceId
    const threads = Array.from(this.collection.threads.values()).filter((t: any) => t.resourceId === resourceId);
    const sortedThreads = this.sortThreads(threads, field, direction);
    const clonedThreads = sortedThreads.map(thread => ({
      ...thread,
      metadata: thread.metadata ? { ...thread.metadata } : thread.metadata,
    })) as StorageThreadType[];
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    return {
      threads: clonedThreads.slice(offset, offset + perPage),
      total: clonedThreads.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedThreads.length,
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

  private sortThreads(threads: any[], field: ThreadOrderBy, direction: ThreadSortDirection): any[] {
    return threads.sort((a, b) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (direction === 'ASC') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }
}
