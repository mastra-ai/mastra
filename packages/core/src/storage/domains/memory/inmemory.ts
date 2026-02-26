import { MessageList } from '../../../agent/message-list';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageMessageType,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
} from '../../types';
import { filterByDateRange, jsonValueEquals, safelyParseJSON } from '../../utils';
import type { InMemoryDB } from '../inmemory-db';
import { MemoryStorage } from './base';

export class InMemoryMemory extends MemoryStorage {
  readonly supportsObservationalMemory = true;
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.threads.clear();
    this.db.messages.clear();
    this.db.resources.clear();
    this.db.observationalMemory.clear();
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
    resourceId: optionalResourceId,
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

    // Step 1: Get messages matching threadId(s) and optionally resourceId
    let threadMessages = Array.from(this.db.messages.values()).filter((msg: any) => {
      // Message must be in one of the specified threads
      if (threadIdSet && !threadIdSet.has(msg.thread_id)) return false;
      // If optionalResourceId provided, message must match it
      if (optionalResourceId && msg.resourceId !== optionalResourceId) return false;
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

  async listMessagesByResourceId({
    resourceId,
    filter,
    perPage: perPageInput,
    page = 0,
    orderBy,
  }: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    this.logger.debug(`InMemoryMemory: listMessagesByResourceId called for resource ${resourceId}`);

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

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Get all messages matching the resourceId (across all threads)
    let messages = Array.from(this.db.messages.values()).filter((msg: any) => msg.resourceId === resourceId);

    // Apply date filtering
    messages = filterByDateRange(messages, (msg: any) => new Date(msg.createdAt), filter?.dateRange);

    // Sort messages
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

    // Get total count for pagination
    const total = messages.length;

    // Apply pagination
    const paginatedMessages = messages.slice(offset, offset + perPage);

    const list = new MessageList().add(
      paginatedMessages.map(m => this.parseStoredMessage(m)),
      'memory',
    );

    const hasMore = offset + paginatedMessages.length < total;

    return {
      messages: list.get.all.db(),
      total,
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

    // Validate metadata keys before filtering
    this.validateMetadataKeys(filter?.metadata);

    // Apply metadata filter if provided (AND logic - all key-value pairs must match)
    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      threads = threads.filter(thread => {
        if (!thread.metadata) return false;
        return Object.entries(filter.metadata!).every(([key, value]) => jsonValueEquals(thread.metadata![key], value));
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

  // ============================================
  // Observational Memory Implementation
  // ============================================

  private getObservationalMemoryKey(threadId: string | null, resourceId: string): string {
    if (threadId) {
      return `thread:${threadId}`;
    }
    return `resource:${resourceId}`;
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.db.observationalMemory.get(key);
    return records?.[0] ?? null;
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit?: number,
  ): Promise<ObservationalMemoryRecord[]> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.db.observationalMemory.get(key) ?? [];
    return limit != null ? records.slice(0, limit) : records;
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    const { threadId, resourceId, scope, config, observedTimezone } = input;
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const now = new Date();

    const record: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope,
      threadId,
      resourceId,
      // Timestamps at top level
      createdAt: now,
      updatedAt: now,
      // lastObservedAt starts undefined - all messages are "unobserved" initially
      // This ensures historical data (like LongMemEval fixtures) works correctly
      lastObservedAt: undefined,
      originType: 'initial',
      generationCount: 0,
      activeObservations: '',
      // Buffering (for async observation/reflection)
      bufferedObservations: undefined,
      bufferedReflection: undefined,
      // Message tracking
      // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
      // Token tracking
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      // State flags
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      // Configuration
      config,
      // Timezone used for observation date formatting
      observedTimezone,
      // Extensible metadata (optional)
      metadata: {},
    };

    // Add as first record (most recent)
    const existing = this.db.observationalMemory.get(key) ?? [];
    this.db.observationalMemory.set(key, [record, ...existing]);

    return record;
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    const { id, observations, tokenCount, lastObservedAt, observedMessageIds } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.activeObservations = observations;
    record.observationTokenCount = tokenCount;
    record.totalTokensObserved += tokenCount;
    // Reset pending tokens since we've now observed them
    record.pendingMessageTokens = 0;

    // Update timestamps (top-level, not in metadata)
    record.lastObservedAt = lastObservedAt;
    record.updatedAt = new Date();

    // Store observed message IDs as safeguard against re-observation
    if (observedMessageIds) {
      record.observedMessageIds = observedMessageIds;
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    const { id, chunk } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    // Create a new chunk with generated id and timestamp
    const newChunk: BufferedObservationChunk = {
      id: `ombuf-${crypto.randomUUID()}`,
      cycleId: chunk.cycleId,
      observations: chunk.observations,
      tokenCount: chunk.tokenCount,
      messageIds: chunk.messageIds,
      messageTokens: chunk.messageTokens,
      lastObservedAt: chunk.lastObservedAt,
      createdAt: new Date(),
      suggestedContinuation: chunk.suggestedContinuation,
      currentTask: chunk.currentTask,
    };

    // Add chunk to the array
    const existingChunks = Array.isArray(record.bufferedObservationChunks) ? record.bufferedObservationChunks : [];
    record.bufferedObservationChunks = [...existingChunks, newChunk];

    if (input.lastBufferedAtTime) {
      record.lastBufferedAtTime = input.lastBufferedAtTime;
    }

    record.updatedAt = new Date();
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    const { id, activationRatio, lastObservedAt } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const chunks = Array.isArray(record.bufferedObservationChunks) ? record.bufferedObservationChunks : [];
    if (chunks.length === 0) {
      return {
        chunksActivated: 0,
        messageTokensActivated: 0,
        observationTokensActivated: 0,
        messagesActivated: 0,
        activatedCycleIds: [],
        activatedMessageIds: [],
      };
    }

    // Calculate target: how many message tokens to remove so that
    // (1 - activationRatio) * threshold worth of raw messages remain.
    // e.g., ratio=0.8, threshold=5000, pending=6000 → remove 6000 - 1000 = 5000
    const retentionFloor = input.messageTokensThreshold * (1 - activationRatio);
    const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

    // Find the closest chunk boundary to the target, biased over (prefer removing
    // slightly more than the target so remaining context lands at or below retentionFloor).
    // Track both best-over and best-under boundaries so we can fall back to under
    // if the over boundary would overshoot by too much.
    let cumulativeMessageTokens = 0;
    let bestOverBoundary = 0;
    let bestOverTokens = 0;
    let bestUnderBoundary = 0;
    let bestUnderTokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
      const boundary = i + 1;

      if (cumulativeMessageTokens >= targetMessageTokens) {
        // Over or equal — track the closest (lowest) over boundary
        if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
          bestOverBoundary = boundary;
          bestOverTokens = cumulativeMessageTokens;
        }
      } else {
        // Under — track the closest (highest) under boundary
        if (cumulativeMessageTokens > bestUnderTokens) {
          bestUnderBoundary = boundary;
          bestUnderTokens = cumulativeMessageTokens;
        }
      }
    }

    // Safeguard: if the over boundary would eat into more than 95% of the
    // retention floor, fall back to the best under boundary instead.
    // This prevents edge cases where a large chunk overshoots dramatically.
    // When forceMaxActivation is set (above blockAfter), still prefer the over
    // boundary, but never if it would leave fewer than the smaller of 1000
    // tokens or the retention floor remaining.
    const maxOvershoot = retentionFloor * 0.95;
    const overshoot = bestOverTokens - targetMessageTokens;
    const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
    const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
    // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
    const minRemaining = Math.min(1000, retentionFloor);

    let chunksToActivate: number;
    if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
      chunksToActivate = bestOverBoundary;
    } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
      chunksToActivate = bestOverBoundary;
    } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
      chunksToActivate = bestUnderBoundary;
    } else if (bestOverBoundary > 0) {
      // All boundaries are over and exceed the safeguard — still activate
      // the closest over boundary (better than nothing)
      chunksToActivate = bestOverBoundary;
    } else {
      chunksToActivate = 1;
    }
    const activatedChunks = chunks.slice(0, chunksToActivate);
    const remainingChunks = chunks.slice(chunksToActivate);

    // Combine activated chunks into content
    const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
    const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
    const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
    const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
    const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds);

