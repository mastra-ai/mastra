import type { Connection } from '@lancedb/lancedb';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  resolveMessageLimit,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type { PaginationInfo, StorageGetMessagesArg, StorageResourceType } from '@mastra/core/storage';
import type { StoreOperationsLance } from '../operations';
import { getTableSchema, processResultWithTypeConversion } from '../utils';

export class StoreMemoryLance extends MemoryStorage {
  private client: Connection;
  private operations: StoreOperationsLance;
  constructor({ client, operations }: { client: Connection; operations: StoreOperationsLance }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.operations.load({ tableName: TABLE_THREADS, keys: { id: threadId } });

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
          id: 'LANCE_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const table = await this.client.openTable(TABLE_THREADS);
      // fetches all threads with the given resourceId
      const query = table.query().where(`\`resourceId\` = '${resourceId}'`);

      const records = await query.toArray();
      return processResultWithTypeConversion(
        records,
        await getTableSchema({ tableName: TABLE_THREADS, client: this.client }),
      ) as StorageThreadType[];
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
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
          id: 'LANCE_STORE_SAVE_THREAD_FAILED',
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
            id: 'LANCE_STORE_UPDATE_THREAD_FAILED',
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
        id: 'LANCE_STORE_UPDATE_THREAD_FAILED',
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
          id: 'LANCE_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private normalizeMessage(message: any): MastraMessageV1 | MastraMessageV2 {
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

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
    threadConfig,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      if (threadConfig) {
        throw new Error('ThreadConfig is not supported by LanceDB storage');
      }
      const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: Number.MAX_SAFE_INTEGER });
      const table = await this.client.openTable(TABLE_MESSAGES);

      let allRecords: any[] = [];

      // Handle selectBy.include for cross-thread context retrieval
      if (selectBy?.include && selectBy.include.length > 0) {
        // Get all unique thread IDs from include items
        const threadIds = [...new Set(selectBy.include.map(item => item.threadId))];

        // Fetch all messages from all relevant threads
        for (const threadId of threadIds) {
          const threadQuery = table.query().where(`thread_id = '${threadId}'`);
          let threadRecords = await threadQuery.toArray();
          allRecords.push(...threadRecords);
        }
      } else {
        // Regular single-thread query
        let query = table.query().where(`\`thread_id\` = '${threadId}'`);
        allRecords = await query.toArray();
      }

      // Sort the records chronologically
      allRecords.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB; // Ascending order
      });

      // Process the include.withPreviousMessages and include.withNextMessages if specified
      if (selectBy?.include && selectBy.include.length > 0) {
        allRecords = this.processMessagesWithContext(allRecords, selectBy.include);
      }

      // If we're fetching the last N messages, take only the last N after sorting
      if (limit !== Number.MAX_SAFE_INTEGER) {
        allRecords = allRecords.slice(-limit);
      }

      const messages = processResultWithTypeConversion(
        allRecords,
        await getTableSchema({ tableName: TABLE_MESSAGES, client: this.client }),
      );

      const list = new MessageList({ threadId, resourceId }).add(messages.map(this.normalizeMessage), 'memory');
      if (format === 'v2') return list.get.all.v2();
      return list.get.all.v1();
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const table = await this.client.openTable(TABLE_MESSAGES);

      const quotedIds = messageIds.map(id => `'${id}'`).join(', ');
      const allRecords = await table.query().where(`id IN (${quotedIds})`).toArray();

      const messages = processResultWithTypeConversion(
        allRecords,
        await getTableSchema({ tableName: TABLE_MESSAGES, client: this.client }),
      );

      const list = new MessageList().add(messages.map(this.normalizeMessage), 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_MESSAGES_BY_ID_FAILED',
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

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    try {
      const { messages, format = 'v1' } = args;
      if (messages.length === 0) {
        return [];
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

      const transformedMessages = messages.map((message: MastraMessageV2 | MastraMessageV1) => {
        const { threadId, type, ...rest } = message;
        return {
          ...rest,
          thread_id: threadId,
          type: type ?? 'v2',
          content: JSON.stringify(message.content),
        };
      });

      const table = await this.client.openTable(TABLE_MESSAGES);
      await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(transformedMessages);

      // Update the thread's updatedAt timestamp
      const threadsTable = await this.client.openTable(TABLE_THREADS);
      const currentTime = new Date().getTime();
      const updateRecord = { id: threadId, updatedAt: currentTime };
      await threadsTable.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([updateRecord]);

      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    try {
      const { resourceId, page = 0, perPage = 10 } = args;
      const table = await this.client.openTable(TABLE_THREADS);

      // Get total count
      const total = await table.countRows(`\`resourceId\` = '${resourceId}'`);

      // Get paginated results
      const query = table.query().where(`\`resourceId\` = '${resourceId}'`);
      const offset = page * perPage;
      query.limit(perPage);
      if (offset > 0) {
        query.offset(offset);
      }

      const records = await query.toArray();

      // Sort by updatedAt descending (most recent first)
      records.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const schema = await getTableSchema({ tableName: TABLE_THREADS, client: this.client });
      const threads = records.map(record => processResultWithTypeConversion(record, schema)) as StorageThreadType[];

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: total > (page + 1) * perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
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

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    try {
      const { threadId, resourceId, selectBy, format = 'v1' } = args;

      if (!threadId) {
        throw new Error('Thread ID is required for getMessagesPaginated');
      }

      // Extract pagination and dateRange from selectBy.pagination
      const page = selectBy?.pagination?.page ?? 0;
      const perPage = selectBy?.pagination?.perPage ?? 10;
      const dateRange = selectBy?.pagination?.dateRange;
      const fromDate = dateRange?.start;
      const toDate = dateRange?.end;

      const table = await this.client.openTable(TABLE_MESSAGES);
      const messages: any[] = [];

      // Handle selectBy.include first (before pagination)
      if (selectBy?.include && Array.isArray(selectBy.include)) {
        // Get all unique thread IDs from include items
        const threadIds = [...new Set(selectBy.include.map(item => item.threadId))];

        // Fetch all messages from all relevant threads
        const allThreadMessages: any[] = [];
        for (const threadId of threadIds) {
          const threadQuery = table.query().where(`thread_id = '${threadId}'`);
          let threadRecords = await threadQuery.toArray();

          // Apply date filtering in JS for context
          if (fromDate) threadRecords = threadRecords.filter(m => m.createdAt >= fromDate.getTime());
          if (toDate) threadRecords = threadRecords.filter(m => m.createdAt <= toDate.getTime());

          allThreadMessages.push(...threadRecords);
        }

        // Sort all messages by createdAt
        allThreadMessages.sort((a, b) => a.createdAt - b.createdAt);

        // Apply processMessagesWithContext to the combined array
        const contextMessages = this.processMessagesWithContext(allThreadMessages, selectBy.include);
        messages.push(...contextMessages);
      }

      // Build query conditions for the main thread
      const conditions: string[] = [`thread_id = '${threadId}'`];
      if (resourceId) {
        conditions.push(`\`resourceId\` = '${resourceId}'`);
      }
      if (fromDate) {
        conditions.push(`\`createdAt\` >= ${fromDate.getTime()}`);
      }
      if (toDate) {
        conditions.push(`\`createdAt\` <= ${toDate.getTime()}`);
      }

      // Get total count (excluding already included messages)
      let total = 0;
      if (conditions.length > 0) {
        total = await table.countRows(conditions.join(' AND '));
      } else {
        total = await table.countRows();
      }

      // If no messages and no included messages, return empty result
      if (total === 0 && messages.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Fetch paginated messages (excluding already included ones)
      const excludeIds = messages.map(m => m.id);
      let selectedMessages: any[] = [];

      if (selectBy?.last && selectBy.last > 0) {
        // Handle selectBy.last: get last N messages for the main thread
        const query = table.query();
        if (conditions.length > 0) {
          query.where(conditions.join(' AND '));
        }
        let records = await query.toArray();
        records = records.sort((a, b) => a.createdAt - b.createdAt);

        // Exclude already included messages
        if (excludeIds.length > 0) {
          records = records.filter(m => !excludeIds.includes(m.id));
        }

        selectedMessages = records.slice(-selectBy.last);
      } else {
        // Regular pagination
        const query = table.query();
        if (conditions.length > 0) {
          query.where(conditions.join(' AND '));
        }
        let records = await query.toArray();
        records = records.sort((a, b) => a.createdAt - b.createdAt);

        // Exclude already included messages
        if (excludeIds.length > 0) {
          records = records.filter(m => !excludeIds.includes(m.id));
        }

        selectedMessages = records.slice(page * perPage, (page + 1) * perPage);
      }

      // Merge all messages and deduplicate
      const allMessages = [...messages, ...selectedMessages];
      const seen = new Set();
      const dedupedMessages = allMessages.filter(m => {
        const key = `${m.id}:${m.thread_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Convert to correct format (v1/v2)
      const formattedMessages = dedupedMessages.map((msg: any) => {
        const { thread_id, ...rest } = msg;
        return {
          ...rest,
          threadId: thread_id,
          content:
            typeof msg.content === 'string'
              ? (() => {
                  try {
                    return JSON.parse(msg.content);
                  } catch {
                    return msg.content;
                  }
                })()
              : msg.content,
        };
      });

      const list = new MessageList().add(formattedMessages, 'memory');
      return {
        messages: format === 'v2' ? list.get.all.v2() : list.get.all.v1(),
        total: total, // Total should be the count of messages matching the filters
        page,
        perPage,
        hasMore: total > (page + 1) * perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Parse message data from LanceDB record format to MastraMessageV2 format
   */
  private parseMessageData(data: any): MastraMessageV2 {
    const { thread_id, ...rest } = data;
    return {
      ...rest,
      threadId: thread_id,
      content:
        typeof data.content === 'string'
          ? (() => {
              try {
                return JSON.parse(data.content);
              } catch {
                return data.content;
              }
            })()
          : data.content,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    } as MastraMessageV2;
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
        const existingMessage = await this.operations.load({ tableName: TABLE_MESSAGES, keys: { id } });
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
        await this.operations.insert({ tableName: TABLE_MESSAGES, record: { id, ...updatePayload } });

        // Get the updated message
        const updatedMessage = await this.operations.load({ tableName: TABLE_MESSAGES, keys: { id } });
        if (updatedMessage) {
          updatedMessages.push(this.parseMessageData(updatedMessage));
        }
      }

      // Update timestamps for all affected threads
      for (const threadId of affectedThreadIds) {
        await this.operations.insert({
          tableName: TABLE_THREADS,
          record: { id: threadId, updatedAt: Date.now() },
        });
      }

      return updatedMessages;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_UPDATE_MESSAGES_FAILED',
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
      const resource = await this.operations.load({ tableName: TABLE_RESOURCES, keys: { id: resourceId } });

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
          id: 'LANCE_STORE_GET_RESOURCE_BY_ID_FAILED',
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
          id: 'LANCE_STORE_SAVE_RESOURCE_FAILED',
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
            id: 'LANCE_STORE_UPDATE_RESOURCE_FAILED',
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
