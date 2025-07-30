import type { JSONRPCMessage, Message, Task } from '@a2a-js/sdk';

/**
 * Represents a JSON-RPC error object.
 */
export interface JSONRPCError<Data = unknown | null, Code = number> {
  /**
   * A number indicating the error type that occurred.
   */
  code: Code;

  /**
   * A string providing a short description of the error.
   */
  message: string;

  /**
   * Optional additional data about the error.
   * @default null
   */
  data?: Data;
}

/**
 * Represents a JSON-RPC response object.
 */
export interface JSONRPCResponse<R = unknown | null, E = unknown | null> extends JSONRPCMessage {
  /**
   * The result of the method invocation. Required on success.
   * Should be null or omitted if an error occurred.
   * @default null
   */
  result?: R;

  /**
   * An error object if an error occurred during the request. Required on failure.
   * Should be null or omitted if the request was successful.
   * @default null
   */
  error?: JSONRPCError<E> | null;
}

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
