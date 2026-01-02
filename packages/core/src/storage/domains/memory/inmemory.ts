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
  ObservationalMemoryRecord,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  CreateReflectionGenerationInput,
} from '../../types';
import { safelyParseJSON } from '../../utils';
import type { StoreOperations } from '../operations';
import { MemoryStorage } from './base';

export type InMemoryThreads = Map<string, StorageThreadType>;
export type InMemoryResources = Map<string, StorageResourceType>;
export type InMemoryMessages = Map<string, StorageMessageType>;
export type InMemoryObservationalMemory = Map<string, ObservationalMemoryRecord[]>;

export class InMemoryMemory extends MemoryStorage {
  private collection: {
    threads: InMemoryThreads;
    resources: InMemoryResources;
    messages: InMemoryMessages;
    observationalMemory: InMemoryObservationalMemory;
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
      observationalMemory?: InMemoryObservationalMemory;
    };
    operations: StoreOperations;
  }) {
    super();
    this.collection = {
      ...collection,
      observationalMemory: collection.observationalMemory ?? new Map(),
    };
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
    // Normalize threadId to array (may be undefined if querying by resourceId only)
    // Treat empty strings and whitespace-only strings as undefined
    const normalizedThreadId = threadId && (Array.isArray(threadId) ? threadId.filter(id => id.trim()) : threadId.trim() || undefined);
    const threadIds = normalizedThreadId ? (Array.isArray(normalizedThreadId) ? normalizedThreadId : [normalizedThreadId]) : undefined;

    // Validate: at least one of threadId or resourceId must be provided
    if (!threadIds?.length && !resourceId) {
      throw new Error('Either threadId or resourceId must be provided');
    }

    if (threadIds?.length) {
      this.logger.debug(`MockStore: listMessages called for threads ${threadIds.join(', ')}`);
    } else {
      this.logger.debug(`MockStore: listMessages called for resourceId ${resourceId}`);
    }

    const threadIdSet = threadIds ? new Set(threadIds) : undefined;

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

    // Step 1: Get messages matching threadId(s) and/or resourceId
    let threadMessages = Array.from(this.collection.messages.values()).filter((msg: any) => {
      // If threadIds provided, message must be in one of them
      if (threadIdSet && !threadIdSet.has(msg.thread_id)) return false;
      // If resourceId provided, message must match it
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
    const records = this.collection.observationalMemory.get(key);
    return records?.[0] ?? null;
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit?: number,
  ): Promise<ObservationalMemoryRecord[]> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.collection.observationalMemory.get(key) ?? [];
    return limit ? records.slice(0, limit) : records;
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    const { threadId, resourceId, scope, config } = input;
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
      // Configuration
      config,
      // Extensible metadata (optional)
      metadata: {},
    };

    // Add as first record (most recent)
    const existing = this.collection.observationalMemory.get(key) ?? [];
    this.collection.observationalMemory.set(key, [record, ...existing]);

    return record;
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    const { id, observations, tokenCount, lastObservedAt } = input;
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
    // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
    record.lastObservedAt = lastObservedAt;
    record.updatedAt = new Date();
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    const { id, observations } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.bufferedObservations = observations;
    // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
    record.updatedAt = new Date();
  }

  async swapBufferedToActive(id: string): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    if (!record.bufferedObservations) {
      return; // Nothing to swap
    }

    // Append buffered to active (or replace if empty)
    if (record.activeObservations) {
      record.activeObservations = `${record.activeObservations}\n\n${record.bufferedObservations}`;
    } else {
      record.activeObservations = record.bufferedObservations;
    }

    // Clear buffered state
    // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
    record.bufferedObservations = undefined;

    // Update timestamps (top-level, not in metadata)
    record.lastObservedAt = new Date();
    record.updatedAt = new Date();
  }

  async markMessagesAsBuffering(id: string, _messageIds: string[]): Promise<void> {
    // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
    // This method is retained for interface compatibility but is a no-op
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }
    record.updatedAt = new Date();
  }

  async markMessagesAsBuffered(id: string, _messageIds: string[]): Promise<void> {
    // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
    // This method is retained for interface compatibility but is a no-op
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }
    record.updatedAt = new Date();
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
      activeObservations: reflection,
      // After reflection, reset observedMessageIds since old messages are now "baked into" the reflection.
      // The previous DB record retains its observedMessageIds as historical record.
      // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
      config: currentRecord.config,
      totalTokensObserved: currentRecord.totalTokensObserved,
      observationTokenCount: tokenCount,
      pendingMessageTokens: currentRecord.pendingMessageTokens ?? 0,
      isReflecting: false,
      isObserving: false,
      // Extensible metadata (optional)
      metadata: {},
    };

    // Add as first record (most recent)
    const existing = this.collection.observationalMemory.get(key) ?? [];
    this.collection.observationalMemory.set(key, [newRecord, ...existing]);

    return newRecord;
  }

  async updateBufferedReflection(id: string, reflection: string): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.bufferedReflection = reflection;
    record.updatedAt = new Date();
  }

  async swapReflectionToActive(id: string): Promise<ObservationalMemoryRecord> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    if (!record.bufferedReflection) {
      throw new Error('No buffered reflection to swap');
    }

    // Create a new generation with the reflection
    const newRecord = await this.createReflectionGeneration({
      currentRecord: record,
      reflection: record.bufferedReflection,
      tokenCount: 0, // Will be calculated by caller
    });

    // Clear the buffered reflection from old record
    record.bufferedReflection = undefined;

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

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    this.collection.observationalMemory.delete(key);
  }

  async addPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.pendingMessageTokens = (record.pendingMessageTokens ?? 0) + tokenCount;
    record.updatedAt = new Date();
  }

  /**
   * Helper to find an observational memory record by ID across all keys
   */
  private findObservationalMemoryRecordById(id: string): ObservationalMemoryRecord | null {
    for (const records of this.collection.observationalMemory.values()) {
      const record = records.find(r => r.id === id);
      if (record) return record;
    }
    return null;
  }
}
