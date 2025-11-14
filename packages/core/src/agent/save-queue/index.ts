import type { IMastraLogger } from '../../logger';
import type { MemoryConfig } from '../../memory';
import type { MastraMemory } from '../../memory/memory';
import type { MessageList } from '../message-list';

export class SaveQueueManager {
  private logger?: IMastraLogger;
  private debounceMs: number;
  private memory?: MastraMemory;

  private static MAX_STALENESS_MS = 1000;

  constructor({ logger, debounceMs, memory }: { logger?: IMastraLogger; debounceMs?: number; memory?: MastraMemory }) {
    this.logger = logger;
    this.debounceMs = debounceMs || 100;
    this.memory = memory;
  }
  private saveQueues = new Map<string, Promise<void>>();
  private saveDebounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Debounces save operations for a thread, ensuring that consecutive save requests
   * are batched and only the latest is executed after a short delay.
   * @param threadId - The ID of the thread to debounce saves for.
   * @param saveFn - The save function to debounce.
   */
  private debounceSave(threadId: string, messageList: MessageList, memoryConfig?: MemoryConfig) {
    if (this.saveDebounceTimers.has(threadId)) {
      clearTimeout(this.saveDebounceTimers.get(threadId)!);
    }
    this.saveDebounceTimers.set(
      threadId,
      setTimeout(() => {
        this.enqueueSave(threadId, messageList, memoryConfig).catch(err => {
          this.logger?.error?.('Error in debounceSave', { err, threadId });
        });
        this.saveDebounceTimers.delete(threadId);
      }, this.debounceMs),
    );
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
  private enqueueSave(threadId: string, messageList: MessageList, memoryConfig?: MemoryConfig) {
    const prev = this.saveQueues.get(threadId) || Promise.resolve();
    const next = prev
      .then(() => this.persistUnsavedMessages(messageList, memoryConfig))
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
  private async persistUnsavedMessages(messageList: MessageList, memoryConfig?: MemoryConfig) {
    const newMessages = messageList.drainUnsavedMessages();
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
  async batchMessages(messageList: MessageList, threadId?: string, memoryConfig?: MemoryConfig) {
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
  async flushMessages(messageList: MessageList, threadId?: string, memoryConfig?: MemoryConfig) {
    if (!threadId) return;
    this.clearDebounce(threadId);
    return this.enqueueSave(threadId, messageList, memoryConfig);
  }
}
