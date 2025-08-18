import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2 } from '@mastra/core/memory';
import { MemoryStorage, resolveMessageLimit } from '@mastra/core/storage';
import type {
  PaginationInfo,
  StorageGetMessagesArg,
  StorageResourceType,
  ThreadSortOptions,
} from '@mastra/core/storage';
import type { Service } from 'electrodb';

export class MemoryStorageDynamoDB extends MemoryStorage {
  private service: Service<Record<string, any>>;
  constructor({ service }: { service: Service<Record<string, any>> }) {
    super();
    this.service = service;
  }

  // Helper function to parse message data (handle JSON fields)
  private parseMessageData(data: any): MastraMessageV2 | MastraMessageV1 {
    // Removed try/catch and JSON.parse logic - now handled by entity 'get' attributes
    // This function now primarily ensures correct typing and Date conversion.
    return {
      ...data,
      // Ensure dates are Date objects if needed (ElectroDB might return strings)
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      // Other fields like content, toolCallArgs etc. are assumed to be correctly
      // transformed by the ElectroDB entity getters.
    };
  }

  // Helper function to transform and sort threads
  private transformAndSortThreads(rawThreads: any[], orderBy: string, sortDirection: string): StorageThreadType[] {
    return rawThreads
      .map((data: any) => ({
        ...data,
        // Convert date strings back to Date objects for consistency
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
      }))
      .sort((a: StorageThreadType, b: StorageThreadType) => {
        const fieldA = orderBy === 'createdAt' ? a.createdAt : a.updatedAt;
        const fieldB = orderBy === 'createdAt' ? b.createdAt : b.updatedAt;

        const comparison = fieldA.getTime() - fieldB.getTime();
        return sortDirection === 'DESC' ? -comparison : comparison;
      }) as StorageThreadType[];
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    this.logger.debug('Getting thread by ID', { threadId });
    try {
      const result = await this.service.entities.thread.get({ entity: 'thread', id: threadId }).go();

      if (!result.data) {
        return null;
      }

      // ElectroDB handles the transformation with attribute getters
      const data = result.data;
      return {
        ...data,
        // Convert date strings back to Date objects for consistency
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
        // metadata: data.metadata ? JSON.parse(data.metadata) : undefined, // REMOVED by AI
        // metadata is already transformed by the entity's getter
      } as StorageThreadType;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead for paginated results.
   */
  public async getThreadsByResourceId(args: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    const resourceId = args.resourceId;
    const orderBy = this.castThreadOrderBy(args.orderBy);
    const sortDirection = this.castThreadSortDirection(args.sortDirection);

    this.logger.debug('Getting threads by resource ID', { resourceId, orderBy, sortDirection });

    try {
      const result = await this.service.entities.thread.query.byResource({ entity: 'thread', resourceId }).go();

      if (!result.data.length) {
        return [];
      }

      // Use shared helper method for transformation and sorting
      return this.transformAndSortThreads(result.data, orderBy, sortDirection);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.logger.debug('Saving thread', { threadId: thread.id });

    const now = new Date();

    const threadData = {
      entity: 'thread',
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title || `Thread ${thread.id}`,
      createdAt: thread.createdAt?.toISOString() || now.toISOString(),
      updatedAt: thread.updatedAt?.toISOString() || now.toISOString(),
      metadata: thread.metadata ? JSON.stringify(thread.metadata) : undefined,
    };

    try {
      await this.service.entities.thread.upsert(threadData).go();

      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: threadData.title,
        createdAt: thread.createdAt || now,
        updatedAt: now,
        metadata: thread.metadata,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_SAVE_THREAD_FAILED',
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
    this.logger.debug('Updating thread', { threadId: id });

    try {
      // First, get the existing thread to merge with updates
      const existingThread = await this.getThreadById({ threadId: id });

      if (!existingThread) {
        throw new Error(`Thread not found: ${id}`);
      }

      const now = new Date();

      // Prepare the update
      // Define type for only the fields we are actually updating
      type ThreadUpdatePayload = {
        updatedAt: string; // ISO String for DDB
        title?: string;
        metadata?: string; // Stringified JSON for DDB
      };
      const updateData: ThreadUpdatePayload = {
        updatedAt: now.toISOString(),
      };

      if (title) {
        updateData.title = title;
      }

      if (metadata) {
        // Merge with existing metadata instead of overwriting
        const existingMetadata = existingThread.metadata
          ? typeof existingThread.metadata === 'string'
            ? JSON.parse(existingThread.metadata)
            : existingThread.metadata
          : {};
        const mergedMetadata = { ...existingMetadata, ...metadata };
        updateData.metadata = JSON.stringify(mergedMetadata); // Stringify merged metadata for update
      }

      // Update the thread using the primary key
      await this.service.entities.thread.update({ entity: 'thread', id }).set(updateData).go();

      // Return the potentially updated thread object
      return {
        ...existingThread,
        title: title || existingThread.title,
        metadata: metadata ? { ...existingThread.metadata, ...metadata } : existingThread.metadata,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    this.logger.debug('Deleting thread', { threadId });

    try {
      // First, delete all messages associated with this thread
      const messages = await this.getMessages({ threadId });
      if (messages.length > 0) {
        // Delete messages in batches
        const batchSize = 25; // DynamoDB batch limits
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          await Promise.all(
            batch.map(message =>
              this.service.entities.message
                .delete({
                  entity: 'message',
                  id: message.id,
                  threadId: message.threadId,
                })
                .go(),
            ),
          );
        }
      }

      // Then delete the thread using the primary key
      await this.service.entities.thread.delete({ entity: 'thread', id: threadId }).go();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    this.logger.debug('Getting messages', { threadId, selectBy });

    try {
      const messages: MastraMessageV2[] = [];
      const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: Number.MAX_SAFE_INTEGER });

      // Handle included messages first (like libsql)
      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages(threadId, selectBy);
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      }

      // Get remaining messages only if limit is not 0
      if (limit !== 0) {
        // Query messages by thread ID using the GSI
        const query = this.service.entities.message.query.byThread({ entity: 'message', threadId });

        // Get messages from the main thread
        let results;
        if (limit !== Number.MAX_SAFE_INTEGER && limit > 0) {
          // Use limit in query to get only the last N messages
          results = await query.go({ limit, order: 'desc' });
          // Reverse the results since we want ascending order
          results.data = results.data.reverse();
        } else {
          // Get all messages
          results = await query.go();
        }

        let allThreadMessages = results.data
          .map((data: any) => this.parseMessageData(data))
          .filter((msg: any): msg is MastraMessageV2 => 'content' in msg);

        // Sort by createdAt ASC to get proper order
        allThreadMessages.sort((a: MastraMessageV2, b: MastraMessageV2) => {
          const timeA = a.createdAt.getTime();
          const timeB = b.createdAt.getTime();
          if (timeA === timeB) {
            return a.id.localeCompare(b.id);
          }
          return timeA - timeB;
        });

        messages.push(...allThreadMessages);
      }

      // Sort by createdAt ASC to match libsql behavior, with ID tiebreaker for stable ordering
      messages.sort((a, b) => {
        const timeA = a.createdAt.getTime();
        const timeB = b.createdAt.getTime();
        if (timeA === timeB) {
          return a.id.localeCompare(b.id);
        }
        return timeA - timeB;
      });

      // Deduplicate messages by ID (like libsql)
      const uniqueMessages = messages.filter(
        (message, index, self) => index === self.findIndex(m => m.id === message.id),
      );

      const list = new MessageList({ threadId, resourceId }).add(uniqueMessages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
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
    this.logger.debug('Getting messages by ID', { messageIds });
    if (messageIds.length === 0) return [];

    try {
      const results = await Promise.all(
        messageIds.map(id => this.service.entities.message.query.primary({ entity: 'message', id }).go()),
      );

      const data = results.map(result => result.data).flat(1);

      let parsedMessages = data
        .map((data: any) => this.parseMessageData(data))
        .filter((msg: any): msg is MastraMessageV2 => 'content' in msg);

      // Deduplicate messages by ID (like libsql)
      const uniqueMessages = parsedMessages.filter(
        (message, index, self) => index === self.findIndex(m => m.id === message.id),
      );

      const list = new MessageList().add(uniqueMessages, 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_MESSAGES_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: JSON.stringify(messageIds) },
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
    this.logger.debug('Saving messages', { count: messages.length });

    if (!messages.length) {
      return [];
    }

    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    // Ensure 'entity' is added and complex fields are handled
    const messagesToSave = messages.map(msg => {
      const now = new Date().toISOString();
      return {
        entity: 'message', // Add entity type
        id: msg.id,
        threadId: msg.threadId,
        role: msg.role,
        type: msg.type,
        resourceId: msg.resourceId,
        // Ensure complex fields are stringified if not handled by attribute setters
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        toolCallArgs: `toolCallArgs` in msg && msg.toolCallArgs ? JSON.stringify(msg.toolCallArgs) : undefined,
        toolCallIds: `toolCallIds` in msg && msg.toolCallIds ? JSON.stringify(msg.toolCallIds) : undefined,
        toolNames: `toolNames` in msg && msg.toolNames ? JSON.stringify(msg.toolNames) : undefined,
        createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt || now,
        updatedAt: now, // Add updatedAt
      };
    });

    try {
      // Process messages sequentially to enable rollback on error
      const savedMessageIds: string[] = [];

      for (const messageData of messagesToSave) {
        // Ensure each item has the entity property before sending
        if (!messageData.entity) {
          this.logger.error('Missing entity property in message data for create', { messageData });
          throw new Error('Internal error: Missing entity property during saveMessages');
        }

        try {
          await this.service.entities.message.put(messageData).go();
          savedMessageIds.push(messageData.id);
        } catch (error) {
          // Rollback: delete all previously saved messages
          for (const savedId of savedMessageIds) {
            try {
              await this.service.entities.message.delete({ entity: 'message', id: savedId }).go();
            } catch (rollbackError) {
              this.logger.error('Failed to rollback message during save error', {
                messageId: savedId,
                error: rollbackError,
              });
            }
          }
          throw error;
        }
      }

      // Update thread's updatedAt timestamp
      await this.service.entities.thread
        .update({ entity: 'thread', id: threadId })
        .set({
          updatedAt: new Date().toISOString(),
        })
        .go();

      const list = new MessageList().add(messages, 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
        },
        error,
      );
    }
  }

  async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page?: number;
      perPage?: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage = 100 } = args;
    const orderBy = this.castThreadOrderBy(args.orderBy);
    const sortDirection = this.castThreadSortDirection(args.sortDirection);

    this.logger.debug('Getting threads by resource ID with pagination', {
      resourceId,
      page,
      perPage,
      orderBy,
      sortDirection,
    });

    try {
      // Query threads by resource ID using the GSI
      const query = this.service.entities.thread.query.byResource({ entity: 'thread', resourceId });

      // Get all threads for this resource ID (DynamoDB doesn't support OFFSET/LIMIT)
      const results = await query.go();

      // Use shared helper method for transformation and sorting
      const allThreads = this.transformAndSortThreads(results.data, orderBy, sortDirection);

      // Apply pagination in memory
      const startIndex = page * perPage;
      const endIndex = startIndex + perPage;
      const paginatedThreads = allThreads.slice(startIndex, endIndex);

      // Calculate pagination info
      const total = allThreads.length;
      const hasMore = endIndex < total;

      return {
        threads: paginatedThreads,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId, page, perPage },
        },
        error,
      );
    }
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, resourceId, selectBy, format = 'v1' } = args;
    const { page = 0, perPage = 40, dateRange } = selectBy?.pagination || {};
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: Number.MAX_SAFE_INTEGER });

    this.logger.debug('Getting messages with pagination', { threadId, page, perPage, fromDate, toDate, limit });

    try {
      let messages: MastraMessageV2[] = [];

      // Handle include messages first
      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages(threadId, selectBy);
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      }

      // Get remaining messages only if limit is not 0
      if (limit !== 0) {
        // Query messages by thread ID using the GSI
        const query = this.service.entities.message.query.byThread({ entity: 'message', threadId });

        // Get messages from the main thread
        let results;
        if (limit !== Number.MAX_SAFE_INTEGER && limit > 0) {
          // Use limit in query to get only the last N messages
          results = await query.go({ limit, order: 'desc' });
          // Reverse the results since we want ascending order
          results.data = results.data.reverse();
        } else {
          // Get all messages
          results = await query.go();
        }

        let allThreadMessages = results.data
          .map((data: any) => this.parseMessageData(data))
          .filter((msg: any): msg is MastraMessageV2 => 'content' in msg);

        // Sort by createdAt ASC to get proper order
        allThreadMessages.sort((a: MastraMessageV2, b: MastraMessageV2) => {
          const timeA = a.createdAt.getTime();
          const timeB = b.createdAt.getTime();
          if (timeA === timeB) {
            return a.id.localeCompare(b.id);
          }
          return timeA - timeB;
        });

        // Exclude already included messages
        const excludeIds = messages.map(m => m.id);
        if (excludeIds.length > 0) {
          allThreadMessages = allThreadMessages.filter((msg: MastraMessageV2) => !excludeIds.includes(msg.id));
        }

        messages.push(...allThreadMessages);
      }

      // Sort all messages by createdAt (oldest first for final result)
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Apply date filtering if needed
      if (fromDate || toDate) {
        messages = messages.filter(msg => {
          const createdAt = new Date(msg.createdAt).getTime();
          if (fromDate && createdAt < new Date(fromDate).getTime()) return false;
          if (toDate && createdAt > new Date(toDate).getTime()) return false;
          return true;
        });
      }

      // Save total before pagination
      const total = messages.length;

      // Apply offset-based pagination in memory
      const start = page * perPage;
      const end = start + perPage;
      const paginatedMessages = messages.slice(start, end);
      const hasMore = end < total;

      const list = new MessageList({ threadId, resourceId }).add(paginatedMessages as MastraMessageV2[], 'memory');
      const finalMessages = format === 'v2' ? list.get.all.v2() : list.get.all.v1();

      return {
        messages: finalMessages,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  // Helper method to get included messages with context
  private async _getIncludedMessages(threadId: string, selectBy: any): Promise<MastraMessageV2[]> {
    if (!selectBy?.include?.length) {
      return [];
    }

    const includeMessages: MastraMessageV2[] = [];

    for (const includeItem of selectBy.include) {
      try {
        const { id, threadId: targetThreadId, withPreviousMessages = 0, withNextMessages = 0 } = includeItem;
        const searchThreadId = targetThreadId || threadId;

        this.logger.debug('Getting included messages for', {
          id,
          targetThreadId,
          searchThreadId,
          withPreviousMessages,
          withNextMessages,
        });

        // Get all messages for the target thread
        const query = this.service.entities.message.query.byThread({ entity: 'message', threadId: searchThreadId });
        const results = await query.go();
        const allMessages = results.data
          .map((data: any) => this.parseMessageData(data))
          .filter((msg: any): msg is MastraMessageV2 => 'content' in msg && typeof msg.content === 'object');

        this.logger.debug('Found messages in thread', {
          threadId: searchThreadId,
          messageCount: allMessages.length,
          messageIds: allMessages.map((m: MastraMessageV2) => m.id),
        });

        // Sort by createdAt ASC to get proper order, with ID tiebreaker for stable ordering
        allMessages.sort((a: MastraMessageV2, b: MastraMessageV2) => {
          const timeA = a.createdAt.getTime();
          const timeB = b.createdAt.getTime();
          if (timeA === timeB) {
            return a.id.localeCompare(b.id);
          }
          return timeA - timeB;
        });

        // Find the target message
        const targetIndex = allMessages.findIndex((msg: MastraMessageV2) => msg.id === id);
        if (targetIndex === -1) {
          this.logger.warn('Target message not found', { id, threadId: searchThreadId });
          continue;
        }

        this.logger.debug('Found target message at index', { id, targetIndex, totalMessages: allMessages.length });

        // Get context messages (previous and next)
        const startIndex = Math.max(0, targetIndex - withPreviousMessages);
        const endIndex = Math.min(allMessages.length, targetIndex + withNextMessages + 1);
        const contextMessages = allMessages.slice(startIndex, endIndex);

        this.logger.debug('Context messages', {
          startIndex,
          endIndex,
          contextCount: contextMessages.length,
          contextIds: contextMessages.map((m: MastraMessageV2) => m.id),
        });

        includeMessages.push(...contextMessages);
      } catch (error) {
        this.logger.warn('Failed to get included message', { messageId: includeItem.id, error });
      }
    }

    this.logger.debug('Total included messages', {
      count: includeMessages.length,
      ids: includeMessages.map((m: MastraMessageV2) => m.id),
    });

    return includeMessages;
  }

  async updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;
    this.logger.debug('Updating messages', { count: messages.length });

    if (!messages.length) {
      return [];
    }

    const updatedMessages: MastraMessageV2[] = [];
    const affectedThreadIds = new Set<string>();

    try {
      for (const updateData of messages) {
        const { id, ...updates } = updateData;

        // Get the existing message
        const existingMessage = await this.service.entities.message.get({ entity: 'message', id }).go();
        if (!existingMessage.data) {
          this.logger.warn('Message not found for update', { id });
          continue;
        }

        const existingMsg = this.parseMessageData(existingMessage.data) as MastraMessageV2;
        const originalThreadId = existingMsg.threadId;
        affectedThreadIds.add(originalThreadId!);

        // Prepare the update payload
        const updatePayload: any = {
          updatedAt: new Date().toISOString(),
        };

        // Handle basic field updates
        if ('role' in updates && updates.role !== undefined) updatePayload.role = updates.role;
        if ('type' in updates && updates.type !== undefined) updatePayload.type = updates.type;
        if ('resourceId' in updates && updates.resourceId !== undefined) updatePayload.resourceId = updates.resourceId;
        if ('threadId' in updates && updates.threadId !== undefined && updates.threadId !== null) {
          updatePayload.threadId = updates.threadId;
          affectedThreadIds.add(updates.threadId as string);
        }

        // Handle content updates
        if (updates.content) {
          const existingContent = existingMsg.content;
          let newContent = { ...existingContent };

          // Deep merge metadata if provided
          if (updates.content.metadata !== undefined) {
            newContent.metadata = {
              ...(existingContent.metadata || {}),
              ...(updates.content.metadata || {}),
            };
          }

          // Update content string if provided
          if (updates.content.content !== undefined) {
            newContent.content = updates.content.content;
          }

          // Update parts if provided (only if it exists in the content type)
          if ('parts' in updates.content && updates.content.parts !== undefined) {
            (newContent as any).parts = updates.content.parts;
          }

          updatePayload.content = JSON.stringify(newContent);
        }

        // Update the message
        await this.service.entities.message.update({ entity: 'message', id }).set(updatePayload).go();

        // Get the updated message
        const updatedMessage = await this.service.entities.message.get({ entity: 'message', id }).go();
        if (updatedMessage.data) {
          updatedMessages.push(this.parseMessageData(updatedMessage.data) as MastraMessageV2);
        }
      }

      // Update timestamps for all affected threads
      for (const threadId of affectedThreadIds) {
        await this.service.entities.thread
          .update({ entity: 'thread', id: threadId })
          .set({
            updatedAt: new Date().toISOString(),
          })
          .go();
      }

      return updatedMessages;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    this.logger.debug('Getting resource by ID', { resourceId });
    try {
      const result = await this.service.entities.resource.get({ entity: 'resource', id: resourceId }).go();

      if (!result.data) {
        return null;
      }

      // ElectroDB handles the transformation with attribute getters
      const data = result.data;
      return {
        ...data,
        // Convert date strings back to Date objects for consistency
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
        // Ensure workingMemory is always returned as a string, regardless of automatic parsing
        workingMemory: typeof data.workingMemory === 'object' ? JSON.stringify(data.workingMemory) : data.workingMemory,
        // metadata is already transformed by the entity's getter
      } as StorageResourceType;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_RESOURCE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    this.logger.debug('Saving resource', { resourceId: resource.id });

    const now = new Date();

    const resourceData = {
      entity: 'resource',
      id: resource.id,
      workingMemory: resource.workingMemory,
      metadata: resource.metadata ? JSON.stringify(resource.metadata) : undefined,
      createdAt: resource.createdAt?.toISOString() || now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await this.service.entities.resource.upsert(resourceData).go();

      return {
        id: resource.id,
        workingMemory: resource.workingMemory,
        metadata: resource.metadata,
        createdAt: resource.createdAt || now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_SAVE_RESOURCE_FAILED',
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
    this.logger.debug('Updating resource', { resourceId });

    try {
      // First, get the existing resource to merge with updates
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

      const now = new Date();

      // Prepare the update
      const updateData: any = {
        updatedAt: now.toISOString(),
      };

      if (workingMemory !== undefined) {
        updateData.workingMemory = workingMemory;
      }

      if (metadata) {
        // Merge with existing metadata instead of overwriting
        const existingMetadata = existingResource.metadata || {};
        const mergedMetadata = { ...existingMetadata, ...metadata };
        updateData.metadata = JSON.stringify(mergedMetadata);
      }

      // Update the resource using the primary key
      await this.service.entities.resource.update({ entity: 'resource', id: resourceId }).set(updateData).go();

      // Return the updated resource object
      return {
        ...existingResource,
        workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
        metadata: metadata ? { ...existingResource.metadata, ...metadata } : existingResource.metadata,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_UPDATE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }
}
