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
  createStorageErrorId,
  ensureDate,
  filterByDateRange,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
} from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import { UpstashDB, resolveUpstashConfig } from '../../db';
import type { UpstashDomainConfig } from '../../db';
import { getKey, processRecord } from '../utils';

function getThreadMessagesKey(threadId: string): string {
  return `thread:${threadId}:messages`;
}

function getMessageKey(threadId: string, messageId: string): string {
  const key = getKey(TABLE_MESSAGES, { threadId, id: messageId });
  return key;
}

// Index key for fast message ID -> threadId lookup (backwards compatible)
function getMessageIndexKey(messageId: string): string {
  return `msg-idx:${messageId}`;
}

export class StoreMemoryUpstash extends MemoryStorage {
  private client: Redis;
  #db: UpstashDB;
  constructor(config: UpstashDomainConfig) {
    super();
    const client = resolveUpstashConfig(config);
    this.client = client;
    this.#db = new UpstashDB({ client });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_THREADS });
    await this.#db.deleteData({ tableName: TABLE_MESSAGES });
    await this.#db.deleteData({ tableName: TABLE_RESOURCES });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.#db.get<StorageThreadType>({
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
          id: createStorageErrorId('UPSTASH', 'GET_THREAD_BY_ID', 'FAILED'),
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

  public async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;
    const { field, direction } = this.parseOrderBy(orderBy);
    const perPage = normalizePerPage(perPageInput, 100);

    try {
      // Validate pagination parameters (throws on invalid input)
      this.validatePagination(page, perPage);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_THREADS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page, perPage },
        },
        error instanceof Error ? error : new Error('Invalid pagination parameters'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      let allThreads: StorageThreadType[] = [];
      const pattern = `${TABLE_THREADS}:*`;
      const keys = await this.#db.scanKeys(pattern);

      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      for (let i = 0; i < results.length; i++) {
        const thread = results[i] as StorageThreadType | null;
        if (!thread) continue;

        // Apply resourceId filter if provided
        if (filter?.resourceId && thread.resourceId !== filter.resourceId) {
          continue;
        }

        // Apply metadata filters if provided (AND logic)
        if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
          const threadMetadata = typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata;
          const matches = Object.entries(filter.metadata).every(([key, value]) => threadMetadata?.[key] === value);
          if (!matches) continue;
        }

        allThreads.push({
          ...thread,
          createdAt: ensureDate(thread.createdAt)!,
          updatedAt: ensureDate(thread.updatedAt)!,
          metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        });
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
          id: createStorageErrorId('UPSTASH', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!filter?.metadata,
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
      await this.#db.insert({
        tableName: TABLE_THREADS,
        record: thread,
      });
      return thread;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'SAVE_THREAD', 'FAILED'),
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
        id: createStorageErrorId('UPSTASH', 'UPDATE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('UPSTASH', 'UPDATE_THREAD', 'FAILED'),
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
      await this.#db.scanAndDelete(getMessageKey(threadId, '*'));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'DELETE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('UPSTASH', 'SAVE_MESSAGES', 'INVALID_ARGS'),
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
          const keys = await this.#db.scanKeys(existingKeyPattern);

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

          // Store the message ID -> threadId index for fast lookups
          pipeline.set(getMessageIndexKey(message.id), message.threadId!);

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
          id: createStorageErrorId('UPSTASH', 'SAVE_MESSAGES', 'FAILED'),
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

  /**
   * Lookup threadId for a message - tries index first (O(1)), falls back to scan (backwards compatible)
   */
  private async _getThreadIdForMessage(messageId: string): Promise<string | null> {
    // Try the index first (fast path for new messages)
    const indexedThreadId = await this.client.get<string>(getMessageIndexKey(messageId));
    if (indexedThreadId) {
      return indexedThreadId;
    }

    // Fall back to scan for backwards compatibility (old messages without index)
    const existingKeyPattern = getMessageKey('*', messageId);
    const keys = await this.#db.scanKeys(existingKeyPattern);
    if (keys.length === 0) return null;

    // Get the message to find its threadId
    const messageData = await this.client.get<MastraDBMessage>(keys[0] as string);
    if (!messageData) return null;

    // Backfill the index for future lookups
    if (messageData.threadId) {
      await this.client.set(getMessageIndexKey(messageId), messageData.threadId);
    }

    return messageData.threadId || null;
  }

  private async _getIncludedMessages(include: StorageListMessagesInput['include']): Promise<MastraDBMessage[]> {
    if (!include?.length) return [];

    const messageIds = new Set<string>();
    const messageIdToThreadIds: Record<string, string> = {};

    for (const item of include) {
      // Step 1: Find the threadId for this message (index first, then scan)
      const itemThreadId = await this._getThreadIdForMessage(item.id);
      if (!itemThreadId) continue;

      messageIds.add(item.id);
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

    if (messageIds.size === 0) return [];

    const pipeline = this.client.pipeline();
    Array.from(messageIds).forEach(id => {
      const tId = messageIdToThreadIds[id]!;
      pipeline.get(getMessageKey(tId, id as string));
    });
    const results = await pipeline.exec();
    return results.filter(result => result !== null) as MastraDBMessage[];
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
      const rawMessages: (MastraDBMessage & { _index?: number })[] = [];

      // Try to get threadIds from index first (fast path)
      const indexPipeline = this.client.pipeline();
      messageIds.forEach(id => indexPipeline.get(getMessageIndexKey(id)));
      const indexResults = await indexPipeline.exec();

      const indexedIds: { messageId: string; threadId: string }[] = [];
      const unindexedIds: string[] = [];

      messageIds.forEach((id, i) => {
        const threadId = indexResults[i] as string | null;
        if (threadId) {
          indexedIds.push({ messageId: id, threadId });
        } else {
          unindexedIds.push(id);
        }
      });

      // Fetch indexed messages directly (O(1) per message)
      if (indexedIds.length > 0) {
        const messagePipeline = this.client.pipeline();
        indexedIds.forEach(({ messageId, threadId }) => messagePipeline.get(getMessageKey(threadId, messageId)));
        const messageResults = await messagePipeline.exec();
        rawMessages.push(...(messageResults.filter(msg => msg !== null) as (MastraDBMessage & { _index?: number })[]));
      }

      // Fall back to scan for unindexed messages (backwards compatibility)
      if (unindexedIds.length > 0) {
        const threadKeys = await this.client.keys('thread:*');

        const result = await Promise.all(
          threadKeys.map(threadKey => {
            const threadId = threadKey.split(':')[1];
            if (!threadId) throw new Error(`Failed to parse thread ID from thread key "${threadKey}"`);
            return this.client.mget<(MastraDBMessage & { _index?: number })[]>(
              unindexedIds.map(id => getMessageKey(threadId, id)),
            );
          }),
        );

        const foundMessages = result.flat(1).filter(msg => !!msg) as (MastraDBMessage & { _index?: number })[];
        rawMessages.push(...foundMessages);

        // Backfill index for found messages
        if (foundMessages.length > 0) {
          const backfillPipeline = this.client.pipeline();
          foundMessages.forEach(msg => {
            if (msg.threadId) {
              backfillPipeline.set(getMessageIndexKey(msg.id), msg.threadId);
            }
          });
          await backfillPipeline.exec();
        }
      }

      const list = new MessageList().add(rawMessages.map(this.parseStoredMessage), 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    // When perPage is false (get all), ignore page offset
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('UPSTASH', 'LIST_MESSAGES', 'INVALID_PAGE'),
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
        const included = (await this._getIncludedMessages(include)) as MastraDBMessage[];
        includedMessages = included.map(this.parseStoredMessage);
      }

      // Get all message IDs from all thread sorted sets
      const allMessageIdsWithThreads: { threadId: string; messageId: string }[] = [];
      for (const tid of threadIds) {
        const threadMessagesKey = getThreadMessagesKey(tid);
        const messageIds = await this.client.zrange(threadMessagesKey, 0, -1);
        for (const mid of messageIds) {
          allMessageIdsWithThreads.push({ threadId: tid, messageId: mid as string });
        }
      }

      if (allMessageIdsWithThreads.length === 0) {
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
      allMessageIdsWithThreads.forEach(({ threadId: tid, messageId }) => pipeline.get(getMessageKey(tid, messageId)));
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
      messagesData = filterByDateRange(
        messagesData,
        (msg: MastraDBMessage) => new Date(msg.createdAt),
        filter?.dateRange,
      );

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

      // Always sort messages by the sort field/direction before pagination
      // This ensures consistent ordering whether orderBy is explicit or uses the default (createdAt ASC)
      messagesData.sort((a, b) => {
        const aValue = getFieldValue(a);
        const bValue = getFieldValue(b);
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

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
      // Always sort by createdAt (or specified field) to ensure consistent chronological ordering
      // This is critical when `include` parameter brings in messages from semantic recall
      finalMessages = finalMessages.sort((a, b) => {
        const aValue = getFieldValue(a);
        const bValue = getFieldValue(b);
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

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
          id: createStorageErrorId('UPSTASH', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
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
        const keys = await this.#db.scanKeys(pattern);

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
          id: createStorageErrorId('UPSTASH', 'UPDATE_MESSAGES', 'FAILED'),
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
      const foundMessageIds: string[] = [];

      // Try index first for each message (fast path)
      const indexPipeline = this.client.pipeline();
      messageIds.forEach(id => indexPipeline.get(getMessageIndexKey(id)));
      const indexResults = await indexPipeline.exec();

      const indexedMessages: { messageId: string; threadId: string }[] = [];
      const unindexedMessageIds: string[] = [];

      messageIds.forEach((id, i) => {
        const threadId = indexResults[i] as string | null;
        if (threadId) {
          indexedMessages.push({ messageId: id, threadId });
        } else {
          unindexedMessageIds.push(id);
        }
      });

      // Process indexed messages (fast path)
      for (const { messageId, threadId } of indexedMessages) {
        messageKeys.push(getMessageKey(threadId, messageId));
        foundMessageIds.push(messageId);
        threadIds.add(threadId);
      }

      // Fall back to scan for unindexed messages (backwards compatibility)
      for (const messageId of unindexedMessageIds) {
        const pattern = getMessageKey('*', messageId);
        const keys = await this.#db.scanKeys(pattern);

        for (const key of keys) {
          const message = await this.client.get<MastraDBMessage>(key);
          if (message && message.id === messageId) {
            messageKeys.push(key);
            foundMessageIds.push(messageId);
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

      // Delete all message index entries
      for (const messageId of foundMessageIds) {
        pipeline.del(getMessageIndexKey(messageId));
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
          id: createStorageErrorId('UPSTASH', 'DELETE_MESSAGES', 'FAILED'),
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

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    // Get the source thread
    const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
    if (!sourceThread) {
      throw new MastraError({
        id: createStorageErrorId('UPSTASH', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }

    // Use provided ID or generate a new one
    const newThreadId = providedThreadId || crypto.randomUUID();

    // Check if the new thread ID already exists
    const existingThread = await this.getThreadById({ threadId: newThreadId });
    if (existingThread) {
      throw new MastraError({
        id: createStorageErrorId('UPSTASH', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    try {
      // Get all message IDs from the source thread's sorted set
      const threadMessagesKey = getThreadMessagesKey(sourceThreadId);
      const messageIds = await this.client.zrange(threadMessagesKey, 0, -1);

      // Fetch all source messages
      const pipeline = this.client.pipeline();
      for (const mid of messageIds) {
        pipeline.get(getMessageKey(sourceThreadId, mid as string));
      }
      const results = await pipeline.exec();

      // Parse and filter messages
      let sourceMessages = results
        .filter((msg): msg is MastraDBMessage & { _index?: number } => msg !== null)
        .map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }));

      // Apply date filters
      if (options?.messageFilter?.startDate || options?.messageFilter?.endDate) {
        sourceMessages = filterByDateRange(sourceMessages, (msg: MastraDBMessage) => new Date(msg.createdAt), {
          start: options.messageFilter?.startDate,
          end: options.messageFilter?.endDate,
        });
      }

      // Apply message ID filter
      if (options?.messageFilter?.messageIds && options.messageFilter.messageIds.length > 0) {
        const messageIdSet = new Set(options.messageFilter.messageIds);
        sourceMessages = sourceMessages.filter(msg => messageIdSet.has(msg.id));
      }

      // Sort by createdAt ASC
      sourceMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Apply message limit (from most recent)
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

      // Use pipeline for all writes
      const writePipeline = this.client.pipeline();

      // Save the new thread
      const threadKey = getKey(TABLE_THREADS, { id: newThreadId });
      writePipeline.set(threadKey, processRecord(TABLE_THREADS, newThread).processedRecord);

      // Clone messages with new IDs
      const clonedMessages: MastraDBMessage[] = [];
      const targetResourceId = resourceId || sourceThread.resourceId;
      const newThreadMessagesKey = getThreadMessagesKey(newThreadId);

      for (let i = 0; i < sourceMessages.length; i++) {
        const sourceMsg = sourceMessages[i]!;
        const newMessageId = crypto.randomUUID();
        const { _index, ...restMsg } = sourceMsg as MastraDBMessage & { _index?: number };

        const newMessage: MastraDBMessage = {
          ...restMsg,
          id: newMessageId,
          threadId: newThreadId,
          resourceId: targetResourceId,
        };

        // Store the message data
        const messageKey = getMessageKey(newThreadId, newMessageId);
        writePipeline.set(messageKey, newMessage);

        // Store the message ID -> threadId index for fast lookups
        writePipeline.set(getMessageIndexKey(newMessageId), newThreadId);

        // Add to sorted set for this thread (use index for ordering)
        writePipeline.zadd(newThreadMessagesKey, {
          score: i,
          member: newMessageId,
        });

        clonedMessages.push(newMessage);
      }

      // Execute all writes
      await writePipeline.exec();

      return {
        thread: newThread,
        clonedMessages,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'CLONE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sourceThreadId, newThreadId },
        },
        error,
      );
    }
  }
}
