import type { IMastraLogger } from '../../logger';
import type { MemoryConfigInternal } from '../../memory';
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
  // Callers waiting on a debounced save for a thread. Every caller within a
  // debounce window must settle when the batched save completes, so superseded
  // debounce calls cannot be abandoned (and left hanging forever).
  private pendingDebounceResolvers = new Map<string, Array<{ resolve: () => void; reject: (err: unknown) => void }>>();

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
      const resolvers = this.pendingDebounceResolvers.get(threadId) ?? [];
      resolvers.push({ resolve, reject });
      this.pendingDebounceResolvers.set(threadId, resolvers);

      if (this.saveDebounceTimers.has(threadId)) {
        clearTimeout(this.saveDebounceTimers.get(threadId)!);
      }
      this.saveDebounceTimers.set(
        threadId,
        setTimeout(() => {
          this.saveDebounceTimers.delete(threadId);
          const pending = this.takePendingDebounceResolvers(threadId);
          this.enqueueSave(threadId, messageList, memoryConfig).then(
            () => {
              for (const p of pending) p.resolve();
            },
            err => {
              this.logger?.error?.('Error in debounceSave', { err, threadId });
              for (const p of pending) p.reject(err);
            },
          );
        }, this.debounceMs),
      );
    });
  }

  /**
   * Removes and returns the callers waiting on a debounced save for a thread.
   */
  private takePendingDebounceResolvers(threadId: string) {
    const pending = this.pendingDebounceResolvers.get(threadId) ?? [];
    this.pendingDebounceResolvers.delete(threadId);
    return pending;
  }

  /**
   * Enqueues a save operation for a thread, ensuring that saves are executed in order and
   * only one save runs at a time per thread. If a save is already in progress for the thread,
   * the new save is queued to run after the previous completes.
   *
   * The promise returned to the caller rejects if the save fails, so callers (e.g.
   * `flushMessages`) can surface or retry the error. The queue chain itself always
   * settles successfully so a single failure does not stall later saves.
   *
   * @param threadId - The ID of the thread whose messages should be saved.
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param memoryConfig - Optional memory configuration to use for saving.
   */
  private enqueueSave(
    threadId: string,
    messageList: MessageList,
    memoryConfig?: MemoryConfigInternal,
  ): Promise<void> {
    const prev = this.saveQueues.get(threadId) || Promise.resolve();
    const result = prev.then(() => this.persistUnsavedMessages(messageList, memoryConfig));
    const next = result
      .catch(err => {
        // Swallow on the queue chain only so subsequent saves still run; the
        // error is propagated to the caller via `result`.
        this.logger?.error?.('Error in enqueueSave', { err, threadId });
      })
      .then(() => {
        if (this.saveQueues.get(threadId) === next) {
          this.saveQueues.delete(threadId);
        }
      });
    this.saveQueues.set(threadId, next);
    return result;
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
   * Reads the unsaved messages and only clears them from the list after a
   * successful write, so a failed save (e.g. transient storage error) leaves the
   * messages queued for the next flush instead of silently dropping them.
   * @param messageList - The MessageList instance for the current thread.
   * @param memoryConfig - The memory configuration for saving.
   */
  private async persistUnsavedMessages(messageList: MessageList, memoryConfig?: MemoryConfigInternal) {
    const newMessages = messageList.getUnsavedMessages();
    if (newMessages.length > 0 && this.memory) {
      await this.memory.saveMessages({
        messages: newMessages,
        memoryConfig,
      });
      messageList.clearUnsavedMessages(newMessages);
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
    // A flush supersedes any pending debounced save for this thread. Adopt its
    // waiting callers so they settle with this flush instead of hanging.
    const pending = this.takePendingDebounceResolvers(threadId);
    const save = this.enqueueSave(threadId, messageList, memoryConfig);
    if (pending.length > 0) {
      save.then(
        () => {
          for (const p of pending) p.resolve();
        },
        err => {
          for (const p of pending) p.reject(err);
        },
      );
    }
    return save;
  }
}
