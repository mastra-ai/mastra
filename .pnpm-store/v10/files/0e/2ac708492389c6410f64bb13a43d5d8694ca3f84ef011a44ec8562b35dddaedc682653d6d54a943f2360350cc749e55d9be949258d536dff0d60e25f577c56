import { LanguageModelV1Source, LanguageModelV1FinishReason, JSONValue as JSONValue$1 } from '@ai-sdk/provider';
import { FetchFunction, ToolCall, ToolResult, Validator } from '@ai-sdk/provider-utils';
export { generateId } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { JSONSchema7 } from 'json-schema';

/**
Represents the number of tokens used in a prompt and completion.
 */
type LanguageModelUsage = {
    /**
  The number of tokens used in the prompt.
     */
    promptTokens: number;
    /**
  The number of tokens used in the completion.
   */
    completionTokens: number;
    /**
  The total number of tokens used (promptTokens + completionTokens).
     */
    totalTokens: number;
};

type AssistantStatus = 'in_progress' | 'awaiting_message';
type UseAssistantOptions = {
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
    credentials?: RequestCredentials;
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
    fetch?: FetchFunction;
};

type IdGenerator = () => string;
/**
Tool invocations are either tool calls or tool results. For each assistant tool call,
there is one tool invocation. While the call is in progress, the invocation is a tool call.
Once the call is complete, the invocation is a tool result.

The step is used to track how to map an assistant UI message with many tool invocations
back to a sequence of LLM assistant/tool result message pairs.
It is optional for backwards compatibility.
 */
type ToolInvocation = ({
    state: 'partial-call';
    step?: number;
} & ToolCall<string, any>) | ({
    state: 'call';
    step?: number;
} & ToolCall<string, any>) | ({
    state: 'result';
    step?: number;
} & ToolResult<string, any, any>);
/**
 * An attachment that can be sent along with a message.
 */
interface Attachment {
    /**
     * The name of the attachment, usually the file name.
     */
    name?: string;
    /**
     * A string indicating the [media type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type).
     * By default, it's extracted from the pathname's extension.
     */
    contentType?: string;
    /**
     * The URL of the attachment. It can either be a URL to a hosted file or a [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs).
     */
    url: string;
}
/**
 * AI SDK UI Messages. They are used in the client and to communicate between the frontend and the API routes.
 */
interface Message {
    /**
  A unique identifier for the message.
     */
    id: string;
    /**
  The timestamp of the message.
     */
    createdAt?: Date;
    /**
  Text content of the message. Use parts when possible.
     */
    content: string;
    /**
  Reasoning for the message.
  
  @deprecated Use `parts` instead.
     */
    reasoning?: string;
    /**
     * Additional attachments to be sent along with the message.
     */
    experimental_attachments?: Attachment[];
    /**
  The 'data' role is deprecated.
     */
    role: 'system' | 'user' | 'assistant' | 'data';
    /**
  For data messages.
  
  @deprecated Data messages will be removed.
     */
    data?: JSONValue;
    /**
     * Additional message-specific information added on the server via StreamData
     */
    annotations?: JSONValue[] | undefined;
    /**
  Tool invocations (that can be tool calls or tool results, depending on whether or not the invocation has finished)
  that the assistant made as part of this message.
  
  @deprecated Use `parts` instead.
     */
    toolInvocations?: Array<ToolInvocation>;
    /**
     * The parts of the message. Use this for rendering the message in the UI.
     *
     * Assistant messages can have text, reasoning and tool invocation parts.
     * User messages can have text parts.
     */
    parts?: Array<TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart>;
}
type UIMessage = Message & {
    /**
     * The parts of the message. Use this for rendering the message in the UI.
     *
     * Assistant messages can have text, reasoning and tool invocation parts.
     * User messages can have text parts.
     */
    parts: Array<TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart>;
};
/**
 * A text part of a message.
 */
type TextUIPart = {
    type: 'text';
    /**
     * The text content.
     */
    text: string;
};
/**
 * A reasoning part of a message.
 */
type ReasoningUIPart = {
    type: 'reasoning';
    /**
     * The reasoning text.
     */
    reasoning: string;
    details: Array<{
        type: 'text';
        text: string;
        signature?: string;
    } | {
        type: 'redacted';
        data: string;
    }>;
};
/**
 * A tool invocation part of a message.
 */
