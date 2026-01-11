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
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
} from '@mastra/core/storage';

import { RedisDB } from '../../db';
import type { RedisDomainConfig } from '../../db';
import type { RedisClient } from '../../types';
import { getKey, processRecord } from '../utils';

export class StoreMemoryRedis extends MemoryStorage {
  private client: RedisClient;
  private db: RedisDB;

  constructor(config: RedisDomainConfig) {
    super();
    this.client = config.client;
    this.db = new RedisDB({ client: config.client });
  }

  public async dangerouslyClearAll(): Promise<void> {
    await this.db.deleteData({ tableName: TABLE_THREADS });
    await this.db.deleteData({ tableName: TABLE_MESSAGES });
    await this.db.deleteData({ tableName: TABLE_RESOURCES });
    await this.db.scanAndDelete('msg-idx:*');
    await this.db.scanAndDelete('thread:*:messages');
  }

  public async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.db.get<StorageThreadType>({
        tableName: TABLE_THREADS,
        keys: { id: threadId },
      });

      if (!thread) {
        return null;
      }

      return {
        ...thread,
        createdAt: ensureDate(thread.createdAt)!,
        updatedAt: ensureDate(thread.updatedAt)!,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'GET_THREAD_BY_ID', 'FAILED'),
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
          id: createStorageErrorId('REDIS', 'LIST_THREADS_BY_RESOURCE_ID', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const allThreads: StorageThreadType[] = [];
      const pattern = `${TABLE_THREADS}:*`;
      const keys = await this.db.scanKeys(pattern);

      if (keys.length === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const results = await this.client.mGet(keys);

      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        if (!data) {
          continue;
        }
        const thread = JSON.parse(data) as StorageThreadType;
        if (thread && thread.resourceId === resourceId) {
          allThreads.push({
            ...thread,
            createdAt: ensureDate(thread.createdAt)!,
            updatedAt: ensureDate(thread.updatedAt)!,
            metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
          });
        }
      }

      const sortedThreads = this.sortThreads(allThreads, field, direction);
      const total = sortedThreads.length;
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
          id: createStorageErrorId('REDIS', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED'),
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

  public async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.db.insert({
        tableName: TABLE_THREADS,
        record: thread,
      });
      return thread;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('REDIS', 'SAVE_THREAD', 'FAILED'),
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

  public async updateThread({
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
        id: createStorageErrorId('REDIS', 'UPDATE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('REDIS', 'UPDATE_THREAD', 'FAILED'),
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

  public async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const threadKey = getKey(TABLE_THREADS, { id: threadId });
    const threadMessagesKey = getThreadMessagesKey(threadId);

    try {
      const messageIds = await this.client.zRange(threadMessagesKey, 0, -1);

      const multi = this.client.multi();
      multi.del(threadKey);
      multi.del(threadMessagesKey);

      for (const messageId of messageIds) {
        const messageKey = getMessageKey(threadId, messageId);
        multi.del(messageKey);
        multi.del(getMessageIndexKey(messageId));
      }

      await multi.exec();
      await this.db.scanAndDelete(getMessageKey(threadId, '*'));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'DELETE_THREAD', 'FAILED'),
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

  public async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    if (messages.length === 0) {
      return { messages: [] };
    }

    const threadId = messages[0]?.threadId;
    try {
      if (!threadId) {
        throw new Error('Thread ID is required');
      }
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'SAVE_MESSAGES', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }

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

    const threadKey = getKey(TABLE_THREADS, { id: threadId });
    const existingThreadData = await this.client.get(threadKey);
    const existingThread = existingThreadData ? (JSON.parse(existingThreadData) as StorageThreadType) : null;

    try {
      const batchSize = 1000;
      for (let i = 0; i < messagesWithIndex.length; i += batchSize) {
        const batch = messagesWithIndex.slice(i, i + batchSize);
        const multi = this.client.multi();

        for (const message of batch) {
          const key = getMessageKey(message.threadId!, message.id);
          const createdAtScore = new Date(message.createdAt).getTime();
          const score = message._index !== undefined ? message._index : createdAtScore;

          const existingKeyPattern = getMessageKey('*', message.id);
          const keys = await this.db.scanKeys(existingKeyPattern);

          if (keys.length > 0) {
            const existingMessagesData = await this.client.mGet(keys);
            for (const data of existingMessagesData) {
              if (!data) {
                continue;
              }
              const existingMessage = JSON.parse(data) as MastraDBMessage;
              if (existingMessage && existingMessage.threadId !== message.threadId) {
                const existingMessageKey = getMessageKey(existingMessage.threadId!, existingMessage.id);
                multi.del(existingMessageKey);
                multi.zRem(getThreadMessagesKey(existingMessage.threadId!), existingMessage.id);
              }
            }
          }

          multi.set(key, JSON.stringify(message));
          multi.set(getMessageIndexKey(message.id), message.threadId!);
          multi.zAdd(getThreadMessagesKey(message.threadId!), { score, value: message.id });
        }

        if (i === 0 && existingThread) {
          const updatedThread = {
            ...existingThread,
            updatedAt: new Date(),
          };
          multi.set(threadKey, JSON.stringify(processRecord(TABLE_THREADS, updatedThread).processedRecord));
        }

        await multi.exec();
      }

      const list = new MessageList().add(messages as Parameters<MessageList['add']>[0], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'SAVE_MESSAGES', 'FAILED'),
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

  private async getThreadIdForMessage(messageId: string): Promise<string | null> {
    const indexedThreadId = await this.client.get(getMessageIndexKey(messageId));
    if (indexedThreadId) {
      return indexedThreadId;
    }

    const keys = await this.db.scanKeys(getMessageKey('*', messageId));
    if (keys.length === 0) {
      return null;
    }

    const messageData = await this.client.get(keys[0] as string);
    if (!messageData) {
      return null;
    }

    const message = JSON.parse(messageData) as MastraDBMessage;
    if (message.threadId) {
      await this.client.set(getMessageIndexKey(messageId), message.threadId);
    }

    return message.threadId || null;
  }

  private async getIncludedMessages(include: StorageListMessagesInput['include']): Promise<MastraDBMessage[]> {
    if (!include?.length) {
      return [];
    }

    const messageIds = new Set<string>();
    const messageIdToThreadIds: Record<string, string> = {};

    for (const item of include) {
      const itemThreadId = await this.getThreadIdForMessage(item.id);
      if (!itemThreadId) {
        continue;
      }

      messageIds.add(item.id);
      messageIdToThreadIds[item.id] = itemThreadId;
      const itemThreadMessagesKey = getThreadMessagesKey(itemThreadId);

      const rank = await this.client.zRank(itemThreadMessagesKey, item.id);
      if (rank === null) {
        continue;
      }

      if (item.withPreviousMessages) {
        const start = Math.max(0, rank - item.withPreviousMessages);
        const prevIds = rank === 0 ? [] : await this.client.zRange(itemThreadMessagesKey, start, rank - 1);
        prevIds.forEach(id => {
          messageIds.add(id);
          messageIdToThreadIds[id] = itemThreadId;
        });
      }

      if (item.withNextMessages) {
        const nextIds = await this.client.zRange(itemThreadMessagesKey, rank + 1, rank + item.withNextMessages);
        nextIds.forEach(id => {
          messageIds.add(id);
          messageIdToThreadIds[id] = itemThreadId;
        });
      }
    }

    if (messageIds.size === 0) {
      return [];
    }

    const keysToFetch = Array.from(messageIds).map(id => getMessageKey(messageIdToThreadIds[id]!, id));
    const results = await this.client.mGet(keysToFetch);

    return results.filter((data): data is string => data !== null).map(data => JSON.parse(data) as MastraDBMessage);
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
    if (messageIds.length === 0) {
      return { messages: [] };
    }

    try {
      const rawMessages: (MastraDBMessage & { _index?: number })[] = [];

      const indexKeys = messageIds.map(id => getMessageIndexKey(id));
      const indexResults = await this.client.mGet(indexKeys);

      const indexedIds: { messageId: string; threadId: string }[] = [];
      const unindexedIds: string[] = [];

      messageIds.forEach((id, i) => {
        const threadId = indexResults[i];
        if (threadId) {
          indexedIds.push({ messageId: id, threadId });
          return;
        }
        unindexedIds.push(id);
      });

      if (indexedIds.length > 0) {
        const messageKeys = indexedIds.map(({ messageId, threadId }) => getMessageKey(threadId, messageId));
        const messageResults = await this.client.mGet(messageKeys);
        for (const data of messageResults) {
          if (data) {
            rawMessages.push(JSON.parse(data) as MastraDBMessage & { _index?: number });
          }
        }
      }

      if (unindexedIds.length > 0) {
        const threadKeys = await this.client.keys('thread:*');

        const result = await Promise.all(
          threadKeys.map(async threadKey => {
            const threadId = threadKey.split(':')[1];
            if (!threadId) {
              throw new Error(`Failed to parse thread ID from thread key "${threadKey}"`);
            }
            const msgKeys = unindexedIds.map(id => getMessageKey(threadId, id));
            return this.client.mGet(msgKeys);
          }),
        );

        const foundMessages = result
          .flat(1)
          .filter((data): data is string => !!data)
          .map(data => JSON.parse(data) as MastraDBMessage & { _index?: number });
        rawMessages.push(...foundMessages);

        if (foundMessages.length > 0) {
          const multi = this.client.multi();
          foundMessages.forEach(msg => {
            if (msg.threadId) {
              multi.set(getMessageIndexKey(msg.id), msg.threadId);
            }
          });
          await multi.exec();
        }
      }

      const list = new MessageList().add(rawMessages.map(this.parseStoredMessage), 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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

    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('REDIS', 'LIST_MESSAGES', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      let includedMessages: MastraDBMessage[] = [];
      if (include && include.length > 0) {
        const included = (await this.getIncludedMessages(include)) as MastraDBMessage[];
        includedMessages = included.map(this.parseStoredMessage);
      }

      const allMessageIdsWithThreads: { threadId: string; messageId: string }[] = [];
      for (const tid of threadIds) {
        const threadMessagesKey = getThreadMessagesKey(tid);
        const msgIds = await this.client.zRange(threadMessagesKey, 0, -1);
        for (const mid of msgIds) {
          allMessageIdsWithThreads.push({ threadId: tid, messageId: mid });
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

      const messageKeys = allMessageIdsWithThreads.map(({ threadId: tid, messageId }) => getMessageKey(tid, messageId));
      const results = await this.client.mGet(messageKeys);

      let messagesData = results
        .filter((data): data is string => data !== null)
        .map(data => JSON.parse(data) as MastraDBMessage & { _index?: number })
        .map(this.parseStoredMessage);

      if (resourceId) {
        messagesData = messagesData.filter(msg => msg.resourceId === resourceId);
      }

      messagesData = filterByDateRange(
        messagesData,
        (msg: MastraDBMessage) => new Date(msg.createdAt),
        filter?.dateRange,
      );

      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      const getFieldValue = (msg: MastraDBMessage): number => {
        if (field === 'createdAt') {
          return new Date(msg.createdAt).getTime();
        }

        const value = (msg as Record<string, unknown>)[field];
        if (typeof value === 'number') {
          return value;
        }
        if (value instanceof Date) {
          return value.getTime();
        }
        return 0;
      };

      messagesData.sort((a, b) => {
        const aValue = getFieldValue(a);
        const bValue = getFieldValue(b);
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

      const total = messagesData.length;
      const start = offset;
      const end = perPageInput === false ? total : start + perPage;
      const paginatedMessages = messagesData.slice(start, end);

      const messageIdsSet = new Set<string>();
      const allMessages: MastraDBMessage[] = [];

      for (const msg of paginatedMessages) {
        if (messageIdsSet.has(msg.id)) {
          continue;
        }
        allMessages.push(msg);
        messageIdsSet.add(msg.id);
      }

      for (const msg of includedMessages) {
        if (messageIdsSet.has(msg.id)) {
          continue;
        }
        allMessages.push(msg);
        messageIdsSet.add(msg.id);
      }

      const list = new MessageList().add(allMessages, 'memory');
      let finalMessages = list.get.all.db();

      finalMessages = finalMessages.sort((a, b) => {
        const aValue = getFieldValue(a);
        const bValue = getFieldValue(b);
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

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
          id: createStorageErrorId('REDIS', 'LIST_MESSAGES', 'FAILED'),
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

  public async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const key = `${TABLE_RESOURCES}:${resourceId}`;
      const data = await this.client.get(key);
      if (!data) {
        return null;
      }

      const resource = JSON.parse(data) as StorageResourceType;

      return {
        ...resource,
        createdAt: new Date(resource.createdAt),
        updatedAt: new Date(resource.updatedAt),
        workingMemory:
          typeof resource.workingMemory === 'object' ? JSON.stringify(resource.workingMemory) : resource.workingMemory,
        metadata: typeof resource.metadata === 'string' ? JSON.parse(resource.metadata) : resource.metadata,
      };
    } catch (error) {
      this.logger.error('Error getting resource by ID:', error);
      throw error;
    }
  }

  public async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      const key = `${TABLE_RESOURCES}:${resource.id}`;
      const serializedResource = {
        ...resource,
        metadata: JSON.stringify(resource.metadata),
        createdAt: resource.createdAt.toISOString(),
        updatedAt: resource.updatedAt.toISOString(),
      };

      await this.client.set(key, JSON.stringify(serializedResource));

      return resource;
    } catch (error) {
      this.logger.error('Error saving resource:', error);
      throw error;
    }
  }

  public async updateResource({
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

  public async updateMessages(args: {
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
      const messageIds = messages.map(m => m.id);
      const existingMessages: MastraDBMessage[] = [];
      const messageIdToKey: Record<string, string> = {};

      for (const messageId of messageIds) {
        const pattern = getMessageKey('*', messageId);
        const keys = await this.db.scanKeys(pattern);

        for (const key of keys) {
          const data = await this.client.get(key);
          if (!data) {
            continue;
          }
          const message = JSON.parse(data) as MastraDBMessage;
          if (message && message.id === messageId) {
            existingMessages.push(message);
            messageIdToKey[messageId] = key;
            break;
          }
        }
      }

      if (existingMessages.length === 0) {
        return [];
      }

      const threadIdsToUpdate = new Set<string>();
      const multi = this.client.multi();

      for (const existingMessage of existingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) {
          continue;
        }

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) {
          continue;
        }

        threadIdsToUpdate.add(existingMessage.threadId!);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
        }

        const updatedMessage = { ...existingMessage };

        if (fieldsToUpdate.content) {
          const existingContent = existingMessage.content as MastraMessageContentV2;
          const newContent = {
            ...existingContent,
            ...fieldsToUpdate.content,
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

        for (const key in fieldsToUpdate) {
          if (Object.prototype.hasOwnProperty.call(fieldsToUpdate, key) && key !== 'content') {
            (updatedMessage as Record<string, unknown>)[key] = fieldsToUpdate[key as keyof typeof fieldsToUpdate];
          }
        }

        const key = messageIdToKey[id];
        if (!key) {
          continue;
        }

        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          multi.zRem(getThreadMessagesKey(existingMessage.threadId!), id);
          multi.del(key);

          const newKey = getMessageKey(updatePayload.threadId, id);
          multi.set(newKey, JSON.stringify(updatedMessage));

          const score =
            (updatedMessage as Record<string, unknown>)._index !== undefined
              ? ((updatedMessage as Record<string, unknown>)._index as number)
              : new Date(updatedMessage.createdAt).getTime();
          multi.zAdd(getThreadMessagesKey(updatePayload.threadId), { score, value: id });
          continue;
        }

        multi.set(key, JSON.stringify(updatedMessage));
      }

      const now = new Date();
      for (const threadId of threadIdsToUpdate) {
        if (threadId) {
          const threadKey = getKey(TABLE_THREADS, { id: threadId });
          const existingThreadData = await this.client.get(threadKey);
          if (existingThreadData) {
            const existingThread = JSON.parse(existingThreadData) as StorageThreadType;
            const updatedThread = {
              ...existingThread,
              updatedAt: now,
            };
            multi.set(threadKey, JSON.stringify(processRecord(TABLE_THREADS, updatedThread).processedRecord));
          }
        }
      }

      await multi.exec();

      const updatedMessages: MastraDBMessage[] = [];
      for (const messageId of messageIds) {
        const key = messageIdToKey[messageId];
        if (key) {
          const data = await this.client.get(key);
          if (data) {
            updatedMessages.push(JSON.parse(data) as MastraDBMessage);
          }
        }
      }

      return updatedMessages;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'UPDATE_MESSAGES', 'FAILED'),
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

  public async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    try {
      const threadIds = new Set<string>();
      const messageKeys: string[] = [];
      const foundMessageIds: string[] = [];

      const indexKeys = messageIds.map(id => getMessageIndexKey(id));
      const indexResults = await this.client.mGet(indexKeys);

      const indexedMessages: { messageId: string; threadId: string }[] = [];
      const unindexedMessageIds: string[] = [];

      messageIds.forEach((id, i) => {
        const threadId = indexResults[i];
        if (threadId) {
          indexedMessages.push({ messageId: id, threadId });
          return;
        }
        unindexedMessageIds.push(id);
      });

      for (const { messageId, threadId } of indexedMessages) {
        messageKeys.push(getMessageKey(threadId, messageId));
        foundMessageIds.push(messageId);
        threadIds.add(threadId);
      }

      for (const messageId of unindexedMessageIds) {
        const pattern = getMessageKey('*', messageId);
        const keys = await this.db.scanKeys(pattern);

        for (const key of keys) {
          const data = await this.client.get(key);
          if (!data) {
            continue;
          }
          const message = JSON.parse(data) as MastraDBMessage;
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
        return;
      }

      const multi = this.client.multi();

      for (const key of messageKeys) {
        multi.del(key);
      }

      for (const messageId of foundMessageIds) {
        multi.del(getMessageIndexKey(messageId));
      }

      if (threadIds.size > 0) {
        for (const threadId of threadIds) {
          for (const msg of indexedMessages) {
            if (msg.threadId === threadId) {
              multi.zRem(getThreadMessagesKey(threadId), msg.messageId);
            }
          }

          const threadKey = getKey(TABLE_THREADS, { id: threadId });
          const threadData = await this.client.get(threadKey);
          if (!threadData) {
            continue;
          }

          const thread = JSON.parse(threadData) as StorageThreadType;
          const updatedThread = { ...thread, updatedAt: new Date() };
          multi.set(threadKey, JSON.stringify(processRecord(TABLE_THREADS, updatedThread).processedRecord));
        }
      }

      await multi.exec();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'DELETE_MESSAGES', 'FAILED'),
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
      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  public async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
    if (!sourceThread) {
      throw new MastraError({
        id: createStorageErrorId('REDIS', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }

    const newThreadId = providedThreadId || crypto.randomUUID();

    const existingThread = await this.getThreadById({ threadId: newThreadId });
    if (existingThread) {
      throw new MastraError({
        id: createStorageErrorId('REDIS', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    try {
      const threadMessagesKey = getThreadMessagesKey(sourceThreadId);
      const msgIds = await this.client.zRange(threadMessagesKey, 0, -1);

      const messageKeys = msgIds.map(mid => getMessageKey(sourceThreadId, mid));
      let sourceMessages: (MastraDBMessage & { _index?: number })[] = [];

      if (messageKeys.length > 0) {
        const results = await this.client.mGet(messageKeys);
        sourceMessages = results
          .filter((data): data is string => data !== null)
          .map(data => {
            const msg = JSON.parse(data) as MastraDBMessage & { _index?: number };
            return { ...msg, createdAt: new Date(msg.createdAt) };
          });
      }

      if (options?.messageFilter?.startDate || options?.messageFilter?.endDate) {
        sourceMessages = filterByDateRange(sourceMessages, (msg: MastraDBMessage) => new Date(msg.createdAt), {
          start: options.messageFilter?.startDate,
          end: options.messageFilter?.endDate,
        });
      }

      if (options?.messageFilter?.messageIds && options.messageFilter.messageIds.length > 0) {
        const messageIdSet = new Set(options.messageFilter.messageIds);
        sourceMessages = sourceMessages.filter(msg => messageIdSet.has(msg.id));
      }

      sourceMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (options?.messageLimit && options.messageLimit > 0 && sourceMessages.length > options.messageLimit) {
        sourceMessages = sourceMessages.slice(-options.messageLimit);
      }

      const now = new Date();
      const lastMessageId = sourceMessages.length > 0 ? sourceMessages[sourceMessages.length - 1]!.id : undefined;

      const cloneMetadata: ThreadCloneMetadata = {
        sourceThreadId,
        clonedAt: now,
        ...(lastMessageId && { lastMessageId }),
      };

      const newThread: StorageThreadType = {
        id: newThreadId,
        resourceId: resourceId || sourceThread.resourceId,
        title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : undefined),
        metadata: { ...metadata, clone: cloneMetadata },
        createdAt: now,
        updatedAt: now,
      };

      const multi = this.client.multi();
      const threadKey = getKey(TABLE_THREADS, { id: newThreadId });
      multi.set(threadKey, JSON.stringify(processRecord(TABLE_THREADS, newThread).processedRecord));

      const clonedMessages: MastraDBMessage[] = [];
      const targetResourceId = resourceId || sourceThread.resourceId;
      const newThreadMessagesKey = getThreadMessagesKey(newThreadId);

      for (let i = 0; i < sourceMessages.length; i++) {
        const sourceMsg = sourceMessages[i]!;
        const newMessageId = crypto.randomUUID();
        const { _index, ...restMsg } = sourceMsg;

        const newMessage: MastraDBMessage = {
          ...restMsg,
          id: newMessageId,
          threadId: newThreadId,
          resourceId: targetResourceId,
        };

        const messageKey = getMessageKey(newThreadId, newMessageId);
        multi.set(messageKey, JSON.stringify(newMessage));
        multi.set(getMessageIndexKey(newMessageId), newThreadId);
        multi.zAdd(newThreadMessagesKey, { score: i, value: newMessageId });

        clonedMessages.push(newMessage);
      }

      await multi.exec();

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
          id: createStorageErrorId('REDIS', 'CLONE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sourceThreadId, newThreadId },
        },
        error,
      );
    }
  }
}

function getThreadMessagesKey(threadId: string): string {
  return `thread:${threadId}:messages`;
}

function getMessageKey(threadId: string, messageId: string): string {
  return getKey(TABLE_MESSAGES, { threadId, id: messageId });
}

function getMessageIndexKey(messageId: string): string {
  return `msg-idx:${messageId}`;
}