    // Derive lastObservedAt from the latest activated chunk, or use provided value
    const latestChunk = activatedChunks[activatedChunks.length - 1];
    const derivedLastObservedAt =
      lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());

    // Append activated content to active observations
    if (record.activeObservations) {
      record.activeObservations = `${record.activeObservations}\n\n${activatedContent}`;
    } else {
      record.activeObservations = activatedContent;
    }

    // Update observation token count
    record.observationTokenCount = (record.observationTokenCount ?? 0) + activatedTokens;

    // Decrement pending message tokens (clamped to zero)
    record.pendingMessageTokens = Math.max(0, (record.pendingMessageTokens ?? 0) - activatedMessageTokens);

    // NOTE: We intentionally do NOT add activatedMessageIds to record.observedMessageIds.
    // observedMessageIds is used by getUnobservedMessages to filter future messages.
    // Since AI SDK may reuse message IDs for new content, adding them here would
    // permanently block new content from being observed. Instead, we return
    // activatedMessageIds so the caller can remove them from messageList directly.

    // Update buffered state with remaining chunks
    record.bufferedObservationChunks = remainingChunks.length > 0 ? remainingChunks : undefined;

    // Update timestamps
    record.lastObservedAt = derivedLastObservedAt;
    record.updatedAt = new Date();

    // Use hints from the most recent activated chunk only — stale hints from older chunks are discarded
    const latestChunkHints = activatedChunks[activatedChunks.length - 1];

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
      suggestedContinuation: latestChunkHints?.suggestedContinuation ?? undefined,
      currentTask: latestChunkHints?.currentTask ?? undefined,
    };
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord, reflection, tokenCount } = input;
    const key = this.getObservationalMemoryKey(currentRecord.threadId, currentRecord.resourceId);
    const now = new Date();

    const newRecord: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope: currentRecord.scope,
      threadId: currentRecord.threadId,
      resourceId: currentRecord.resourceId,
      // Timestamps at top level
      createdAt: now,
      updatedAt: now,
      lastObservedAt: currentRecord.lastObservedAt ?? now, // Carry over from observation (which always runs before reflection)
      originType: 'reflection',
      generationCount: currentRecord.generationCount + 1,
      activeObservations: reflection,
      config: currentRecord.config,
      totalTokensObserved: currentRecord.totalTokensObserved,
      observationTokenCount: tokenCount,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      // Timezone used for observation date formatting
      observedTimezone: currentRecord.observedTimezone,
      // Extensible metadata (optional)
      metadata: {},
    };

    // Add as first record (most recent)
    const existing = this.db.observationalMemory.get(key) ?? [];
    this.db.observationalMemory.set(key, [newRecord, ...existing]);

    return newRecord;
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    const { id, reflection, tokenCount, inputTokenCount, reflectedObservationLineCount } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const existing = record.bufferedReflection || '';
    record.bufferedReflection = existing ? `${existing}\n\n${reflection}` : reflection;
    record.bufferedReflectionTokens = (record.bufferedReflectionTokens || 0) + tokenCount;
    record.bufferedReflectionInputTokens = (record.bufferedReflectionInputTokens || 0) + inputTokenCount;
    record.reflectedObservationLineCount = reflectedObservationLineCount;
    record.updatedAt = new Date();
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    const record = this.findObservationalMemoryRecordById(currentRecord.id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${currentRecord.id}`);
    }

    if (!record.bufferedReflection) {
      throw new Error('No buffered reflection to swap');
    }

    const bufferedReflection = record.bufferedReflection;
    const reflectedLineCount = record.reflectedObservationLineCount ?? 0;

    // Split current activeObservations by the boundary line count.
    // Lines 0..reflectedLineCount were reflected on → replaced by bufferedReflection.
    // Lines after reflectedLineCount were added after reflection started → kept as-is.
    const currentObservations = record.activeObservations ?? '';
    const allLines = currentObservations.split('\n');
    const unreflectedLines = allLines.slice(reflectedLineCount);
    const unreflectedContent = unreflectedLines.join('\n').trim();

    // New activeObservations = bufferedReflection + unreflected observations
    const newObservations = unreflectedContent ? `${bufferedReflection}\n\n${unreflectedContent}` : bufferedReflection;

    // Create a new generation with the merged content.
    // tokenCount is computed by the processor using its token counter on the combined content.
    const newRecord = await this.createReflectionGeneration({
      currentRecord: record,
      reflection: newObservations,
      tokenCount: input.tokenCount,
    });

    // Clear buffered state on old record
    record.bufferedReflection = undefined;
    record.bufferedReflectionTokens = undefined;
    record.bufferedReflectionInputTokens = undefined;
    record.reflectedObservationLineCount = undefined;

    return newRecord;
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isReflecting = isReflecting;
    record.updatedAt = new Date();
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isObserving = isObserving;
    record.updatedAt = new Date();
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isBufferingObservation = isBuffering;
    if (lastBufferedAtTokens !== undefined) {
      record.lastBufferedAtTokens = lastBufferedAtTokens;
    }
    record.updatedAt = new Date();
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isBufferingReflection = isBuffering;
    record.updatedAt = new Date();
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    this.db.observationalMemory.delete(key);
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.pendingMessageTokens = tokenCount;
    record.updatedAt = new Date();
  }

  /**
   * Helper to find an observational memory record by ID across all keys
   */
  private findObservationalMemoryRecordById(id: string): ObservationalMemoryRecord | null {
    for (const records of this.db.observationalMemory.values()) {
      const record = records.find(r => r.id === id);
      if (record) return record;
    }
    return null;
  }
}
