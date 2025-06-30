// Define a type for the assistant status
export type AssistantStatus = 'in_progress' | 'awaiting_message';

export type UseAssistantOptions = {
  /**
   * The API endpoint that accepts a `{ threadId: string | null; message: string; }` object and returns an `AssistantResponse` stream.
   * The threadId refers to an existing thread with messages (or is `null` to create a new thread).
   * The message is the next message that should be appended to the thread and sent to the assistant.
   */
  api: string;

  /**
   * An optional string that represents the ID of an existing thread.
   * If not provided, a new thread will be created.
   */
  threadId?: string;

  /**
   * An optional literal that sets the mode of credentials to be used on the request.
   * Defaults to "same-origin".
   */
  credentials?: any;
  // credentials?: RequestCredentials;

  /**
   * An optional object of headers to be passed to the API endpoint.
   */
  headers?: Record<string, string> | Headers;

  /**
   * An optional, additional body object to be passed to the API endpoint.
   */
  body?: object;

  /**
   * An optional callback that will be called when the assistant encounters an error.
   */
  onError?: (error: Error) => void;

  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
    */
  fetch?: any;
};
