import type { Message, Task } from '@a2a-js/sdk';

// export * from './types';
export * from './error';
export * from '@a2a-js/sdk';
export type { JSONRPCResponse, JSONRPCError } from './types';
export interface TaskContext {
  /**
   * The current state of the task when the handler is invoked or resumed.
   * Note: This is a snapshot. For the absolute latest state during async operations,
   * the handler might need to reload the task via the store.
   */
  task: Task;

  /**
   * The specific user message that triggered this handler invocation or resumption.
   */
  userMessage: Message;

  /**
   * Function to check if cancellation has been requested for this task.
   * Handlers should ideally check this periodically during long-running operations.
   * @returns {boolean} True if cancellation has been requested, false otherwise.
   */
  isCancelled(): boolean;

  /**
   * The message history associated with the task up to the point the handler is invoked.
   * Optional, as history might not always be available or relevant.
   */
  history?: Message[];

  // taskStore is removed as the server now handles loading/saving directly.
  // If a handler specifically needs history, it would need to be passed differently
  // or the handler pattern might need adjustment based on use case.

  // Potential future additions:
  // - logger instance
  // - AbortSignal linked to cancellation
}
