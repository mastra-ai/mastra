import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  safelyParseJSON,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';
import { formatDateForMongoDB } from '../utils';

export class MemoryStorageMongoDB extends MemoryStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  private parseRow(row: any): MastraDBMessage {
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
    } as MastraDBMessage;

    if (row.type && row.type !== 'v2') result.type = row.type;
    return result;
  }

  private async _getIncludedMessages({
    threadId,
    include,
  }: {
    threadId: string;
    include: StorageListMessagesInput['include'];
  }) {
    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

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

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    try {
      const collection = await this.operations.getCollection(TABLE_MESSAGES);
      const rawMessages = await collection
        .find({ id: { $in: messageIds } })
        .sort({ createdAt: -1 })
        .toArray();

      const list = new MessageList().add(
        rawMessages.map(this.parseRow) as (MastraMessageV1 | MastraDBMessage)[],
        'memory',
      );
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_LIST_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
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
          id: 'STORAGE_MONGODB_LIST_MESSAGES_INVALID_THREAD_ID',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        new Error('threadId must be a non-empty string'),
      );
    }

    if (page < 0) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_LIST_MESSAGES_INVALID_PAGE',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const sortOrder = direction === 'ASC' ? 1 : -1;

      const collection = await this.operations.getCollection(TABLE_MESSAGES);

      // Build query conditions
      const query: any = { thread_id: threadId };

      if (resourceId) {
        query.resourceId = resourceId;
      }

      if (filter?.dateRange?.start) {
        query.createdAt = { ...query.createdAt, $gte: filter.dateRange.start };
      }

      if (filter?.dateRange?.end) {
        query.createdAt = { ...query.createdAt, $lte: filter.dateRange.end };
      }

      // Get total count
      const total = await collection.countDocuments(query);

      const messages: any[] = [];

      // Step 1: Get paginated messages from the thread first (without excluding included ones)
      if (perPage !== 0) {
        const sortObj: any = { [field]: sortOrder };
        let cursor = collection.find(query).sort(sortObj).skip(offset);

        // Only apply limit if not unlimited
        // MongoDB's .limit(0) means "no limit" (returns all), not "return 0 documents"
        if (perPageInput !== false) {
          cursor = cursor.limit(perPage);
        }

        const dataResult = await cursor.toArray();
        messages.push(...dataResult.map((row: any) => this.parseRow(row)));
      }

      // Only return early if there are no messages AND no includes to process
      if (total === 0 && messages.length === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Step 2: Add included messages with context (if any), excluding duplicates
      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ threadId, include });
        if (includeMessages) {
          // Deduplicate: only add messages that aren't already in the paginated results
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(messages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output
      finalMessages = finalMessages.sort((a, b) => {
        const isDateField = field === 'createdAt' || field === 'updatedAt';
        const aValue = isDateField ? new Date((a as any)[field]).getTime() : (a as any)[field];
        const bValue = isDateField ? new Date((b as any)[field]).getTime() : (b as any)[field];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        // Fallback to string comparison for non-numeric fields
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const returnedThreadMessageIds = new Set(finalMessages.filter(m => m.threadId === threadId).map(m => m.id));
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore = perPageInput !== false && !allThreadMessagesReturned && offset + perPage < total;

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
          id: 'MONGODB_STORE_LIST_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return {
        messages: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };

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

      const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
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
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const collection = await this.operations.getCollection(TABLE_MESSAGES);

    const existingMessages = await collection.find({ id: { $in: messageIds } }).toArray();

    const existingMessagesParsed: MastraDBMessage[] = existingMessages.map((msg: any) => this.parseRow(msg));

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

  public async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    try {
      const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;

      if (page < 0) {
        throw new MastraError(
          {
            id: 'STORAGE_MONGODB_LIST_THREADS_BY_RESOURCE_ID_INVALID_PAGE',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const { field, direction } = this.parseOrderBy(orderBy);
      const collection = await this.operations.getCollection(TABLE_THREADS);

      const query = { resourceId };
      const total = await collection.countDocuments(query);

      if (perPage === 0) {
        return {
          threads: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: offset < total,
        };
      }

      // MongoDB sort: 1 = ASC, -1 = DESC
      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find(query)
        .sort({ [field]: sortOrder })
        .skip(offset);
      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }
      const threads = await cursor.toArray();

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
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_LIST_THREADS_BY_RESOURCE_ID_FAILED',
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
