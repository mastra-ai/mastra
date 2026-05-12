import type { IMastraLogger } from '../../logger';
import type { MemoryConfigInternal } from '../../memory';
import type { MastraMemory } from '../../memory/memory';
import type { MessageList } from '../message-list';

export class SaveQueueManager {
  private logger?: IMastraLogger;
  private debounceMs: number;
  private memory?: MastraMemory;

  private static MAX_STALENESS_MS = 1000;
  private static MAX_TOOL_STATE_METADATA_ENTRIES = 1000;

  constructor({ logger, debounceMs, memory }: { logger?: IMastraLogger; debounceMs?: number; memory?: MastraMemory }) {
    this.logger = logger;
    this.debounceMs = debounceMs || 100;
    this.memory = memory;
  }
  private saveQueues = new Map<string, Promise<void>>();
  private saveDebounceTimers = new Map<string, NodeJS.Timeout>();
  private toolStateMetadata = new Map<string, Record<string, Record<string, unknown>>>();

  private getToolStateMetadataKey(threadId: string, messageId: string) {
    return `${threadId}:${messageId}`;
  }

  private getToolStateMetadata(threadId: string, messageId: string) {
    const key = this.getToolStateMetadataKey(threadId, messageId);
    const value = this.toolStateMetadata.get(key);
    if (value) {
      this.toolStateMetadata.delete(key);
      this.toolStateMetadata.set(key, value);
    }
    return value;
  }

  private setToolStateMetadata(threadId: string, messageId: string, metadata: Record<string, Record<string, unknown>>) {
    const key = this.getToolStateMetadataKey(threadId, messageId);
    this.toolStateMetadata.delete(key);
    this.toolStateMetadata.set(key, metadata);

    while (this.toolStateMetadata.size > SaveQueueManager.MAX_TOOL_STATE_METADATA_ENTRIES) {
      const oldestKey = this.toolStateMetadata.keys().next().value;
      if (!oldestKey) break;
      this.toolStateMetadata.delete(oldestKey);
    }
  }

  private removeToolStateMetadata(threadId: string, messageId: string) {
    this.toolStateMetadata.delete(this.getToolStateMetadataKey(threadId, messageId));
  }

