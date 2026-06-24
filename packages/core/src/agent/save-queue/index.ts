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
  // Superseded debounce callers that are waiting on the next scheduled save to settle their promise.
  private pendingDebounceSettlers = new Map<string, Array<{ resolve: () => void; reject: (err: unknown) => void }>>();

  /**
   * Debounces save operations for a thread, ensuring that consecutive save requests
   * are batched and only the latest is executed after a short delay.
   *
   * When a second call arrives before the timer fires, the first caller's promise is
   * parked in pendingDebounceSettlers so that it is settled (resolved or rejected)
   * alongside the winning save rather than hanging forever.
   *
   * @param threadId - The ID of the thread to debounce saves for.
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param memoryConfig - Optional memory configuration to use for saving.
   * @returns A promise that resolves when the debounced save completes.
   */
  private debounceSave(threadId: string, messageList: MessageList, memoryConfig?: MemoryConfigInternal): Promise<void> {
    return new Promise((resolve, reject) => {
      // Register this call's settlers before touching the timer so that any call —
      // whether it wins the debounce race or is superseded — will always be settled.
      const settlers = this.pendingDebounceSettlers.get(threadId) ?? [];
      settlers.push({ resolve, reject });
      this.pendingDebounceSettlers.set(threadId, settlers);

      if (this.saveDebounceTimers.has(threadId)) {
        // A timer is already running; reset it so the debounce window restarts.
        // The new timer will settle all accumulated settlers (including this one).
        clearTimeout(this.saveDebounceTimers.get(threadId)!);
      }

      this.saveDebounceTimers.set(
        threadId,
        setTimeout(() => {
          // Claim every settler accumulated since the first debounceSave call for
          // this thread, then clear the list before the async work begins.
          const batch = this.pendingDebounceSettlers.get(threadId) ?? [];
          this.pendingDebounceSettlers.delete(threadId);

          this.enqueueSave(threadId, messageList, memoryConfig)
            .then(() => {
              for (const s of batch) s.resolve();
            })
            .catch(err => {
              this.logger?.error?.('Error in debounceSave', { err, threadId });
              for (const s of batch) s.reject(err);
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
   * Errors from persistUnsavedMessages are propagated to the caller so that flushMessages
   * and batchMessages do not silently resolve on storage failures.
   *
   * @param threadId - The ID of the thread whose messages should be saved.
   * @param messageList - The MessageList instance containing unsaved messages.
   * @param memoryConfig - Optional memory configuration to use for saving.
   */
  private enqueueSave(threadId: string, messageList: MessageList, memoryConfig?: MemoryConfigInternal) {
    const prev = this.saveQueues.get(threadId) || Promise.resolve();
    // Recover from any error in the preceding save so this save still runs even when
    // the previous one failed.  The error from *this* save is propagated to the caller.
    const next = prev
      .catch(() => {})
      .then(() => this.persistUnsavedMessages(messageList, memoryConfig))
      .finally(() => {
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
   *
   * Messages are drained from the unsaved sets only after a successful write so that a
   * transient storage failure leaves them eligible for the next flush attempt.  On failure
   * the drained messages are restored to the MessageList and the error is re-thrown so
   * callers (flushMessages / batchMessages) can observe and surface it.
   *
   * @param messageList - The MessageList instance for the current thread.
   * @param memoryConfig - The memory configuration for saving.
   */
  private async persistUnsavedMessages(messageList: MessageList, memoryConfig?: MemoryConfigInternal) {
    const newMessages = messageList.drainUnsavedMessages();
    if (newMessages.length === 0 || !this.memory) {
      return;
    }
    try {
      await this.memory.saveMessages({
        messages: newMessages,
        memoryConfig,
      });
    } catch (err) {
      // Restore the drained messages so the next flush can retry them.
      messageList.restoreUnsavedMessages(newMessages);
      throw err;
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
    // Claim any settlers that were waiting on the cancelled debounce so they are
    // resolved/rejected alongside this immediate save rather than hanging forever.
    const superseded = this.pendingDebounceSettlers.get(threadId) ?? [];
    this.pendingDebounceSettlers.delete(threadId);
    const save = this.enqueueSave(threadId, messageList, memoryConfig);
    if (superseded.length > 0) {
      save.then(() => {
        for (const s of superseded) s.resolve();
      }).catch(err => {
        for (const s of superseded) s.reject(err);
      });
    }
    return save;
  }
}
