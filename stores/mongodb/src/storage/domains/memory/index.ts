import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  resolveMessageLimit,
  safelyParseJSON,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type { PaginationInfo, StorageGetMessagesArg, StorageResourceType } from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';
import { formatDateForMongoDB } from '../utils';

export class MemoryStorageMongoDB extends MemoryStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  private parseRow(row: any): MastraMessageV2 {
    let content = row.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch {
        // use content as is if it's not JSON
      }
    }

    const result = {
      id: row.id,
      content,
      role: row.role,
      createdAt: formatDateForMongoDB(row.createdAt),
      threadId: row.thread_id,
      resourceId: row.resourceId,
    } as MastraMessageV2;

    if (row.type && row.type !== 'v2') result.type = row.type;
    return result;
  }

  private async _getIncludedMessages({
    threadId,
    selectBy,
  }: {
    threadId: string;
    selectBy: StorageGetMessagesArg['selectBy'];
  }) {
    const include = selectBy?.include;
    if (!include) return null;

    const collection = await this.operations.getCollection(TABLE_MESSAGES);

    const includedMessages: any[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      const searchThreadId = inc.threadId || threadId;

      // Get all messages for the search thread ordered by creation date
      const allMessages = await collection.find({ thread_id: searchThreadId }).sort({ createdAt: 1 }).toArray();

      // Find the target message
      const targetIndex = allMessages.findIndex((msg: any) => msg.id === id);

      if (targetIndex === -1) continue;

      // Get previous messages
      const startIndex = Math.max(0, targetIndex - withPreviousMessages);
      // Get next messages
      const endIndex = Math.min(allMessages.length - 1, targetIndex + withNextMessages);

      // Add messages in range
      for (let i = startIndex; i <= endIndex; i++) {
        includedMessages.push(allMessages[i]);
      }
    }

    // Remove duplicates
    const seen = new Set<string>();
    const dedupedMessages = includedMessages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });

    return dedupedMessages.map(row => this.parseRow(row));
  }

  /**
   * @deprecated use getMessagesPaginated instead for paginated results.
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & {
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const messages: MastraMessageV2[] = [];
      const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });

      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy });
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      }

      const excludeIds = messages.map(m => m.id);
      const collection = await this.operations.getCollection(TABLE_MESSAGES);

      const query: any = { thread_id: threadId };
      if (excludeIds.length > 0) {
        query.id = { $nin: excludeIds };
      }

      // Only fetch remaining messages if limit > 0
      if (limit > 0) {
        const remainingMessages = await collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();

        messages.push(...remainingMessages.map((row: any) => this.parseRow(row)));
      }

      // Sort all messages by creation date ascending
      messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const list = new MessageList().add(messages, 'memory');
      if (format === 'v2') return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
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
    const { threadId, format, selectBy } = args;
    const { page = 0, perPage: perPageInput, dateRange } = selectBy?.pagination || {};
    const perPage =
      perPageInput !== undefined ? perPageInput : resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const messages: MastraMessageV2[] = [];

    if (selectBy?.include?.length) {
      try {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy });
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      } catch (error) {
        throw new MastraError(
          {
            id: 'MONGODB_STORE_GET_MESSAGES_PAGINATED_GET_INCLUDE_MESSAGES_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { threadId },
          },
          error,
        );
      }
    }

    try {
      const currentOffset = page * perPage;
      const collection = await this.operations.getCollection(TABLE_MESSAGES);

      const query: any = { thread_id: threadId };

      if (fromDate) {
        query.createdAt = { ...query.createdAt, $gte: fromDate };
      }
      if (toDate) {
        query.createdAt = { ...query.createdAt, $lte: toDate };
      }

      const total = await collection.countDocuments(query);

      if (total === 0 && messages.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const excludeIds = messages.map(m => m.id);
      if (excludeIds.length > 0) {
        query.id = { $nin: excludeIds };
      }

      const dataResult = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(currentOffset)
        .limit(perPage)
        .toArray();

      messages.push(...dataResult.map((row: any) => this.parseRow(row)));

      const messagesToReturn =
        format === 'v1'
          ? new MessageList().add(messages, 'memory').get.all.v1()
          : new MessageList().add(messages, 'memory').get.all.v2();

      return {
        messages: messagesToReturn,
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MONGODB_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      return { messages: [], total: 0, page, perPage, hasMore: false };
    }
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages({
    messages,
    format,
  }:
    | { messages: MastraMessageV1[]; format?: undefined | 'v1' }
    | { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    if (messages.length === 0) return messages;

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      const collection = await this.operations.getCollection(TABLE_MESSAGES);
      const threadsCollection = await this.operations.getCollection(TABLE_THREADS);

      // Prepare messages for insertion
      const messagesToInsert = messages.map(message => {
        const time = message.createdAt || new Date();
        if (!message.threadId) {
          throw new Error(
            "Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.",
          );
        }
        if (!message.resourceId) {
          throw new Error(
            "Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.",
          );
        }

        return {
          updateOne: {
            filter: { id: message.id },
            update: {
              $set: {
                id: message.id,
                thread_id: message.threadId!,
                content: typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
                role: message.role,
                type: message.type || 'v2',
                createdAt: formatDateForMongoDB(time),
                resourceId: message.resourceId,
              },
            },
            upsert: true,
          },
        };
      });

      // Execute message inserts and thread update in parallel
      await Promise.all([
        collection.bulkWrite(messagesToInsert),
        threadsCollection.updateOne({ id: threadId }, { $set: { updatedAt: new Date() } }),
      ]);

      const list = new MessageList().add(messages, 'memory');
      if (format === 'v2') return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraMessageV2[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const collection = await this.operations.getCollection(TABLE_MESSAGES);

    const existingMessages = await collection.find({ id: { $in: messageIds } }).toArray();

    const existingMessagesParsed: MastraMessageV2[] = existingMessages.map((msg: any) => this.parseRow(msg));

    if (existingMessagesParsed.length === 0) {
      return [];
    }

    const threadIdsToUpdate = new Set<string>();
    const bulkOps = [];

    for (const existingMessage of existingMessagesParsed) {
      const updatePayload = messages.find(m => m.id === existingMessage.id);
      if (!updatePayload) continue;

      const { id, ...fieldsToUpdate } = updatePayload;
      if (Object.keys(fieldsToUpdate).length === 0) continue;

      threadIdsToUpdate.add(existingMessage.threadId!);
      if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
        threadIdsToUpdate.add(updatePayload.threadId);
      }

      const updateDoc: any = {};
      const updatableFields = { ...fieldsToUpdate };

      // Special handling for content field to merge instead of overwrite
      if (updatableFields.content) {
        const newContent = {
          ...existingMessage.content,
          ...updatableFields.content,
          // Deep merge metadata if it exists on both
          ...(existingMessage.content?.metadata && updatableFields.content.metadata
            ? {
                metadata: {
                  ...existingMessage.content.metadata,
                  ...updatableFields.content.metadata,
                },
              }
            : {}),
        };
        updateDoc.content = JSON.stringify(newContent);
        delete updatableFields.content;
      }

      // Handle other fields
      for (const key in updatableFields) {
        if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
          const dbKey = key === 'threadId' ? 'thread_id' : key;
          let value = updatableFields[key as keyof typeof updatableFields];

          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          updateDoc[dbKey] = value;
        }
      }

      if (Object.keys(updateDoc).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { id },
            update: { $set: updateDoc },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps);
    }

    // Update thread timestamps
    if (threadIdsToUpdate.size > 0) {
      const threadsCollection = await this.operations.getCollection(TABLE_THREADS);
      await threadsCollection.updateMany(
        { id: { $in: Array.from(threadIdsToUpdate) } },
        { $set: { updatedAt: new Date() } },
      );
    }

    // Re-fetch updated messages
    const updatedMessages = await collection.find({ id: { $in: messageIds } }).toArray();

    return updatedMessages.map((row: any) => this.parseRow(row));
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const collection = await this.operations.getCollection(TABLE_RESOURCES);
      const result = await collection.findOne<any>({ id: resourceId });

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        workingMemory: result.workingMemory || '',
        metadata: typeof result.metadata === 'string' ? safelyParseJSON(result.metadata) : result.metadata,
        createdAt: formatDateForMongoDB(result.createdAt),
        updatedAt: formatDateForMongoDB(result.updatedAt),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_RESOURCE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      const collection = await this.operations.getCollection(TABLE_RESOURCES);
      await collection.updateOne(
        { id: resource.id },
        {
          $set: {
            ...resource,
            metadata: JSON.stringify(resource.metadata),
          },
        },
        { upsert: true },
      );

      return resource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_SAVE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId: resource.id },
        },
        error,
      );
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
          workingMemory: workingMemory || '',
          metadata: metadata || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return this.saveResource({ resource: newResource });
      }

      const updatedResource = {
        ...existingResource,
        workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
        metadata: metadata ? { ...existingResource.metadata, ...metadata } : existingResource.metadata,
        updatedAt: new Date(),
      };

      const collection = await this.operations.getCollection(TABLE_RESOURCES);
      const updateDoc: any = { updatedAt: updatedResource.updatedAt };

      if (workingMemory !== undefined) {
        updateDoc.workingMemory = workingMemory;
      }

      if (metadata) {
        updateDoc.metadata = JSON.stringify(updatedResource.metadata);
      }

      await collection.updateOne({ id: resourceId }, { $set: updateDoc });

      return updatedResource;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_UPDATE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const collection = await this.operations.getCollection(TABLE_THREADS);
      const result = await collection.findOne<any>({ id: threadId });
      if (!result) {
        return null;
      }

      return {
        ...result,
        metadata: typeof result.metadata === 'string' ? safelyParseJSON(result.metadata) : result.metadata,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const collection = await this.operations.getCollection(TABLE_THREADS);
      const results = await collection.find<any>({ resourceId }).sort({ updatedAt: -1 }).toArray();
      if (!results.length) {
        return [];
      }

      return results.map((result: any) => ({
        ...result,
        metadata: typeof result.metadata === 'string' ? safelyParseJSON(result.metadata) : result.metadata,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  public async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    try {
      const { resourceId, page, perPage } = args;
      const collection = await this.operations.getCollection(TABLE_THREADS);

      const query = { resourceId };
      const total = await collection.countDocuments(query);

      const threads = await collection
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(page * perPage)
        .limit(perPage)
        .toArray();

      return {
        threads: threads.map((thread: any) => ({
          id: thread.id,
          title: thread.title,
          resourceId: thread.resourceId,
          createdAt: formatDateForMongoDB(thread.createdAt),
          updatedAt: formatDateForMongoDB(thread.updatedAt),
          metadata: thread.metadata || {},
        })),
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId: args.resourceId },
        },
        error,
      );
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const collection = await this.operations.getCollection(TABLE_THREADS);
      await collection.updateOne(
        { id: thread.id },
        {
          $set: {
            ...thread,
            metadata: thread.metadata,
          },
        },
        { upsert: true },
      );
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: thread.id },
        },
        error,
      );
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
        id: 'STORAGE_MONGODB_STORE_UPDATE_THREAD_NOT_FOUND',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { threadId: id, status: 404 },
        text: `Thread ${id} not found`,
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
      const collection = await this.operations.getCollection(TABLE_THREADS);
      await collection.updateOne(
        { id },
        {
          $set: {
            title,
            metadata: updatedThread.metadata,
          },
        },
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id },
        },
        error,
      );
    }

    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // First, delete all messages associated with the thread
      const collectionMessages = await this.operations.getCollection(TABLE_MESSAGES);
      await collectionMessages.deleteMany({ thread_id: threadId });
      // Then delete the thread itself
      const collectionThreads = await this.operations.getCollection(TABLE_THREADS);
      await collectionThreads.deleteOne({ id: threadId });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }
}