type ToolInvocationUIPart = {
    type: 'tool-invocation';
    /**
     * The tool invocation.
     */
    toolInvocation: ToolInvocation;
};
/**
 * A source part of a message.
 */
type SourceUIPart = {
    type: 'source';
    /**
     * The source.
     */
    source: LanguageModelV1Source;
};
/**
 * A file part of a message.
 */
type FileUIPart = {
    type: 'file';
    mimeType: string;
    data: string;
};
/**
 * A step boundary part of a message.
 */
type StepStartUIPart = {
    type: 'step-start';
};
type CreateMessage = Omit<Message, 'id'> & {
    id?: Message['id'];
};
type ChatRequest = {
    /**
  An optional object of headers to be passed to the API endpoint.
   */
    headers?: Record<string, string> | Headers;
    /**
  An optional object to be passed to the API endpoint.
  */
    body?: object;
    /**
  The messages of the chat.
     */
    messages: Message[];
    /**
  Additional data to be sent to the server.
     */
    data?: JSONValue;
};
type RequestOptions = {
    /**
  An optional object of headers to be passed to the API endpoint.
   */
    headers?: Record<string, string> | Headers;
    /**
  An optional object to be passed to the API endpoint.
     */
    body?: object;
};
type ChatRequestOptions = {
    /**
  Additional headers that should be to be passed to the API endpoint.
   */
    headers?: Record<string, string> | Headers;
    /**
  Additional body JSON properties that should be sent to the API endpoint.
   */
    body?: object;
    /**
  Additional data to be sent to the API endpoint.
     */
    data?: JSONValue;
    /**
     * Additional files to be sent to the server.
     */
    experimental_attachments?: FileList | Array<Attachment>;
    /**
     * Allow submitting an empty message. Defaults to `false`.
     */
    allowEmptySubmit?: boolean;
};
type UseChatOptions = {
    /**
  Keeps the last message when an error happens. Defaults to `true`.
  
  @deprecated This option will be removed in the next major release.
     */
    keepLastMessageOnError?: boolean;
    /**
     * The API endpoint that accepts a `{ messages: Message[] }` object and returns
     * a stream of tokens of the AI chat response. Defaults to `/api/chat`.
     */
    api?: string;
    /**
     * A unique identifier for the chat. If not provided, a random one will be
     * generated. When provided, the `useChat` hook with the same `id` will
     * have shared states across components.
     */
    id?: string;
    /**
     * Initial messages of the chat. Useful to load an existing chat history.
     */
    initialMessages?: Message[];
    /**
     * Initial input of the chat.
     */
    initialInput?: string;
    /**
  Optional callback function that is invoked when a tool call is received.
  Intended for automatic client-side tool execution.
  
  You can optionally return a result for the tool call,
  either synchronously or asynchronously.
     */
    onToolCall?: ({ toolCall, }: {
        toolCall: ToolCall<string, unknown>;
    }) => void | Promise<unknown> | unknown;
    /**
     * Callback function to be called when the API response is received.
     */
    onResponse?: (response: Response) => void | Promise<void>;
    /**
     * Optional callback function that is called when the assistant message is finished streaming.
     *
     * @param message The message that was streamed.
     * @param options.usage The token usage of the message.
     * @param options.finishReason The finish reason of the message.
     */
    onFinish?: (message: Message, options: {
        usage: LanguageModelUsage;
        finishReason: LanguageModelV1FinishReason;
    }) => void;
    /**
     * Callback function to be called when an error is encountered.
     */
    onError?: (error: Error) => void;
    /**
     * A way to provide a function that is going to be used for ids for messages and the chat.
     * If not provided the default AI SDK `generateId` is used.
     */
    generateId?: IdGenerator;
    /**
     * The credentials mode to be used for the fetch request.
     * Possible values are: 'omit', 'same-origin', 'include'.
     * Defaults to 'same-origin'.
     */
    credentials?: RequestCredentials;
    /**
     * HTTP headers to be sent with the API request.
     */
    headers?: Record<string, string> | Headers;
    /**
     * Extra body object to be sent with the API request.
     * @example
     * Send a `sessionId` to the API along with the messages.
     * ```js
     * useChat({
     *   body: {
     *     sessionId: '123',
     *   }
     * })
     * ```
     */
    body?: object;
    /**
     * Whether to send extra message fields such as `message.id` and `message.createdAt` to the API.
     * Defaults to `false`. When set to `true`, the API endpoint might need to
     * handle the extra fields before forwarding the request to the AI service.
     */
    sendExtraMessageFields?: boolean;
    /**
  Streaming protocol that is used. Defaults to `data`.
     */
    streamProtocol?: 'data' | 'text';
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
};
type UseCompletionOptions = {
    /**
     * The API endpoint that accepts a `{ prompt: string }` object and returns
     * a stream of tokens of the AI completion response. Defaults to `/api/completion`.
     */
    api?: string;
    /**
     * An unique identifier for the chat. If not provided, a random one will be
     * generated. When provided, the `useChat` hook with the same `id` will
     * have shared states across components.
     */
    id?: string;
    /**
     * Initial prompt input of the completion.
     */
    initialInput?: string;
    /**
     * Initial completion result. Useful to load an existing history.
     */
    initialCompletion?: string;
    /**
     * Callback function to be called when the API response is received.
     */
    onResponse?: (response: Response) => void | Promise<void>;
    /**
     * Callback function to be called when the completion is finished streaming.
     */
    onFinish?: (prompt: string, completion: string) => void;
    /**
     * Callback function to be called when an error is encountered.
     */
    onError?: (error: Error) => void;
    /**
     * The credentials mode to be used for the fetch request.
     * Possible values are: 'omit', 'same-origin', 'include'.
     * Defaults to 'same-origin'.
     */
    credentials?: RequestCredentials;
    /**
     * HTTP headers to be sent with the API request.
     */
    headers?: Record<string, string> | Headers;
    /**
     * Extra body object to be sent with the API request.
     * @example
     * Send a `sessionId` to the API along with the prompt.
     * ```js
     * useChat({
     *   body: {
     *     sessionId: '123',
     *   }
     * })
     * ```
     */
    body?: object;
    /**
  Streaming protocol that is used. Defaults to `data`.
     */
    streamProtocol?: 'data' | 'text';
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
};
/**
A JSON value can be a string, number, boolean, object, array, or null.
JSON values can be serialized and deserialized by the JSON.stringify and JSON.parse methods.
 */
