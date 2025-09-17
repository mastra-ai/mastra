import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type { PaginationInfo, StorageGetMessagesArg, StorageResourceType } from '@mastra/core/storage';
import {
  ensureDate,
  MemoryStorage,
  resolveMessageLimit,
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
          id: 'CLOUDFLARE_STORAGE_GET_THREAD_BY_ID_FAILED',
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

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const keyList = await this.operations.listKV(TABLE_THREADS);
      const threads = await Promise.all(
        keyList.map(async keyObj => {
          try {
            const data = await this.operations.getKV(TABLE_THREADS, keyObj.name);
            if (!data) return null;

            const thread = typeof data === 'string' ? JSON.parse(data) : data;
            if (!thread || !thread.resourceId || thread.resourceId !== resourceId) return null;

            return {
              ...thread,
              createdAt: ensureDate(thread.createdAt)!,
              updatedAt: ensureDate(thread.updatedAt)!,
              metadata: this.ensureMetadata(thread.metadata),
            };
          } catch (error: any) {
            const mastraError = new MastraError(
              {
                id: 'CLOUDFLARE_STORAGE_GET_THREADS_BY_RESOURCE_ID_FAILED',
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
        }),
      );
      return threads.filter((thread): thread is StorageThreadType => thread !== null);
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_THREADS_BY_RESOURCE_ID_FAILED',
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
      return [];
    }
  }

  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    try {
      const { resourceId, page = 0, perPage = 100 } = args;

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

      // Sort by createdAt descending
      threads.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      // Apply pagination
      const start = page * perPage;
      const end = start + perPage;
      const paginatedThreads = threads.slice(start, end);

      return {
        page,
        perPage,
        total: threads.length,
        hasMore: start + perPage < threads.length,
        threads: paginatedThreads,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
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
          id: 'CLOUDFLARE_STORAGE_SAVE_THREAD_FAILED',
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
          id: 'CLOUDFLARE_STORAGE_UPDATE_THREAD_FAILED',
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
      this.logger.error(`Error getting message key for thread ${threadId} and message ${messageId}:`, { message });
      throw error;
    }
  }

  private getThreadMessagesKey(threadId: string): string {
    try {
      return this.operations.getKey(TABLE_MESSAGES, { threadId, id: 'messages' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting thread messages key for thread ${threadId}:`, { message });
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
          id: 'CLOUDFLARE_STORAGE_DELETE_THREAD_FAILED',
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

  private async updateSorting(threadMessages: (MastraMessageV1 & { _index?: number })[]) {
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
        this.logger.error(`Error updating sorted order for key ${orderKey}:`, { message });
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
      this.logger.error(`Error parsing order data for key ${orderKey}:`, { e });
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

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    if (!Array.isArray(messages) || messages.length === 0) return [];

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
        console.info(`Checking message ${message.id}: existing=${existingMessage?.threadId}, new=${message.threadId}`);
        if (existingMessage && existingMessage.threadId && existingMessage.threadId !== message.threadId) {
          // Message exists in a different thread, migrate it
          console.info(`Migrating message ${message.id} from ${existingMessage.threadId} to ${message.threadId}`);
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
          acc.get(message.threadId)!.push(message as MastraMessageV1 & { _index?: number });
        }
        return acc;
      }, new Map<string, (MastraMessageV1 & { _index?: number })[]>());

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
                console.info(`Saving message ${message.id} with content:`, {
                  content: serializedMessage.content,
                  contentType: typeof serializedMessage.content,
                  isArray: Array.isArray(serializedMessage.content),
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
                id: 'CLOUDFLARE_STORAGE_SAVE_MESSAGES_FAILED',
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
          ({ ...message, type: message.type !== 'v2' ? message.type : undefined }) as MastraMessageV1,
      );
      const list = new MessageList().add(prepared, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SAVE_MESSAGES_FAILED',
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

  private async getIncludedMessagesWithContext(
    threadId: string,
    include: { id: string; threadId?: string; withPreviousMessages?: number; withNextMessages?: number }[],
    messageIds: Set<string>,
  ): Promise<void> {
    await Promise.all(
      include.map(async item => {
        // Use the item's threadId if provided, otherwise use the main threadId
        const targetThreadId = item.threadId || threadId;
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
      console.info(`No message order found for thread ${threadId}, skipping latest messages`);
    }
  }

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
              // Search for the message in any thread
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
          console.info(`Retrieved message ${id} from thread ${threadId} with content:`, {
            content: parsed.content,
            contentType: typeof parsed.content,
            isArray: Array.isArray(parsed.content),
          });
          return parsed;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Error retrieving message ${id}:`, { message });
          return null;
        }
      }),
    );
    return messages.filter((msg): msg is MastraMessageV1 & { _index?: number } => msg !== null);
  }

  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    console.info(`getMessages called with format: ${format}, threadId: ${threadId}`);

    // Default to v1 format if not specified
    const actualFormat = format || 'v1';
    console.info(`Using format: ${actualFormat}`);

    const limit = resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
    const messageIds = new Set<string>();
    if (limit === 0 && !selectBy?.include?.length) return [];

    try {
      if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

      // Get included messages and recent messages in parallel
      await Promise.all([
        selectBy?.include?.length
          ? this.getIncludedMessagesWithContext(threadId, selectBy.include, messageIds)
          : Promise.resolve(),
        limit > 0 ? this.getRecentMessages(threadId, limit, messageIds) : Promise.resolve(),
      ]);

      // Fetch and parse all messages from their respective threads
      // Only use targetThreadId if we don't have include information (for cross-thread operations)
      const targetThreadId = selectBy?.include?.length ? undefined : threadId;
      const messages = await this.fetchAndParseMessagesFromMultipleThreads(
        Array.from(messageIds),
        selectBy?.include,
        targetThreadId,
      );
      if (!messages.length) return [];

      // Sort messages
      try {
        const threadMessagesKey = this.getThreadMessagesKey(threadId);
        const messageOrder = await this.getFullOrder(threadMessagesKey);
        const orderMap = new Map(messageOrder.map((id, index) => [id, index]));

        messages.sort((a, b) => {
          const indexA = orderMap.get(a.id);
          const indexB = orderMap.get(b.id);

          if (indexA !== undefined && indexB !== undefined) return orderMap.get(a.id)! - orderMap.get(b.id)!;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: 'CLOUDFLARE_STORAGE_SORT_MESSAGES_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            text: `Error sorting messages for thread ${threadId} falling back to creation time`,
            details: {
              threadId,
            },
          },
          error,
        );
        this.logger?.trackException(mastraError);
        this.logger?.error(mastraError.toString());
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      // Remove _index and ensure dates before returning, just like Upstash
      const prepared = messages.map(({ _index, ...message }) => ({
        ...message,
        type: message.type === (`v2` as `text`) ? undefined : message.type,
        createdAt: ensureDate(message.createdAt)!,
      }));
      // For v1 format, return messages directly without using MessageList (like Upstash)
      if (actualFormat === `v1`) {
        console.info(`Processing ${prepared.length} messages for v1 format - returning directly without MessageList`);
        // Return messages exactly as stored, without MessageList transformation
        return (prepared as MastraMessageV1[]).map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }));
      }

      // For v2 format, use MessageList for proper conversion
      const list = new MessageList({ threadId, resourceId }).add(prepared as MastraMessageV1[], 'memory');
      return list.get.all.v2();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error retrieving messages for thread ${threadId}`,
          details: {
            threadId,
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return [];
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
      // Fetch and parse all messages from their respective threads
      const messages = (await Promise.all(messageIds.map(id => this.findMessageInAnyThread(id)))).filter(
        result => !!result,
      ) as (MastraMessageV1 & { _index: string })[];

      // Remove _index and ensure dates before returning, just like Upstash
      const prepared: MastraMessageV1[] = messages.map(({ _index, ...message }) => ({
        ...message,
        ...(message.type !== (`v2` as string) && { type: message.type }),
        createdAt: ensureDate(message.createdAt)!,
      }));
      // For v2 format, use MessageList for proper conversion
      const list = new MessageList().add(prepared, 'memory');
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_MESSAGES_BY_ID_FAILED',
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
      return [];
    }
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg,
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, resourceId, selectBy, format = 'v1' } = args;
    const { page = 0, perPage = 100 } = selectBy?.pagination || {};

    try {
      if (!threadId.trim()) throw new Error('threadId must be a non-empty string');

      // Get all messages for the thread
      const messages =
        format === 'v2'
          ? await this.getMessages({ threadId, selectBy, format: 'v2' })
          : await this.getMessages({ threadId, selectBy, format: 'v1' });

      // Apply date filtering if specified
      let filteredMessages = messages;
      if (selectBy?.pagination?.dateRange) {
        const { start: dateStart, end: dateEnd } = selectBy.pagination.dateRange;
        filteredMessages = messages.filter(message => {
          const messageDate = new Date(message.createdAt);
          if (dateStart && messageDate < dateStart) return false;
          if (dateEnd && messageDate > dateEnd) return false;
          return true;
        }) as MastraMessageV1[] | MastraMessageV2[];
      }

      // Apply pagination
      const start = page * perPage;
      const end = start + perPage;
      const paginatedMessages = filteredMessages.slice(start, end);

      return {
        page,
        perPage,
        total: filteredMessages.length,
        hasMore: start + perPage < filteredMessages.length,
        messages: paginatedMessages as MastraMessageV1[] | MastraMessageV2[],
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to get messages with pagination',
          details: {
            threadId,
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      return { messages: [], total: 0, page, perPage: perPage || 40, hasMore: false };
    }
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      threadId?: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraMessageV2[]> {
    try {
      const { messages } = args;
      const updatedMessages: MastraMessageV2[] = [];

      for (const messageUpdate of messages) {
        const { id, content, ...otherFields } = messageUpdate;

        // Get the existing message by searching through all threads
        // This is a simplified approach - in a real implementation you'd want to store threadId with the message
        const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
        const keyObjs = await this.operations.listKV(TABLE_MESSAGES, { prefix: `${prefix}${TABLE_MESSAGES}` });

        let existingMessage: MastraMessageV2 | null = null;
        let messageKey = '';

        for (const { name: key } of keyObjs) {
          const data = await this.operations.getKV(TABLE_MESSAGES, key);
          if (data && data.id === id) {
            existingMessage = data as MastraMessageV2;
            messageKey = key;
            break;
          }
        }

        if (!existingMessage) {
          // Message doesn't exist, skip it
          continue;
        }

        // Merge the updates
        const updatedMessage: MastraMessageV2 = {
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
          id: 'CLOUDFLARE_STORAGE_UPDATE_MESSAGES_FAILED',
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
          id: 'CLOUDFLARE_STORAGE_GET_RESOURCE_BY_ID_FAILED',
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
          id: 'CLOUDFLARE_STORAGE_SAVE_RESOURCE_FAILED',
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
