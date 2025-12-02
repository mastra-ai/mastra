import { Message, CreateMessage, AssistantStatus, UseAssistantOptions, UIMessage, ChatRequestOptions, JSONValue, UseChatOptions, RequestOptions, UseCompletionOptions, Schema, DeepPartial } from '@ai-sdk/ui-utils';
export { CreateMessage, Message, UseChatOptions, UseCompletionOptions } from '@ai-sdk/ui-utils';
import { FetchFunction } from '@ai-sdk/provider-utils';
import z from 'zod';

type UseAssistantHelpers = {
    /**
     * The current array of chat messages.
     */
    messages: Message[];
    /**
     * Update the message store with a new array of messages.
     */
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    /**
     * The current thread ID.
     */
    threadId: string | undefined;
    /**
     * Set the current thread ID. Specifying a thread ID will switch to that thread, if it exists. If set to 'undefined', a new thread will be created. For both cases, `threadId` will be updated with the new value and `messages` will be cleared.
     */
    setThreadId: (threadId: string | undefined) => void;
    /**
     * The current value of the input field.
     */
    input: string;
    /**
     * Append a user message to the chat list. This triggers the API call to fetch
     * the assistant's response.
     * @param message The message to append
     * @param requestOptions Additional options to pass to the API call
     */
    append: (message: Message | CreateMessage, requestOptions?: {
        data?: Record<string, string>;
    }) => Promise<void>;
    /**
  Abort the current request immediately, keep the generated tokens if any.
     */
    stop: () => void;
    /**
     * setState-powered method to update the input value.
     */
    setInput: React.Dispatch<React.SetStateAction<string>>;
    /**
     * Handler for the `onChange` event of the input field to control the input's value.
     */
    handleInputChange: (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
    /**
     * Form submission handler that automatically resets the input field and appends a user message.
     */
    submitMessage: (event?: React.FormEvent<HTMLFormElement>, requestOptions?: {
        data?: Record<string, string>;
    }) => Promise<void>;
    /**
     * The current status of the assistant. This can be used to show a loading indicator.
     */
    status: AssistantStatus;
    /**
     * The error thrown during the assistant message processing, if any.
     */
    error: undefined | Error;
};
declare function useAssistant({ api, threadId: threadIdParam, credentials, headers, body, onError, fetch, }: UseAssistantOptions): UseAssistantHelpers;

type UseChatHelpers = {
    /** Current messages in the chat */
    messages: UIMessage[];
    /** The error object of the API request */
    error: undefined | Error;
    /**
     * Append a user message to the chat list. This triggers the API call to fetch
     * the assistant's response.
     * @param message The message to append
     * @param options Additional options to pass to the API call
     */
    append: (message: Message | CreateMessage, chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>;
    /**
     * Reload the last AI chat response for the given chat history. If the last
     * message isn't from the assistant, it will request the API to generate a
     * new response.
     */
    reload: (chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>;
    /**
     * Abort the current request immediately, keep the generated tokens if any.
     */
    stop: () => void;
    /**
     * Resume an ongoing chat generation stream. This does not resume an aborted generation.
     */
    experimental_resume: () => void;
    /**
     * Update the `messages` state locally. This is useful when you want to
     * edit the messages on the client, and then trigger the `reload` method
     * manually to regenerate the AI response.
     */
    setMessages: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
    /** The current value of the input */
    input: string;
    /** setState-powered method to update the input value */
    setInput: React.Dispatch<React.SetStateAction<string>>;
    /** An input/textarea-ready onChange handler to control the value of the input */
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
    /** Form submission handler to automatically reset input and append a user message */
    handleSubmit: (event?: {
        preventDefault?: () => void;
    }, chatRequestOptions?: ChatRequestOptions) => void;
    metadata?: Object;
    /**
     * Whether the API request is in progress
     *
     * @deprecated use `status` instead
     */
    isLoading: boolean;
    /**
     * Hook status:
     *
     * - `submitted`: The message has been sent to the API and we're awaiting the start of the response stream.
     * - `streaming`: The response is actively streaming in from the API, receiving chunks of data.
     * - `ready`: The full response has been received and processed; a new user message can be submitted.
     * - `error`: An error occurred during the API request, preventing successful completion.
     */
    status: 'submitted' | 'streaming' | 'ready' | 'error';
    /** Additional data added on the server via StreamData. */
    data?: JSONValue[];
    /** Set the data of the chat. You can use this to transform or clear the chat data. */
    setData: (data: JSONValue[] | undefined | ((data: JSONValue[] | undefined) => JSONValue[] | undefined)) => void;
    /** The id of the chat */
    id: string;
};
declare function useChat({ api, id, initialMessages, initialInput, sendExtraMessageFields, onToolCall, experimental_prepareRequestBody, maxSteps, streamProtocol, onResponse, onFinish, onError, credentials, headers, body, generateId, fetch, keepLastMessageOnError, experimental_throttle: throttleWaitMs, }?: UseChatOptions & {
    key?: string;
    /**
     * Experimental (React only). When a function is provided, it will be used
     * to prepare the request body for the chat API. This can be useful for
     * customizing the request body based on the messages and data in the chat.
     *
     * @param messages The current messages in the chat.
     * @param requestData The data object passed in the chat request.
     * @param requestBody The request body object passed in the chat request.
     */
    experimental_prepareRequestBody?: (options: {
        id: string;
        messages: UIMessage[];
        requestData?: JSONValue;
        requestBody?: object;
    }) => unknown;
    /**
  Custom throttle wait in ms for the chat messages and data updates.
  Default is undefined, which disables throttling.
     */
    experimental_throttle?: number;
    /**
  Maximum number of sequential LLM calls (steps), e.g. when you use tool calls.
  Must be at least 1.
  
  A maximum number is required to prevent infinite loops in the case of misconfigured tools.
  
  By default, it's set to 1, which means that only a single LLM call is made.
   */
    maxSteps?: number;
}): UseChatHelpers & {
    addToolResult: ({ toolCallId, result, }: {
        toolCallId: string;
        result: any;
    }) => void;
};

type UseCompletionHelpers = {
    /** The current completion result */
    completion: string;
    /**
     * Send a new prompt to the API endpoint and update the completion state.
     */
    complete: (prompt: string, options?: RequestOptions) => Promise<string | null | undefined>;
    /** The error object of the API request */
    error: undefined | Error;
    /**
     * Abort the current API request but keep the generated tokens.
     */
    stop: () => void;
    /**
     * Update the `completion` state locally.
     */
    setCompletion: (completion: string) => void;
    /** The current value of the input */
    input: string;
    /** setState-powered method to update the input value */
    setInput: React.Dispatch<React.SetStateAction<string>>;
    /**
     * An input/textarea-ready onChange handler to control the value of the input
     * @example
     * ```jsx
     * <input onChange={handleInputChange} value={input} />
     * ```
     */
    handleInputChange: (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
    /**
     * Form submission handler to automatically reset input and append a user message
     * @example
     * ```jsx
     * <form onSubmit={handleSubmit}>
     *  <input onChange={handleInputChange} value={input} />
     * </form>
     * ```
     */
    handleSubmit: (event?: {
        preventDefault?: () => void;
    }) => void;
    /** Whether the API request is in progress */
    isLoading: boolean;
    /** Additional data added on the server via StreamData */
    data?: JSONValue[];
};
declare function useCompletion({ api, id, initialCompletion, initialInput, credentials, headers, body, streamProtocol, fetch, onResponse, onFinish, onError, experimental_throttle: throttleWaitMs, }?: UseCompletionOptions & {
    /**
     * Custom throttle wait in ms for the completion and data updates.
     * Default is undefined, which disables throttling.
     */
    experimental_throttle?: number;
}): UseCompletionHelpers;

type Experimental_UseObjectOptions<RESULT> = {
    /**
     * The API endpoint. It should stream JSON that matches the schema as chunked text.
     */
    api: string;
    /**
     * A Zod schema that defines the shape of the complete object.
     */
    schema: z.Schema<RESULT, z.ZodTypeDef, any> | Schema<RESULT>;
    /**
     * An unique identifier. If not provided, a random one will be
     * generated. When provided, the `useObject` hook with the same `id` will
     * have shared states across components.
     */
    id?: string;
    /**
     * An optional value for the initial object.
     */
    initialValue?: DeepPartial<RESULT>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
    /**
  Callback that is called when the stream has finished.
       */
    onFinish?: (event: {
        /**
    The generated object (typed according to the schema).
    Can be undefined if the final object does not match the schema.
       */
        object: RESULT | undefined;
        /**
    Optional error object. This is e.g. a TypeValidationError when the final object does not match the schema.
     */
        error: Error | undefined;
    }) => Promise<void> | void;
    /**
     * Callback function to be called when an error is encountered.
     */
    onError?: (error: Error) => void;
    /**
     * Additional HTTP headers to be included in the request.
     */
    headers?: Record<string, string> | Headers;
    /**
     * The credentials mode to be used for the fetch request.
     * Possible values are: 'omit', 'same-origin', 'include'.
     * Defaults to 'same-origin'.
     */
    credentials?: RequestCredentials;
};
type Experimental_UseObjectHelpers<RESULT, INPUT> = {
    /**
     * Calls the API with the provided input as JSON body.
     */
    submit: (input: INPUT) => void;
    /**
     * The current value for the generated object. Updated as the API streams JSON chunks.
     */
    object: DeepPartial<RESULT> | undefined;
    /**
     * The error object of the API request if any.
     */
    error: Error | undefined;
    /**
     * Flag that indicates whether an API request is in progress.
     */
    isLoading: boolean;
    /**
     * Abort the current request immediately, keep the current partial object if any.
     */
    stop: () => void;
};
declare function useObject<RESULT, INPUT = any>({ api, id, schema, // required, in the future we will use it for validation
initialValue, fetch, onError, onFinish, headers, credentials, }: Experimental_UseObjectOptions<RESULT>): Experimental_UseObjectHelpers<RESULT, INPUT>;
declare const experimental_useObject: typeof useObject;

export { Experimental_UseObjectHelpers, Experimental_UseObjectOptions, UseAssistantHelpers, UseChatHelpers, UseCompletionHelpers, experimental_useObject, useAssistant, useChat, useCompletion };