type JSONValue = null | string | number | boolean | {
    [value: string]: JSONValue;
} | Array<JSONValue>;
type AssistantMessage = {
    id: string;
    role: 'assistant';
    content: Array<{
        type: 'text';
        text: {
            value: string;
        };
    }>;
};
type DataMessage = {
    id?: string;
    role: 'data';
    data: JSONValue;
};

type AssistantStreamString = `${(typeof StreamStringPrefixes)[keyof typeof StreamStringPrefixes]}:${string}\n`;
interface AssistantStreamPart<CODE extends string, NAME extends string, TYPE> {
    code: CODE;
    name: NAME;
    parse: (value: JSONValue) => {
        type: NAME;
        value: TYPE;
    };
}
declare const textStreamPart: AssistantStreamPart<'0', 'text', string>;
declare const errorStreamPart: AssistantStreamPart<'3', 'error', string>;
declare const assistantMessageStreamPart: AssistantStreamPart<'4', 'assistant_message', AssistantMessage>;
declare const assistantControlDataStreamPart: AssistantStreamPart<'5', 'assistant_control_data', {
    threadId: string;
    messageId: string;
}>;
declare const dataMessageStreamPart: AssistantStreamPart<'6', 'data_message', DataMessage>;
type AssistantStreamParts = typeof textStreamPart | typeof errorStreamPart | typeof assistantMessageStreamPart | typeof assistantControlDataStreamPart | typeof dataMessageStreamPart;
type AssistantStreamPartValueType = {
    [P in AssistantStreamParts as P['name']]: ReturnType<P['parse']>['value'];
};
type AssistantStreamPartType = ReturnType<typeof textStreamPart.parse> | ReturnType<typeof errorStreamPart.parse> | ReturnType<typeof assistantMessageStreamPart.parse> | ReturnType<typeof assistantControlDataStreamPart.parse> | ReturnType<typeof dataMessageStreamPart.parse>;
declare const StreamStringPrefixes: {
    readonly text: "0";
    readonly error: "3";
    readonly assistant_message: "4";
    readonly assistant_control_data: "5";
    readonly data_message: "6";
};
declare const parseAssistantStreamPart: (line: string) => AssistantStreamPartType;
declare function formatAssistantStreamPart<T extends keyof AssistantStreamPartValueType>(type: T, value: AssistantStreamPartValueType[T]): AssistantStreamString;

