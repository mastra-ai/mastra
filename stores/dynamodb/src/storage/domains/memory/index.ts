import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType, MastraMessageV1, MastraDBMessage } from '@mastra/core/memory';
import {
  createStorageErrorId,
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  storageMessageMatchesMetadataFilter,
  validateStorageMetadataFilter,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from '@mastra/core/storage';
import type { Service } from 'electrodb';
import type { ThreadEntityData, MessageEntityData, ResourceEntityData } from '../../../entities/utils';
import { resolveDynamoDBConfig } from '../../db';
import type { DynamoDBDomainConfig } from '../../db';
import type { DynamoDBTtlConfig } from '../../index';
import { getTtlProps } from '../../ttl';
import { deleteTableData } from '../utils';

export class MemoryStorageDynamoDB extends MemoryStorage {
  private service: Service<Record<string, any>>;
  private ttlConfig?: DynamoDBTtlConfig;

  constructor(config: DynamoDBDomainConfig) {
    super();
    const resolved = resolveDynamoDBConfig(config);
    this.service = resolved.service;
    this.ttlConfig = resolved.ttl;
  }

  async dangerouslyClearAll(): Promise<void> {
    await deleteTableData(this.service, TABLE_THREADS);
    await deleteTableData(this.service, TABLE_MESSAGES);
    await deleteTableData(this.service, TABLE_RESOURCES);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    this.logger.debug('Deleting messages', { count: messageIds.length });

    try {
      // Collect thread IDs to update timestamps
      const threadIds = new Set<string>();

      // Delete messages in batches of 25 (DynamoDB limit)
      const batchSize = 25;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        // Get messages to find their threadIds before deleting
        const messagesToDelete = await Promise.all(
          batch.map(async id => {
            const result = await this.service.entities.message.get({ entity: 'message', id }).go();
            return result.data;
          }),
        );

        // Collect threadIds and delete messages
        for (const message of messagesToDelete) {
          if (message) {
            if (message.threadId) {
              threadIds.add(message.threadId);
            }
            await this.service.entities.message.delete({ entity: 'message', id: message.id }).go();
          }
        }
      }

      // Update thread timestamps
      const now = new Date().toISOString();
      for (const threadId of threadIds) {
        await this.service.entities.thread.update({ entity: 'thread', id: threadId }).set({ updatedAt: now }).go();
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messageIds.length },
        },
        error,
      );
    }
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

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    this.logger.debug('Getting thread by ID', { threadId, resourceId });
    try {
      const result = await this.service.entities.thread.get({ entity: 'thread', id: threadId }).go();

      if (!result.data || (resourceId !== undefined && result.data.resourceId !== resourceId)) {
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
          id: createStorageErrorId('DYNAMODB', 'GET_THREAD_BY_ID', 'FAILED'),
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

    const threadData: ThreadEntityData = {
      entity: 'thread',
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title ?? `Thread ${thread.id}`,
      createdAt: thread.createdAt?.toISOString() || now.toISOString(),
      updatedAt: thread.updatedAt?.toISOString() || now.toISOString(),
      metadata: thread.metadata ? JSON.stringify(thread.metadata) : undefined,
      ...getTtlProps('thread', this.ttlConfig),
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
          id: createStorageErrorId('DYNAMODB', 'SAVE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('DYNAMODB', 'UPDATE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('DYNAMODB', 'DELETE_THREAD', 'FAILED'),
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
          id: createStorageErrorId('DYNAMODB', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
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
            id: createStorageErrorId('DYNAMODB', 'LIST_MESSAGES', 'INVALID_PAGE'),
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

      // When perPage is 0 with no includes, there's nothing to return.
      if (perPage === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      // When perPage is 0, we only need included messages — skip thread load entirely
      if (perPage === 0 && include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        const list = new MessageList().add(includeMessages, 'memory');
        return {
          messages: this._sortMessages(list.get.all.db(), field, direction),
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const order = direction === 'DESC' ? 'desc' : 'asc';

      const parseQueryMessages = (data: any[]): MastraDBMessage[] =>
        data
          .map((item: any) => this.parseMessageData(item))
          .filter((msg: any): msg is MastraDBMessage => 'content' in msg && typeof msg.content === 'object');

      const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : String(value));

      const applyQueryFilters = (q: any) => {
        let query = q;
        const dateRange = filter?.dateRange;
        const startIso = dateRange?.start ? toIso(dateRange.start) : undefined;
        const endIso = dateRange?.end ? toIso(dateRange.end) : undefined;
        const startExclusive = dateRange?.startExclusive ?? false;
        const endExclusive = dateRange?.endExclusive ?? false;
        const startOp = startExclusive ? 'gt' : 'gte';
        const endOp = endExclusive ? 'lt' : 'lte';

        if (startIso && endIso) {
          query = query.between({ createdAt: startIso }, { createdAt: endIso });
          if (startExclusive || endExclusive) {
            query = query.where(({ createdAt }: any, { gt, lt }: any) => {
              if (startExclusive && endExclusive) {
                return `${gt(createdAt, startIso)} AND ${lt(createdAt, endIso)}`;
              }
              if (startExclusive) {
                return gt(createdAt, startIso);
              }
              return lt(createdAt, endIso);
            });
          }
        } else if (startIso) {
          query = query[startOp]({ createdAt: startIso });
        } else if (endIso) {
          query = query[endOp]({ createdAt: endIso });
        }

        if (resourceId) {
          query = query.where(({ resourceId: rid }: any, { eq }: any) => eq(rid, resourceId));
        }

        return query;
      };

      let paginatedMessages: MastraDBMessage[] = [];
      let total = 0;
      const filteredMessageIds = new Set<string>();
      if (threadIds.length > 1 || metadataFilter) {
        // DynamoDB can't query multiple partitions in one request. For multi-thread calls,
        // fall back to per-thread fetch + merge/sort in memory to preserve correctness.
        // Metadata filters must also use the full candidate set because ElectroDB can't
        // filter nested JSON content metadata before pagination/counting.
        const threadResults = await Promise.all(
          threadIds.map(async tid => {
            const q = applyQueryFilters(
              this.service.entities.message.query.byThread({ entity: 'message', threadId: tid }),
            );
            const results = await q.go({ pages: 'all', order });
            let messages = parseQueryMessages(results.data);
            if (metadataFilter) {
              messages = messages.filter(message =>
                storageMessageMatchesMetadataFilter(message.content, metadataFilter),
              );
            }
            return { ids: messages.map(message => message.id), messages };
          }),
        );

        for (const result of threadResults) {
          for (const id of result.ids) filteredMessageIds.add(id);
        }
        total = threadResults.reduce((sum, r) => sum + r.ids.length, 0);
        const merged = threadResults.flatMap(r => r.messages);
        const sorted = this._sortMessages(merged, field, direction);
        paginatedMessages = perPageInput === false ? sorted : sorted.slice(offset, offset + perPage);
      } else {
        // Step 1: Query messages from the thread via byThread GSI (createdAt sort key).
        const baseQuery = this.service.entities.message.query.byThread({ entity: 'message', threadId: threadIds[0]! });
        const query = applyQueryFilters(baseQuery);

        // Lightweight total: id-only reads across all pages (no full message bodies).
        const countResult = await query.go({ pages: 'all', attributes: ['id'] });
        total = countResult.data.length;
        for (const item of countResult.data) filteredMessageIds.add(item.id);

        if (perPageInput === false) {
          const results = await query.go({ pages: 'all', order });
          paginatedMessages = parseQueryMessages(results.data);
        } else {
          const results = await query.go({ count: offset + perPage, order });
          paginatedMessages = parseQueryMessages(results.data).slice(offset, offset + perPage);
        }

        if (field !== 'createdAt') {
          paginatedMessages = this._sortMessages(paginatedMessages, field, direction);
        }
      }

      // Only return early if there are no messages AND no includes to process
      if (total === 0 && paginatedMessages.length === 0 && (!include || include.length === 0)) {
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
        includeMessages = await this._getIncludedMessages({ include });

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
      finalMessages = this._sortMessages(finalMessages, field, direction);

      const returnedFilteredMessageIds = new Set(
        finalMessages.filter(message => filteredMessageIds.has(message.id)).map(message => message.id),
      );
      const hasMore =
        perPageInput !== false &&
        (metadataFilter || returnedFilteredMessageIds.size < total) &&
        offset + perPage < total;

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
          id: createStorageErrorId('DYNAMODB', 'LIST_MESSAGES', 'FAILED'),
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
    const messagesToSave: MessageEntityData[] = messages.map(msg => {
      const now = new Date().toISOString();
      return {
        entity: 'message' as const,
        id: msg.id,
        threadId: msg.threadId,
        role: msg.role,
        type: msg.type,
        resourceId: msg.resourceId,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        toolCallArgs: `toolCallArgs` in msg && msg.toolCallArgs ? JSON.stringify(msg.toolCallArgs) : undefined,
        toolCallIds: `toolCallIds` in msg && msg.toolCallIds ? JSON.stringify(msg.toolCallIds) : undefined,
        toolNames: `toolNames` in msg && msg.toolNames ? JSON.stringify(msg.toolNames) : undefined,
        createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt || now,
        updatedAt: now,
        ...getTtlProps('message', this.ttlConfig),
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
          id: createStorageErrorId('DYNAMODB', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
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
          id: createStorageErrorId('DYNAMODB', 'LIST_THREADS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            page,
            ...(perPageInput !== undefined && { perPage: perPageInput }),
          },
        },
        error instanceof Error ? error : new Error('Invalid pagination parameters'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const { field, direction } = this.parseOrderBy(orderBy);

    // Log only safe fields to avoid leaking PII/secrets in metadata values
    this.logger.debug('Listing threads with filters', {
      resourceId: filter?.resourceId,
      metadataKeys: filter?.metadata ? Object.keys(filter.metadata) : [],
      page,
      perPage,
      field,
      direction,
    });

    try {
      // Fetch threads from DynamoDB
      // Use query with GSI for resourceId filtering (efficient), otherwise scan all threads
      const rawThreads = filter?.resourceId
        ? (
            await this.service.entities.thread.query
              .byResource({
                entity: 'thread',
                resourceId: filter.resourceId,
              })
              .go({ pages: 'all' })
          ).data
        : (await this.service.entities.thread.scan.go({ pages: 'all' })).data;

      // Transform threads
      let allThreads = this.transformAndSortThreads(rawThreads, field, direction);

      // Apply metadata filters if provided (AND logic)
      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        allThreads = allThreads.filter(thread => {
          // Handle both object and stringified JSON metadata
          let threadMeta: Record<string, unknown> | null = null;

          if (typeof thread.metadata === 'string') {
            try {
              threadMeta = JSON.parse(thread.metadata);
            } catch {
              return false; // Invalid JSON, exclude thread
            }
          } else if (thread.metadata && typeof thread.metadata === 'object') {
            threadMeta = thread.metadata as Record<string, unknown>;
          }

          if (!threadMeta) return false;

          // Compare metadata values using strict equality
          return Object.entries(filter.metadata!).every(([key, value]) => threadMeta![key] === value);
        });
      }

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
          id: createStorageErrorId('DYNAMODB', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!(filter?.metadata && Object.keys(filter.metadata).length),
            page,
            perPage: perPageForResponse,
          },
        },
        error,
      );
    }
  }

  // Helper method to get included messages with context
  private _sortMessages(messages: MastraDBMessage[], field: string, direction: string): MastraDBMessage[] {
    return messages.sort((a, b) => {
      const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
      const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

      if (aValue === bValue) {
        return a.id.localeCompare(b.id);
      }

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private async _getIncludedMessages({
    include,
  }: {
    include: StorageListMessagesInput['include'];
  }): Promise<MastraDBMessage[]> {
    if (!include?.length) {
      return [];
    }

    // Phase 1: Batch-fetch target message metadata in parallel.
    // This replaces sequential per-include get() + full thread load.
    const targetResults = await Promise.all(
      include.map(inc =>
        this.service.entities.message
          .get({ entity: 'message', id: inc.id })
          .go()
          .then((r: { data: any }) => ({ id: inc.id, data: r.data }))
          .catch(() => ({ id: inc.id, data: null })),
      ),
    );

    const targetMap = new Map<string, { threadId: string; createdAt: string }>();
    for (const { id, data } of targetResults) {
      if (data) {
        const createdAt =
          typeof (data as any).createdAt === 'string'
            ? (data as any).createdAt
            : new Date((data as any).createdAt).toISOString();
        targetMap.set(id, { threadId: (data as any).threadId, createdAt });
      }
    }

    if (targetMap.size === 0) return [];

    const parseQueryMessages = (data: any[]): MastraDBMessage[] =>
      data
        .map((item: any) => this.parseMessageData(item))
        .filter(
          (msg: MastraDBMessage | MastraMessageV1): msg is MastraDBMessage =>
            'content' in msg && typeof msg.content === 'object',
        );

    const includeMessages: MastraDBMessage[] = [];

    for (const includeItem of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = includeItem;
      const target = targetMap.get(id);
      if (!target) continue;

      try {
        const prevResult = await this.service.entities.message.query
          .byThread({ entity: 'message', threadId: target.threadId })
          .lte({ createdAt: target.createdAt })
          .go({ order: 'desc', count: withPreviousMessages + 1 });

        const prevMessages = parseQueryMessages(prevResult.data).reverse();
        includeMessages.push(...prevMessages);

        if (withNextMessages > 0) {
          const nextResult = await this.service.entities.message.query
            .byThread({ entity: 'message', threadId: target.threadId })
            .gt({ createdAt: target.createdAt })
            .go({ order: 'asc', count: withNextMessages });

          includeMessages.push(...parseQueryMessages(nextResult.data));
        }
      } catch {
        // Include query failed, skip this item
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return includeMessages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
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
          id: createStorageErrorId('DYNAMODB', 'UPDATE_MESSAGES', 'FAILED'),
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
          id: createStorageErrorId('DYNAMODB', 'GET_RESOURCE_BY_ID', 'FAILED'),
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

    const resourceData: ResourceEntityData = {
      entity: 'resource',
      id: resource.id,
      workingMemory: resource.workingMemory,
      metadata: resource.metadata ? JSON.stringify(resource.metadata) : undefined,
      createdAt: resource.createdAt?.toISOString() || now.toISOString(),
      updatedAt: now.toISOString(),
      ...getTtlProps('resource', this.ttlConfig),
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
          id: createStorageErrorId('DYNAMODB', 'SAVE_RESOURCE', 'FAILED'),
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
          id: createStorageErrorId('DYNAMODB', 'UPDATE_RESOURCE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
    }
  }
}