  /**
   * Debounces save operations for a thread, ensuring that consecutive save requests
   * are batched and only the latest is executed after a short delay.
   * @param threadId - The ID of the thread to debounce saves for.
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param memoryConfig - Optional memory configuration to use for saving.
   * @returns A promise that resolves when the debounced save completes.
   */
  private debounceSave(threadId: string, messageList: MessageList, memoryConfig?: MemoryConfigInternal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.saveDebounceTimers.has(threadId)) {
        clearTimeout(this.saveDebounceTimers.get(threadId)!);
      }
      this.saveDebounceTimers.set(
        threadId,
        setTimeout(() => {
          this.enqueueSave(threadId, messageList, memoryConfig)
            .then(resolve)
            .catch(err => {
              this.logger?.error?.('Error in debounceSave', { err, threadId });
              reject(err);
            })
            .finally(() => {
              this.saveDebounceTimers.delete(threadId);
            });
        }, this.debounceMs),
      );
    });
  }

  /**
   * Enqueues a save operation for a thread, ensuring that saves are executed in order and
   * only one save runs at a time per thread. If a save is already in progress for the thread,
   * the new save is queued to run after the previous completes.
   *
   * @param threadId - The ID of the thread whose messages should be saved.
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param memoryConfig - Optional memory configuration to use for saving.
   */
  private enqueueSave(threadId: string, messageList: MessageList, memoryConfig?: MemoryConfigInternal) {
    const prev = this.saveQueues.get(threadId) || Promise.resolve();
    const next = prev
      .then(() => this.persistUnsavedMessages(messageList, threadId, memoryConfig))
      .catch(err => {
        this.logger?.error?.('Error in enqueueSave', { err, threadId });
      })
      .then(() => {
        if (this.saveQueues.get(threadId) === next) {
          this.saveQueues.delete(threadId);
        }
      });
    this.saveQueues.set(threadId, next);
    return next;
  }

  /**
   * Clears any pending debounced save for a thread, preventing the scheduled save
   * from executing if it hasn't already fired.
   *
   * @param threadId - The ID of the thread whose debounced save should be cleared.
   */
  clearDebounce(threadId: string) {
    if (this.saveDebounceTimers.has(threadId)) {
      clearTimeout(this.saveDebounceTimers.get(threadId)!);
      this.saveDebounceTimers.delete(threadId);
    }
  }

  /**
   * Persists any unsaved messages from the MessageList to memory storage.
   * Drains the list of unsaved messages and writes them using the memory backend.
   * @param messageList - The MessageList instance for the current thread.
   * @param memoryConfig - The memory configuration for saving.
   */
  private async mergeConcurrentToolStateMessages(
    messages: ReturnType<MessageList['drainUnsavedMessages']>,
    threadId: string,
    memoryConfig?: MemoryConfigInternal,
  ) {
    const toolStateKeys = ['suspendedTools', 'pendingToolApprovals', 'backgroundTasks'] as const;
    const hasToolStateMetadata = messages.some(message =>
      toolStateKeys.some(key => {
        const value = message.content.metadata?.[key];
        return value && typeof value === 'object';
      }),
    );

    if (!hasToolStateMetadata || !this.memory) {
      return messages;
    }

    const existingMessages = await this.memory
      .recall({
        threadId,
        threadConfig: memoryConfig,
      })
      .then(result => result.messages)
      .catch(error => {
        this.logger?.warn?.('Unable to merge concurrent tool state metadata before saving messages', {
          error,
          threadId,
        });
        return [];
      });

    const existingById = new Map(existingMessages.map(message => [message.id, message]));
    const mergeToolStateRecord = (...records: Array<Record<string, unknown> | undefined>): Record<string, unknown> => {
      return records.reduce<Record<string, unknown>>(
        (merged, record) => {
          if (!record) {
            return merged;
          }

          for (const [key, value] of Object.entries(record)) {
            const existingValue = merged[key] as Record<string, unknown> | undefined;
            const incomingValue = value as Record<string, unknown>;
            merged[key] =
              existingValue?.resumed && !incomingValue?.resumed
                ? { ...incomingValue, ...existingValue }
                : { ...(existingValue ?? {}), ...incomingValue };
          }

          return merged;
        },
        {} as Record<string, unknown>,
      );
    };

    return messages.map(message => {
      const existing = existingById.get(message.id);
      const accumulatedMetadata = this.getToolStateMetadata(threadId, message.id);
      const existingMetadata = existing?.content.metadata;
      const incomingMetadata = message.content.metadata;

      if (!incomingMetadata) {
        return message;
      }

      const mergedMetadata = {
        ...(existingMetadata ?? {}),
        ...(accumulatedMetadata ?? {}),
        ...incomingMetadata,
      };

      for (const key of toolStateKeys) {
        const existingValue = existingMetadata?.[key];
        const accumulatedValue = accumulatedMetadata?.[key];
        const incomingValue = incomingMetadata[key];
        if (
          (existingValue && typeof existingValue === 'object') ||
          (accumulatedValue && typeof accumulatedValue === 'object') ||
          (incomingValue && typeof incomingValue === 'object')
        ) {
          mergedMetadata[key] = mergeToolStateRecord(
            existingValue as Record<string, unknown> | undefined,
            accumulatedValue as Record<string, unknown> | undefined,
            incomingValue as Record<string, unknown> | undefined,
          );
        }
      }

      const nextToolStateMetadata = Object.fromEntries(
        toolStateKeys
          .filter(key => mergedMetadata[key] && typeof mergedMetadata[key] === 'object')
          .map(key => [key, mergedMetadata[key] as Record<string, unknown>]),
      );
      if (Object.keys(nextToolStateMetadata).length > 0) {
        this.setToolStateMetadata(threadId, message.id, nextToolStateMetadata);
      } else {
        this.removeToolStateMetadata(threadId, message.id);
      }

      return {
        ...message,
        content: {
          ...message.content,
          metadata: mergedMetadata,
        },
      };
    });
  }

  private async persistUnsavedMessages(
    messageList: MessageList,
    threadId: string,
    memoryConfig?: MemoryConfigInternal,
  ) {
    const newMessages = await this.mergeConcurrentToolStateMessages(
      messageList.drainUnsavedMessages(),
      threadId,
      memoryConfig,
    );
    if (newMessages.length > 0 && this.memory) {
      await this.memory.saveMessages({
        messages: newMessages,
        memoryConfig,
      });
    }
  }

  /**
   * Batches a save of unsaved messages for a thread, using debouncing to batch rapid updates.
   * If the oldest unsaved message is stale (older than MAX_STALENESS_MS), the save is performed immediately.
   * Otherwise, the save is delayed to batch multiple updates and reduce redundant writes.
   *
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param threadId - The ID of the thread whose messages are being saved.
   * @param memoryConfig - Optional memory configuration for saving.
   */
  async batchMessages(messageList: MessageList, threadId?: string, memoryConfig?: MemoryConfigInternal) {
    if (!threadId) return;
    const earliest = messageList.getEarliestUnsavedMessageTimestamp();
    const now = Date.now();

    if (earliest && now - earliest > SaveQueueManager.MAX_STALENESS_MS) {
      return this.flushMessages(messageList, threadId, memoryConfig);
    } else {
      return this.debounceSave(threadId, messageList, memoryConfig);
    }
  }

  /**
   * Forces an immediate save of unsaved messages for a thread, bypassing any debounce delay.
   * This is used when a flush to persistent storage is required (e.g., on shutdown or critical transitions).
   *
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param threadId - The ID of the thread whose messages are being saved.
   * @param memoryConfig - Optional memory configuration for saving.
   */
  async flushMessages(messageList: MessageList, threadId?: string, memoryConfig?: MemoryConfigInternal) {
    if (!threadId) return;
    this.clearDebounce(threadId);
    return this.enqueueSave(threadId, messageList, memoryConfig);
  }
}