declare const getOriginalFetch$1: () => typeof fetch;
declare function callChatApi({ api, body, streamProtocol, credentials, headers, abortController, restoreMessagesOnFailure, onResponse, onUpdate, onFinish, onToolCall, generateId, fetch, lastMessage, requestType, }: {
    api: string;
    body: Record<string, any>;
    streamProtocol: 'data' | 'text' | undefined;
    credentials: RequestCredentials | undefined;
    headers: HeadersInit | undefined;
    abortController: (() => AbortController | null) | undefined;
    restoreMessagesOnFailure: () => void;
    onResponse: ((response: Response) => void | Promise<void>) | undefined;
    onUpdate: (options: {
        message: UIMessage;
        data: JSONValue[] | undefined;
        replaceLastMessage: boolean;
    }) => void;
    onFinish: UseChatOptions['onFinish'];
    onToolCall: UseChatOptions['onToolCall'];
    generateId: IdGenerator;
    fetch: ReturnType<typeof getOriginalFetch$1> | undefined;
    lastMessage: UIMessage | undefined;
    requestType?: 'generate' | 'resume';
}): Promise<void>;

declare const getOriginalFetch: () => typeof fetch;
declare function callCompletionApi({ api, prompt, credentials, headers, body, streamProtocol, setCompletion, setLoading, setError, setAbortController, onResponse, onFinish, onError, onData, fetch, }: {
    api: string;
    prompt: string;
    credentials: RequestCredentials | undefined;
    headers: HeadersInit | undefined;
    body: Record<string, any>;
    streamProtocol: 'data' | 'text' | undefined;
    setCompletion: (completion: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: Error | undefined) => void;
    setAbortController: (abortController: AbortController | null) => void;
    onResponse: ((response: Response) => void | Promise<void>) | undefined;
    onFinish: ((prompt: string, completion: string) => void) | undefined;
    onError: ((error: Error) => void) | undefined;
    onData: ((data: JSONValue[]) => void) | undefined;
    fetch: ReturnType<typeof getOriginalFetch> | undefined;
}): Promise<string | null | undefined>;

type DataStreamString = `${(typeof DataStreamStringPrefixes)[keyof typeof DataStreamStringPrefixes]}:${string}\n`;
interface DataStreamPart<CODE extends string, NAME extends string, TYPE> {
    code: CODE;
    name: NAME;
    parse: (value: JSONValue) => {
        type: NAME;
        value: TYPE;
    };
}
declare const dataStreamParts: readonly [DataStreamPart<"0", "text", string>, DataStreamPart<"2", "data", JSONValue[]>, DataStreamPart<"3", "error", string>, DataStreamPart<"8", "message_annotations", JSONValue[]>, DataStreamPart<"9", "tool_call", ToolCall<string, any>>, DataStreamPart<"a", "tool_result", Omit<ToolResult<string, any, any>, "args" | "toolName">>, DataStreamPart<"b", "tool_call_streaming_start", {
    toolCallId: string;
    toolName: string;
}>, DataStreamPart<"c", "tool_call_delta", {
    toolCallId: string;
    argsTextDelta: string;
}>, DataStreamPart<"d", "finish_message", {
    finishReason: LanguageModelV1FinishReason;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}>, DataStreamPart<"e", "finish_step", {
    isContinued: boolean;
    finishReason: LanguageModelV1FinishReason;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}>, DataStreamPart<"f", "start_step", {
    messageId: string;
}>, DataStreamPart<"g", "reasoning", string>, DataStreamPart<"h", "source", LanguageModelV1Source>, DataStreamPart<"i", "redacted_reasoning", {
    data: string;
}>, DataStreamPart<"j", "reasoning_signature", {
    signature: string;
}>, DataStreamPart<"k", "file", {
    data: string;
    mimeType: string;
}>];
type DataStreamParts = (typeof dataStreamParts)[number];
/**
 * Maps the type of a stream part to its value type.
 */
