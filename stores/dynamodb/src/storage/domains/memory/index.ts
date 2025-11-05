import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType, MastraMessageV1, MastraDBMessage } from '@mastra/core/memory';
import { MemoryStorage, normalizePerPage, calculatePagination } from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import type { Service } from 'electrodb';

export class MemoryStorageDynamoDB extends MemoryStorage {
  private service: Service<Record<string, any>>;
  constructor({ service }: { service: Service<Record<string, any>> }) {
    super();
    this.service = service;
  }

  // Helper function to parse message data (handle JSON fields)
  private parseMessageData(data: any): MastraDBMessage | MastraMessageV1 {
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
  private transformAndSortThreads(rawThreads: any[], field: string, direction: string): StorageThreadType[] {
    return rawThreads
      .map((data: any) => ({
        ...data,
        // Convert date strings back to Date objects for consistency
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
      }))
      .sort((a: StorageThreadType, b: StorageThreadType) => {
        const fieldA = field === 'createdAt' ? a.createdAt : a.updatedAt;
        const fieldB = field === 'createdAt' ? b.createdAt : b.updatedAt;

        const comparison = fieldA.getTime() - fieldB.getTime();
        return direction === 'DESC' ? -comparison : comparison;
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
        updatedAt: thread.updatedAt || now,
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
      // Use perPage: false to fetch ALL messages, not just the first page
      const { messages } = await this.listMessages({ threadId, perPage: false });
      if (messages.length > 0) {
        // Delete messages in batches
        const batchSize = 25; // DynamoDB batch limits
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          await Promise.all(
            batch.map((message: MastraDBMessage) =>
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

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    this.logger.debug('Getting messages by ID', { messageIds });
    if (messageIds.length === 0) return { messages: [] };

    try {
      const results = await Promise.all(
        messageIds.map(id => this.service.entities.message.query.primary({ entity: 'message', id }).go()),
      );

      const data = results.map(result => result.data).flat(1);

      let parsedMessages = data
        .map((data: any) => this.parseMessageData(data))
        .filter((msg: any): msg is MastraDBMessage => 'content' in msg);

      // Deduplicate messages by ID (like libsql)
      const uniqueMessages = parsedMessages.filter(
        (message, index, self) => index === self.findIndex(m => m.id === message.id),
      );

      const list = new MessageList().add(uniqueMessages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_LIST_MESSAGES_BY_ID_FAILED',
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
          id: 'STORAGE_DYNAMODB_LIST_MESSAGES_INVALID_THREAD_ID',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        new Error('threadId must be a non-empty string'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 40);
    // When perPage is false (get all), ignore page offset
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      if (page < 0) {
        throw new MastraError(
          {
            id: 'STORAGE_DYNAMODB_LIST_MESSAGES_INVALID_PAGE',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      this.logger.debug('Getting messages with listMessages', {
        threadId,
        resourceId,
        perPageInput,
        offset,
        perPage,
        page,
        field,
        direction,
      });

      // Step 1: Get paginated messages from the thread first (without excluding included ones)
      const query = this.service.entities.message.query.byThread({ entity: 'message', threadId });
      const results = await query.go();

      let allThreadMessages = results.data
        .map((data: any) => this.parseMessageData(data))
        .filter((msg: any): msg is MastraDBMessage => 'content' in msg && typeof msg.content === 'object');

      // Apply resourceId filter
      if (resourceId) {
        allThreadMessages = allThreadMessages.filter((msg: MastraDBMessage) => msg.resourceId === resourceId);
      }

      // Apply date range filter
      if (filter?.dateRange) {
        const dateRange = filter.dateRange;
        allThreadMessages = allThreadMessages.filter((msg: MastraDBMessage) => {
          const createdAt = new Date(msg.createdAt).getTime();
          if (dateRange.start) {
            const startTime =
              dateRange.start instanceof Date ? dateRange.start.getTime() : new Date(dateRange.start).getTime();
            if (createdAt < startTime) return false;
          }
          if (dateRange.end) {
            const endTime = dateRange.end instanceof Date ? dateRange.end.getTime() : new Date(dateRange.end).getTime();
            if (createdAt > endTime) return false;
          }
          return true;
        });
      }

      // Sort messages by the specified field and direction
      allThreadMessages.sort((a: MastraDBMessage, b: MastraDBMessage) => {
        const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        // Handle tiebreaker for stable sorting
        if (aValue === bValue) {
          return a.id.localeCompare(b.id);
        }

        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

      // Save total before pagination
      const total = allThreadMessages.length;

      // Apply pagination
      const paginatedMessages = allThreadMessages.slice(offset, offset + perPage);
      const paginatedCount = paginatedMessages.length;

      // Only return early if there are no messages AND no includes to process
      if (total === 0 && paginatedCount === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Step 2: Add included messages with context (if any), excluding duplicates
      const messageIds = new Set(paginatedMessages.map((m: MastraDBMessage) => m.id));
      let includeMessages: MastraDBMessage[] = [];

      if (include && include.length > 0) {
        // Use the existing _getIncludedMessages helper, but adapt it for listMessages format
        const selectBy = { include };
        includeMessages = await this._getIncludedMessages(threadId, selectBy);

        // Deduplicate: only add messages that aren't already in the paginated results
        for (const includeMsg of includeMessages) {
          if (!messageIds.has(includeMsg.id)) {
            paginatedMessages.push(includeMsg);
            messageIds.add(includeMsg.id);
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(paginatedMessages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output
      finalMessages = finalMessages.sort((a, b) => {
        const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        // Handle tiebreaker for stable sorting
        if (aValue === bValue) {
          return a.id.localeCompare(b.id);
        }

        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const returnedThreadMessageIds = new Set(finalMessages.filter(m => m.threadId === threadId).map(m => m.id));
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      let hasMore = false;
      if (perPageInput !== false && !allThreadMessagesReturned) {
        hasMore = offset + paginatedCount < total;
      }

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_LIST_MESSAGES_FAILED',
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

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    this.logger.debug('Saving messages', { count: messages.length });

    if (!messages.length) {
      return { messages: [] };
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

      const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
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

  public async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const { resourceId, page = 0, perPage: perPageInput, orderBy } = args;
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_LIST_THREADS_BY_RESOURCE_ID_INVALID_PAGE',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    // When perPage is false (get all), ignore page offset
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug('Getting threads by resource ID with pagination', {
      resourceId,
      page,
      perPage,
      field,
      direction,
    });

    try {
      // Query threads by resource ID using the GSI
      const query = this.service.entities.thread.query.byResource({ entity: 'thread', resourceId });

      // Get all threads for this resource ID (DynamoDB doesn't support OFFSET/LIMIT)
      const results = await query.go();

      // Use shared helper method for transformation and sorting
      const allThreads = this.transformAndSortThreads(results.data, field, direction);

      // Apply pagination in memory
      const endIndex = offset + perPage;
      const paginatedThreads = allThreads.slice(offset, endIndex);

      // Calculate pagination info
      const total = allThreads.length;
      const hasMore = offset + perPage < total;

      return {
        threads: paginatedThreads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_LIST_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId, page, perPage },
        },
        error,
      );
    }
  }

  // Helper method to get included messages with context
  private async _getIncludedMessages(threadId: string, selectBy: any): Promise<MastraDBMessage[]> {
    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

    if (!selectBy?.include?.length) {
      return [];
    }

    const includeMessages: MastraDBMessage[] = [];

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
          .filter((msg: any): msg is MastraDBMessage => 'content' in msg && typeof msg.content === 'object');

        this.logger.debug('Found messages in thread', {
          threadId: searchThreadId,
          messageCount: allMessages.length,
          messageIds: allMessages.map((m: MastraDBMessage) => m.id),
        });

        // Sort by createdAt ASC to get proper order, with ID tiebreaker for stable ordering
        allMessages.sort((a: MastraDBMessage, b: MastraDBMessage) => {
          const timeA = a.createdAt.getTime();
          const timeB = b.createdAt.getTime();
          if (timeA === timeB) {
            return a.id.localeCompare(b.id);
          }
          return timeA - timeB;
        });

        // Find the target message
        const targetIndex = allMessages.findIndex((msg: MastraDBMessage) => msg.id === id);
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
          contextIds: contextMessages.map((m: MastraDBMessage) => m.id),
        });

        includeMessages.push(...contextMessages);
      } catch (error) {
        this.logger.warn('Failed to get included message', { messageId: includeItem.id, error });
      }
    }

    this.logger.debug('Total included messages', {
      count: includeMessages.length,
      ids: includeMessages.map((m: MastraDBMessage) => m.id),
    });

    return includeMessages;
  }

  async updateMessages(args: {
    messages: Partial<Omit<MastraDBMessage, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;
    this.logger.debug('Updating messages', { count: messages.length });

    if (!messages.length) {
      return [];
    }

    const updatedMessages: MastraDBMessage[] = [];
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

        const existingMsg = this.parseMessageData(existingMessage.data) as MastraDBMessage;
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
          updatedMessages.push(this.parseMessageData(updatedMessage.data) as MastraDBMessage);
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
