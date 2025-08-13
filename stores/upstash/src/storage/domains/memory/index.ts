import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  TABLE_RESOURCES,
  TABLE_THREADS,
  resolveMessageLimit,
  TABLE_MESSAGES,
} from '@mastra/core/storage';
import type { StorageGetMessagesArg, PaginationInfo, StorageResourceType } from '@mastra/core/storage';
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

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const pattern = `${TABLE_THREADS}:*`;
      const keys = await this.operations.scanKeys(pattern);

      if (keys.length === 0) {
        return [];
      }

      const allThreads: StorageThreadType[] = [];
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

      allThreads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return allThreads;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return [];
    }
  }

  public async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage = 100 } = args;

    try {
      const allThreads = await this.getThreadsByResourceId({ resourceId });

      const total = allThreads.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedThreads = allThreads.slice(start, end);
      const hasMore = end < total;

      return {
        threads: paginatedThreads,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
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
        perPage,
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

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    if (messages.length === 0) return [];

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
            const existingMessages = results.filter(
              (msg): msg is MastraMessageV2 | MastraMessageV1 => msg !== null,
            ) as (MastraMessageV2 | MastraMessageV1)[];
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

      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
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
    selectBy: StorageGetMessagesArg['selectBy'],
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const messageIds = new Set<string>();
    const messageIdToThreadIds: Record<string, string> = {};

    // First, get specifically included messages and their context
    if (selectBy?.include?.length) {
      for (const item of selectBy.include) {
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
      return results.filter(result => result !== null) as MastraMessageV2[] | MastraMessageV1[];
    }

    return [];
  }

  private parseStoredMessage(storedMessage: MastraMessageV2 & { _index?: number }): MastraMessageV2 {
    const defaultMessageContent = { format: 2, parts: [{ type: 'text', text: '' }] };
    const { _index, ...rest } = storedMessage;
    return {
      ...rest,
      createdAt: new Date(rest.createdAt),
      content: rest.content || defaultMessageContent,
    } satisfies MastraMessageV2;
  }

  /**
   * @deprecated use getMessagesPaginated instead
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const threadMessagesKey = getThreadMessagesKey(threadId);
    try {
      const allMessageIds = await this.client.zrange(threadMessagesKey, 0, -1);
      const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: Number.MAX_SAFE_INTEGER });

      const messageIds = new Set<string>();
      const messageIdToThreadIds: Record<string, string> = {};

      if (limit === 0 && !selectBy?.include) {
        return [];
      }

      // Then get the most recent messages (or all if no limit)
      if (limit === Number.MAX_SAFE_INTEGER) {
        // Get all messages
        const allIds = await this.client.zrange(threadMessagesKey, 0, -1);
        allIds.forEach(id => {
          messageIds.add(id as string);
          messageIdToThreadIds[id as string] = threadId;
        });
      } else if (limit > 0) {
        // Get limited number of recent messages
        const latestIds = await this.client.zrange(threadMessagesKey, -limit, -1);
        latestIds.forEach(id => {
          messageIds.add(id as string);
          messageIdToThreadIds[id as string] = threadId;
        });
      }

      const includedMessages = await this._getIncludedMessages(threadId, selectBy);

      // Fetch all needed messages in parallel
      const messages = [
        ...includedMessages,
        ...((
          await Promise.all(
            Array.from(messageIds).map(async id => {
              const tId = messageIdToThreadIds[id] || threadId;
              const byThreadId = await this.client.get<MastraMessageV2 & { _index?: number }>(getMessageKey(tId, id));
              if (byThreadId) return byThreadId;

              return null;
            }),
          )
        ).filter(msg => msg !== null) as (MastraMessageV2 & { _index?: number })[]),
      ];

      // Sort messages by their position in the sorted set
      messages.sort((a, b) => allMessageIds.indexOf(a!.id) - allMessageIds.indexOf(b!.id));

      const seen = new Set<string>();
      const dedupedMessages = messages.filter(row => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });

      // Remove _index before returning and handle format conversion properly
      const prepared = dedupedMessages
        .filter(message => message !== null && message !== undefined)
        .map(message => {
          const { _index, ...messageWithoutIndex } = message as MastraMessageV2 & { _index?: number };
          return messageWithoutIndex as unknown as MastraMessageV1;
        });

      // For backward compatibility, return messages directly without using MessageList
      // since MessageList has deduplication logic that can cause issues
      if (format === 'v2') {
        // Convert V1 format back to V2 format
        return prepared.map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
          content: msg.content || { format: 2, parts: [{ type: 'text', text: '' }] },
        })) as MastraMessageV2[];
      }

      return prepared.map(msg => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_MESSAGES_FAILED',
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

  public async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format: 'v1';
  }): Promise<MastraMessageV1[]>;
  public async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v2';
  }): Promise<MastraMessageV2[]>;
  public async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    if (messageIds.length === 0) return [];

    try {
      // Search in all threads in parallel
      const threadKeys = await this.client.keys('thread:*');

      const result = await Promise.all(
        threadKeys.map(threadKey => {
          const threadId = threadKey.split(':')[1];
          if (!threadId) throw new Error(`Failed to parse thread ID from thread key "${threadKey}"`);
          return this.client.mget<(MastraMessageV2 & { _index?: number })[]>(
            messageIds.map(id => getMessageKey(threadId, id)),
          );
        }),
      );

      const rawMessages = result.flat(1).filter(msg => !!msg) as (MastraMessageV2 & { _index?: number })[];

      const list = new MessageList().add(rawMessages.map(this.parseStoredMessage), 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_MESSAGES_BY_ID_FAILED',
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

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, selectBy, format } = args;
    const { page = 0, perPage = 40, dateRange } = selectBy?.pagination || {};
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const threadMessagesKey = getThreadMessagesKey(threadId);
    const messages: (MastraMessageV2 | MastraMessageV1)[] = [];

    try {
      const includedMessages = await this._getIncludedMessages(threadId, selectBy);

      messages.push(...includedMessages);

      const allMessageIds = await this.client.zrange(
        threadMessagesKey,
        args?.selectBy?.last ? -args.selectBy.last : 0,
        -1,
      );
      if (allMessageIds.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Use pipeline to fetch all messages efficiently
      const pipeline = this.client.pipeline();
      allMessageIds.forEach(id => pipeline.get(getMessageKey(threadId, id as string)));
      const results = await pipeline.exec();

      // Process messages and apply filters - handle undefined results from pipeline
      let messagesData = results.filter((msg): msg is MastraMessageV2 | MastraMessageV1 => msg !== null) as (
        | MastraMessageV2
        | MastraMessageV1
      )[];

      // Apply date filters if provided
      if (fromDate) {
        messagesData = messagesData.filter(msg => msg && new Date(msg.createdAt).getTime() >= fromDate.getTime());
      }

      if (toDate) {
        messagesData = messagesData.filter(msg => msg && new Date(msg.createdAt).getTime() <= toDate.getTime());
      }

      // Sort messages by their position in the sorted set
      messagesData.sort((a, b) => allMessageIds.indexOf(a!.id) - allMessageIds.indexOf(b!.id));

      const total = messagesData.length;

      const start = page * perPage;
      const end = start + perPage;
      const hasMore = end < total;
      const paginatedMessages = messagesData.slice(start, end);

      messages.push(...paginatedMessages);

      const list = new MessageList().add(messages, 'memory');
      const finalMessages = (format === `v2` ? list.get.all.v2() : list.get.all.v1()) as
        | MastraMessageV1[]
        | MastraMessageV2[];

      return {
        messages: finalMessages,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
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
        perPage,
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
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;

    if (messages.length === 0) {
      return [];
    }

    try {
      // Get all message IDs to update
      const messageIds = messages.map(m => m.id);

      // Find all existing messages by scanning for their keys
      const existingMessages: (MastraMessageV2 | MastraMessageV1)[] = [];
      const messageIdToKey: Record<string, string> = {};

      // Scan for all message keys that match any of the IDs
      for (const messageId of messageIds) {
        const pattern = getMessageKey('*', messageId);
        const keys = await this.operations.scanKeys(pattern);

        for (const key of keys) {
          const message = await this.client.get<MastraMessageV2 | MastraMessageV1>(key);
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
      const updatedMessages: MastraMessageV2[] = [];
      for (const messageId of messageIds) {
        const key = messageIdToKey[messageId];
        if (key) {
          const updatedMessage = await this.client.get<MastraMessageV2 | MastraMessageV1>(key);
          if (updatedMessage) {
            // Convert to V2 format if needed
            const v2e = updatedMessage as MastraMessageV2;
            updatedMessages.push(v2e);
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
          const message = await this.client.get<MastraMessageV2 | MastraMessageV1>(key);
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
}