type DataStreamPartValueType = {
    [P in DataStreamParts as P['name']]: ReturnType<P['parse']>['value'];
};
type DataStreamPartType = ReturnType<DataStreamParts['parse']>;
/**
 * The map of prefixes for data in the stream
 *
 * - 0: Text from the LLM response
 * - 1: (OpenAI) function_call responses
 * - 2: custom JSON added by the user using `Data`
 * - 6: (OpenAI) tool_call responses
 *
 * Example:
 * ```
 * 0:Vercel
 * 0:'s
 * 0: AI
 * 0: AI
 * 0: SDK
 * 0: is great
 * 0:!
 * 2: { "someJson": "value" }
 * 1: {"function_call": {"name": "get_current_weather", "arguments": "{\\n\\"location\\": \\"Charlottesville, Virginia\\",\\n\\"format\\": \\"celsius\\"\\n}"}}
 * 6: {"tool_call": {"id": "tool_0", "type": "function", "function": {"name": "get_current_weather", "arguments": "{\\n\\"location\\": \\"Charlottesville, Virginia\\",\\n\\"format\\": \\"celsius\\"\\n}"}}}
 *```
 */
declare const DataStreamStringPrefixes: { [K in DataStreamParts["name"]]: (typeof dataStreamParts)[number]["code"]; };
/**
Parses a stream part from a string.

@param line The string to parse.
@returns The parsed stream part.
@throws An error if the string cannot be parsed.
 */
declare const parseDataStreamPart: (line: string) => DataStreamPartType;
/**
Prepends a string with a prefix from the `StreamChunkPrefixes`, JSON-ifies it,
and appends a new line.

It ensures type-safety for the part type and value.
 */
declare function formatDataStreamPart<T extends keyof DataStreamPartValueType>(type: T, value: DataStreamPartValueType[T]): DataStreamString;

/**
 * Converts a data URL of type text/* to a text string.
 */
declare function getTextFromDataUrl(dataUrl: string): string;

/**
Create a type from an object with all keys and nested keys set to optional.
The helper supports normal objects and Zod schemas (which are resolved automatically).
It always recurses into arrays.

Adopted from [type-fest](https://github.com/sindresorhus/type-fest/tree/main) PartialDeep.
 */
type DeepPartial<T> = T extends z.ZodTypeAny ? DeepPartialInternal<z.infer<T>> : DeepPartialInternal<T>;
type DeepPartialInternal<T> = T extends null | undefined | string | number | boolean | symbol | bigint | void | Date | RegExp | ((...arguments_: any[]) => unknown) | (new (...arguments_: any[]) => unknown) ? T : T extends Map<infer KeyType, infer ValueType> ? PartialMap<KeyType, ValueType> : T extends Set<infer ItemType> ? PartialSet<ItemType> : T extends ReadonlyMap<infer KeyType, infer ValueType> ? PartialReadonlyMap<KeyType, ValueType> : T extends ReadonlySet<infer ItemType> ? PartialReadonlySet<ItemType> : T extends object ? T extends ReadonlyArray<infer ItemType> ? ItemType[] extends T ? readonly ItemType[] extends T ? ReadonlyArray<DeepPartialInternal<ItemType | undefined>> : Array<DeepPartialInternal<ItemType | undefined>> : PartialObject<T> : PartialObject<T> : unknown;
type PartialMap<KeyType, ValueType> = {} & Map<DeepPartialInternal<KeyType>, DeepPartialInternal<ValueType>>;
type PartialSet<T> = {} & Set<DeepPartialInternal<T>>;
type PartialReadonlyMap<KeyType, ValueType> = {} & ReadonlyMap<DeepPartialInternal<KeyType>, DeepPartialInternal<ValueType>>;
type PartialReadonlySet<T> = {} & ReadonlySet<DeepPartialInternal<T>>;
type PartialObject<ObjectType extends object> = {
    [KeyType in keyof ObjectType]?: DeepPartialInternal<ObjectType[KeyType]>;
};

declare function extractMaxToolInvocationStep(toolInvocations: ToolInvocation[] | undefined): number | undefined;

declare function fillMessageParts(messages: Message[]): UIMessage[];

