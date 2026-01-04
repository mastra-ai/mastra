import type { Connection } from '@lancedb/lancedb';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  createStorageErrorId,
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import { LanceDB, resolveLanceConfig } from '../../db';
import type { LanceDomainConfig } from '../../db';
import { getTableSchema, processResultWithTypeConversion } from '../../db/utils';

export class StoreMemoryLance extends MemoryStorage {
  private client: Connection;
  #db: LanceDB;

  constructor(config: LanceDomainConfig) {
    super();
    const client = resolveLanceConfig(config);
    this.client = client;
    this.#db = new LanceDB({ client });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.#db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.#db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });
    // Add resourceId and metadataJson columns for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId', 'metadataJson'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_THREADS });
    await this.#db.clearTable({ tableName: TABLE_MESSAGES });
    await this.#db.clearTable({ tableName: TABLE_RESOURCES });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    this.logger.debug('Deleting messages', { count: messageIds.length });

    try {
      // Collect thread IDs to update timestamps
      const threadIds = new Set<string>();

      // Get messages to find their threadIds before deleting
      for (const messageId of messageIds) {
        const message = await this.#db.load({ tableName: TABLE_MESSAGES, keys: { id: messageId } });
        if (message?.thread_id) {
          threadIds.add(message.thread_id);
        }
      }

      // Delete messages
      const messagesTable = await this.client.openTable(TABLE_MESSAGES);
      const idConditions = messageIds.map(id => `id = '${this.escapeSql(id)}'`).join(' OR ');
      await messagesTable.delete(idConditions);

      // Update thread timestamps using mergeInsert
      const now = new Date().getTime();
      const threadsTable = await this.client.openTable(TABLE_THREADS);
      for (const threadId of threadIds) {
        const thread = await this.getThreadById({ threadId });
        if (thread) {
          const record = {
            id: threadId,
            resourceId: thread.resourceId,
            title: thread.title,
            metadata: JSON.stringify(thread.metadata),
            createdAt: new Date(thread.createdAt).getTime(),
            updatedAt: now,
          };
          await threadsTable.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([record]);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messageIds.length },
        },
        error,
      );
    }
  }

  // Utility to escape single quotes in SQL strings
  private escapeSql(str: string): string {
    return str.replace(/'/g, "''");
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.#db.load({ tableName: TABLE_THREADS, keys: { id: threadId } });

      if (!thread) {
        return null;
      }

      return {
        ...thread,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'GET_THREAD_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Saves a thread to the database. This function doesn't overwrite existing threads.
   * @param thread - The thread to save
   * @returns The saved thread
   */
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const record = { ...thread, metadata: JSON.stringify(thread.metadata) };
      const table = await this.client.openTable(TABLE_THREADS);
      await table.add([record], { mode: 'append' });

      return thread;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'SAVE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current state atomically
        const current = await this.getThreadById({ threadId: id });
        if (!current) {
          throw new Error(`Thread with id ${id} not found`);
        }

        // Merge metadata
        const mergedMetadata = { ...current.metadata, ...metadata };

        // Update atomically
        const record = {
          id,
          title,
          metadata: JSON.stringify(mergedMetadata),
          updatedAt: new Date().getTime(),
        };

        const table = await this.client.openTable(TABLE_THREADS);
        await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([record]);

        const updatedThread = await this.getThreadById({ threadId: id });
        if (!updatedThread) {
          throw new Error(`Failed to retrieve updated thread ${id}`);
        }
        return updatedThread;
      } catch (error: any) {
        if (error.message?.includes('Commit conflict') && attempt < maxRetries - 1) {
          // Wait with exponential backoff before retrying
          const delay = Math.pow(2, attempt) * 10; // 10ms, 20ms, 40ms
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If it's not a commit conflict or we've exhausted retries, throw the error
        throw new MastraError(
          {
            id: createStorageErrorId('LANCE', 'UPDATE_THREAD', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
          },
          error,
        );
      }
    }

    // This should never be reached, but just in case
    throw new MastraError(
      {
        id: createStorageErrorId('LANCE', 'UPDATE_THREAD', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
      },
      new Error('All retries exhausted'),
    );
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // Delete the thread
      const table = await this.client.openTable(TABLE_THREADS);
      await table.delete(`id = '${threadId}'`);

      // Delete all messages with the matching thread_id
      const messagesTable = await this.client.openTable(TABLE_MESSAGES);
      await messagesTable.delete(`thread_id = '${threadId}'`);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private normalizeMessage(message: any): MastraMessageV1 | MastraDBMessage {
    const { thread_id, ...rest } = message;
    return {
      ...rest,
      threadId: thread_id,
      content:
        typeof message.content === 'string'
          ? (() => {
              try {
                return JSON.parse(message.content);
              } catch {
                return message.content;
              }
            })()
          : message.content,
    };
  }

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    try {
      const table = await this.client.openTable(TABLE_MESSAGES);

      const quotedIds = messageIds.map(id => `'${id}'`).join(', ');
      const allRecords = await table.query().where(`id IN (${quotedIds})`).toArray();

      const messages = processResultWithTypeConversion(
        allRecords,
        await getTableSchema({ tableName: TABLE_MESSAGES, client: this.client }),
      );

      const list = new MessageList().add(
        messages.map(this.normalizeMessage) as (MastraMessageV1 | MastraDBMessage)[],
        'memory',
      );
      return { messages: list.get.all.db() };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_MESSAGES_BY_ID', 'FAILED'),
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
          id: createStorageErrorId('LANCE', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
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
            id: createStorageErrorId('LANCE', 'LIST_MESSAGES', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      const table = await this.client.openTable(TABLE_MESSAGES);

      // Build query conditions for multiple threads
      const threadCondition =
        threadIds.length === 1
          ? `thread_id = '${this.escapeSql(threadIds[0]!)}'`
          : `thread_id IN (${threadIds.map(t => `'${this.escapeSql(t)}'`).join(', ')})`;
      const conditions: string[] = [threadCondition];

      if (resourceId) {
        conditions.push(`\`resourceId\` = '${this.escapeSql(resourceId)}'`);
      }

      if (filter?.dateRange?.start) {
        const startTime =
          filter.dateRange.start instanceof Date
            ? filter.dateRange.start.getTime()
            : new Date(filter.dateRange.start).getTime();
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`\`createdAt\` ${startOp} ${startTime}`);
      }

      if (filter?.dateRange?.end) {
        const endTime =
          filter.dateRange.end instanceof Date
            ? filter.dateRange.end.getTime()
            : new Date(filter.dateRange.end).getTime();
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`\`createdAt\` ${endOp} ${endTime}`);
      }

      const whereClause = conditions.join(' AND ');

      // Step 1: Get paginated messages from the thread first (without excluding included ones)
      const query = table.query().where(whereClause);
      let allRecords = await query.toArray();

      // Apply metadata filter (post-fetch since LanceDB doesn't have native JSON query support)
      if (filter?.metadata != null && Object.keys(filter.metadata).length > 0) {
        allRecords = allRecords.filter((record: any) => {
          let metadata = record.metadataJson;
          if (!metadata) return false;
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch {
              return false;
            }
          }
          for (const [key, value] of Object.entries(filter.metadata!)) {
            if (metadata[key] !== value) return false;
          }
          return true;
        });
      }

      // Get total count after filtering
      const total = allRecords.length;

      // Sort records
      allRecords.sort((a, b) => {
        const aValue = field === 'createdAt' ? a.createdAt : a[field];
        const bValue = field === 'createdAt' ? b.createdAt : b[field];

        // Handle null/undefined - treat as "smallest" values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === 'ASC' ? -1 : 1;
        if (bValue == null) return direction === 'ASC' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return direction === 'ASC' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

      // Apply pagination
      const paginatedRecords = allRecords.slice(offset, offset + perPage);
      const messages: any[] = paginatedRecords.map((row: any) => this.normalizeMessage(row));

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
        // Get all unique thread IDs from include items
        const threadIds = [...new Set(include.map(item => item.threadId || threadId))];

        // Fetch all messages from all relevant threads
        const allThreadMessages: any[] = [];
        for (const tid of threadIds) {
          const threadQuery = table.query().where(`thread_id = '${tid}'`);
          let threadRecords = await threadQuery.toArray();
          allThreadMessages.push(...threadRecords);
        }

        // Sort all messages by createdAt
        allThreadMessages.sort((a, b) => a.createdAt - b.createdAt);

        // Apply processMessagesWithContext to get included messages with context
        const contextMessages = this.processMessagesWithContext(allThreadMessages, include);
        const includedMessages = contextMessages.map((row: any) => this.normalizeMessage(row));

        // Deduplicate: only add messages that aren't already in the paginated results
        for (const includeMsg of includedMessages) {
          if (!messageIds.has(includeMsg.id)) {
            messages.push(includeMsg);
            messageIds.add(includeMsg.id);
          }
        }
      }

      // Use MessageList for proper deduplication and format conversion to V2
      const list = new MessageList().add(messages, 'memory');
      let finalMessages = list.get.all.db();

      // Sort all messages (paginated + included) for final output
      finalMessages = finalMessages.sort((a, b) => {
        const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        // Handle null/undefined - treat as "smallest" values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === 'ASC' ? -1 : 1;
        if (bValue == null) return direction === 'ASC' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return direction === 'ASC' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const returnedThreadMessageIds = new Set(finalMessages.filter(m => m.threadId === threadId).map(m => m.id));
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const fetchedAll = perPageInput === false || allThreadMessagesReturned;
      const hasMore = !fetchedAll && offset + perPage < total;

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
          id: createStorageErrorId('LANCE', 'LIST_MESSAGES', 'FAILED'),
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
    try {
      const { messages } = args;
      if (messages.length === 0) {
        return { messages: [] };
      }

      const threadId = messages[0]?.threadId;

      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      // Validate all messages before saving
      for (const message of messages) {
        if (!message.id) {
          throw new Error('Message ID is required');
        }
        if (!message.threadId) {
          throw new Error('Thread ID is required for all messages');
        }
        if (message.resourceId === null || message.resourceId === undefined) {
          throw new Error('Resource ID cannot be null or undefined');
        }
        if (!message.content) {
          throw new Error('Message content is required');
        }
      }

      const transformedMessages = messages.map((message: MastraDBMessage | MastraMessageV1) => {
        const { threadId, type, ...rest } = message;
        // Extract metadata for the metadataJson column (for JSON filtering)
        let metadataJson: Record<string, unknown> | null = null;
        if ('content' in message && typeof message.content === 'object' && message.content !== null) {
          const content = message.content as { metadata?: Record<string, unknown> };
          if (content.metadata) {
            metadataJson = content.metadata;
          }
        }
        return {
          ...rest,
          thread_id: threadId,
          type: type ?? 'v2',
          content: JSON.stringify(message.content),
          metadataJson: metadataJson ? JSON.stringify(metadataJson) : null,
        };
      });

      const table = await this.client.openTable(TABLE_MESSAGES);
      await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(transformedMessages);

      // Update the thread's updatedAt timestamp
      const threadsTable = await this.client.openTable(TABLE_THREADS);
      const currentTime = new Date().getTime();
      const updateRecord = { id: threadId, updatedAt: currentTime };
      await threadsTable.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([updateRecord]);

      const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const perPage = normalizePerPage(perPageInput, 100);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('LANCE', 'LIST_THREADS_BY_RESOURCE_ID', 'INVALID_PAGE'),
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
      const table = await this.client.openTable(TABLE_THREADS);

      // Get total count
      const total = await table.countRows(`\`resourceId\` = '${this.escapeSql(resourceId)}'`);

      // Get ALL matching records (no limit/offset yet - need to sort first)
      const query = table.query().where(`\`resourceId\` = '${this.escapeSql(resourceId)}'`);
      const records = await query.toArray();

      // Apply dynamic sorting BEFORE pagination
      records.sort((a, b) => {
        const aValue = ['createdAt', 'updatedAt'].includes(field) ? new Date(a[field]).getTime() : a[field];
        const bValue = ['createdAt', 'updatedAt'].includes(field) ? new Date(b[field]).getTime() : b[field];

        // Handle null/undefined - treat as "smallest" values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === 'ASC' ? -1 : 1;
        if (bValue == null) return direction === 'ASC' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return direction === 'ASC' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      });

      // Apply pagination AFTER sorting
      const paginatedRecords = records.slice(offset, offset + perPage);

      const schema = await getTableSchema({ tableName: TABLE_THREADS, client: this.client });
      const threads = paginatedRecords.map(record =>
        processResultWithTypeConversion(record, schema),
      ) as StorageThreadType[];

      return {
        threads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: offset + perPage < total,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Processes messages to include context messages based on withPreviousMessages and withNextMessages
   * @param records - The sorted array of records to process
   * @param include - The array of include specifications with context parameters
   * @returns The processed array with context messages included
   */
  private processMessagesWithContext(
    records: any[],
    include: { id: string; withPreviousMessages?: number; withNextMessages?: number }[],
  ): any[] {
    const messagesWithContext = include.filter(item => item.withPreviousMessages || item.withNextMessages);

    if (messagesWithContext.length === 0) {
      return records;
    }

    // Create a map of message id to index in the sorted array for quick lookup
    const messageIndexMap = new Map<string, number>();
    records.forEach((message, index) => {
      messageIndexMap.set(message.id, index);
    });

    // Keep track of additional indices to include
    const additionalIndices = new Set<number>();

    for (const item of messagesWithContext) {
      const messageIndex = messageIndexMap.get(item.id);

      if (messageIndex !== undefined) {
        // Add previous messages if requested
        if (item.withPreviousMessages) {
          const startIdx = Math.max(0, messageIndex - item.withPreviousMessages);
          for (let i = startIdx; i < messageIndex; i++) {
            additionalIndices.add(i);
          }
        }

        // Add next messages if requested
        if (item.withNextMessages) {
          const endIdx = Math.min(records.length - 1, messageIndex + item.withNextMessages);
          for (let i = messageIndex + 1; i <= endIdx; i++) {
            additionalIndices.add(i);
          }
        }
      }
    }

    // If we need to include additional messages, create a new set of records
    if (additionalIndices.size === 0) {
      return records;
    }

    // Get IDs of the records that matched the original query
    const originalMatchIds = new Set(include.map(item => item.id));

    // Create a set of all indices we need to include
    const allIndices = new Set<number>();

    // Add indices of originally matched messages
    records.forEach((record, index) => {
      if (originalMatchIds.has(record.id)) {
        allIndices.add(index);
      }
    });

    // Add the additional context message indices
    additionalIndices.forEach(index => {
      allIndices.add(index);
    });

    // Create a new filtered array with only the required messages
    // while maintaining chronological order
    return Array.from(allIndices)
      .sort((a, b) => a - b)
      .map(index => records[index]);
  }

  /**
   * Parse message data from LanceDB record format to MastraDBMessage format
   */
  private parseMessageData(data: any): MastraDBMessage {
    const { thread_id, metadataJson, ...rest } = data;
    let content =
      typeof data.content === 'string'
        ? (() => {
            try {
              return JSON.parse(data.content);
            } catch {
              return data.content;
            }
          })()
        : data.content;

    // If metadataJson is available, use it as the authoritative source for metadata
    // This enables efficient JSON filtering while maintaining backwards compatibility
    if (metadataJson && typeof content === 'object') {
      let parsedMetadataJson = metadataJson;
      if (typeof metadataJson === 'string') {
        try {
          parsedMetadataJson = JSON.parse(metadataJson);
        } catch {
          // use as is if parsing fails
        }
      }
      content = {
        ...content,
        metadata: parsedMetadataJson,
      };
    }

    return {
      ...rest,
      threadId: thread_id,
      content,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    } as MastraDBMessage;
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
        const existingMessage = await this.#db.load({ tableName: TABLE_MESSAGES, keys: { id } });
        if (!existingMessage) {
          this.logger.warn('Message not found for update', { id });
          continue;
        }

        const existingMsg = this.parseMessageData(existingMessage);
        const originalThreadId = existingMsg.threadId;
        affectedThreadIds.add(originalThreadId!);

        // Prepare the update payload
        const updatePayload: any = {};

        // Handle basic field updates
        if ('role' in updates && updates.role !== undefined) updatePayload.role = updates.role;
        if ('type' in updates && updates.type !== undefined) updatePayload.type = updates.type;
        if ('resourceId' in updates && updates.resourceId !== undefined) updatePayload.resourceId = updates.resourceId;
        if ('threadId' in updates && updates.threadId !== undefined && updates.threadId !== null) {
          updatePayload.thread_id = updates.threadId;
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
            // Sync metadataJson column for JSON filtering
            updatePayload.metadataJson = JSON.stringify(newContent.metadata);
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

        // Update the message using merge insert
        await this.#db.insert({ tableName: TABLE_MESSAGES, record: { id, ...updatePayload } });

        // Get the updated message
        const updatedMessage = await this.#db.load({ tableName: TABLE_MESSAGES, keys: { id } });
        if (updatedMessage) {
          updatedMessages.push(this.parseMessageData(updatedMessage));
        }
      }

      // Update timestamps for all affected threads
      for (const threadId of affectedThreadIds) {
        await this.#db.insert({
          tableName: TABLE_THREADS,
          record: { id: threadId, updatedAt: Date.now() },
        });
      }

      return updatedMessages;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'UPDATE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: messages.length },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const resource = await this.#db.load({ tableName: TABLE_RESOURCES, keys: { id: resourceId } });

      if (!resource) {
        return null;
      }

      // Handle date conversion - LanceDB stores timestamps as numbers
      let createdAt: Date;
      let updatedAt: Date;

      // Convert ISO strings back to Date objects with error handling
      try {
        // If createdAt is already a Date object, use it directly
        if (resource.createdAt instanceof Date) {
          createdAt = resource.createdAt;
        } else if (typeof resource.createdAt === 'string') {
          // If it's an ISO string, parse it
          createdAt = new Date(resource.createdAt);
        } else if (typeof resource.createdAt === 'number') {
          // If it's a timestamp, convert it to Date
          createdAt = new Date(resource.createdAt);
        } else {
          // If it's null or undefined, use current date
          createdAt = new Date();
        }
        if (isNaN(createdAt.getTime())) {
          createdAt = new Date(); // Fallback to current date if invalid
        }
      } catch {
        createdAt = new Date(); // Fallback to current date if conversion fails
      }

      try {
        // If updatedAt is already a Date object, use it directly
        if (resource.updatedAt instanceof Date) {
          updatedAt = resource.updatedAt;
        } else if (typeof resource.updatedAt === 'string') {
          // If it's an ISO string, parse it
          updatedAt = new Date(resource.updatedAt);
        } else if (typeof resource.updatedAt === 'number') {
          // If it's a timestamp, convert it to Date
          updatedAt = new Date(resource.updatedAt);
        } else {
          // If it's null or undefined, use current date
          updatedAt = new Date();
        }
        if (isNaN(updatedAt.getTime())) {
          updatedAt = new Date(); // Fallback to current date if invalid
        }
      } catch {
        updatedAt = new Date(); // Fallback to current date if conversion fails
      }

      // Handle workingMemory - return undefined for null/undefined, empty string for empty string
      let workingMemory = resource.workingMemory;
      if (workingMemory === null || workingMemory === undefined) {
        workingMemory = undefined;
      } else if (workingMemory === '') {
        workingMemory = ''; // Return empty string for empty strings to match test expectations
      } else if (typeof workingMemory === 'object') {
        workingMemory = JSON.stringify(workingMemory);
      }

      // Handle metadata - return undefined for empty strings, parse JSON safely
      let metadata = resource.metadata;
      if (metadata === '' || metadata === null || metadata === undefined) {
        metadata = undefined;
      } else if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          // If JSON parsing fails, return the original string
          metadata = metadata;
        }
      }

      return {
        ...resource,
        createdAt,
        updatedAt,
        workingMemory,
        metadata,
      } as StorageResourceType;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'GET_RESOURCE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      const record = {
        ...resource,
        metadata: resource.metadata ? JSON.stringify(resource.metadata) : '',
        createdAt: resource.createdAt.getTime(), // Store as timestamp (milliseconds)
        updatedAt: resource.updatedAt.getTime(), // Store as timestamp (milliseconds)
      };

      const table = await this.client.openTable(TABLE_RESOURCES);
      await table.add([record], { mode: 'append' });

      return resource;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'SAVE_RESOURCE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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

        const record = {
          id: resourceId,
          workingMemory: updatedResource.workingMemory || '',
          metadata: updatedResource.metadata ? JSON.stringify(updatedResource.metadata) : '',
          updatedAt: updatedResource.updatedAt.getTime(), // Store as timestamp (milliseconds)
        };

        const table = await this.client.openTable(TABLE_RESOURCES);
        await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([record]);

        return updatedResource;
      } catch (error: any) {
        if (error.message?.includes('Commit conflict') && attempt < maxRetries - 1) {
          // Wait with exponential backoff before retrying
          const delay = Math.pow(2, attempt) * 10; // 10ms, 20ms, 40ms
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If it's not a commit conflict or we've exhausted retries, throw the error
        throw new MastraError(
          {
            id: createStorageErrorId('LANCE', 'UPDATE_RESOURCE', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
          },
          error,
        );
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of retry loop');
  }
}
