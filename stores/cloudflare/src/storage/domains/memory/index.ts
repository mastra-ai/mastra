import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '@mastra/core/storage';
import {
  createStorageErrorId,
  ensureDate,
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  serializeDate,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type { StoreOperationsCloudflare } from '../operations';

export class MemoryStorageCloudflare extends MemoryStorage {
  operations: StoreOperationsCloudflare;
  constructor({ operations }: { operations: StoreOperationsCloudflare }) {
    super();
    this.operations = operations;
  }

  private ensureMetadata(metadata: Record<string, unknown> | string | undefined): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    return typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  }

  /**
   * Summarizes message content without exposing raw data (for logging).
   * Returns type, length, and keys only to prevent PII leakage.
   */
  private summarizeMessageContent(content: unknown): { type: string; length?: number; keys?: string[] } {
    if (!content) return { type: 'undefined' };
    if (typeof content === 'string') return { type: 'string', length: content.length };
    if (Array.isArray(content)) return { type: 'array', length: content.length };
    if (typeof content === 'object') return { type: 'object', keys: Object.keys(content) };
    return { type: typeof content };
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.operations.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId } });
    if (!thread) return null;

    try {
      return {
        ...thread,
        createdAt: ensureDate(thread.createdAt)!,
        updatedAt: ensureDate(thread.updatedAt)!,
        metadata: this.ensureMetadata(thread.metadata),
      };
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_THREAD_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return null;
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
            id: createStorageErrorId('CLOUDFLARE', 'LIST_THREADS_BY_RESOURCE_ID', 'INVALID_PAGE'),
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

      // List all keys in the threads table
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const keyObjs = await this.operations.listKV(TABLE_THREADS, { prefix: `${prefix}${TABLE_THREADS}` });

      const threads: StorageThreadType[] = [];

      for (const { name: key } of keyObjs) {
        const data = await this.operations.getKV(TABLE_THREADS, key);
        if (!data) continue;

        // Filter by resourceId
        if (data.resourceId !== resourceId) continue;

        threads.push(data);
      }

      // Apply dynamic sorting
      threads.sort((a, b) => {
        const aTime = new Date(a[field] || 0).getTime();
        const bTime = new Date(b[field] || 0).getTime();
        return direction === 'ASC' ? aTime - bTime : bTime - aTime;
      });

      // Apply pagination
      const end = perPageInput === false ? threads.length : offset + perPage;
      const paginatedThreads = threads.slice(offset, end);

      return {
        page,
        perPage: perPageForResponse,
        total: threads.length,
        hasMore: perPageInput === false ? false : offset + perPage < threads.length,
        threads: paginatedThreads,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to get threads by resource ID with pagination',
        },
        error,
      );
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.operations.insert({ tableName: TABLE_THREADS, record: thread });
      return thread;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'SAVE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id,
          },
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
    try {
      const thread = await this.getThreadById({ threadId: id });
      if (!thread) {
        throw new Error(`Thread ${id} not found`);
      }

      const updatedThread = {
        ...thread,
        title,
        metadata: this.ensureMetadata({
          ...(thread.metadata ?? {}),
          ...metadata,
        }),
        updatedAt: new Date(),
      };

      // Insert with proper metadata handling
      await this.operations.insert({ tableName: TABLE_THREADS, record: updatedThread });
      return updatedThread;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'UPDATE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
            title,
          },
        },
        error,
      );
    }
  }

  private getMessageKey(threadId: string, messageId: string): string {
    try {
      return this.operations.getKey(TABLE_MESSAGES, { threadId, id: messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Error getting message key for thread ${threadId} and message ${messageId}:`, { message });
      throw error;
    }
  }

  private getThreadMessagesKey(threadId: string): string {
    try {
      return this.operations.getKey(TABLE_MESSAGES, { threadId, id: 'messages' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Error getting thread messages key for thread ${threadId}:`, { message });
      throw error;
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // Verify thread exists
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      // Get all message keys for this thread first
      const messageKeys = await this.operations.listKV(TABLE_MESSAGES);
      const threadMessageKeys = messageKeys.filter(key => key.name.includes(`${TABLE_MESSAGES}:${threadId}:`));

      // Delete all messages and their order atomically
      await Promise.all([
        // Delete message order
        this.operations.deleteKV(TABLE_MESSAGES, this.getThreadMessagesKey(threadId)),
        // Delete all messages
        ...threadMessageKeys.map(key => this.operations.deleteKV(TABLE_MESSAGES, key.name)),
        // Delete thread
        this.operations.deleteKV(TABLE_THREADS, this.operations.getKey(TABLE_THREADS, { id: threadId })),
      ]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'DELETE_THREAD', 'FAILED'),
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
   * Searches all threads in the KV store to find a message by its ID.
   *
   * **Performance Warning**: This method sequentially scans all threads to locate
   * the message. For stores with many threads, this can result in significant
   * latency and API calls. When possible, callers should provide the `threadId`
   * directly to avoid this full scan.
   *
   * @param messageId - The globally unique message ID to search for
   * @returns The message with its threadId if found, null otherwise
   */
  private async findMessageInAnyThread(messageId: string): Promise<MastraMessageV1 | null> {
    try {
      // List all threads to search for the message
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const threadKeys = await this.operations.listKV(TABLE_THREADS, { prefix: `${prefix}${TABLE_THREADS}` });

      for (const { name: threadKey } of threadKeys) {
        const threadId = threadKey.split(':').pop();
        if (!threadId || threadId === 'messages') continue;

        const messageKey = this.getMessageKey(threadId, messageId);
        const message = await this.operations.getKV(TABLE_MESSAGES, messageKey);
        if (message) {
          // Ensure the message has the correct threadId
          return { ...message, threadId };
        }
      }
      return null;
    } catch (error) {
      this.logger?.error(`Error finding message ${messageId} in any thread:`, error);
      return null;
    }
  }

  /**
   * Queue for serializing sorted order updates.
   * Updates the sorted order for a given key. This operation is eventually consistent.
   */
  private updateQueue = new Map<string, Promise<void>>();

  private async updateSorting(threadMessages: (MastraDBMessage & { _index?: number })[]) {
    // Sort messages by index or timestamp
    return threadMessages
      .map(msg => ({
        message: msg,
        // Use _index if available, otherwise timestamp, matching Upstash
        score: msg._index !== undefined ? msg._index : msg.createdAt.getTime(),
      }))
      .sort((a, b) => a.score - b.score)
      .map(item => ({
        id: item.message.id,
        score: item.score,
      }));
  }

  /**
   * Updates the sorted order for a given key. This operation is eventually consistent.
   * Note: Operations on the same orderKey are serialized using a queue to prevent
   * concurrent updates from conflicting with each other.
   */
  private async updateSortedMessages(
    orderKey: string,
    newEntries: Array<{ id: string; score: number }>,
  ): Promise<void> {
    // Get the current promise chain or create a new one
    const currentPromise = this.updateQueue.get(orderKey) || Promise.resolve();

    // Create the next promise in the chain
    const nextPromise = currentPromise.then(async () => {
      try {
        const currentOrder = await this.getSortedMessages(orderKey);

        // Create a map for faster lookups
        const orderMap = new Map(currentOrder.map(entry => [entry.id, entry]));

        // Update or add new entries
        for (const entry of newEntries) {
          orderMap.set(entry.id, entry);
        }

        // Convert back to array and sort
        const updatedOrder = Array.from(orderMap.values()).sort((a, b) => a.score - b.score);

        // Use putKV for consistent serialization across both APIs
        await this.operations.putKV({
          tableName: TABLE_MESSAGES,
          key: orderKey,
          value: JSON.stringify(updatedOrder),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger?.error(`Error updating sorted order for key ${orderKey}:`, { message });
        throw error; // Let caller handle the error
      } finally {
        // Clean up the queue if this was the last operation
        if (this.updateQueue.get(orderKey) === nextPromise) {
          this.updateQueue.delete(orderKey);
        }
      }
    });

    // Update the queue with the new promise
    this.updateQueue.set(orderKey, nextPromise);

    // Wait for our turn and handle any errors
    return nextPromise;
  }

  private async getSortedMessages(orderKey: string): Promise<Array<{ id: string; score: number }>> {
    const raw = await this.operations.getKV(TABLE_MESSAGES, orderKey);
    if (!raw) return [];
    try {
      const arr = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      this.logger?.error(`Error parsing order data for key ${orderKey}:`, { e });
      return [];
    }
  }

  private async migrateMessage(messageId: string, fromThreadId: string, toThreadId: string): Promise<void> {
    try {
      // Get the message from the old thread
      const oldMessageKey = this.getMessageKey(fromThreadId, messageId);
      const message = await this.operations.getKV(TABLE_MESSAGES, oldMessageKey);
      if (!message) return;

      // Update the message's threadId
      const updatedMessage = {
        ...message,
        threadId: toThreadId,
      };

      // Save to new thread
      const newMessageKey = this.getMessageKey(toThreadId, messageId);
      await this.operations.putKV({ tableName: TABLE_MESSAGES, key: newMessageKey, value: updatedMessage });

      // Remove from old thread's sorted list
      const oldOrderKey = this.getThreadMessagesKey(fromThreadId);
      const oldEntries = await this.getSortedMessages(oldOrderKey);
      const filteredEntries = oldEntries.filter(entry => entry.id !== messageId);
      await this.updateSortedMessages(oldOrderKey, filteredEntries);

      // Add to new thread's sorted list
      const newOrderKey = this.getThreadMessagesKey(toThreadId);
      const newEntries = await this.getSortedMessages(newOrderKey);
      const newEntry = { id: messageId, score: Date.now() };
      newEntries.push(newEntry);
      await this.updateSortedMessages(newOrderKey, newEntries);

      // Delete from old thread
      await this.operations.deleteKV(TABLE_MESSAGES, oldMessageKey);
    } catch (error) {
      this.logger?.error(`Error migrating message ${messageId} from ${fromThreadId} to ${toThreadId}:`, error);
      throw error;
    }
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    if (!Array.isArray(messages) || messages.length === 0) return { messages: [] };

    try {
      // Validate message structure and ensure dates
      const validatedMessages = messages
        .map((message, index) => {
          const errors: string[] = [];
          if (!message.id) errors.push('id is required');
          if (!message.threadId) errors.push('threadId is required');
          if (!message.content) errors.push('content is required');
          if (!message.role) errors.push('role is required');
          if (!message.createdAt) errors.push('createdAt is required');
          if (message.resourceId === null || message.resourceId === undefined) errors.push('resourceId is required');

          if (errors.length > 0) {
            throw new Error(`Invalid message at index ${index}: ${errors.join(', ')}`);
          }

          return {
            ...message,
            createdAt: ensureDate(message.createdAt)!,
            type: message.type || 'v2',
            _index: index,
          };
        })
        .filter(m => !!m);

      // Check for existing messages and handle thread migration
      const messageMigrationTasks: Promise<void>[] = [];

      for (const message of validatedMessages) {
        // Check if this message already exists in a different thread
        const existingMessage = await this.findMessageInAnyThread(message.id);
        this.logger?.debug(
          `Checking message ${message.id}: existing=${existingMessage?.threadId}, new=${message.threadId}`,
        );
        if (existingMessage && existingMessage.threadId && existingMessage.threadId !== message.threadId) {
          // Message exists in a different thread, migrate it
          this.logger?.debug(`Migrating message ${message.id} from ${existingMessage.threadId} to ${message.threadId}`);
          messageMigrationTasks.push(this.migrateMessage(message.id, existingMessage.threadId, message.threadId!));
        }
      }

      // Wait for all migrations to complete
      await Promise.all(messageMigrationTasks);

      // Group messages by thread for batch processing
      const messagesByThread = validatedMessages.reduce((acc, message) => {
        if (message.threadId && !acc.has(message.threadId)) {
          acc.set(message.threadId, []);
        }
        if (message.threadId) {
          acc.get(message.threadId)!.push(message as MastraDBMessage & { _index?: number });
        }
        return acc;
      }, new Map<string, (MastraDBMessage & { _index?: number })[]>());

      // Process each thread's messages
      await Promise.all(
        Array.from(messagesByThread.entries()).map(async ([threadId, threadMessages]) => {
          try {
            // Verify thread exists
            const thread = await this.getThreadById({ threadId });
            if (!thread) {
              throw new Error(`Thread ${threadId} not found`);
            }

            // Save messages with serialized dates
            await Promise.all(
              threadMessages.map(async message => {
                const key = this.getMessageKey(threadId, message.id);
                // Strip _index and serialize dates before saving
                const { _index, ...cleanMessage } = message;
                const serializedMessage = {
                  ...cleanMessage,
                  createdAt: serializeDate(cleanMessage.createdAt),
                };
                this.logger?.debug(`Saving message ${message.id}`, {
                  contentSummary: this.summarizeMessageContent(serializedMessage.content),
                });
                await this.operations.putKV({ tableName: TABLE_MESSAGES, key, value: serializedMessage });
              }),
            );

            // Update message order using _index or timestamps
            const orderKey = this.getThreadMessagesKey(threadId);
            const entries = await this.updateSorting(threadMessages);
            await this.updateSortedMessages(orderKey, entries);

            // Update thread's updatedAt timestamp
            const updatedThread = {
              ...thread,
              updatedAt: new Date(),
            };
            await this.operations.putKV({
              tableName: TABLE_THREADS,
              key: this.operations.getKey(TABLE_THREADS, { id: threadId }),
              value: updatedThread,
            });
          } catch (error) {
            throw new MastraError(
              {
                id: createStorageErrorId('CLOUDFLARE', 'SAVE_MESSAGES', 'FAILED'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
                details: {
                  threadId,
                },
              },
              error,
            );
          }
        }),
      );

      // Remove _index from returned messages
      const prepared = validatedMessages.map(
        ({ _index, ...message }) =>
          ({ ...message, type: message.type !== 'v2' ? message.type : undefined }) as MastraMessageV1 | MastraDBMessage,
      );
      const list = new MessageList().add(prepared, 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async getRank(orderKey: string, id: string): Promise<number | null> {
    const order = await this.getSortedMessages(orderKey);
    const index = order.findIndex(item => item.id === id);
    return index >= 0 ? index : null;
  }

  private async getRange(orderKey: string, start: number, end: number): Promise<string[]> {
    const order = await this.getSortedMessages(orderKey);
    const actualStart = start < 0 ? Math.max(0, order.length + start) : start;
    const actualEnd = end < 0 ? order.length + end : Math.min(end, order.length - 1);
    const sliced = order.slice(actualStart, actualEnd + 1);
    return sliced.map(item => item.id);
  }

  private async getLastN(orderKey: string, n: number): Promise<string[]> {
    // Reuse getRange with negative indexing
    return this.getRange(orderKey, -n, -1);
  }

  private async getFullOrder(orderKey: string): Promise<string[]> {
    // Get the full range in ascending order (oldest to newest)
    return this.getRange(orderKey, 0, -1);
  }

  /**
   * Retrieves messages specified in the include array along with their surrounding context.
   *
   * **Performance Note**: When `threadId` is not provided in an include entry, this method
   * must call `findMessageInAnyThread` which sequentially scans all threads in the KV store.
   * For optimal performance, callers should provide `threadId` in include entries when known.
   *
   * @param include - Array of message IDs to include, optionally with context windows
   * @param messageIds - Set to accumulate the message IDs that should be fetched
   */
  private async getIncludedMessagesWithContext(
    include: { id: string; threadId?: string; withPreviousMessages?: number; withNextMessages?: number }[],
    messageIds: Set<string>,
  ): Promise<void> {
    await Promise.all(
      include.map(async item => {
        // Look up the message to get its threadId (message IDs are globally unique)
        // Note: When threadId is not provided, this triggers a full scan of all threads
        let targetThreadId = item.threadId;
        if (!targetThreadId) {
          const foundMessage = await this.findMessageInAnyThread(item.id);
          if (!foundMessage) return;
          targetThreadId = foundMessage.threadId;
        }
        if (!targetThreadId) return;

        const threadMessagesKey = this.getThreadMessagesKey(targetThreadId);

        messageIds.add(item.id);
        if (!item.withPreviousMessages && !item.withNextMessages) return;

        const rank = await this.getRank(threadMessagesKey, item.id);
        if (rank === null) return;

        if (item.withPreviousMessages) {
          const prevIds = await this.getRange(
            threadMessagesKey,
            Math.max(0, rank - item.withPreviousMessages),
            rank - 1,
          );
          prevIds.forEach(id => messageIds.add(id));
        }

        if (item.withNextMessages) {
          const nextIds = await this.getRange(threadMessagesKey, rank + 1, rank + item.withNextMessages);
          nextIds.forEach(id => messageIds.add(id));
        }
      }),
    );
  }

  private async getRecentMessages(threadId: string, limit: number, messageIds: Set<string>): Promise<void> {
    if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

    if (limit <= 0) return;

    try {
      const threadMessagesKey = this.getThreadMessagesKey(threadId);
      const latestIds = await this.getLastN(threadMessagesKey, limit);
      latestIds.forEach(id => messageIds.add(id));
    } catch {
      this.logger?.debug(`No message order found for thread ${threadId}, skipping latest messages`);
    }
  }

  /**
   * Fetches and parses messages from one or more threads.
   *
   * **Performance Note**: When neither `include` entries with `threadId` nor `targetThreadId`
   * are provided, this method falls back to `findMessageInAnyThread` which scans all threads.
   * For optimal performance, provide `threadId` in include entries or specify `targetThreadId`.
   */
  private async fetchAndParseMessagesFromMultipleThreads(
    messageIds: string[],
    include?: { id: string; threadId?: string; withPreviousMessages?: number; withNextMessages?: number }[],
    targetThreadId?: string,
  ): Promise<(MastraMessageV1 & { _index?: number })[]> {
    // Create a map of messageId to threadId
    const messageIdToThreadId = new Map<string, string>();

    // If we have include information, use it to map messageIds to threadIds
    if (include) {
      for (const item of include) {
        if (item.threadId) {
          messageIdToThreadId.set(item.id, item.threadId);
        }
      }
    }

    const messages = await Promise.all(
      messageIds.map(async id => {
        try {
          // Try to get the threadId for this message
          let threadId = messageIdToThreadId.get(id);

          if (!threadId) {
            if (targetThreadId) {
              // If we have a target thread, only look in that thread
              threadId = targetThreadId;
            } else {
              // Search for the message in any thread (expensive: scans all threads)
              const foundMessage = await this.findMessageInAnyThread(id);
              if (foundMessage) {
                threadId = foundMessage.threadId;
              }
            }
          }

          if (!threadId) return null;

          const key = this.getMessageKey(threadId, id);
          const data = await this.operations.getKV(TABLE_MESSAGES, key);
          if (!data) return null;
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          this.logger?.debug(`Retrieved message ${id} from thread ${threadId}`, {
            contentSummary: this.summarizeMessageContent(parsed.content),
          });
          return parsed;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger?.error(`Error retrieving message ${id}:`, { message });
          return null;
        }
      }),
    );
    return messages.filter((msg): msg is MastraMessageV1 & { _index?: number } => msg !== null);
  }

  /**
   * Retrieves messages by their IDs.
   *
   * **Performance Warning**: This method calls `findMessageInAnyThread` for each message ID,
   * which scans all threads in the KV store. For large numbers of messages or threads,
   * this can result in significant latency. Consider using `listMessages` with specific
   * thread IDs when the thread context is known.
   */
  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

    try {
      // Fetch and parse all messages from their respective threads (expensive: scans all threads per message)
      const messages = (await Promise.all(messageIds.map(id => this.findMessageInAnyThread(id)))).filter(
        result => !!result,
      ) as (MastraMessageV1 & { _index: string })[];

      // Remove _index and ensure dates before returning, just like Upstash
      const prepared = messages.map(({ _index, ...message }) => ({
        ...message,
        ...(message.type !== (`v2` as string) && { type: message.type }),
        createdAt: ensureDate(message.createdAt)!,
      }));
      const list = new MessageList().add(prepared as MastraMessageV1[] | MastraDBMessage[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'LIST_MESSAGES_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error retrieving messages by ID`,
          details: {
            messageIds: JSON.stringify(messageIds),
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return { messages: [] };
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    // Validate each threadId is a non-empty string (avoid TypeError on non-string inputs)
    const isValidThreadId = (id: unknown): boolean => typeof id === 'string' && id.trim().length > 0;

    if (threadIds.length === 0 || threadIds.some(id => !isValidThreadId(id))) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? JSON.stringify(threadId) : String(threadId) },
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
            id: createStorageErrorId('CLOUDFLARE', 'LIST_MESSAGES', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      // Determine sort field and direction
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

      // Step 1: Get thread messages from all specified threads (for pagination)
      const threadMessageIds = new Set<string>();
      for (const tid of threadIds) {
        try {
          const threadMessagesKey = this.getThreadMessagesKey(tid);
          const allIds = await this.getFullOrder(threadMessagesKey);
          allIds.forEach(id => threadMessageIds.add(id));
        } catch {
          // If no message order found for this thread, continue
        }
      }

      // Fetch thread messages from all threads
      const threadMessages = await this.fetchAndParseMessagesFromMultipleThreads(
        Array.from(threadMessageIds),
        undefined,
        threadIds.length === 1 ? threadIds[0] : undefined,
      );

      // Filter thread messages by resourceId if specified
      let filteredThreadMessages = threadMessages;
      if (resourceId) {
        filteredThreadMessages = filteredThreadMessages.filter(msg => msg.resourceId === resourceId);
      }

      // Filter thread messages by dateRange if specified
      const dateRange = filter?.dateRange;
      if (dateRange) {
        filteredThreadMessages = filteredThreadMessages.filter(msg => {
          const messageDate = new Date(msg.createdAt);
          if (dateRange.start && messageDate < new Date(dateRange.start)) return false;
          if (dateRange.end && messageDate > new Date(dateRange.end)) return false;
          return true;
        });
      }

      // Get total count for pagination
      const total = filteredThreadMessages.length;

      // If perPage is 0 AND there are no include messages, return empty array immediately
      if (perPage === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: offset < total,
        };
      }

      // Sort thread messages by createdAt BEFORE pagination
      filteredThreadMessages.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        const timeDiff = direction === 'ASC' ? timeA - timeB : timeB - timeA;
        if (timeDiff === 0) {
          return a.id.localeCompare(b.id);
        }
        return timeDiff;
      });

      // Apply pagination to thread messages
      // After sorting, pagination is simply offset + limit from the sorted array
      // (same as SQL: ORDER BY ... LIMIT ... OFFSET ...)
      let paginatedMessages: (MastraMessageV1 & { _index?: number })[];
      if (perPage === 0) {
        // perPage: 0 means return no paginated messages (only include messages)
        paginatedMessages = [];
      } else if (perPage === Number.MAX_SAFE_INTEGER) {
        // perPage: false (MAX_SAFE_INTEGER) means return all messages
        paginatedMessages = filteredThreadMessages;
      } else {
        // Normal pagination - just slice from the sorted array
        paginatedMessages = filteredThreadMessages.slice(offset, offset + perPage);
      }

      // Step 2: Get included messages separately (not subject to pagination)
      let includedMessages: (MastraMessageV1 & { _index?: number })[] = [];
      if (include && include.length > 0) {
        const includedMessageIds = new Set<string>();
        await this.getIncludedMessagesWithContext(include, includedMessageIds);

        // Remove IDs that are already in paginated messages to avoid duplicate fetches
        const paginatedIds = new Set(paginatedMessages.map(m => m.id));
        const idsToFetch = Array.from(includedMessageIds).filter(id => !paginatedIds.has(id));

        if (idsToFetch.length > 0) {
          includedMessages = await this.fetchAndParseMessagesFromMultipleThreads(idsToFetch, include, undefined);
        }
      }

      // Step 3: Combine paginated + included messages, deduplicate
      const seenIds = new Set<string>();
      const allMessages: (MastraMessageV1 & { _index?: number })[] = [];

      for (const msg of paginatedMessages) {
        if (!seenIds.has(msg.id)) {
          allMessages.push(msg);
          seenIds.add(msg.id);
        }
      }

      for (const msg of includedMessages) {
        if (!seenIds.has(msg.id)) {
          allMessages.push(msg);
          seenIds.add(msg.id);
        }
      }

      // Sort combined messages by createdAt
      allMessages.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        const timeDiff = direction === 'ASC' ? timeA - timeB : timeB - timeA;
        if (timeDiff === 0) {
          return a.id.localeCompare(b.id);
        }
        return timeDiff;
      });

      let filteredMessages = allMessages;
      const paginatedCount = paginatedMessages.length;

      // Only return early if there are no messages AND no includes to process
      if (total === 0 && filteredMessages.length === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Remove _index and ensure dates before returning
      const prepared = filteredMessages.map(({ _index, ...message }) => ({
        ...message,
        type: message.type !== ('v2' as string) ? message.type : undefined,
        createdAt: ensureDate(message.createdAt)!,
      }));

      // Use MessageList for proper deduplication and format conversion to V2
      // Use first threadId for context when multiple threads are provided
      const primaryThreadId = Array.isArray(threadId) ? threadId[0] : threadId;
      const list = new MessageList({ threadId: primaryThreadId, resourceId }).add(
        prepared as MastraMessageV1[],
        'memory',
      );
      let finalMessages = list.get.all.db();

      // Sort final messages with type-aware comparator and stable tiebreaker
      finalMessages = finalMessages.sort((a, b) => {
        const isDateField = field === 'createdAt' || field === 'updatedAt';
        const aVal = isDateField ? new Date((a as any)[field]).getTime() : (a as any)[field];
        const bVal = isDateField ? new Date((b as any)[field]).getTime() : (b as any)[field];

        // Handle undefined/null values (sort to end)
        if (aVal == null && bVal == null) return a.id.localeCompare(b.id);
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          const cmp = direction === 'ASC' ? aVal - bVal : bVal - aVal;
          return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
        }
        const cmp =
          direction === 'ASC' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      });

      // Calculate hasMore based on pagination window
      // If all thread messages have been returned (through pagination or include), hasMore = false
      // Otherwise, check if there are more pages in the pagination window
      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageIds = new Set(
        finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).map(m => m.id),
      );
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore = perPageInput !== false && !allThreadMessagesReturned && offset + paginatedCount < total;

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
          id: createStorageErrorId('CLOUDFLARE', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to list messages for thread ${Array.isArray(threadId) ? threadId.join(',') : threadId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
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

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraDBMessage[]> {
    try {
      const { messages } = args;
      const updatedMessages: MastraDBMessage[] = [];

      for (const messageUpdate of messages) {
        const { id, content, ...otherFields } = messageUpdate;

        // Get the existing message by searching through all threads
        // This is a simplified approach - in a real implementation you'd want to store threadId with the message
        const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
        const keyObjs = await this.operations.listKV(TABLE_MESSAGES, { prefix: `${prefix}${TABLE_MESSAGES}` });

        let existingMessage: MastraDBMessage | null = null;
        let messageKey = '';

        for (const { name: key } of keyObjs) {
          const data = await this.operations.getKV(TABLE_MESSAGES, key);
          if (data && data.id === id) {
            existingMessage = data as MastraDBMessage;
            messageKey = key;
            break;
          }
        }

        if (!existingMessage) {
          // Message doesn't exist, skip it
          continue;
        }

        // Merge the updates
        const updatedMessage: MastraDBMessage = {
          ...existingMessage,
          ...otherFields,
          id,
        };

        // Handle content updates
        if (content) {
          if (content.metadata !== undefined) {
            updatedMessage.content = {
              ...updatedMessage.content,
              metadata: {
                ...updatedMessage.content?.metadata,
                ...content.metadata,
              },
            };
          }
          if (content.content !== undefined) {
            updatedMessage.content = {
              ...updatedMessage.content,
              content: content.content,
            };
          }
        }

        // If the message is being moved to a different thread, we need to handle it specially
        if (
          'threadId' in messageUpdate &&
          messageUpdate.threadId &&
          messageUpdate.threadId !== existingMessage.threadId
        ) {
          // Delete the message from the old thread
          await this.operations.deleteKV(TABLE_MESSAGES, messageKey);

          // Update the message's threadId to the new thread
          updatedMessage.threadId = messageUpdate.threadId;

          // Save the message to the new thread with a new key
          const newMessageKey = this.getMessageKey(messageUpdate.threadId, id);
          await this.operations.putKV({
            tableName: TABLE_MESSAGES,
            key: newMessageKey,
            value: updatedMessage,
          });

          // Update message order in both threads
          if (existingMessage.threadId) {
            // Remove from source thread's order
            const sourceOrderKey = this.getThreadMessagesKey(existingMessage.threadId);
            const sourceEntries = await this.getSortedMessages(sourceOrderKey);
            const filteredEntries = sourceEntries.filter(entry => entry.id !== id);
            await this.updateSortedMessages(sourceOrderKey, filteredEntries);
          }

          // Add to destination thread's order
          const destOrderKey = this.getThreadMessagesKey(messageUpdate.threadId);
          const destEntries = await this.getSortedMessages(destOrderKey);
          const newEntry = { id: id, score: Date.now() };
          destEntries.push(newEntry);
          await this.updateSortedMessages(destOrderKey, destEntries);
        } else {
          // Save the updated message in place
          await this.operations.putKV({
            tableName: TABLE_MESSAGES,
            key: messageKey,
            value: updatedMessage,
          });
        }

        // Update thread timestamps for both source and destination threads
        const threadsToUpdate = new Set<string>();

        // Always update the current thread if threadId is available
        if (updatedMessage.threadId) {
          threadsToUpdate.add(updatedMessage.threadId);
        }

        // If threadId is being changed, also update the source thread
        if (
          'threadId' in messageUpdate &&
          messageUpdate.threadId &&
          messageUpdate.threadId !== existingMessage.threadId
        ) {
          // Add the source thread (where the message was originally)
          if (existingMessage.threadId) {
            threadsToUpdate.add(existingMessage.threadId);
          }
          // Add the destination thread (where the message is being moved to)
          threadsToUpdate.add(messageUpdate.threadId);
        }

        // Update all affected threads
        for (const threadId of threadsToUpdate) {
          const thread = await this.getThreadById({ threadId });
          if (thread) {
            const updatedThread = {
              ...thread,
              updatedAt: new Date(),
            };
            await this.operations.putKV({
              tableName: TABLE_THREADS,
              key: this.operations.getKey(TABLE_THREADS, { id: threadId }),
              value: updatedThread,
            });
          }
        }

        updatedMessages.push(updatedMessage);
      }

      return updatedMessages;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'UPDATE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to update messages',
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const data = await this.operations.getKV(TABLE_RESOURCES, resourceId);
      if (!data) return null;

      const resource = typeof data === 'string' ? JSON.parse(data) : data;
      return {
        ...resource,
        createdAt: ensureDate(resource.createdAt)!,
        updatedAt: ensureDate(resource.updatedAt)!,
        metadata: this.ensureMetadata(resource.metadata),
      };
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_RESOURCE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return null;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      const resourceToSave = {
        ...resource,
        metadata: resource.metadata ? JSON.stringify(resource.metadata) : null,
      };

      await this.operations.putKV({
        tableName: TABLE_RESOURCES,
        key: resource.id,
        value: resourceToSave,
      });

      return resource;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'SAVE_RESOURCE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId: resource.id,
          },
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

    const updatedAt = new Date();
    const updatedResource = {
      ...existingResource,
      workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
      metadata: {
        ...existingResource.metadata,
        ...metadata,
      },
      updatedAt,
    };

    return this.saveResource({ resource: updatedResource });
  }
}
