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
  StorageListMessagesByResourceIdInput,
  ObservationalMemoryRecord,
  ObservationalMemoryHistoryOptions,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
  UpdateObservationalMemoryConfigInput,
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

function getResourceMessagesKey(resourceId: string): string {
  return `resource:${resourceId}:messages`;
}

function getObservationalMemoryKey(threadId: string | null, resourceId: string): string {
  return `observational-memory:${threadId ?? 'resource'}:${resourceId}`;
}

function getObservationalMemoryIndexKey(id: string): string {
  return `observational-memory-index:${id}`;
}

export class StoreMemoryUpstash extends MemoryStorage {
  readonly supportsObservationalMemory = true;
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

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.#db.get<StorageThreadType>({
        tableName: TABLE_THREADS,
        keys: { id: threadId },
      });

      if (!thread || (resourceId !== undefined && thread.resourceId !== resourceId)) return null;

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

    try {
      // Validate pagination input before normalization
      // This ensures page === 0 when perPageInput === false
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_THREADS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page, ...(perPageInput !== undefined && { perPage: perPageInput }) },
        },
        error instanceof Error ? error : new Error('Invalid pagination parameters'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);

    // Validate metadata keys to prevent prototype pollution and ensure safe key patterns
    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
        },
        error instanceof Error ? error : new Error('Invalid metadata key'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      let allThreads: StorageThreadType[] = [];
      const pattern = `${TABLE_THREADS}:*`;
      const keys = await this.#db.scanKeys(pattern);

      // Return early if no keys found to avoid "Pipeline is empty" error
      if (keys.length === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

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

    try {
      for (const message of messages) {
        if (!message.threadId) {
          throw new Error('Thread ID is required');
        }
        if (!message.resourceId) {
          throw new Error(
            `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
          );
        }
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
      return {
        ...message,
        _index: index,
      };
    });

    try {
      const batchSize = 1000;
      const targetThreadIds = new Set(messagesWithIndex.map(message => message.threadId!));
      const existingThreadIds: (string | null)[] = [];
      const touchedThreadIds = new Set<string>(targetThreadIds);

      // Read index entries up front so all touched threads can be validated/loaded before writes.
      for (let i = 0; i < messagesWithIndex.length; i += batchSize) {
        const batch = messagesWithIndex.slice(i, i + batchSize);
        const indexLookupPipeline = this.client.pipeline();

        batch.forEach(message => {
          indexLookupPipeline.get(getMessageIndexKey(message.id));
        });
        const batchExistingThreadIds = (await indexLookupPipeline.exec()) as (string | null)[];
        existingThreadIds.push(...batchExistingThreadIds);

        batchExistingThreadIds.forEach(existingThreadId => {
          if (existingThreadId) {
            touchedThreadIds.add(existingThreadId);
          }
        });
      }

      const touchedThreadIdList = Array.from(touchedThreadIds);
      const threadLookupPipeline = this.client.pipeline();
      touchedThreadIdList.forEach(touchedThreadId => {
        threadLookupPipeline.get(getKey(TABLE_THREADS, { id: touchedThreadId }));
      });
      const threadLookupResults = (await threadLookupPipeline.exec()) as (StorageThreadType | null)[];
      const threadRecordsById = new Map<string, StorageThreadType>();

      touchedThreadIdList.forEach((touchedThreadId, index) => {
        const threadRecord = threadLookupResults[index];
        if (threadRecord) {
          threadRecordsById.set(touchedThreadId, threadRecord);
        }
      });

      for (const targetThreadId of targetThreadIds) {
        if (!threadRecordsById.has(targetThreadId)) {
          throw new MastraError(
            {
              id: createStorageErrorId('UPSTASH', 'SAVE_MESSAGES', 'INVALID_ARGS'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
            },
            new Error(`Thread ${targetThreadId} not found`),
          );
        }
      }

      for (let i = 0; i < messagesWithIndex.length; i += batchSize) {
        const batch = messagesWithIndex.slice(i, i + batchSize);
        const pipeline = this.client.pipeline();
        const batchTouchedThreadIds = new Set<string>();
        const batchExistingThreadIds = existingThreadIds.slice(i, i + batch.length);

        for (const [batchIndex, message] of batch.entries()) {
          const key = getMessageKey(message.threadId!, message.id);
          const createdAtScore = new Date(message.createdAt).getTime();
          const score = message._index !== undefined ? message._index : createdAtScore;
          batchTouchedThreadIds.add(message.threadId!);

          // Check if this message id exists in another thread (index lookup, no scan)
          const existingThreadId = batchExistingThreadIds[batchIndex];
          if (existingThreadId && existingThreadId !== message.threadId) {
            pipeline.del(getMessageKey(existingThreadId, message.id));
            pipeline.zrem(getThreadMessagesKey(existingThreadId), message.id);
            batchTouchedThreadIds.add(existingThreadId);
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

          pipeline.zadd(getResourceMessagesKey(message.resourceId!), {
            score: createdAtScore,
            member: message.id,
          });
        }

        const now = new Date();
        for (const touchedThreadId of batchTouchedThreadIds) {
          const existingThread = threadRecordsById.get(touchedThreadId);
          if (!existingThread) {
            continue;
          }
          const updatedThread = {
            ...existingThread,
            updatedAt: now,
          };
          const threadKey = getKey(TABLE_THREADS, { id: touchedThreadId });
          pipeline.set(threadKey, processRecord(TABLE_THREADS, updatedThread).processedRecord);
          threadRecordsById.set(touchedThreadId, updatedThread);
        }

        await pipeline.exec();
      }

      const list = new MessageList().add(messages as any, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadIds: Array.from(new Set(messages.map(message => message.threadId).filter(Boolean))).join(','),
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

  private _sortMessages(messages: MastraDBMessage[], field: string, direction: string): MastraDBMessage[] {
    return messages.sort((a, b) => {
      const getVal = (msg: MastraDBMessage): number => {
        if (field === 'createdAt') {
          return new Date(msg.createdAt).getTime();
        }
        const value = (msg as Record<string, unknown>)[field];
        if (typeof value === 'number') return value;
        if (value instanceof Date) return value.getTime();
        return 0;
      };
      const aValue = getVal(a);
      const bValue = getVal(b);
      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
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

      // Determine sort field and direction, default to ASC (oldest first)
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      // When perPage is 0 with no includes, there's nothing to return.
      if (perPage === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      // Get included messages with context if specified
      let includedMessages: MastraDBMessage[] = [];
      if (include && include.length > 0) {
        const included = (await this._getIncludedMessages(include)) as MastraDBMessage[];
        includedMessages = included.map(this.parseStoredMessage);
      }

      // When perPage is 0, we only need included messages — skip thread load entirely
      if (perPage === 0 && include && include.length > 0) {
        const list = new MessageList().add(includedMessages, 'memory');
        return {
          messages: this._sortMessages(list.get.all.db(), field, direction),
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
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

      // Always sort messages by the sort field/direction before pagination
      // This ensures consistent ordering whether orderBy is explicit or uses the default (createdAt ASC)
      messagesData = this._sortMessages(messagesData, field, direction);

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
      finalMessages = this._sortMessages(finalMessages, field, direction);

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
      const updatesById = new Map(messages.map(message => [message.id, message]));

      // Find all existing messages — try index first, fall back to scan
      const existingMessages: MastraDBMessage[] = [];
      const messageIdToKey: Record<string, string> = {};
      const backfillIndexValues: Record<string, string> = {};

      const indexPipeline = this.client.pipeline();
      messageIds.forEach(messageId => indexPipeline.get(getMessageIndexKey(messageId)));
      const indexResults = (await indexPipeline.exec()) as (string | null)[];

      const indexedLookups: { messageId: string; threadId: string }[] = [];
      const fallbackMessageIds: string[] = [];

      messageIds.forEach((messageId, index) => {
        const indexedThreadId = indexResults[index];
        if (indexedThreadId) {
          indexedLookups.push({ messageId, threadId: indexedThreadId });
        } else {
          fallbackMessageIds.push(messageId);
        }
      });

      if (indexedLookups.length > 0) {
        const messagePipeline = this.client.pipeline();
        indexedLookups.forEach(({ messageId, threadId }) => {
          messagePipeline.get(getMessageKey(threadId, messageId));
        });
        const indexedMessages = (await messagePipeline.exec()) as (MastraDBMessage | null)[];

        indexedLookups.forEach(({ messageId, threadId }, index) => {
          const key = getMessageKey(threadId, messageId);
          const message = indexedMessages[index];
          if (message && message.id === messageId) {
            existingMessages.push(message);
            messageIdToKey[messageId] = key;
          } else {
            fallbackMessageIds.push(messageId);
          }
        });
      }

      for (const messageId of fallbackMessageIds) {
        // Fall back to scan for backwards compatibility (old messages without index)
        const pattern = getMessageKey('*', messageId);
        const keys = await this.#db.scanKeys(pattern);

        for (const key of keys) {
          const message = await this.client.get<MastraDBMessage>(key);
          if (message && message.id === messageId) {
            existingMessages.push(message);
            messageIdToKey[messageId] = key;
            // Backfill the index for future lookups
            if (message.threadId) {
              backfillIndexValues[messageId] = message.threadId;
            }
            break;
          }
        }
      }

      if (Object.keys(backfillIndexValues).length > 0) {
        const backfillPipeline = this.client.pipeline();
        for (const [messageId, threadId] of Object.entries(backfillIndexValues)) {
          backfillPipeline.set(getMessageIndexKey(messageId), threadId);
        }
        await backfillPipeline.exec();
      }

      if (existingMessages.length === 0) {
        return [];
      }

      const threadIdsToUpdate = new Set<string>();
      const destinationThreadIds = new Set<string>();

      for (const existingMessage of existingMessages) {
        const updatePayload = updatesById.get(existingMessage.id);
        if (!updatePayload) continue;

        const { id: _id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

        threadIdsToUpdate.add(existingMessage.threadId!);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
          destinationThreadIds.add(updatePayload.threadId);
        }
      }

      const threadRecordsById = new Map<string, StorageThreadType>();
      if (threadIdsToUpdate.size > 0) {
        const threadIdList = Array.from(threadIdsToUpdate);
        const threadLookupPipeline = this.client.pipeline();

        threadIdList.forEach(threadId => {
          threadLookupPipeline.get(getKey(TABLE_THREADS, { id: threadId }));
        });
        const threadLookupResults = (await threadLookupPipeline.exec()) as (StorageThreadType | null)[];

        threadIdList.forEach((threadId, index) => {
          const threadRecord = threadLookupResults[index];
          if (threadRecord) {
            threadRecordsById.set(threadId, threadRecord);
          }
        });
      }

      for (const destinationThreadId of destinationThreadIds) {
        if (!threadRecordsById.has(destinationThreadId)) {
          throw new MastraError(
            {
              id: createStorageErrorId('UPSTASH', 'UPDATE_MESSAGES', 'INVALID_ARGS'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
            },
            new Error(`Thread ${destinationThreadId} not found`),
          );
        }
      }

      const pipeline = this.client.pipeline();

      // Process each existing message for updates
      for (const existingMessage of existingMessages) {
        const updatePayload = updatesById.get(existingMessage.id);
        if (!updatePayload) continue;

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

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
            const newThreadId = updatedMessage.threadId!;

            // Remove from old thread's sorted set
            const oldThreadMessagesKey = getThreadMessagesKey(existingMessage.threadId!);
            pipeline.zrem(oldThreadMessagesKey, id);

            // Delete the old message key
            pipeline.del(key);

            // Create new message key with new threadId
            const newKey = getMessageKey(newThreadId, id);
            pipeline.set(newKey, updatedMessage);
            pipeline.set(getMessageIndexKey(id), newThreadId);
            messageIdToKey[id] = newKey;

            // Add to new thread's sorted set
            const newThreadMessagesKey = getThreadMessagesKey(newThreadId);
            const score =
              (updatedMessage as any)._index !== undefined
                ? (updatedMessage as any)._index
                : new Date(updatedMessage.createdAt).getTime();
            pipeline.zadd(newThreadMessagesKey, { score, member: id });
            if (updatedMessage.resourceId) {
              pipeline.zadd(getResourceMessagesKey(updatedMessage.resourceId), {
                score: new Date(updatedMessage.createdAt).getTime(),
                member: id,
              });
            }
          } else {
            // No thread change, just update the existing key
            pipeline.set(key, updatedMessage);
            if (updatedMessage.resourceId) {
              pipeline.zadd(getResourceMessagesKey(updatedMessage.resourceId), {
                score: new Date(updatedMessage.createdAt).getTime(),
                member: id,
              });
            }
          }
        }
      }

      // Update thread timestamps
      const now = new Date();
      for (const threadId of threadIdsToUpdate) {
        if (threadId) {
          const existingThread = threadRecordsById.get(threadId);
          if (existingThread) {
            const updatedThread = {
              ...existingThread,
              updatedAt: now,
            };
            const threadKey = getKey(TABLE_THREADS, { id: threadId });
            pipeline.set(threadKey, processRecord(TABLE_THREADS, updatedThread).processedRecord);
            threadRecordsById.set(threadId, updatedThread);
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
      if (error instanceof MastraError) {
        throw error;
      }
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

      for (const messageId of foundMessageIds) {
        const message = await this.listMessagesById({ messageIds: [messageId] });
        const resourceId = message.messages[0]?.resourceId;
        if (resourceId) {
          pipeline.zrem(getResourceMessagesKey(resourceId), messageId);
        }
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

  async listMessagesByResourceId({
    resourceId,
    filter,
    perPage: perPageInput,
    page = 0,
    orderBy,
  }: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
    const perPage = normalizePerPage(perPageInput, 40);
    this.validatePaginationInput(page, perPageInput ?? 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const indexedIds = await this.client.zrange(getResourceMessagesKey(resourceId), 0, -1);
      let messages: MastraDBMessage[] = [];

      if (indexedIds.length > 0) {
        const indexPipeline = this.client.pipeline();
        indexedIds.forEach(id => indexPipeline.get(getMessageIndexKey(id as string)));
        const threadIds = (await indexPipeline.exec()) as (string | null)[];

        const messagePipeline = this.client.pipeline();
        indexedIds.forEach((id, index) => {
          const threadId = threadIds[index];
          if (threadId) {
            messagePipeline.get(getMessageKey(threadId, id as string));
          }
        });
        messages = ((await messagePipeline.exec()) as (MastraDBMessage | null)[]).filter(
          (message): message is MastraDBMessage => !!message && message.resourceId === resourceId,
        );
      } else {
        const keys = await this.#db.scanKeys(`${TABLE_MESSAGES}:*`);
        if (keys.length > 0) {
          const pipeline = this.client.pipeline();
          keys.forEach(key => pipeline.get(key));
          messages = ((await pipeline.exec()) as (MastraDBMessage | null)[]).filter(
            (message): message is MastraDBMessage => !!message && message.resourceId === resourceId,
          );
        }
      }

      messages = filterByDateRange(messages, message => new Date(message.createdAt), filter?.dateRange);
      messages = this._sortMessages(messages, field, direction);

      const total = messages.length;
      const paginated = perPageInput === false ? messages : messages.slice(offset, offset + perPage);
      const list = new MessageList().add(paginated, 'memory');

      return {
        messages: list.get.all.db(),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_MESSAGES_BY_RESOURCE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  private async getObservationalMemoryRecords(
    threadId: string | null,
    resourceId: string,
  ): Promise<ObservationalMemoryRecord[]> {
    const records = await this.client.get<ObservationalMemoryRecord[]>(getObservationalMemoryKey(threadId, resourceId));
    return (records ?? []).map(record => this.reviveObservationalMemoryRecord(record));
  }

  private async saveObservationalMemoryRecords(
    threadId: string | null,
    resourceId: string,
    records: ObservationalMemoryRecord[],
  ): Promise<void> {
    await this.client.set(getObservationalMemoryKey(threadId, resourceId), records);
    const pipeline = this.client.pipeline();
    records.forEach(record => pipeline.set(getObservationalMemoryIndexKey(record.id), getObservationalMemoryKey(threadId, resourceId)));
    await pipeline.exec();
  }

  private reviveObservationalMemoryRecord(record: ObservationalMemoryRecord): ObservationalMemoryRecord {
    return {
      ...record,
      createdAt: ensureDate(record.createdAt)!,
      updatedAt: ensureDate(record.updatedAt)!,
      lastObservedAt: record.lastObservedAt ? ensureDate(record.lastObservedAt) : undefined,
      lastBufferedAtTime: record.lastBufferedAtTime ? ensureDate(record.lastBufferedAtTime)! : null,
      bufferedObservationChunks: record.bufferedObservationChunks?.map(chunk => ({
        ...chunk,
        createdAt: ensureDate(chunk.createdAt)!,
        lastObservedAt: chunk.lastObservedAt ? ensureDate(chunk.lastObservedAt)! : new Date(0),
      })),
    };
  }

  private async updateObservationalMemoryRecord(
    id: string,
    updater: (record: ObservationalMemoryRecord) => void,
  ): Promise<ObservationalMemoryRecord> {
    const key = await this.client.get<string>(getObservationalMemoryIndexKey(id));
    if (!key) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const records = ((await this.client.get<ObservationalMemoryRecord[]>(key)) ?? []).map(record =>
      this.reviveObservationalMemoryRecord(record),
    );
    const record = records.find(item => item.id === id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    updater(record);
    record.updatedAt = new Date();
    await this.client.set(key, records);
    return record;
  }

  async getObservationalMemory(
    threadId: string | null,
    resourceId: string,
  ): Promise<ObservationalMemoryRecord | null> {
    const records = await this.getObservationalMemoryRecords(threadId, resourceId);
    return records[0] ?? null;
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit?: number,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    let records = await this.getObservationalMemoryRecords(threadId, resourceId);
    if (options?.from) records = records.filter(record => record.createdAt >= options.from!);
    if (options?.to) records = records.filter(record => record.createdAt <= options.to!);
    if (options?.offset != null) records = records.slice(options.offset);
    return limit != null ? records.slice(0, limit) : records;
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    const now = new Date();
    const record: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope: input.scope,
      threadId: input.threadId,
      resourceId: input.resourceId,
      createdAt: now,
      updatedAt: now,
      lastObservedAt: undefined,
      originType: 'initial',
      generationCount: 0,
      activeObservations: '',
      bufferedObservations: undefined,
      bufferedReflection: undefined,
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
      metadata: {},
    };
    const records = await this.getObservationalMemoryRecords(input.threadId, input.resourceId);
    await this.saveObservationalMemoryRecords(input.threadId, input.resourceId, [record, ...records]);
    return record;
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    const records = await this.getObservationalMemoryRecords(record.threadId, record.resourceId);
    records.push(record);
    records.sort((a, b) => b.generationCount - a.generationCount);
    await this.saveObservationalMemoryRecords(record.threadId, record.resourceId, records);
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    await this.updateObservationalMemoryRecord(input.id, record => {
      record.activeObservations = input.observations;
      record.observationTokenCount = input.tokenCount;
      record.totalTokensObserved += input.tokenCount;
      record.pendingMessageTokens = 0;
      record.lastObservedAt = input.lastObservedAt;
      if (input.observedMessageIds) record.observedMessageIds = input.observedMessageIds;
    });
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    await this.updateObservationalMemoryRecord(input.id, record => {
      const chunk: BufferedObservationChunk = {
        id: `ombuf-${crypto.randomUUID()}`,
        cycleId: input.chunk.cycleId,
        observations: input.chunk.observations,
        tokenCount: input.chunk.tokenCount,
        messageIds: input.chunk.messageIds,
        messageTokens: input.chunk.messageTokens,
        lastObservedAt: input.chunk.lastObservedAt,
        createdAt: new Date(),
        suggestedContinuation: input.chunk.suggestedContinuation,
        currentTask: input.chunk.currentTask,
        threadTitle: input.chunk.threadTitle,
      };
      record.bufferedObservationChunks = [...(record.bufferedObservationChunks ?? []), chunk];
      if (input.lastBufferedAtTime) record.lastBufferedAtTime = input.lastBufferedAtTime;
    });
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    let result: SwapBufferedToActiveResult | undefined;
    await this.updateObservationalMemoryRecord(input.id, record => {
      const chunks = input.bufferedChunks ?? record.bufferedObservationChunks ?? [];
      if (chunks.length === 0) {
        result = {
          chunksActivated: 0,
          messageTokensActivated: 0,
          observationTokensActivated: 0,
          messagesActivated: 0,
          activatedCycleIds: [],
          activatedMessageIds: [],
        };
        return;
      }

      const targetMessageTokens = Math.max(0, input.currentPendingTokens - input.messageTokensThreshold * (1 - input.activationRatio));
      let cumulative = 0;
      let chunksToActivate = chunks.length;
      for (let index = 0; index < chunks.length; index++) {
        cumulative += chunks[index]!.messageTokens ?? 0;
        if (cumulative >= targetMessageTokens) {
          chunksToActivate = index + 1;
          break;
        }
      }

      const activated = chunks.slice(0, chunksToActivate);
      const remaining = chunks.slice(chunksToActivate);
      const observations = activated.map(chunk => chunk.observations).join('\n\n');
      const observationTokensActivated = activated.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
      const messageTokensActivated = activated.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
      const activatedMessageIds = activated.flatMap(chunk => chunk.messageIds);
      const lastObservedAt = input.lastObservedAt ?? activated[activated.length - 1]?.lastObservedAt ?? new Date();

      record.activeObservations = record.activeObservations
        ? `${record.activeObservations}\n\n--- message boundary (${new Date(lastObservedAt).toISOString()}) ---\n\n${observations}`
        : observations;
      record.observationTokenCount = (record.observationTokenCount ?? 0) + observationTokensActivated;
      record.pendingMessageTokens = Math.max(0, (record.pendingMessageTokens ?? 0) - messageTokensActivated);
      record.bufferedObservationChunks = remaining.length > 0 ? remaining : undefined;
      record.lastObservedAt = new Date(lastObservedAt);

      result = {
        chunksActivated: activated.length,
        messageTokensActivated,
        observationTokensActivated,
        messagesActivated: activatedMessageIds.length,
        activatedCycleIds: activated.map(chunk => chunk.cycleId).filter((id): id is string => !!id),
        activatedMessageIds,
        observations,
        perChunk: activated.map(chunk => ({
          cycleId: chunk.cycleId ?? '',
          messageTokens: chunk.messageTokens ?? 0,
          observationTokens: chunk.tokenCount,
          messageCount: chunk.messageIds.length,
          observations: chunk.observations,
        })),
        suggestedContinuation: activated[activated.length - 1]?.suggestedContinuation,
        currentTask: activated[activated.length - 1]?.currentTask,
      };
    });
    return result!;
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    const now = new Date();
    const newRecord: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope: input.currentRecord.scope,
      threadId: input.currentRecord.threadId,
      resourceId: input.currentRecord.resourceId,
      createdAt: now,
      updatedAt: now,
      lastObservedAt: input.currentRecord.lastObservedAt ?? now,
      originType: 'reflection',
      generationCount: input.currentRecord.generationCount + 1,
      activeObservations: input.reflection,
      config: input.currentRecord.config,
      totalTokensObserved: input.currentRecord.totalTokensObserved,
      observationTokenCount: input.tokenCount,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      observedTimezone: input.currentRecord.observedTimezone,
      metadata: {},
    };
    const records = await this.getObservationalMemoryRecords(input.currentRecord.threadId, input.currentRecord.resourceId);
    await this.saveObservationalMemoryRecords(input.currentRecord.threadId, input.currentRecord.resourceId, [
      newRecord,
      ...records,
    ]);
    return newRecord;
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    await this.updateObservationalMemoryRecord(input.id, record => {
      record.bufferedReflection = record.bufferedReflection
        ? `${record.bufferedReflection}\n\n${input.reflection}`
        : input.reflection;
      record.bufferedReflectionTokens = (record.bufferedReflectionTokens ?? 0) + input.tokenCount;
      record.bufferedReflectionInputTokens = (record.bufferedReflectionInputTokens ?? 0) + input.inputTokenCount;
      record.reflectedObservationLineCount = input.reflectedObservationLineCount;
    });
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const record = await this.updateObservationalMemoryRecord(input.currentRecord.id, current => {
      if (!current.bufferedReflection) throw new Error('No buffered reflection to swap');
    });
    const reflectedLineCount = record.reflectedObservationLineCount ?? 0;
    const unreflected = (record.activeObservations ?? '').split('\n').slice(reflectedLineCount).join('\n').trim();
    const reflection = unreflected ? `${record.bufferedReflection}\n\n${unreflected}` : record.bufferedReflection!;
    const newRecord = await this.createReflectionGeneration({
      currentRecord: record,
      reflection,
      tokenCount: input.tokenCount,
    });
    await this.updateObservationalMemoryRecord(record.id, current => {
      current.bufferedReflection = undefined;
      current.bufferedReflectionTokens = undefined;
      current.bufferedReflectionInputTokens = undefined;
      current.reflectedObservationLineCount = undefined;
    });
    return newRecord;
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    await this.updateObservationalMemoryRecord(id, record => {
      record.isReflecting = isReflecting;
    });
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    await this.updateObservationalMemoryRecord(id, record => {
      record.isObserving = isObserving;
    });
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    await this.updateObservationalMemoryRecord(id, record => {
      record.isBufferingObservation = isBuffering;
      if (lastBufferedAtTokens !== undefined) record.lastBufferedAtTokens = lastBufferedAtTokens;
    });
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    await this.updateObservationalMemoryRecord(id, record => {
      record.isBufferingReflection = isBuffering;
    });
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    const key = getObservationalMemoryKey(threadId, resourceId);
    const records = (await this.client.get<ObservationalMemoryRecord[]>(key)) ?? [];
    const pipeline = this.client.pipeline();
    pipeline.del(key);
    records.forEach(record => pipeline.del(getObservationalMemoryIndexKey(record.id)));
    await pipeline.exec();
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    await this.updateObservationalMemoryRecord(id, record => {
      record.pendingMessageTokens = tokenCount;
    });
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    await this.updateObservationalMemoryRecord(input.id, record => {
      record.config = this.deepMergeConfig(record.config as Record<string, unknown>, input.config);
    });
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
        title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : ''),
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
      const messageIdMap: Record<string, string> = {};
      const targetResourceId = resourceId || sourceThread.resourceId;
      const newThreadMessagesKey = getThreadMessagesKey(newThreadId);

      for (let i = 0; i < sourceMessages.length; i++) {
        const sourceMsg = sourceMessages[i]!;
        const newMessageId = crypto.randomUUID();
        messageIdMap[sourceMsg.id] = newMessageId;
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
        messageIdMap,
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
