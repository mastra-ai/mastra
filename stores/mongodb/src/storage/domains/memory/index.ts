import { randomUUID } from 'node:crypto';

import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  createStorageErrorId,
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  safelyParseJSON,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';

/**
 * Local constant for the observational memory table name.
 * Defined locally to avoid a static import that crashes on older @mastra/core
 * versions that don't export TABLE_OBSERVATIONAL_MEMORY.
 */
const OM_TABLE = 'mastra_observational_memory' as const;
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedReflectionInput,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';
import { formatDateForMongoDB } from '../utils';

export class MemoryStorageMongoDB extends MemoryStorage {
  readonly supportsObservationalMemory = true;

  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  /** Collections managed by this domain */
  static readonly MANAGED_COLLECTIONS = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES, OM_TABLE] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    // Filter indexes to only those for collections managed by this domain
    this.#indexes = config.indexes?.filter(idx =>
      (MemoryStorageMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the memory domain collections.
   */
  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      // Threads collection indexes
      { collection: TABLE_THREADS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_THREADS, keys: { resourceId: 1 } },
      { collection: TABLE_THREADS, keys: { createdAt: -1 } },
      { collection: TABLE_THREADS, keys: { updatedAt: -1 } },
      // Messages collection indexes
      { collection: TABLE_MESSAGES, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_MESSAGES, keys: { thread_id: 1 } },
      { collection: TABLE_MESSAGES, keys: { resourceId: 1 } },
      { collection: TABLE_MESSAGES, keys: { createdAt: -1 } },
      { collection: TABLE_MESSAGES, keys: { thread_id: 1, createdAt: 1 } },
      // Resources collection indexes
      { collection: TABLE_RESOURCES, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_RESOURCES, keys: { createdAt: -1 } },
      { collection: TABLE_RESOURCES, keys: { updatedAt: -1 } },
      // Observational Memory collection indexes
      { collection: OM_TABLE, keys: { id: 1 }, options: { unique: true } },
      { collection: OM_TABLE, keys: { lookupKey: 1 } },
      { collection: OM_TABLE, keys: { lookupKey: 1, generationCount: -1 } },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's collections.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    const threadsCollection = await this.getCollection(TABLE_THREADS);
    const messagesCollection = await this.getCollection(TABLE_MESSAGES);
    const resourcesCollection = await this.getCollection(TABLE_RESOURCES);

    await Promise.all([
      threadsCollection.deleteMany({}),
      messagesCollection.deleteMany({}),
      resourcesCollection.deleteMany({}),
    ]);
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

  private async _getIncludedMessages({ include }: { include: StorageListMessagesInput['include'] }) {
    if (!include || include.length === 0) return null;

    const collection = await this.getCollection(TABLE_MESSAGES);
    const includedMessages: any[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;

      // Step 1: Get the target message by ID (globally unique)
      const targetMessage = await collection.findOne({ id });
      if (!targetMessage) continue;

      // Step 2: Get the threadId from the message itself
      const messageThreadId = targetMessage.thread_id;

      // Step 3: Get all messages for that thread ordered by creation date
      const allMessages = await collection.find({ thread_id: messageThreadId }).sort({ createdAt: 1 }).toArray();

      // Step 4: Find the target message index
      const targetIndex = allMessages.findIndex((msg: any) => msg.id === id);
      if (targetIndex === -1) continue;

      // Step 5: Get surrounding context
      const startIndex = Math.max(0, targetIndex - withPreviousMessages);
      const endIndex = Math.min(allMessages.length - 1, targetIndex + withNextMessages);

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
      const collection = await this.getCollection(TABLE_MESSAGES);
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
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? threadId.join(',') : threadId },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'INVALID_PAGE'),
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

      const collection = await this.getCollection(TABLE_MESSAGES);

      // Build query conditions - use $in for multiple thread IDs
      const query: any = { thread_id: threadIds.length === 1 ? threadIds[0] : { $in: threadIds } };

      if (resourceId) {
        query.resourceId = resourceId;
      }

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '$gt' : '$gte';
        query.createdAt = { ...query.createdAt, [startOp]: formatDateForMongoDB(filter.dateRange.start) };
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '$lt' : '$lte';
        query.createdAt = { ...query.createdAt, [endOp]: formatDateForMongoDB(filter.dateRange.end) };
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
        const includeMessages = await this._getIncludedMessages({ include });
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
      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageIds = new Set(
        finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).map(m => m.id),
      );
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
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
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

  public async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    if (!resourceId || typeof resourceId !== 'string' || resourceId.trim().length === 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'INVALID_QUERY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resourceId: resourceId ?? '' },
        },
        new Error('resourceId is required'),
      );
    }

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'INVALID_PAGE'),
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

      const collection = await this.getCollection(TABLE_MESSAGES);

      // Build query conditions
      const query: any = {};

      // Add resourceId filter (required for listMessagesByResourceId)
      query.resourceId = resourceId;

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '$gt' : '$gte';
        query.createdAt = { ...query.createdAt, [startOp]: formatDateForMongoDB(filter.dateRange.start) };
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '$lt' : '$lte';
        query.createdAt = { ...query.createdAt, [endOp]: formatDateForMongoDB(filter.dateRange.end) };
      }

      // Get total count
      const total = await collection.countDocuments(query);

      const messages: any[] = [];

      // Step 1: Get paginated messages
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
        const includeMessages = await this._getIncludedMessages({ include });
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
      const hasMore = perPageInput !== false && offset + perPage < total;

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
          id: createStorageErrorId('MONGODB', 'LIST_MESSAGES_BY_RESOURCE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
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

      const collection = await this.getCollection(TABLE_MESSAGES);
      const threadsCollection = await this.getCollection(TABLE_THREADS);

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
                resourceId: message.resourceId,
              },
              $setOnInsert: {
                createdAt: formatDateForMongoDB(time),
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
          id: createStorageErrorId('MONGODB', 'SAVE_MESSAGES', 'FAILED'),
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
    const collection = await this.getCollection(TABLE_MESSAGES);

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
      const threadsCollection = await this.getCollection(TABLE_THREADS);
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
      const collection = await this.getCollection(TABLE_RESOURCES);
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
          id: createStorageErrorId('MONGODB', 'GET_RESOURCE_BY_ID', 'FAILED'),
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
      const collection = await this.getCollection(TABLE_RESOURCES);
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
          id: createStorageErrorId('MONGODB', 'SAVE_RESOURCE', 'FAILED'),
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

      const collection = await this.getCollection(TABLE_RESOURCES);
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
          id: createStorageErrorId('MONGODB', 'UPDATE_RESOURCE', 'FAILED'),
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
      const collection = await this.getCollection(TABLE_THREADS);
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
          id: createStorageErrorId('MONGODB', 'GET_THREAD_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  public async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;

    try {
      // Validate pagination input before normalization
      // This ensures page === 0 when perPageInput === false
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_THREADS', 'INVALID_PAGE'),
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
          id: createStorageErrorId('MONGODB', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
        },
        error instanceof Error ? error : new Error('Invalid metadata key'),
      );
    }

    try {
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const { field, direction } = this.parseOrderBy(orderBy);
      const collection = await this.getCollection(TABLE_THREADS);

      // Build MongoDB query object
      const query: any = {};

      // Add resourceId filter if provided
      if (filter?.resourceId) {
        query.resourceId = filter.resourceId;
      }

      // Add metadata filters if provided (AND logic)
      // MongoDB properly escapes dot notation keys in the driver
      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          query[`metadata.${key}`] = value;
        }
      }

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
          id: createStorageErrorId('MONGODB', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!filter?.metadata,
          },
        },
        error,
      );
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const collection = await this.getCollection(TABLE_THREADS);
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
          id: createStorageErrorId('MONGODB', 'SAVE_THREAD', 'FAILED'),
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
        id: createStorageErrorId('MONGODB', 'UPDATE_THREAD', 'NOT_FOUND'),
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
      const collection = await this.getCollection(TABLE_THREADS);
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
          id: createStorageErrorId('MONGODB', 'UPDATE_THREAD', 'FAILED'),
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
      const collectionMessages = await this.getCollection(TABLE_MESSAGES);
      await collectionMessages.deleteMany({ thread_id: threadId });
      // Then delete the thread itself
      const collectionThreads = await this.getCollection(TABLE_THREADS);
      await collectionThreads.deleteOne({ id: threadId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    try {
      const messagesCollection = await this.getCollection(TABLE_MESSAGES);
      const threadsCollection = await this.getCollection(TABLE_THREADS);

      // Get unique thread IDs from messages before deleting
      const messagesToDelete = await messagesCollection.find({ id: { $in: messageIds } }).toArray();
      const threadIds = [...new Set(messagesToDelete.map((m: any) => m.thread_id))];

      // Delete the messages
      await messagesCollection.deleteMany({ id: { $in: messageIds } });

      // Update thread timestamps for affected threads
      if (threadIds.length > 0) {
        await threadsCollection.updateMany({ id: { $in: threadIds } }, { $set: { updatedAt: new Date() } });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
        },
        error,
      );
    }
  }

  // ============================================
  // Observational Memory Methods
  // ============================================

  private getOMKey(threadId: string | null, resourceId: string): string {
    return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
  }

  private parseOMDocument(doc: any): ObservationalMemoryRecord {
    return {
      id: doc.id,
      scope: doc.scope,
      threadId: doc.threadId || null,
      resourceId: doc.resourceId,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
      lastObservedAt: doc.lastObservedAt
        ? doc.lastObservedAt instanceof Date
          ? doc.lastObservedAt
          : new Date(doc.lastObservedAt)
        : undefined,
      originType: doc.originType || 'initial',
      generationCount: Number(doc.generationCount || 0),
      activeObservations: doc.activeObservations || '',
      // Handle new chunk-based structure
      bufferedObservationChunks: doc.bufferedObservationChunks || undefined,
      // Deprecated fields (for backward compatibility)
      bufferedObservations: doc.activeObservationsPendingUpdate || undefined,
      bufferedObservationTokens: doc.bufferedObservationTokens ? Number(doc.bufferedObservationTokens) : undefined,
      bufferedMessageIds: undefined, // Use bufferedObservationChunks instead
      bufferedReflection: doc.bufferedReflection || undefined,
      bufferedReflectionTokens: doc.bufferedReflectionTokens ? Number(doc.bufferedReflectionTokens) : undefined,
      bufferedReflectionInputTokens: doc.bufferedReflectionInputTokens
        ? Number(doc.bufferedReflectionInputTokens)
        : undefined,
      reflectedObservationLineCount: doc.reflectedObservationLineCount
        ? Number(doc.reflectedObservationLineCount)
        : undefined,
      totalTokensObserved: Number(doc.totalTokensObserved || 0),
      observationTokenCount: Number(doc.observationTokenCount || 0),
      pendingMessageTokens: Number(doc.pendingMessageTokens || 0),
      isReflecting: Boolean(doc.isReflecting),
      isObserving: Boolean(doc.isObserving),
      isBufferingObservation: Boolean(doc.isBufferingObservation),
      isBufferingReflection: Boolean(doc.isBufferingReflection),
      lastBufferedAtTokens:
        typeof doc.lastBufferedAtTokens === 'number'
          ? doc.lastBufferedAtTokens
          : parseInt(String(doc.lastBufferedAtTokens ?? '0'), 10) || 0,
      lastBufferedAtTime: doc.lastBufferedAtTime ? new Date(doc.lastBufferedAtTime) : null,
      config: doc.config || {},
      metadata: doc.metadata || undefined,
      observedMessageIds: doc.observedMessageIds || undefined,
      observedTimezone: doc.observedTimezone || undefined,
    };
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const collection = await this.getCollection(OM_TABLE);
      const doc = await collection.findOne({ lookupKey }, { sort: { generationCount: -1 } });
      if (!doc) return null;
      return this.parseOMDocument(doc);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit: number = 10,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const collection = await this.getCollection(OM_TABLE);
      const docs = await collection.find({ lookupKey }).sort({ generationCount: -1 }).limit(limit).toArray();
      return docs.map((doc: any) => this.parseOMDocument(doc));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_OBSERVATIONAL_MEMORY_HISTORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId, limit },
        },
        error,
      );
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    try {
      const id = randomUUID();
      const now = new Date();
      const lookupKey = this.getOMKey(input.threadId, input.resourceId);

      const record: ObservationalMemoryRecord = {
        id,
        scope: input.scope,
        threadId: input.threadId,
        resourceId: input.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: undefined,
        originType: 'initial',
        generationCount: 0,
        activeObservations: '',
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
      };

      const collection = await this.getCollection(OM_TABLE);
      await collection.insertOne({
        id,
        lookupKey,
        scope: input.scope,
        resourceId: input.resourceId,
        threadId: input.threadId || null,
        activeObservations: '',
        activeObservationsPendingUpdate: null,
        originType: 'initial',
        config: input.config,
        generationCount: 0,
        lastObservedAt: null,
        lastReflectionAt: null,
        pendingMessageTokens: 0,
        totalTokensObserved: 0,
        observationTokenCount: 0,
        isObserving: false,
        isReflecting: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        observedTimezone: input.observedTimezone || null,
        createdAt: now,
        updatedAt: now,
      });

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'INITIALIZE_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: input.threadId, resourceId: input.resourceId },
        },
        error,
      );
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    try {
      const now = new Date();
      const collection = await this.getCollection(OM_TABLE);
      const safeTokenCount = Number.isFinite(input.tokenCount) && input.tokenCount >= 0 ? input.tokenCount : 0;

      const updateDoc: any = {
        activeObservations: input.observations,
        lastObservedAt: input.lastObservedAt,
        pendingMessageTokens: 0,
        observationTokenCount: safeTokenCount,
        observedMessageIds: input.observedMessageIds ?? null,
        updatedAt: now,
      };

      const result = await collection.updateOne(
        { id: input.id },
        {
          $set: updateDoc,
          $inc: { totalTokensObserved: safeTokenCount },
        },
      );

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_ACTIVE_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_ACTIVE_OBSERVATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    try {
      const id = randomUUID();
      const now = new Date();
      const lookupKey = this.getOMKey(input.currentRecord.threadId, input.currentRecord.resourceId);

      const record: ObservationalMemoryRecord = {
        id,
        scope: input.currentRecord.scope,
        threadId: input.currentRecord.threadId,
        resourceId: input.currentRecord.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: input.currentRecord.lastObservedAt,
        originType: 'reflection',
        generationCount: input.currentRecord.generationCount + 1,
        activeObservations: input.reflection,
        totalTokensObserved: input.currentRecord.totalTokensObserved,
        observationTokenCount: input.tokenCount,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: input.currentRecord.config,
        metadata: input.currentRecord.metadata,
        observedTimezone: input.currentRecord.observedTimezone,
      };

      const collection = await this.getCollection(OM_TABLE);
      await collection.insertOne({
        id,
        lookupKey,
        scope: record.scope,
        resourceId: record.resourceId,
        threadId: record.threadId || null,
        activeObservations: input.reflection,
        activeObservationsPendingUpdate: null,
        originType: 'reflection',
        config: record.config,
        generationCount: input.currentRecord.generationCount + 1,
        lastObservedAt: record.lastObservedAt || null,
        lastReflectionAt: now,
        pendingMessageTokens: record.pendingMessageTokens,
        totalTokensObserved: record.totalTokensObserved,
        observationTokenCount: record.observationTokenCount,
        isObserving: false,
        isReflecting: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        observedTimezone: record.observedTimezone || null,
        createdAt: now,
        updatedAt: now,
        metadata: record.metadata || null,
      });

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_REFLECTION_GENERATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { currentRecordId: input.currentRecord.id },
        },
        error,
      );
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    try {
      const collection = await this.getCollection(OM_TABLE);
      const result = await collection.updateOne({ id }, { $set: { isReflecting, updatedAt: new Date() } });

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SET_REFLECTING_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isReflecting },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SET_REFLECTING_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isReflecting },
        },
        error,
      );
    }
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    try {
      const collection = await this.getCollection(OM_TABLE);
      const result = await collection.updateOne({ id }, { $set: { isObserving, updatedAt: new Date() } });

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SET_OBSERVING_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isObserving },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SET_OBSERVING_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isObserving },
        },
        error,
      );
    }
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    try {
      const collection = await this.getCollection(OM_TABLE);
      const updateDoc: any = {
        isBufferingObservation: isBuffering,
        updatedAt: new Date(),
      };

      if (lastBufferedAtTokens !== undefined) {
        updateDoc.lastBufferedAtTokens = lastBufferedAtTokens;
      }

      const result = await collection.updateOne({ id }, { $set: updateDoc });

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SET_BUFFERING_OBSERVATION_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering, lastBufferedAtTokens: lastBufferedAtTokens ?? null },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SET_BUFFERING_OBSERVATION_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering, lastBufferedAtTokens: lastBufferedAtTokens ?? null },
        },
        error,
      );
    }
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    try {
      const collection = await this.getCollection(OM_TABLE);
      const result = await collection.updateOne(
        { id },
        { $set: { isBufferingReflection: isBuffering, updatedAt: new Date() } },
      );

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SET_BUFFERING_REFLECTION_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SET_BUFFERING_REFLECTION_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering },
        },
        error,
      );
    }
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const collection = await this.getCollection(OM_TABLE);
      await collection.deleteMany({ lookupKey });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CLEAR_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    // Validate tokenCount before using in $set
    if (typeof tokenCount !== 'number' || !Number.isFinite(tokenCount) || tokenCount < 0) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'SET_PENDING_MESSAGE_TOKENS', 'INVALID_INPUT'),
        text: `Invalid tokenCount: must be a finite non-negative number, got ${tokenCount}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { id, tokenCount },
      });
    }

    try {
      const collection = await this.getCollection(OM_TABLE);
      const result = await collection.updateOne(
        { id },
        {
          $set: { pendingMessageTokens: tokenCount, updatedAt: new Date() },
        },
      );

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SET_PENDING_MESSAGE_TOKENS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SET_PENDING_MESSAGE_TOKENS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        },
        error,
      );
    }
  }

  // ============================================
  // Async Buffering Methods
  // ============================================

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    try {
      const collection = await this.getCollection(OM_TABLE);

      // Create new chunk with ID and timestamp
      const newChunk: BufferedObservationChunk = {
        id: `ombuf-${randomUUID()}`,
        cycleId: input.chunk.cycleId,
        observations: input.chunk.observations,
        tokenCount: input.chunk.tokenCount,
        messageIds: input.chunk.messageIds,
        messageTokens: input.chunk.messageTokens,
        lastObservedAt: input.chunk.lastObservedAt,
        createdAt: new Date(),
        suggestedContinuation: input.chunk.suggestedContinuation,
        currentTask: input.chunk.currentTask,
      };

      // Use $push to append chunk to array atomically
      const $set: Record<string, any> = { updatedAt: new Date() };
      if (input.lastBufferedAtTime) {
        $set.lastBufferedAtTime = input.lastBufferedAtTime;
      }
      const result = await collection.updateOne(
        { id: input.id },
        {
          $push: { bufferedObservationChunks: newChunk as any },
          $set,
        },
      );

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_BUFFERED_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_BUFFERED_OBSERVATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      const collection = await this.getCollection(OM_TABLE);

      // Get current record
      const doc = await collection.findOne({ id: input.id });
      if (!doc) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SWAP_BUFFERED_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      // Parse buffered chunks safely
      const chunks: BufferedObservationChunk[] = Array.isArray(doc.bufferedObservationChunks)
        ? doc.bufferedObservationChunks
        : [];

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

      // Calculate target message tokens to activate based on new formula:
      // retentionFloor = threshold * (1 - ratio) represents tokens to keep as raw messages
      // targetMessageTokens = max(0, currentPending - retentionFloor) represents tokens to activate
      const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
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

      // Split chunks
      const activatedChunks = chunks.slice(0, chunksToActivate);
      const remainingChunks = chunks.slice(chunksToActivate);

      // Combine activated observations
      const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
      const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
      const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
      const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
      const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
      const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

      // Derive lastObservedAt from the latest activated chunk, or use provided value
      const latestChunk = activatedChunks[activatedChunks.length - 1];
      const lastObservedAt =
        input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());

      // Get existing values
      const existingActive = (doc.activeObservations as string) || '';
      const existingTokenCount = Number(doc.observationTokenCount || 0);

      // Calculate new values
      const newActive = existingActive ? `${existingActive}\n\n${activatedContent}` : activatedContent;
      const newTokenCount = existingTokenCount + activatedTokens;

      // NOTE: We intentionally do NOT add message IDs to observedMessageIds during buffered activation.
      // Buffered chunks represent observations of messages as they were at buffering time.
      // With streaming, messages grow after buffering, so we rely on lastObservedAt for filtering.
      // New content after lastObservedAt will be picked up in subsequent observations.

      // Decrement pending message tokens (clamped to zero)
      const existingPending = Number(doc.pendingMessageTokens || 0);
      const newPending = Math.max(0, existingPending - activatedMessageTokens);

      await collection.updateOne(
        { id: input.id },
        {
          $set: {
            activeObservations: newActive,
            observationTokenCount: newTokenCount,
            pendingMessageTokens: newPending,
            bufferedObservationChunks: remainingChunks.length > 0 ? remainingChunks : null,
            lastObservedAt,
            updatedAt: new Date(),
          },
        },
      );

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
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SWAP_BUFFERED_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    try {
      const collection = await this.getCollection(OM_TABLE);

      // First get current record to merge buffered content
      const doc = await collection.findOne({ id: input.id });
      if (!doc) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_BUFFERED_REFLECTION', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      const existingContent = (doc.bufferedReflection as string) || '';
      const existingTokens = Number(doc.bufferedReflectionTokens || 0);
      const existingInputTokens = Number(doc.bufferedReflectionInputTokens || 0);

      // Merge content
      const newContent = existingContent ? `${existingContent}\n\n${input.reflection}` : input.reflection;
      const newTokens = existingTokens + input.tokenCount;
      const newInputTokens = existingInputTokens + input.inputTokenCount;

      const result = await collection.updateOne(
        { id: input.id },
        {
          $set: {
            bufferedReflection: newContent,
            bufferedReflectionTokens: newTokens,
            bufferedReflectionInputTokens: newInputTokens,
            reflectedObservationLineCount: input.reflectedObservationLineCount,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_BUFFERED_REFLECTION', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_BUFFERED_REFLECTION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    try {
      const collection = await this.getCollection(OM_TABLE);

      // Get current record
      const doc = await collection.findOne({ id: input.currentRecord.id });
      if (!doc) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.currentRecord.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        });
      }

      const bufferedReflection = (doc.bufferedReflection as string) || '';
      const reflectedLineCount = Number(doc.reflectedObservationLineCount || 0);

      if (!bufferedReflection) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
          text: 'No buffered reflection to swap',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: input.currentRecord.id },
        });
      }

      // Split current activeObservations by the recorded boundary.
      // Lines 0..reflectedLineCount were reflected on → replaced by bufferedReflection.
      // Lines after reflectedLineCount were added after reflection started → kept as-is.
      const currentObservations = (doc.activeObservations as string) || '';
      const allLines = currentObservations.split('\n');
      const unreflectedLines = allLines.slice(reflectedLineCount);
      const unreflectedContent = unreflectedLines.join('\n').trim();

      // New activeObservations = bufferedReflection + unreflected observations
      const newObservations = unreflectedContent
        ? `${bufferedReflection}\n\n${unreflectedContent}`
        : bufferedReflection;

      // Create new generation with the merged content.
      // tokenCount is computed by the processor using its token counter on the combined content.
      const newRecord = await this.createReflectionGeneration({
        currentRecord: input.currentRecord,
        reflection: newObservations,
        tokenCount: input.tokenCount,
      });

      // Clear buffered state on old record
      await collection.updateOne(
        { id: input.currentRecord.id },
        {
          $set: {
            bufferedReflection: null,
            bufferedReflectionTokens: null,
            bufferedReflectionInputTokens: null,
            reflectedObservationLineCount: null,
            updatedAt: new Date(),
          },
        },
      );

      return newRecord;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        },
        error,
      );
    }
  }
}
