import type { IMastraLogger } from '../../logger/index.js';
import type { MemoryConfig } from '../../memory/index.js';
import type { MastraMemory } from '../../memory/memory.js';
import type { MessageList } from '../message-list/index.js';
export declare class SaveQueueManager {
    private logger?;
    private debounceMs;
    private memory?;
    private static MAX_STALENESS_MS;
    constructor({ logger, debounceMs, memory }: {
        logger?: IMastraLogger;
        debounceMs?: number;
        memory?: MastraMemory;
    });
    private saveQueues;
    private saveDebounceTimers;
    /**
     * Debounces save operations for a thread, ensuring that consecutive save requests
     * are batched and only the latest is executed after a short delay.
     * @param threadId - The ID of the thread to debounce saves for.
     * @param saveFn - The save function to debounce.
     */
    private debounceSave;
    /**
     * Enqueues a save operation for a thread, ensuring that saves are executed in order and
     * only one save runs at a time per thread. If a save is already in progress for the thread,
     * the new save is queued to run after the previous completes.
     *
     * @param threadId - The ID of the thread whose messages should be saved.
     * @param messageList - The MessageList instance containing unsaved messages.
     * @param memoryConfig - Optional memory configuration to use for saving.
     */
    private enqueueSave;
    /**
     * Clears any pending debounced save for a thread, preventing the scheduled save
     * from executing if it hasn't already fired.
     *
     * @param threadId - The ID of the thread whose debounced save should be cleared.
     */
    clearDebounce(threadId: string): void;
    /**
     * Persists any unsaved messages from the MessageList to memory storage.
     * Drains the list of unsaved messages and writes them using the memory backend.
     * @param messageList - The MessageList instance for the current thread.
     * @param memoryConfig - The memory configuration for saving.
     */
    private persistUnsavedMessages;
    /**
     * Batches a save of unsaved messages for a thread, using debouncing to batch rapid updates.
     * If the oldest unsaved message is stale (older than MAX_STALENESS_MS), the save is performed immediately.
     * Otherwise, the save is delayed to batch multiple updates and reduce redundant writes.
     *
     * @param messageList - The MessageList instance containing unsaved messages.
     * @param threadId - The ID of the thread whose messages are being saved.
     * @param memoryConfig - Optional memory configuration for saving.
     */
    batchMessages(messageList: MessageList, threadId?: string, memoryConfig?: MemoryConfig): Promise<void>;
    /**
     * Forces an immediate save of unsaved messages for a thread, bypassing any debounce delay.
     * This is used when a flush to persistent storage is required (e.g., on shutdown or critical transitions).
     *
     * @param messageList - The MessageList instance containing unsaved messages.
     * @param threadId - The ID of the thread whose messages are being saved.
     * @param memoryConfig - Optional memory configuration for saving.
     */
    flushMessages(messageList: MessageList, threadId?: string, memoryConfig?: MemoryConfig): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map