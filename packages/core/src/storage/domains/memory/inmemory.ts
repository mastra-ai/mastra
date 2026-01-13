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
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
} from '../../types';
import { filterByDateRange, safelyParseJSON } from '../../utils';
import type { InMemoryDB } from '../inmemory-db';
import { MemoryStorage } from './base';

export class InMemoryMemory extends MemoryStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.threads.clear();
    this.db.messages.clear();
    this.db.resources.clear();
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    this.logger.debug(`InMemoryMemory: getThreadById called for ${threadId}`);
    const thread = this.db.threads.get(threadId);
    return thread ? { ...thread, metadata: thread.metadata ? { ...thread.metadata } : thread.metadata } : null;
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.logger.debug(`InMemoryMemory: saveThread called for ${thread.id}`);
    const key = thread.id;
    this.db.threads.set(key, thread);
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
    this.logger.debug(`InMemoryMemory: updateThread called for ${id}`);
    const thread = this.db.threads.get(id);

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
    this.logger.debug(`InMemoryMemory: deleteThread called for ${threadId}`);
    this.db.threads.delete(threadId);

    this.db.messages.forEach((msg, key) => {
      if (msg.thread_id === threadId) {
        this.db.messages.delete(key);
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
    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    this.logger.debug(`InMemoryMemory: listMessages called for threads ${threadIds.join(', ')}`);

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new Error('threadId must be a non-empty string or array of non-empty strings');
    }

    const threadIdSet = new Set(threadIds);

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

    // Step 1: Get regular paginated messages from the thread(s) first
    let threadMessages = Array.from(this.db.messages.values()).filter((msg: any) => {
      if (!threadIdSet.has(msg.thread_id)) return false;
      if (resourceId && msg.resourceId !== resourceId) return false;
      return true;
    });

    // Apply date filtering
    threadMessages = filterByDateRange(threadMessages, (msg: any) => new Date(msg.createdAt), filter?.dateRange);

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
        const targetMessage = this.db.messages.get(includeItem.id);
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
            const allThreadMessages = Array.from(this.db.messages.values())
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
            const allThreadMessages = Array.from(this.db.messages.values())
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
    this.logger.debug(`InMemoryMemory: listMessagesById called`);

    const rawMessages = messageIds.map(id => this.db.messages.get(id)).filter(message => !!message);

    const list = new MessageList().add(
      rawMessages.map(m => this.parseStoredMessage(m)),
      'memory',
    );
    return { messages: list.get.all.db() };
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    this.logger.debug(`InMemoryMemory: saveMessages called with ${messages.length} messages`);
    // Simulate error handling for testing - check before saving
    if (messages.some(msg => msg.id === 'error-message' || msg.resourceId === null)) {
      throw new Error('Simulated error for testing');
    }

    // Update thread timestamps for each unique threadId
    const threadIds = new Set(messages.map(msg => msg.threadId).filter((id): id is string => Boolean(id)));
    for (const threadId of threadIds) {
      const thread = this.db.threads.get(threadId);
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
      this.db.messages.set(key, storageMessage);
    }

    const list = new MessageList().add(messages, 'memory');
    return { messages: list.get.all.db() };
  }

  async updateMessages(args: { messages: (Partial<MastraDBMessage> & { id: string })[] }): Promise<MastraDBMessage[]> {
    const updatedMessages: MastraDBMessage[] = [];
    for (const update of args.messages) {
      const storageMsg = this.db.messages.get(update.id);
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
        const oldThread = this.db.threads.get(oldThreadId);
        if (oldThread) {
          const prev = new Date(oldThread.updatedAt).getTime();
          oldThreadNewTime = Math.max(base, prev + 1);
          oldThread.updatedAt = new Date(oldThreadNewTime);
        }
        const newThread = this.db.threads.get(newThreadId);
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
        const thread = this.db.threads.get(oldThreadId);
        if (thread) {
          const prev = new Date(thread.updatedAt).getTime();
          let newTime = Date.now();
          if (newTime <= prev) newTime = prev + 1;
          thread.updatedAt = new Date(newTime);
        }
      }
      // Save the updated message
      this.db.messages.set(update.id, storageMsg);
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

    this.logger.debug(`InMemoryMemory: deleteMessages called for ${messageIds.length} messages`);

    // Collect thread IDs to update
    const threadIds = new Set<string>();

    for (const messageId of messageIds) {
      const message = this.db.messages.get(messageId);
      if (message && message.thread_id) {
        threadIds.add(message.thread_id);
      }
      // Delete the message
      this.db.messages.delete(messageId);
    }

    // Update thread timestamps
    const now = new Date();
    for (const threadId of threadIds) {
      const thread = this.db.threads.get(threadId);
      if (thread) {
        thread.updatedAt = now;
      }
    }
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;
    const { field, direction } = this.parseOrderBy(orderBy);

    // Validate pagination input before normalization
    // This ensures page === 0 when perPageInput === false
    this.validatePaginationInput(page, perPageInput ?? 100);

    const perPage = normalizePerPage(perPageInput, 100);

    this.logger.debug(`InMemoryMemory: listThreads called with filter: ${JSON.stringify(filter)}`);

    // Start with all threads
    let threads = Array.from(this.db.threads.values());

    // Apply resourceId filter if provided
    if (filter?.resourceId) {
      threads = threads.filter((t: any) => t.resourceId === filter.resourceId);
    }

    // Apply metadata filter if provided (AND logic - all key-value pairs must match)
    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      threads = threads.filter(thread => {
        if (!thread.metadata) return false;
        return Object.entries(filter.metadata!).every(([key, value]) => thread.metadata![key] === value);
      });
    }

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
    this.logger.debug(`InMemoryMemory: getResourceById called for ${resourceId}`);
    const resource = this.db.resources.get(resourceId);
    return resource
      ? { ...resource, metadata: resource.metadata ? { ...resource.metadata } : resource.metadata }
      : null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    this.logger.debug(`InMemoryMemory: saveResource called for ${resource.id}`);
    this.db.resources.set(resource.id, resource);
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
    this.logger.debug(`InMemoryMemory: updateResource called for ${resourceId}`);
    let resource = this.db.resources.get(resourceId);

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

    this.db.resources.set(resourceId, resource);
    return resource;
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    this.logger.debug(`InMemoryMemory: cloneThread called for source thread ${sourceThreadId}`);

    // Get the source thread
    const sourceThread = this.db.threads.get(sourceThreadId);
    if (!sourceThread) {
      throw new Error(`Source thread with id ${sourceThreadId} not found`);
    }

    // Use provided ID or generate a new one
    const newThreadId = providedThreadId || crypto.randomUUID();

    // Check if the new thread ID already exists
    if (this.db.threads.has(newThreadId)) {
      throw new Error(`Thread with id ${newThreadId} already exists`);
    }

    // Get messages from the source thread
    let sourceMessages = Array.from(this.db.messages.values())
      .filter((msg: StorageMessageType) => msg.thread_id === sourceThreadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Apply message filters if provided
    if (options?.messageFilter) {
      const { startDate, endDate, messageIds } = options.messageFilter;

      if (messageIds && messageIds.length > 0) {
        const messageIdSet = new Set(messageIds);
        sourceMessages = sourceMessages.filter(msg => messageIdSet.has(msg.id));
      }

      if (startDate) {
        sourceMessages = sourceMessages.filter(msg => new Date(msg.createdAt) >= startDate);
      }

      if (endDate) {
        sourceMessages = sourceMessages.filter(msg => new Date(msg.createdAt) <= endDate);
      }
    }

    // Apply message limit (take from the end to get most recent)
    if (options?.messageLimit && options.messageLimit > 0 && sourceMessages.length > options.messageLimit) {
      sourceMessages = sourceMessages.slice(-options.messageLimit);
    }

    const now = new Date();

    // Determine the last message ID for clone metadata
    const lastMessageId = sourceMessages.length > 0 ? sourceMessages[sourceMessages.length - 1]!.id : undefined;

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
      title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : undefined),
      metadata: {
        ...metadata,
        clone: cloneMetadata,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Save the new thread
    this.db.threads.set(newThreadId, newThread);

    // Clone messages with new IDs
    const clonedMessages: MastraDBMessage[] = [];
    for (const sourceMsg of sourceMessages) {
      const newMessageId = crypto.randomUUID();
      const parsedContent = safelyParseJSON(sourceMsg.content);

      // Create storage message
      const newStorageMessage: StorageMessageType = {
        id: newMessageId,
        thread_id: newThreadId,
        content: sourceMsg.content,
        role: sourceMsg.role,
        type: sourceMsg.type,
        createdAt: sourceMsg.createdAt,
        resourceId: resourceId || sourceMsg.resourceId,
      };

      this.db.messages.set(newMessageId, newStorageMessage);

      // Create MastraDBMessage for return
      clonedMessages.push({
        id: newMessageId,
        threadId: newThreadId,
        content: parsedContent,
        role: sourceMsg.role as MastraDBMessage['role'],
        type: sourceMsg.type,
        createdAt: sourceMsg.createdAt,
        resourceId: resourceId || sourceMsg.resourceId || undefined,
      });
    }

    this.logger.debug(
      `InMemoryMemory: cloned thread ${sourceThreadId} to ${newThreadId} with ${clonedMessages.length} messages`,
    );

    return {
      thread: newThread,
      clonedMessages,
    };
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