declare function getMessageParts(message: Message | CreateMessage | UIMessage): (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[];

/**
 * Performs a deep-equal comparison of two parsed JSON objects.
 *
 * @param {any} obj1 - The first object to compare.
 * @param {any} obj2 - The second object to compare.
 * @returns {boolean} - Returns true if the two objects are deeply equal, false otherwise.
 */
declare function isDeepEqualData(obj1: any, obj2: any): boolean;

declare function parsePartialJson(jsonText: string | undefined): {
    value: JSONValue$1 | undefined;
    state: 'undefined-input' | 'successful-parse' | 'repaired-parse' | 'failed-parse';
};

declare function prepareAttachmentsForRequest(attachmentsFromOptions: FileList | Array<Attachment> | undefined): Promise<Attachment[]>;

declare function processAssistantStream({ stream, onTextPart, onErrorPart, onAssistantMessagePart, onAssistantControlDataPart, onDataMessagePart, }: {
    stream: ReadableStream<Uint8Array>;
    onTextPart?: (streamPart: (AssistantStreamPartType & {
        type: 'text';
    })['value']) => Promise<void> | void;
    onErrorPart?: (streamPart: (AssistantStreamPartType & {
        type: 'error';
    })['value']) => Promise<void> | void;
    onAssistantMessagePart?: (streamPart: (AssistantStreamPartType & {
        type: 'assistant_message';
    })['value']) => Promise<void> | void;
    onAssistantControlDataPart?: (streamPart: (AssistantStreamPartType & {
        type: 'assistant_control_data';
    })['value']) => Promise<void> | void;
    onDataMessagePart?: (streamPart: (AssistantStreamPartType & {
        type: 'data_message';
    })['value']) => Promise<void> | void;
}): Promise<void>;

declare function processDataStream({ stream, onTextPart, onReasoningPart, onReasoningSignaturePart, onRedactedReasoningPart, onSourcePart, onFilePart, onDataPart, onErrorPart, onToolCallStreamingStartPart, onToolCallDeltaPart, onToolCallPart, onToolResultPart, onMessageAnnotationsPart, onFinishMessagePart, onFinishStepPart, onStartStepPart, }: {
    stream: ReadableStream<Uint8Array>;
    onTextPart?: (streamPart: (DataStreamPartType & {
        type: 'text';
    })['value']) => Promise<void> | void;
    onReasoningPart?: (streamPart: (DataStreamPartType & {
        type: 'reasoning';
    })['value']) => Promise<void> | void;
    onReasoningSignaturePart?: (streamPart: (DataStreamPartType & {
        type: 'reasoning_signature';
    })['value']) => Promise<void> | void;
    onRedactedReasoningPart?: (streamPart: (DataStreamPartType & {
        type: 'redacted_reasoning';
    })['value']) => Promise<void> | void;
    onFilePart?: (streamPart: (DataStreamPartType & {
        type: 'file';
    })['value']) => Promise<void> | void;
    onSourcePart?: (streamPart: (DataStreamPartType & {
        type: 'source';
    })['value']) => Promise<void> | void;
    onDataPart?: (streamPart: (DataStreamPartType & {
        type: 'data';
    })['value']) => Promise<void> | void;
    onErrorPart?: (streamPart: (DataStreamPartType & {
        type: 'error';
    })['value']) => Promise<void> | void;
    onToolCallStreamingStartPart?: (streamPart: (DataStreamPartType & {
        type: 'tool_call_streaming_start';
    })['value']) => Promise<void> | void;
    onToolCallDeltaPart?: (streamPart: (DataStreamPartType & {
        type: 'tool_call_delta';
    })['value']) => Promise<void> | void;
    onToolCallPart?: (streamPart: (DataStreamPartType & {
        type: 'tool_call';
    })['value']) => Promise<void> | void;
    onToolResultPart?: (streamPart: (DataStreamPartType & {
        type: 'tool_result';
    })['value']) => Promise<void> | void;
    onMessageAnnotationsPart?: (streamPart: (DataStreamPartType & {
        type: 'message_annotations';
    })['value']) => Promise<void> | void;
    onFinishMessagePart?: (streamPart: (DataStreamPartType & {
        type: 'finish_message';
    })['value']) => Promise<void> | void;
    onFinishStepPart?: (streamPart: (DataStreamPartType & {
        type: 'finish_step';
    })['value']) => Promise<void> | void;
    onStartStepPart?: (streamPart: (DataStreamPartType & {
        type: 'start_step';
    })['value']) => Promise<void> | void;
}): Promise<void>;

declare function processTextStream({ stream, onTextPart, }: {
    stream: ReadableStream<Uint8Array>;
    onTextPart: (chunk: string) => Promise<void> | void;
}): Promise<void>;

/**
 * Used to mark schemas so we can support both Zod and custom schemas.
 */
declare const schemaSymbol: unique symbol;
type Schema<OBJECT = unknown> = Validator<OBJECT> & {
    /**
     * Used to mark schemas so we can support both Zod and custom schemas.
     */
    [schemaSymbol]: true;
    /**
     * Schema type for inference.
     */
    _type: OBJECT;
    /**
     * The JSON Schema for the schema. It is passed to the providers.
     */
    readonly jsonSchema: JSONSchema7;
};
/**
 * Create a schema using a JSON Schema.
 *
 * @param jsonSchema The JSON Schema for the schema.
 * @param options.validate Optional. A validation function for the schema.
 */
declare function jsonSchema<OBJECT = unknown>(jsonSchema: JSONSchema7, { validate, }?: {
    validate?: (value: unknown) => {
        success: true;
        value: OBJECT;
    } | {
        success: false;
        error: Error;
    };
}): Schema<OBJECT>;
declare function asSchema<OBJECT>(schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>): Schema<OBJECT>;

declare function shouldResubmitMessages({ originalMaxToolInvocationStep, originalMessageCount, maxSteps, messages, }: {
    originalMaxToolInvocationStep: number | undefined;
    originalMessageCount: number;
    maxSteps: number;
    messages: UIMessage[];
}): boolean;
/**
Check if the message is an assistant message with completed tool calls.
The last step of the message must have at least one tool invocation and
all tool invocations must have a result.
 */
declare function isAssistantMessageWithCompletedToolCalls(message: UIMessage): message is UIMessage & {
    role: 'assistant';
};

/**
 * Updates the result of a specific tool invocation in the last message of the given messages array.
 *
 * @param {object} params - The parameters object.
 * @param {UIMessage[]} params.messages - An array of messages, from which the last one is updated.
 * @param {string} params.toolCallId - The unique identifier for the tool invocation to update.
 * @param {unknown} params.toolResult - The result object to attach to the tool invocation.
 * @returns {void} This function does not return anything.
 */
declare function updateToolCallResult({ messages, toolCallId, toolResult: result, }: {
    messages: UIMessage[];
    toolCallId: string;
    toolResult: unknown;
}): void;

declare function zodSchema<OBJECT>(zodSchema: z.Schema<OBJECT, z.ZodTypeDef, any>, options?: {
    /**
     * Enables support for references in the schema.
     * This is required for recursive schemas, e.g. with `z.lazy`.
     * However, not all language models and providers support such references.
     * Defaults to `false`.
     */
    useReferences?: boolean;
}): Schema<OBJECT>;

export { type AssistantMessage, type AssistantStatus, type AssistantStreamPart, type AssistantStreamString, type Attachment, type ChatRequest, type ChatRequestOptions, type CreateMessage, type DataMessage, type DataStreamPart, type DataStreamString, type DeepPartial, type FileUIPart, type IdGenerator, type JSONValue, type Message, type ReasoningUIPart, type RequestOptions, type Schema, type SourceUIPart, type StepStartUIPart, type TextUIPart, type ToolInvocation, type ToolInvocationUIPart, type UIMessage, type UseAssistantOptions, type UseChatOptions, type UseCompletionOptions, asSchema, callChatApi, callCompletionApi, extractMaxToolInvocationStep, fillMessageParts, formatAssistantStreamPart, formatDataStreamPart, getMessageParts, getTextFromDataUrl, isAssistantMessageWithCompletedToolCalls, isDeepEqualData, jsonSchema, parseAssistantStreamPart, parseDataStreamPart, parsePartialJson, prepareAttachmentsForRequest, processAssistantStream, processDataStream, processTextStream, shouldResubmitMessages, updateToolCallResult, zodSchema };
