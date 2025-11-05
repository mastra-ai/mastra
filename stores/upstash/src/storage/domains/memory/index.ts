import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_MESSAGES,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import type { StoreOperationsUpstash } from '../operations';
import { ensureDate, getKey, processRecord } from '../utils';

function getThreadMessagesKey(threadId: string): string {
  return `thread:${threadId}:messages`;
}

function getMessageKey(threadId: string, messageId: string): string {
  const key = getKey(TABLE_MESSAGES, { threadId, id: messageId });
  return key;
}

export class StoreMemoryUpstash extends MemoryStorage {
  private client: Redis;
  private operations: StoreOperationsUpstash;
  constructor({ client, operations }: { client: Redis; operations: StoreOperationsUpstash }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.operations.load<StorageThreadType>({
        tableName: TABLE_THREADS,
        keys: { id: threadId },
      });

      if (!thread) return null;

      return {
        ...thread,
        createdAt: ensureDate(thread.createdAt)!,
        updatedAt: ensureDate(thread.updatedAt)!,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  public async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;
    const { field, direction } = this.parseOrderBy(orderBy);
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_LIST_THREADS_BY_RESOURCE_ID_INVALID_PAGE',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      let allThreads: StorageThreadType[] = [];
      const pattern = `${TABLE_THREADS}:*`;
      const keys = await this.operations.scanKeys(pattern);

      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      for (let i = 0; i < results.length; i++) {
        const thread = results[i] as StorageThreadType | null;
        if (thread && thread.resourceId === resourceId) {
          allThreads.push({
            ...thread,
            createdAt: ensureDate(thread.createdAt)!,
            updatedAt: ensureDate(thread.updatedAt)!,
            metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
          });
        }
      }

      // Apply sorting with parameters
      const sortedThreads = this.sortThreads(allThreads, field, direction);

      const total = sortedThreads.length;
      // When perPage is false (get all), ignore page offset
      const end = perPageInput === false ? total : offset + perPage;
      const paginatedThreads = sortedThreads.slice(offset, end);
      const hasMore = perPageInput === false ? false : end < total;

      return {
        threads: paginatedThreads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_LIST_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
            page,
            perPage,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return {
        threads: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.operations.insert({
        tableName: TABLE_THREADS,
        record: thread,
      });
      return thread;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }
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
    const thread = await this.getThreadById({ threadId: id });
    if (!thread) {
      throw new MastraError({
        id: 'STORAGE_UPSTASH_STORAGE_UPDATE_THREAD_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          threadId: id,
        },
      });
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    try {
      await this.saveThread({ thread: updatedThread });
      return updatedThread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
          },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // Delete thread metadata and sorted set
    const threadKey = getKey(TABLE_THREADS, { id: threadId });
    const threadMessagesKey = getThreadMessagesKey(threadId);
    try {
      const messageIds: string[] = await this.client.zrange(threadMessagesKey, 0, -1);

      const pipeline = this.client.pipeline();
      pipeline.del(threadKey);
      pipeline.del(threadMessagesKey);

      for (let i = 0; i < messageIds.length; i++) {
        const messageId = messageIds[i];
        const messageKey = getMessageKey(threadId, messageId as string);
        pipeline.del(messageKey);
      }

      await pipeline.exec();

      // Bulk delete all message keys for this thread if any remain
      await this.operations.scanAndDelete(getMessageKey(threadId, '*'));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    if (messages.length === 0) return { messages: [] };

    const threadId = messages[0]?.threadId;
    try {
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      // Check if thread exists
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_SAVE_MESSAGES_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }

    // Add an index to each message to maintain order
    const messagesWithIndex = messages.map((message, index) => {
      if (!message.threadId) {
        throw new Error(
          `Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.`,
        );
      }
      if (!message.resourceId) {
        throw new Error(
          `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
        );
      }
      return {
        ...message,
        _index: index,
      };
    });

    // Get current thread data once (all messages belong to same thread)
    const threadKey = getKey(TABLE_THREADS, { id: threadId });
    const existingThread = await this.client.get<StorageThreadType>(threadKey);

    try {
      const batchSize = 1000;
      for (let i = 0; i < messagesWithIndex.length; i += batchSize) {
        const batch = messagesWithIndex.slice(i, i + batchSize);
        const pipeline = this.client.pipeline();

        for (const message of batch) {
          const key = getMessageKey(message.threadId!, message.id);
          const createdAtScore = new Date(message.createdAt).getTime();
          const score = message._index !== undefined ? message._index : createdAtScore;

          // Check if this message id exists in another thread
          const existingKeyPattern = getMessageKey('*', message.id);
          const keys = await this.operations.scanKeys(existingKeyPattern);

          if (keys.length > 0) {
            const pipeline2 = this.client.pipeline();
            keys.forEach(key => pipeline2.get(key));
            const results = await pipeline2.exec();
            const existingMessages = results.filter((msg): msg is MastraDBMessage => msg !== null) as MastraDBMessage[];
            for (const existingMessage of existingMessages) {
              const existingMessageKey = getMessageKey(existingMessage.threadId!, existingMessage.id);
              if (existingMessage && existingMessage.threadId !== message.threadId) {
                pipeline.del(existingMessageKey);
                // Remove from old thread's sorted set
                pipeline.zrem(getThreadMessagesKey(existingMessage.threadId!), existingMessage.id);
              }
            }
          }

          // Store the message data
          pipeline.set(key, message);

          // Add to sorted set for this thread
          pipeline.zadd(getThreadMessagesKey(message.threadId!), {
            score,
            member: message.id,
          });
        }

        // Update the thread's updatedAt field (only in the first batch)
        if (i === 0 && existingThread) {
          const updatedThread = {
            ...existingThread,
            updatedAt: new Date(),
          };
          pipeline.set(threadKey, processRecord(TABLE_THREADS, updatedThread).processedRecord);
        }

        await pipeline.exec();
      }

      const list = new MessageList().add(messages as any, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  private async _getIncludedMessages(
    threadId: string,
    include: StorageListMessagesInput['include'],
  ): Promise<MastraDBMessage[]> {
    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

    const messageIds = new Set<string>();
    const messageIdToThreadIds: Record<string, string> = {};

    // First, get specifically included messages and their context
    if (include?.length) {
      for (const item of include) {
        messageIds.add(item.id);

        // Use per-include threadId if present, else fallback to main threadId
        const itemThreadId = item.threadId || threadId;
        messageIdToThreadIds[item.id] = itemThreadId;
        const itemThreadMessagesKey = getThreadMessagesKey(itemThreadId);

        // Get the rank of this message in the sorted set
        const rank = await this.client.zrank(itemThreadMessagesKey, item.id);
        if (rank === null) continue;

        // Get previous messages if requested
        if (item.withPreviousMessages) {
          const start = Math.max(0, rank - item.withPreviousMessages);
          const prevIds = rank === 0 ? [] : await this.client.zrange(itemThreadMessagesKey, start, rank - 1);
          prevIds.forEach(id => {
            messageIds.add(id as string);
            messageIdToThreadIds[id as string] = itemThreadId;
          });
        }

        // Get next messages if requested
        if (item.withNextMessages) {
          const nextIds = await this.client.zrange(itemThreadMessagesKey, rank + 1, rank + item.withNextMessages);
          nextIds.forEach(id => {
            messageIds.add(id as string);
            messageIdToThreadIds[id as string] = itemThreadId;
          });
        }
      }

      const pipeline = this.client.pipeline();
      Array.from(messageIds).forEach(id => {
        const tId = messageIdToThreadIds[id] || threadId;
        pipeline.get(getMessageKey(tId, id as string));
      });
      const results = await pipeline.exec();
      return results.filter(result => result !== null) as MastraDBMessage[];
    }

    return [];
  }

  private parseStoredMessage(storedMessage: MastraDBMessage & { _index?: number }): MastraDBMessage {
    const defaultMessageContent = { format: 2, parts: [{ type: 'text', text: '' }] };
    const { _index, ...rest } = storedMessage;
    return {
      ...rest,
      createdAt: new Date(rest.createdAt),
      content: rest.content || defaultMessageContent,
    } satisfies MastraDBMessage;
  }

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

    try {
      // Search in all threads in parallel
      const threadKeys = await this.client.keys('thread:*');

      const result = await Promise.all(
        threadKeys.map(threadKey => {
          const threadId = threadKey.split(':')[1];
          if (!threadId) throw new Error(`Failed to parse thread ID from thread key "${threadKey}"`);
          return this.client.mget<(MastraDBMessage & { _index?: number })[]>(
            messageIds.map(id => getMessageKey(threadId, id)),
          );
        }),
      );

      const rawMessages = result.flat(1).filter(msg => !!msg) as (MastraDBMessage & { _index?: number })[];

      const list = new MessageList().add(rawMessages.map(this.parseStoredMessage), 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_LIST_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageIds: JSON.stringify(messageIds),
          },
        },
        error,
      );
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    if (!threadId.trim()) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_LIST_MESSAGES_INVALID_THREAD_ID',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        new Error('threadId must be a non-empty string'),
      );
    }

    const threadMessagesKey = getThreadMessagesKey(threadId);
    const perPage = normalizePerPage(perPageInput, 40);
    // When perPage is false (get all), ignore page offset
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      if (page < 0) {
        throw new MastraError(
          {
            id: 'STORAGE_UPSTASH_LIST_MESSAGES_INVALID_PAGE',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      // Get included messages with context if specified
      let includedMessages: MastraDBMessage[] = [];
      if (include && include.length > 0) {
        const included = (await this._getIncludedMessages(threadId, include)) as MastraDBMessage[];
        includedMessages = included.map(this.parseStoredMessage);
      }

      // Get all message IDs from the sorted set
      const allMessageIds = await this.client.zrange(threadMessagesKey, 0, -1);
      if (allMessageIds.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Use pipeline to fetch all messages efficiently
      const pipeline = this.client.pipeline();
      allMessageIds.forEach(id => pipeline.get(getMessageKey(threadId, id as string)));
      const results = await pipeline.exec();

      // Process messages and apply filters
      let messagesData = results
        .filter((msg): msg is MastraDBMessage & { _index?: number } => msg !== null)
        .map(this.parseStoredMessage);

      // Filter by resourceId if provided
      if (resourceId) {
        messagesData = messagesData.filter(msg => msg.resourceId === resourceId);
      }

      // Apply date filters if provided
      const dateRange = filter?.dateRange;
      if (dateRange?.start) {
        const fromDate = dateRange.start;
        messagesData = messagesData.filter(msg => new Date(msg.createdAt).getTime() >= fromDate.getTime());
      }

      if (dateRange?.end) {
        const toDate = dateRange.end;
        messagesData = messagesData.filter(msg => new Date(msg.createdAt).getTime() <= toDate.getTime());
      }

      // Determine sort field and direction, default to ASC (oldest first)
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      // Type-safe field accessor helper
      const getFieldValue = (msg: MastraDBMessage): number => {
        if (field === 'createdAt') {
          return new Date(msg.createdAt).getTime();
        }
        // Access other fields with type-safe casting
        const value = (msg as Record<string, unknown>)[field];
        if (typeof value === 'number') {
          return value;
        }
        if (value instanceof Date) {
          return value.getTime();
        }
        // Handle missing/undefined values - treat as 0 for numeric comparison
        return 0;
      };

      // Sort messages by orderBy field and direction only if orderBy is specified
      // If orderBy is undefined, keep messages in sorted-set order for correct pagination
      if (orderBy) {
        messagesData.sort((a, b) => {
          const aValue = getFieldValue(a);
          const bValue = getFieldValue(b);
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        });
      }

      const total = messagesData.length;

      // Apply pagination
      const start = offset;
      const end = perPageInput === false ? total : start + perPage;
      const paginatedMessages = messagesData.slice(start, end);

      // Combine paginated messages with included messages, deduplicating
      const messageIds = new Set<string>();
      const allMessages: MastraDBMessage[] = [];

      // Add paginated messages first
      for (const msg of paginatedMessages) {
        if (!messageIds.has(msg.id)) {
          allMessages.push(msg);
          messageIds.add(msg.id);
        }
      }

      // Add included messages (with context), avoiding duplicates
      for (const msg of includedMessages) {
        if (!messageIds.has(msg.id)) {
          allMessages.push(msg);
          messageIds.add(msg.id);
        }
      }

      // Use MessageList for proper deduplication and format conversion
      const list = new MessageList().add(allMessages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output - must be done AFTER MessageList
      // because MessageList.get.all.db() sorts by createdAt ASC internally
      if (orderBy) {
        finalMessages = finalMessages.sort((a, b) => {
          const aValue = getFieldValue(a);
          const bValue = getFieldValue(b);
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        });
      } else {
        // Build Map for O(1) lookups instead of O(n) indexOf
        const messageIdToPosition = new Map<string, number>();
        allMessageIds.forEach((id, index) => {
          messageIdToPosition.set(id as string, index);
        });

        finalMessages = finalMessages.sort((a, b) => {
          const aPos = messageIdToPosition.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bPos = messageIdToPosition.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          return aPos - bPos;
        });
      }

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const returnedThreadMessageIds = new Set(finalMessages.filter(m => m.threadId === threadId).map(m => m.id));
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore = perPageInput !== false && !allThreadMessagesReturned && end < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_LIST_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        messages: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const key = `${TABLE_RESOURCES}:${resourceId}`;
      const data = await this.client.get<StorageResourceType>(key);

      if (!data) {
        return null;
      }

      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        // Ensure workingMemory is always returned as a string, regardless of automatic parsing
        workingMemory: typeof data.workingMemory === 'object' ? JSON.stringify(data.workingMemory) : data.workingMemory,
        metadata: typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata,
      };
    } catch (error) {
      this.logger.error('Error getting resource by ID:', error);
      throw error;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      const key = `${TABLE_RESOURCES}:${resource.id}`;
      const serializedResource = {
        ...resource,
        metadata: JSON.stringify(resource.metadata),
        createdAt: resource.createdAt.toISOString(),
        updatedAt: resource.updatedAt.toISOString(),
      };

      await this.client.set(key, serializedResource);

      return resource;
    } catch (error) {
      this.logger.error('Error saving resource:', error);
      throw error;
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
      const existingResource = await this.getResourceById({ resourceId });

      if (!existingResource) {
        // Create new resource if it doesn't exist
        const newResource: StorageResourceType = {
          id: resourceId,
          workingMemory,
          metadata: metadata || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return this.saveResource({ resource: newResource });
      }

      const updatedResource = {
        ...existingResource,
        workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
        metadata: {
          ...existingResource.metadata,
          ...metadata,
        },
        updatedAt: new Date(),
      };

      await this.saveResource({ resource: updatedResource });
      return updatedResource;
    } catch (error) {
      this.logger.error('Error updating resource:', error);
      throw error;
    }
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;

    if (messages.length === 0) {
      return [];
    }

    try {
      // Get all message IDs to update
      const messageIds = messages.map(m => m.id);

      // Find all existing messages by scanning for their keys
      const existingMessages: MastraDBMessage[] = [];
      const messageIdToKey: Record<string, string> = {};

      // Scan for all message keys that match any of the IDs
      for (const messageId of messageIds) {
        const pattern = getMessageKey('*', messageId);
        const keys = await this.operations.scanKeys(pattern);

        for (const key of keys) {
          const message = await this.client.get<MastraDBMessage>(key);
          if (message && message.id === messageId) {
            existingMessages.push(message);
            messageIdToKey[messageId] = key;
            break; // Found the message, no need to continue scanning
          }
        }
      }

      if (existingMessages.length === 0) {
        return [];
      }

      const threadIdsToUpdate = new Set<string>();
      const pipeline = this.client.pipeline();

      // Process each existing message for updates
      for (const existingMessage of existingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) continue;

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

        // Track thread IDs that need updating
        threadIdsToUpdate.add(existingMessage.threadId!);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
        }

        // Create updated message object
        const updatedMessage = { ...existingMessage };

        // Special handling for the content field to merge instead of overwrite
        if (fieldsToUpdate.content) {
          const existingContent = existingMessage.content as MastraMessageContentV2;
          const newContent = {
            ...existingContent,
            ...fieldsToUpdate.content,
            // Deep merge metadata if it exists on both
            ...(existingContent?.metadata && fieldsToUpdate.content.metadata
              ? {
                  metadata: {
                    ...existingContent.metadata,
                    ...fieldsToUpdate.content.metadata,
                  },
                }
              : {}),
          };
          updatedMessage.content = newContent;
        }

        // Update other fields
        for (const key in fieldsToUpdate) {
          if (Object.prototype.hasOwnProperty.call(fieldsToUpdate, key) && key !== 'content') {
            (updatedMessage as any)[key] = fieldsToUpdate[key as keyof typeof fieldsToUpdate];
          }
        }

        // Update the message in Redis
        const key = messageIdToKey[id];
        if (key) {
          // If the message is being moved to a different thread, we need to handle the key change
          if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
            // Remove from old thread's sorted set
            const oldThreadMessagesKey = getThreadMessagesKey(existingMessage.threadId!);
            pipeline.zrem(oldThreadMessagesKey, id);

            // Delete the old message key
            pipeline.del(key);

            // Create new message key with new threadId
            const newKey = getMessageKey(updatePayload.threadId, id);
            pipeline.set(newKey, updatedMessage);

            // Add to new thread's sorted set
            const newThreadMessagesKey = getThreadMessagesKey(updatePayload.threadId);
            const score =
              (updatedMessage as any)._index !== undefined
                ? (updatedMessage as any)._index
                : new Date(updatedMessage.createdAt).getTime();
            pipeline.zadd(newThreadMessagesKey, { score, member: id });
          } else {
            // No thread change, just update the existing key
            pipeline.set(key, updatedMessage);
          }
        }
      }

      // Update thread timestamps
      const now = new Date();
      for (const threadId of threadIdsToUpdate) {
        if (threadId) {
          const threadKey = getKey(TABLE_THREADS, { id: threadId });
          const existingThread = await this.client.get<StorageThreadType>(threadKey);
          if (existingThread) {
            const updatedThread = {
              ...existingThread,
              updatedAt: now,
            };
            pipeline.set(threadKey, processRecord(TABLE_THREADS, updatedThread).processedRecord);
          }
        }
      }

      // Execute all updates
      await pipeline.exec();

      // Return the updated messages
      const updatedMessages: MastraDBMessage[] = [];
      for (const messageId of messageIds) {
        const key = messageIdToKey[messageId];
        if (key) {
          const updatedMessage = await this.client.get<MastraDBMessage>(key);
          if (updatedMessage) {
            updatedMessages.push(updatedMessage);
          }
        }
      }

      return updatedMessages;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageIds: messages.map(m => m.id).join(','),
          },
        },
        error,
      );
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    try {
      const threadIds = new Set<string>();
      const messageKeys: string[] = [];

      // Find all message keys and collect thread IDs
      for (const messageId of messageIds) {
        const pattern = getMessageKey('*', messageId);
        const keys = await this.operations.scanKeys(pattern);

        for (const key of keys) {
          const message = await this.client.get<MastraDBMessage>(key);
          if (message && message.id === messageId) {
            messageKeys.push(key);
            if (message.threadId) {
              threadIds.add(message.threadId);
            }
            break;
          }
        }
      }

      if (messageKeys.length === 0) {
        // none of the message ids existed
        return;
      }

      const pipeline = this.client.pipeline();

      // Delete all messages
      for (const key of messageKeys) {
        pipeline.del(key);
      }

      // Update thread timestamps
      if (threadIds.size > 0) {
        for (const threadId of threadIds) {
          const threadKey = getKey(TABLE_THREADS, { id: threadId });
          const thread = await this.client.get<StorageThreadType>(threadKey);
          if (thread) {
            const updatedThread = {
              ...thread,
              updatedAt: new Date(),
            };
            pipeline.set(threadKey, processRecord(TABLE_THREADS, updatedThread).processedRecord);
          }
        }
      }

      // Execute all operations
      await pipeline.exec();

      // TODO: Delete from vector store if semantic recall is enabled
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_DELETE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  private sortThreads(
    threads: StorageThreadType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageThreadType[] {
    return threads.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();

      if (direction === 'ASC') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }
}
