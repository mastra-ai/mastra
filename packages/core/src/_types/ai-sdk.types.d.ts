/* eslint-disable */
import type { ServerResponse } from 'http';
import type { ServerResponse as ServerResponse_2 } from 'node:http';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod';

/**
 * Custom error class for AI SDK related errors.
 * @extends Error
 */
export declare class AISDKError extends Error {
  private readonly [symbol$d];
  /**
   * The underlying cause of the error, if any.
   */
  readonly cause?: unknown;
  /**
   * Creates an AI SDK Error.
   *
   * @param {Object} params - The parameters for creating the error.
   * @param {string} params.name - The name of the error.
   * @param {string} params.message - The error message.
   * @param {unknown} [params.cause] - The underlying cause of the error.
   */
  constructor({ name, message, cause }: { name: string; message: string; cause?: unknown });
  /**
   * Checks if the given error is an AI SDK Error.
   * @param {unknown} error - The error to check.
   * @returns {boolean} True if the error is an AI SDK Error, false otherwise.
   */
  static isInstance(error: unknown): error is AISDKError;
  protected static hasMarker(error: unknown, marker: string): boolean;
}

/**
 * Appends a client message to the messages array.
 * If the last message in the array has the same id as the new message, it will be replaced.
 * Otherwise, the new message will be appended.
 */
export declare function appendClientMessage({
  messages,
  message,
}: {
  messages: Message[];
  message: Message;
}): Message[];

/**
 * Appends the ResponseMessage[] from the response to a Message[] (for useChat).
 * The messages are converted to Messages before being appended.
 * Timestamps are generated for the new messages.
 *
 * @returns A new Message[] with the response messages appended.
 */
export declare function appendResponseMessages({
  messages,
  responseMessages,
  _internal: { currentDate },
}: {
  messages: Message[];
  responseMessages: ResponseMessage[];
  /**
     Internal. For test use only. May change without notice.
     */
  _internal?: {
    currentDate?: () => Date;
  };
}): Message[];

/**
 Content of an assistant message.
 It can be a string or an array of text, image, reasoning, redacted reasoning, and tool call parts.
 */
export declare type AssistantContent =
  | string
  | Array<TextPart | FilePart | ReasoningPart | RedactedReasoningPart | ToolCallPart>;

declare type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

/**
 * An attachment that can be sent along with a message.
 */
declare interface Attachment {
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
 * Attributes is a map from string to attribute values.
 *
 * Note: only the own enumerable keys are counted as valid attribute keys.
 */
declare interface Attributes {
  [attributeKey: string]: AttributeValue | undefined;
}

/**
 * Attribute values may be any non-nullish primitive value except an object.
 *
 * null or undefined attribute values are invalid and will result in undefined behavior.
 */
declare type AttributeValue =
  | string
  | number
  | boolean
  | Array<null | undefined | string>
  | Array<null | undefined | number>
  | Array<null | undefined | boolean>;

declare type CallSettings = {
  /**
     Maximum number of tokens to generate.
     */
  maxTokens?: number;
  /**
     Temperature setting. This is a number between 0 (almost no randomness) and
     1 (very random).

     It is recommended to set either `temperature` or `topP`, but not both.

     @default 0
     */
  temperature?: number;
  /**
     Nucleus sampling. This is a number between 0 and 1.

     E.g. 0.1 would mean that only tokens with the top 10% probability mass
     are considered.

     It is recommended to set either `temperature` or `topP`, but not both.
     */
  topP?: number;
  /**
     Only sample from the top K options for each subsequent token.

     Used to remove "long tail" low probability responses.
     Recommended for advanced use cases only. You usually only need to use temperature.
     */
  topK?: number;
  /**
     Presence penalty setting. It affects the likelihood of the model to
     repeat information that is already in the prompt.

     The presence penalty is a number between -1 (increase repetition)
     and 1 (maximum penalty, decrease repetition). 0 means no penalty.
     */
  presencePenalty?: number;
  /**
     Frequency penalty setting. It affects the likelihood of the model
     to repeatedly use the same words or phrases.

     The frequency penalty is a number between -1 (increase repetition)
     and 1 (maximum penalty, decrease repetition). 0 means no penalty.
     */
  frequencyPenalty?: number;
  /**
     Stop sequences.
     If set, the model will stop generating text when one of the stop sequences is generated.
     Providers may have limits on the number of stop sequences.
     */
  stopSequences?: string[];
  /**
     The seed (integer) to use for random sampling. If set and supported
     by the model, calls will generate deterministic results.
     */
  seed?: number;
  /**
     Maximum number of retries. Set to 0 to disable retries.

     @default 2
     */
  maxRetries?: number;
  /**
     Abort signal.
     */
  abortSignal?: AbortSignal;
  /**
     Additional HTTP headers to be sent with the request.
     Only applicable for HTTP-based providers.
     */
  headers?: Record<string, string | undefined>;
};

/**
 Warning from the model provider for this call. The call will proceed, but e.g.
 some settings might not be supported, which can lead to suboptimal results.
 */
declare type CallWarning = LanguageModelV1CallWarning;

declare type ConsumeStreamOptions = {
  onError?: (error: unknown) => void;
};

declare interface Context {
  /**
   * Get a value from the context.
   *
   * @param key key which identifies a context value
   */
  getValue(key: symbol): unknown;
  /**
   * Create a new context which inherits from this context and has
   * the given key set to the given value.
   *
   * @param key context key for which to set the value
   * @param value value to set for the given key
   */
  setValue(key: symbol, value: unknown): Context;
  /**
   * Return a new context which inherits from this context but does
   * not contain a value for the given key.
   *
   * @param key context key for which to clear a value
   */
  deleteValue(key: symbol): Context;
}

/**
 Converts an array of messages from useChat into an array of CoreMessages that can be used
 with the AI core functions (e.g. `streamText`).
 */
export declare function convertToCoreMessages<TOOLS extends ToolSet = never>(
  messages: Array<Omit<Message, 'id'>>,
  options?: {
    tools?: TOOLS;
  },
): CoreMessage[];

export declare function convertUint8ArrayToBase64(array: Uint8Array): string;

/**
 An assistant message. It can contain text, tool calls, or a combination of text and tool calls.
 */
export declare type CoreAssistantMessage = {
  role: 'assistant';
  content: AssistantContent;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
};

/**
 A message that can be used in the `messages` field of a prompt.
 It can be a user message, an assistant message, or a tool message.
 */
export declare type CoreMessage = CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage;

/**
 A system message. It can contain system information.

 Note: using the "system" part of the prompt is strongly preferred
 to increase the resilience against prompt injection attacks,
 and because not all providers support several system messages.
 */
export declare type CoreSystemMessage = {
  role: 'system';
  content: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
};

/**
 A tool message. It contains the result of one or more tool calls.
 */
export declare type CoreToolMessage = {
  role: 'tool';
  content: ToolContent;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
};

/**
 A user message. It can contain text or a combination of text and images.
 */
export declare type CoreUserMessage = {
  role: 'user';
  content: UserContent;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
};

/**
 Data content. Can either be a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer.
 */
declare type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

declare type DataStreamOptions = {
  /**
   * Send usage parts to the client.
   * Default to true.
   */
  sendUsage?: boolean;
  /**
   * Send reasoning parts to the client.
   * Default to false.
   */
  sendReasoning?: boolean;
  /**
   * Send source parts to the client.
   * Default to false.
   */
  sendSources?: boolean;
  /**
   * Send the finish event to the client.
   * Set to false if you are using additional streamText calls
   * that send additional data.
   * Default to true.
   */
  experimental_sendFinish?: boolean;
  /**
   * Send the message start event to the client.
   * Set to false if you are using additional streamText calls
   * and the message start event has already been sent.
   * Default to true.
   *
   * Note: this setting is currently not used, but you should
   * already set it to false if you are using additional
   * streamText calls that send additional data to prevent
   * the message start event from being sent multiple times.
   */
  experimental_sendStart?: boolean;
};

declare interface DataStreamPart<CODE extends string, NAME extends string, TYPE> {
  code: CODE;
  name: NAME;
  parse: (value: JSONValue_2) => {
    type: NAME;
    value: TYPE;
  };
}

declare type DataStreamParts = (typeof dataStreamParts)[number];

declare const dataStreamParts: readonly [
  DataStreamPart<'0', 'text', string>,
  DataStreamPart<'2', 'data', JSONValue_2[]>,
  DataStreamPart<'3', 'error', string>,
  DataStreamPart<'8', 'message_annotations', JSONValue_2[]>,
  DataStreamPart<'9', 'tool_call', ToolCall<string, any>>,
  DataStreamPart<'a', 'tool_result', Omit<ToolResult<string, any, any>, 'args' | 'toolName'>>,
  DataStreamPart<
    'b',
    'tool_call_streaming_start',
    {
      toolCallId: string;
      toolName: string;
    }
  >,
  DataStreamPart<
    'c',
    'tool_call_delta',
    {
      toolCallId: string;
      argsTextDelta: string;
    }
  >,
  DataStreamPart<
    'd',
    'finish_message',
    {
      finishReason: LanguageModelV1FinishReason;
      usage?: {
        promptTokens: number;
        completionTokens: number;
      };
    }
  >,
  DataStreamPart<
    'e',
    'finish_step',
    {
      isContinued: boolean;
      finishReason: LanguageModelV1FinishReason;
      usage?: {
        promptTokens: number;
        completionTokens: number;
      };
    }
  >,
  DataStreamPart<
    'f',
    'start_step',
    {
      messageId: string;
    }
  >,
  DataStreamPart<'g', 'reasoning', string>,
  DataStreamPart<'h', 'source', LanguageModelV1Source>,
  DataStreamPart<
    'i',
    'redacted_reasoning',
    {
      data: string;
    }
  >,
  DataStreamPart<
    'j',
    'reasoning_signature',
    {
      signature: string;
    }
  >,
  DataStreamPart<
    'k',
    'file',
    {
      data: string;
      mimeType: string;
    }
  >,
];

declare type DataStreamString =
  `${(typeof DataStreamStringPrefixes)[keyof typeof DataStreamStringPrefixes]}:${string}\n`;

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
declare const DataStreamStringPrefixes: { [K in DataStreamParts['name']]: (typeof dataStreamParts)[number]['code'] };

declare interface DataStreamWriter {
  /**
   * Appends a data part to the stream.
   */
  write(data: DataStreamString): void;
  /**
   * Appends a data part to the stream.
   */
  writeData(value: JSONValue): void;
  /**
   * Appends a message annotation to the stream.
   */
  writeMessageAnnotation(value: JSONValue): void;
  /**
   * Appends a source part to the stream.
   */
  writeSource(source: Source): void;
  /**
   * Merges the contents of another stream to this stream.
   */
  merge(stream: ReadableStream<DataStreamString>): void;
  /**
   * Error handler that is used by the data stream writer.
   * This is intended for forwarding when merging streams
   * to prevent duplicated error masking.
   */
  onError: ((error: unknown) => string) | undefined;
}

/**
 Create a type from an object with all keys and nested keys set to optional.
 The helper supports normal objects and Zod schemas (which are resolved automatically).
 It always recurses into arrays.

 Adopted from [type-fest](https://github.com/sindresorhus/type-fest/tree/main) PartialDeep.
 */
export declare type DeepPartial<T> = T extends z.ZodTypeAny ? DeepPartialInternal<z.infer<T>> : DeepPartialInternal<T>;

declare type DeepPartialInternal<T> = T extends
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint
  | void
  | Date
  | RegExp
  | ((...arguments_: any[]) => unknown)
  | (new (...arguments_: any[]) => unknown)
  ? T
  : T extends Map<infer KeyType, infer ValueType>
    ? PartialMap<KeyType, ValueType>
    : T extends Set<infer ItemType>
      ? PartialSet<ItemType>
      : T extends ReadonlyMap<infer KeyType, infer ValueType>
        ? PartialReadonlyMap<KeyType, ValueType>
        : T extends ReadonlySet<infer ItemType>
          ? PartialReadonlySet<ItemType>
          : T extends object
            ? T extends ReadonlyArray<infer ItemType>
              ? ItemType[] extends T
                ? readonly ItemType[] extends T
                  ? ReadonlyArray<DeepPartialInternal<ItemType | undefined>>
                  : Array<DeepPartialInternal<ItemType | undefined>>
                : PartialObject<T>
              : PartialObject<T>
            : unknown;

/**
 Embed a value using an embedding model. The type of the value is defined by the embedding model.

 @param model - The embedding model to use.
 @param value - The value that should be embedded.

 @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 @param abortSignal - An optional abort signal that can be used to cancel the call.
 @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

 @returns A result object that contains the embedding, the value, and additional information.
 */
export declare function embed<VALUE>({
  model,
  value,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  experimental_telemetry: telemetry,
}: {
  /**
     The embedding model to use.
     */
  model: EmbeddingModel<VALUE>;
  /**
     The value that should be embedded.
     */
  value: VALUE;
  /**
     Maximum number of retries per embedding model call. Set to 0 to disable retries.

     @default 2
     */
  maxRetries?: number;
  /**
     Abort signal.
     */
  abortSignal?: AbortSignal;
  /**
     Additional headers to include in the request.
     Only applicable for HTTP-based providers.
     */
  headers?: Record<string, string>;
  /**
   * Optional telemetry configuration (experimental).
   */
  experimental_telemetry?: TelemetrySettings;
}): Promise<EmbedResult<VALUE>>;

/**
 Embedding.
 */
declare type Embedding = EmbeddingModelV1Embedding;

/**
 Embedding model that is used by the AI SDK Core functions.
 */
export declare type EmbeddingModel<VALUE> = EmbeddingModelV1<VALUE>;

/**
 Represents the number of tokens used in an embedding.
 */
declare type EmbeddingModelUsage = {
  /**
     The number of tokens used in the embedding.
     */
  tokens: number;
};

/**
 Specification for an embedding model that implements the embedding model
 interface version 1.

 VALUE is the type of the values that the model can embed.
 This will allow us to go beyond text embeddings in the future,
 e.g. to support image embeddings
 */
declare type EmbeddingModelV1<VALUE> = {
  /**
     The embedding model must specify which embedding model interface
     version it implements. This will allow us to evolve the embedding
     model interface and retain backwards compatibility. The different
     implementation versions can be handled as a discriminated union
     on our side.
     */
  readonly specificationVersion: 'v1';
  /**
     Name of the provider for logging purposes.
     */
  readonly provider: string;
  /**
     Provider-specific model ID for logging purposes.
     */
  readonly modelId: string;
  /**
     Limit of how many embeddings can be generated in a single API call.
     */
  readonly maxEmbeddingsPerCall: number | undefined;
  /**
     True if the model can handle multiple embedding calls in parallel.
     */
  readonly supportsParallelCalls: boolean;
  /**
     Generates a list of embeddings for the given input text.

     Naming: "do" prefix to prevent accidental direct usage of the method
     by the user.
     */
  doEmbed(options: {
    /**
         List of values to embed.
         */
    values: Array<VALUE>;
    /**
         Abort signal for cancelling the operation.
         */
    abortSignal?: AbortSignal;
    /**
         Additional HTTP headers to be sent with the request.
         Only applicable for HTTP-based providers.
         */
    headers?: Record<string, string | undefined>;
  }): PromiseLike<{
    /**
         Generated embeddings. They are in the same order as the input values.
         */
    embeddings: Array<EmbeddingModelV1Embedding>;
    /**
         Token usage. We only have input tokens for embeddings.
         */
    usage?: {
      tokens: number;
    };
    /**
         Optional raw response information for debugging purposes.
         */
    rawResponse?: {
      /**
             Response headers.
             */
      headers?: Record<string, string>;
    };
  }>;
};

/**
 An embedding is a vector, i.e. an array of numbers.
 It is e.g. used to represent a text as a vector of word embeddings.
 */
declare type EmbeddingModelV1Embedding = Array<number>;

/**
 The result of a `embedMany` call.
 It contains the embeddings, the values, and additional information.
 */
export declare interface EmbedManyResult<VALUE> {
  /**
     The values that were embedded.
     */
  readonly values: Array<VALUE>;
  /**
     The embeddings. They are in the same order as the values.
     */
  readonly embeddings: Array<Embedding>;
  /**
     The embedding token usage.
     */
  readonly usage: EmbeddingModelUsage;
}

/**
 The result of an `embed` call.
 It contains the embedding, the value, and additional information.
 */
export declare interface EmbedResult<VALUE> {
  /**
     The value that was embedded.
     */
  readonly value: VALUE;
  /**
     The embedding of the value.
     */
  readonly embedding: Embedding;
  /**
     The embedding token usage.
     */
  readonly usage: EmbeddingModelUsage;
  /**
     Optional raw response data.
     */
  readonly rawResponse?: {
    /**
         Response headers.
         */
    headers?: Record<string, string>;
  };
}

/**
 * Defines Exception.
 *
 * string or an object with one of (message or name or code) and optional stack
 */
declare type Exception = ExceptionWithCode | ExceptionWithMessage | ExceptionWithName | string;

declare interface ExceptionWithCode {
  code: string | number;
  name?: string;
  message?: string;
  stack?: string;
}

declare interface ExceptionWithMessage {
  code?: string | number;
  message: string;
  name?: string;
  stack?: string;
}

declare interface ExceptionWithName {
  code?: string | number;
  message?: string;
  name: string;
  stack?: string;
}

/**
 File content part of a prompt. It contains a file.
 */
export declare interface FilePart {
  type: 'file';
  /**
     File data. Can either be:

     - data: a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer
     - URL: a URL that points to the image
     */
  data: DataContent | URL;
  /**
     Optional filename of the file.
     */
  filename?: string;
  /**
     Mime type of the file.
     */
  mimeType: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

/**
 * A file part of a message.
 */
declare type FileUIPart = {
  type: 'file';
  mimeType: string;
  data: string;
};

/**
 Reason why a language model finished generating a response.

 Can be one of the following:
 - `stop`: model generated stop sequence
 - `length`: model generated maximum number of tokens
 - `content-filter`: content filter violation stopped the model
 - `tool-calls`: model triggered tool calls
 - `error`: model stopped because of an error
 - `other`: model stopped for other reasons
 */
export declare type FinishReason = LanguageModelV1FinishReason;

/**
 * A generated file.
 */
declare interface GeneratedFile {
  /**
     File as a base64 encoded string.
     */
  readonly base64: string;
  /**
     File as a Uint8Array.
     */
  readonly uint8Array: Uint8Array;
  /**
     MIME type of the file
     */
  readonly mimeType: string;
}

/**
 Generate a structured, typed object for a given prompt and schema using a language model.

 This function does not stream the output. If you want to stream the output, use `streamObject` instead.

 @returns
 A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
export declare function generateObject<OBJECT>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output?: 'object' | undefined;
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The schema of the object that the model should generate.
     */
      schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
      /**
     Optional name of the output that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema name.
     */
      schemaName?: string;
      /**
     Optional description of the output that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema description.
     */
      schemaDescription?: string;
      /**
     The mode to use for object generation.

     The schema is converted into a JSON schema and used in one of the following ways

     - 'auto': The provider will choose the best mode for the model.
     - 'tool': A tool with the JSON schema as parameters is provided and the provider is instructed to use it.
     - 'json': The JSON schema and an instruction are injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

     Please note that most providers do not support all modes.

     Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';
      /**
     A function that attempts to repair the raw output of the mode
     to enable JSON parsing.
     */
      experimental_repairText?: RepairTextFunction;
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<OBJECT>>;

/**
 Generate an array with structured, typed elements for a given prompt and element schema using a language model.

 This function does not stream the output. If you want to stream the output, use `streamObject` instead.

 @return
 A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
export declare function generateObject<ELEMENT>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'array';
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The element schema of the array that the model should generate.
     */
      schema: z.Schema<ELEMENT, z.ZodTypeDef, any> | Schema<ELEMENT>;
      /**
     Optional name of the array that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema name.
     */
      schemaName?: string;
      /**
     Optional description of the array that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema description.
     */
      schemaDescription?: string;
      /**
     The mode to use for object generation.

     The schema is converted into a JSON schema and used in one of the following ways

     - 'auto': The provider will choose the best mode for the model.
     - 'tool': A tool with the JSON schema as parameters is provided and the provider is instructed to use it.
     - 'json': The JSON schema and an instruction are injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

     Please note that most providers do not support all modes.

     Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';
      /**
     A function that attempts to repair the raw output of the mode
     to enable JSON parsing.
     */
      experimental_repairText?: RepairTextFunction;
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<Array<ELEMENT>>>;

/**
 Generate a value from an enum (limited list of string values) using a language model.

 This function does not stream the output.

 @return
 A result object that contains the generated value, the finish reason, the token usage, and additional information.
 */
export declare function generateObject<ENUM extends string>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'enum';
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The enum values that the model should use.
     */
      enum: Array<ENUM>;
      /**
     The mode to use for object generation.

     The schema is converted into a JSON schema and used in one of the following ways

     - 'auto': The provider will choose the best mode for the model.
     - 'tool': A tool with the JSON schema as parameters is provided and the provider is instructed to use it.
     - 'json': The JSON schema and an instruction are injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

     Please note that most providers do not support all modes.

     Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';
      /**
     A function that attempts to repair the raw output of the mode
     to enable JSON parsing.
     */
      experimental_repairText?: RepairTextFunction;
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<ENUM>>;

/**
 Generate JSON with any schema for a given prompt using a language model.

 This function does not stream the output. If you want to stream the output, use `streamObject` instead.

 @returns
 A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
export declare function generateObject(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'no-schema';
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The mode to use for object generation. Must be "json" for no-schema output.
     */
      mode?: 'json';
      /**
     A function that attempts to repair the raw output of the mode
     to enable JSON parsing.
     */
      experimental_repairText?: RepairTextFunction;
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<JSONValue>>;

/**
 The result of a `generateObject` call.
 */
export declare interface GenerateObjectResult<OBJECT> {
  /**
     The generated object (typed according to the schema).
     */
  readonly object: OBJECT;
  /**
     The reason why the generation finished.
     */
  readonly finishReason: FinishReason;
  /**
     The token usage of the generated text.
     */
  readonly usage: LanguageModelUsage;
  /**
     Warnings from the model provider (e.g. unsupported settings).
     */
  readonly warnings: CallWarning[] | undefined;
  /**
     Additional request information.
     */
  readonly request: LanguageModelRequestMetadata;
  /**
     Additional response information.
     */
  readonly response: LanguageModelResponseMetadata & {
    /**
         Response body (available only for providers that use HTTP requests).
         */
    body?: unknown;
  };
  /**
     Logprobs for the completion.
     `undefined` if the mode does not support logprobs or if was not enabled.

     @deprecated Will become a provider extension in the future.
     */
  readonly logprobs: LogProbs | undefined;
  /**
     Additional provider-specific metadata. They are passed through
     from the provider to the AI SDK and enable provider-specific
     results that can be fully encapsulated in the provider.
     */
  readonly providerMetadata: ProviderMetadata | undefined;
  /**
     @deprecated Use `providerMetadata` instead.
     */
  readonly experimental_providerMetadata: ProviderMetadata | undefined;
  /**
     Converts the object to a JSON response.
     The response will have a status code of 200 and a content type of `application/json; charset=utf-8`.
     */
  toJsonResponse(init?: ResponseInit): Response;
}

/**
 Generate a text and call tools for a given prompt using a language model.

 This function does not stream the output. If you want to stream the output, use `streamText` instead.

 @param model - The language model to use.

 @param tools - Tools that are accessible to and can be called by the model. The model needs to support calling tools.
 @param toolChoice - The tool choice strategy. Default: 'auto'.

 @param system - A system message that will be part of the prompt.
 @param prompt - A simple text prompt. You can either use `prompt` or `messages` but not both.
 @param messages - A list of messages. You can either use `prompt` or `messages` but not both.

 @param maxTokens - Maximum number of tokens to generate.
 @param temperature - Temperature setting.
 The value is passed through to the provider. The range depends on the provider and model.
 It is recommended to set either `temperature` or `topP`, but not both.
 @param topP - Nucleus sampling.
 The value is passed through to the provider. The range depends on the provider and model.
 It is recommended to set either `temperature` or `topP`, but not both.
 @param topK - Only sample from the top K options for each subsequent token.
 Used to remove "long tail" low probability responses.
 Recommended for advanced use cases only. You usually only need to use temperature.
 @param presencePenalty - Presence penalty setting.
 It affects the likelihood of the model to repeat information that is already in the prompt.
 The value is passed through to the provider. The range depends on the provider and model.
 @param frequencyPenalty - Frequency penalty setting.
 It affects the likelihood of the model to repeatedly use the same words or phrases.
 The value is passed through to the provider. The range depends on the provider and model.
 @param stopSequences - Stop sequences.
 If set, the model will stop generating text when one of the stop sequences is generated.
 @param seed - The seed (integer) to use for random sampling.
 If set and supported by the model, calls will generate deterministic results.

 @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 @param abortSignal - An optional abort signal that can be used to cancel the call.
 @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

 @param maxSteps - Maximum number of sequential LLM calls (steps), e.g. when you use tool calls.
 @param experimental_generateMessageId - Generate a unique ID for each message.

 @param onStepFinish - Callback that is called when each step (LLM call) is finished, including intermediate steps.

 @returns
 A result object that contains the generated text, the results of the tool calls, and additional information.
 */
export declare function generateText<TOOLS extends ToolSet, OUTPUT = never, OUTPUT_PARTIAL = never>({
  model,
  tools,
  toolChoice,
  system,
  prompt,
  messages,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  maxSteps,
  experimental_generateMessageId: generateMessageId,
  experimental_output: output,
  experimental_continueSteps: continueSteps,
  experimental_telemetry: telemetry,
  experimental_providerMetadata,
  providerOptions,
  experimental_activeTools: activeTools,
  experimental_prepareStep: prepareStep,
  experimental_repairToolCall: repairToolCall,
  _internal: { generateId, currentDate },
  onStepFinish,
  ...settings
}: CallSettings &
  Prompt & {
    /**
     The language model to use.
     */
    model: LanguageModel;
    /**
     The tools that the model can call. The model needs to support calling tools.
     */
    tools?: TOOLS;
    /**
     The tool choice strategy. Default: 'auto'.
     */
    toolChoice?: ToolChoice<TOOLS>;
    /**
     Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1.

     A maximum number is required to prevent infinite loops in the case of misconfigured tools.

     By default, it's set to 1, which means that only a single LLM call is made.
     */
    maxSteps?: number;
    /**
     Generate a unique ID for each message.
     */
    experimental_generateMessageId?: IDGenerator;
    /**
     When enabled, the model will perform additional steps if the finish reason is "length" (experimental).

     By default, it's set to false.
     */
    experimental_continueSteps?: boolean;
    /**
     Optional telemetry configuration (experimental).
     */
    experimental_telemetry?: TelemetrySettings;
    /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
    providerOptions?: ProviderOptions;
    /**
     @deprecated Use `providerOptions` instead.
     */
    experimental_providerMetadata?: ProviderMetadata;
    /**
     Limits the tools that are available for the model to call without
     changing the tool call and result types in the result.
     */
    experimental_activeTools?: Array<keyof TOOLS>;
    /**
     Optional specification for parsing structured outputs from the LLM response.
     */
    experimental_output?: Output_2<OUTPUT, OUTPUT_PARTIAL>;
    /**
     Optional function that you can use to provide different settings for a step.

     @param options - The options for the step.
     @param options.steps - The steps that have been executed so far.
     @param options.stepNumber - The number of the step that is being executed.
     @param options.maxSteps - The maximum number of steps.
     @param options.model - The model that is being used.

     @returns An object that contains the settings for the step.
     If you return undefined (or for undefined settings), the settings from the outer level will be used.
     */
    experimental_prepareStep?: (options: {
      steps: Array<StepResult<TOOLS>>;
      stepNumber: number;
      maxSteps: number;
      model: LanguageModel;
    }) => PromiseLike<
      | {
          model?: LanguageModel;
          toolChoice?: ToolChoice<TOOLS>;
          experimental_activeTools?: Array<keyof TOOLS>;
        }
      | undefined
    >;
    /**
     A function that attempts to repair a tool call that failed to parse.
     */
    experimental_repairToolCall?: ToolCallRepairFunction<TOOLS>;
    /**
     Callback that is called when each step (LLM call) is finished, including intermediate steps.
     */
    onStepFinish?: GenerateTextOnStepFinishCallback<TOOLS>;
    /**
     * Internal. For test use only. May change without notice.
     */
    _internal?: {
      generateId?: IDGenerator;
      currentDate?: () => Date;
    };
  }): Promise<GenerateTextResult<TOOLS, OUTPUT>>;

/**
 Callback that is set using the `onStepFinish` option.

 @param stepResult - The result of the step.
 */
export declare type GenerateTextOnStepFinishCallback<TOOLS extends ToolSet> = (
  stepResult: StepResult<TOOLS>,
) => Promise<void> | void;

/**
 The result of a `generateText` call.
 It contains the generated text, the tool calls that were made during the generation, and the results of the tool calls.
 */
export declare interface GenerateTextResult<TOOLS extends ToolSet, OUTPUT> {
  /**
     The generated text.
     */
  readonly text: string;
  /**
     The reasoning text that the model has generated. Can be undefined if the model
     has only generated text.
     */
  readonly reasoning: string | undefined;
  /**
     The files that were generated. Empty array if no files were generated.
     */
  readonly files: Array<GeneratedFile>;
  /**
     The full reasoning that the model has generated.
     */
  readonly reasoningDetails: Array<ReasoningDetail>;
  /**
     Sources that have been used as input to generate the response.
     For multi-step generation, the sources are accumulated from all steps.
     */
  readonly sources: Source[];
  /**
     The generated structured output. It uses the `experimental_output` specification.
     */
  readonly experimental_output: OUTPUT;
  /**
     The tool calls that were made during the generation.
     */
  readonly toolCalls: ToolCallArray<TOOLS>;
  /**
     The results of the tool calls.
     */
  readonly toolResults: ToolResultArray<TOOLS>;
  /**
     The reason why the generation finished.
     */
  readonly finishReason: FinishReason;
  /**
     The token usage of the generated text.
     */
  readonly usage: LanguageModelUsage;
  /**
     Warnings from the model provider (e.g. unsupported settings)
     */
  readonly warnings: CallWarning[] | undefined;
  /**
     Details for all steps.
     You can use this to get information about intermediate steps,
     such as the tool calls or the response headers.
     */
  readonly steps: Array<StepResult<TOOLS>>;
  /**
     Additional request information.
     */
  readonly request: LanguageModelRequestMetadata;
  /**
     Additional response information.
     */
  readonly response: LanguageModelResponseMetadata & {
    /**
         The response messages that were generated during the call. It consists of an assistant message,
         potentially containing tool calls.

         When there are tool results, there is an additional tool message with the tool results that are available.
         If there are tools that do not have execute functions, they are not included in the tool results and
         need to be added separately.
         */
    messages: Array<ResponseMessage>;
    /**
         Response body (available only for providers that use HTTP requests).
         */
    body?: unknown;
  };
  /**
     Logprobs for the completion.
     `undefined` if the mode does not support logprobs or if it was not enabled.

     @deprecated Will become a provider extension in the future.
     */
  readonly logprobs: LogProbs | undefined;
  /**
     Additional provider-specific metadata. They are passed through
     from the provider to the AI SDK and enable provider-specific
     results that can be fully encapsulated in the provider.
     */
  readonly providerMetadata: ProviderMetadata | undefined;
  /**
     @deprecated Use `providerMetadata` instead.
     */
  readonly experimental_providerMetadata: ProviderMetadata | undefined;
}

/**
 * Defines High-Resolution Time.
 *
 * The first number, HrTime[0], is UNIX Epoch time in seconds since 00:00:00 UTC on 1 January 1970.
 * The second number, HrTime[1], represents the partial second elapsed since Unix Epoch time represented by first number in nanoseconds.
 * For example, 2021-01-01T12:30:10.150Z in UNIX Epoch time in milliseconds is represented as 1609504210150.
 * The first number is calculated by converting and truncating the Epoch time in milliseconds to seconds:
 * HrTime[0] = Math.trunc(1609504210150 / 1000) = 1609504210.
 * The second number is calculated by converting the digits after the decimal point of the subtraction, (1609504210150 / 1000) - HrTime[0], to nanoseconds:
 * HrTime[1] = Number((1609504210.150 - HrTime[0]).toFixed(9)) * 1e9 = 150000000.
 * This is represented in HrTime format as [1609504210, 150000000].
 */
declare type HrTime = [number, number];

/**
 A function that generates an ID.
 */
declare type IDGenerator = () => string;

export declare type IdGenerator = () => string;

/**
 Image content part of a prompt. It contains an image.
 */
export declare interface ImagePart {
  type: 'image';
  /**
     Image data. Can either be:

     - data: a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer
     - URL: a URL that points to the image
     */
  image: DataContent | URL;
  /**
     Optional mime type of the image.
     */
  mimeType?: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

declare type inferParameters<PARAMETERS extends ToolParameters> =
  PARAMETERS extends Schema<any> ? PARAMETERS['_type'] : PARAMETERS extends z.ZodTypeAny ? z.infer<PARAMETERS> : never;

declare class InvalidToolArgumentsError extends AISDKError {
  private readonly [symbol$f];
  readonly toolName: string;
  readonly toolArgs: string;
  constructor({
    toolArgs,
    toolName,
    cause,
    message,
  }: {
    message?: string;
    toolArgs: string;
    toolName: string;
    cause: unknown;
  });
  static isInstance(error: unknown): error is InvalidToolArgumentsError;
}

declare type JSONArray = JSONValue[];

declare type JSONObject = {
  [key: string]: JSONValue;
};

declare class JSONParseError extends AISDKError {
  private readonly [symbol$7];
  readonly text: string;
  constructor({ text, cause }: { text: string; cause: unknown });
  static isInstance(error: unknown): error is JSONParseError;
}

/**
 * Create a schema using a JSON Schema.
 *
 * @param jsonSchema The JSON Schema for the schema.
 * @param options.validate Optional. A validation function for the schema.
 */
export declare function jsonSchema<OBJECT = unknown>(
  jsonSchema: JSONSchema7,
  {
    validate,
  }?: {
    validate?: (value: unknown) =>
      | {
          success: true;
          value: OBJECT;
        }
      | {
          success: false;
          error: Error;
        };
  },
): Schema<OBJECT>;

declare type JSONValue = null | string | number | boolean | JSONObject | JSONArray;

/**
 A JSON value can be a string, number, boolean, object, array, or null.
 JSON values can be serialized and deserialized by the JSON.stringify and JSON.parse methods.
 */
declare type JSONValue_2 =
  | null
  | string
  | number
  | boolean
  | {
      [value: string]: JSONValue_2;
    }
  | Array<JSONValue_2>;

/**
 Language model that is used by the AI SDK Core functions.
 */
export declare type LanguageModel = LanguageModelV1;

export declare type LanguageModelRequestMetadata = {
  /**
     Raw request HTTP body that was sent to the provider API as a string (JSON should be stringified).
     */
  body?: string;
};

declare type LanguageModelResponseMetadata = {
  /**
     ID for the generated response.
     */
  id: string;
  /**
     Timestamp for the start of the generated response.
     */
  timestamp: Date;
  /**
     The ID of the response model that was used to generate the response.
     */
  modelId: string;
  /**
     Response headers (available only for providers that use HTTP requests).
     */
  headers?: Record<string, string>;
};

/**
 Represents the number of tokens used in a prompt and completion.
 */
declare type LanguageModelUsage = {
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

/**
 Specification for a language model that implements the language model interface version 1.
 */
export declare type LanguageModelV1 = {
  /**
     The language model must specify which language model interface
     version it implements. This will allow us to evolve the language
     model interface and retain backwards compatibility. The different
     implementation versions can be handled as a discriminated union
     on our side.
     */
  readonly specificationVersion: 'v1';
  /**
     Name of the provider for logging purposes.
     */
  readonly provider: string;
  /**
     Provider-specific model ID for logging purposes.
     */
  readonly modelId: string;
  /**
     Default object generation mode that should be used with this model when
     no mode is specified. Should be the mode with the best results for this
     model. `undefined` can be returned if object generation is not supported.

     This is needed to generate the best objects possible w/o requiring the
     user to explicitly specify the object generation mode.
     */
  readonly defaultObjectGenerationMode: LanguageModelV1ObjectGenerationMode;
  /**
     Flag whether this model supports image URLs. Default is `true`.

     When the flag is set to `false`, the AI SDK will download the image and
     pass the image data to the model.
     */
  readonly supportsImageUrls?: boolean;
  /**
     Flag whether this model supports grammar-guided generation,
     i.e. follows JSON schemas for object generation
     when the response format is set to 'json' or
     when the `object-json` mode is used.

     This means that the model guarantees that the generated JSON
     will be a valid JSON object AND that the object will match the
     JSON schema.

     Please note that `generateObject` and `streamObject` will work
     regardless of this flag, but might send different prompts and
     use further optimizations if this flag is set to `true`.

     Defaults to `false`.
     */
  readonly supportsStructuredOutputs?: boolean;
  /**
     Checks if the model supports the given URL for file parts natively.
     If the model does not support the URL,
     the AI SDK will download the file and pass the file data to the model.

     When undefined, the AI SDK will download the file.
     */
  supportsUrl?(url: URL): boolean;
  /**
     Generates a language model output (non-streaming).

     Naming: "do" prefix to prevent accidental direct usage of the method
     by the user.
     */
  doGenerate(options: LanguageModelV1CallOptions): PromiseLike<{
    /**
         Text that the model has generated.
         Can be undefined if the model did not generate any text.
         */
    text?: string;
    /**
         Reasoning that the model has generated.
         Can be undefined if the model does not support reasoning.
         */
    reasoning?:
      | string
      | Array<
          | {
              type: 'text';
              text: string;
              /**
             An optional signature for verifying that the reasoning originated from the model.
             */
              signature?: string;
            }
          | {
              type: 'redacted';
              data: string;
            }
        >;
    /**
         Generated files as base64 encoded strings or binary data.
         The files should be returned without any unnecessary conversion.
         If the API returns base64 encoded strings, the files should be returned
         as base64 encoded strings. If the API returns binary data, the files should
         be returned as binary data.
         */
    files?: Array<{
      data: string | Uint8Array;
      mimeType: string;
    }>;
    /**
         Tool calls that the model has generated.
         Can be undefined if the model did not generate any tool calls.
         */
    toolCalls?: Array<LanguageModelV1FunctionToolCall>;
    /**
         Finish reason.
         */
    finishReason: LanguageModelV1FinishReason;
    /**
         Usage information.
         */
    usage: {
      promptTokens: number;
      completionTokens: number;
    };
    /**
         Raw prompt and setting information for observability provider integration.
         */
    rawCall: {
      /**
             Raw prompt after expansion and conversion to the format that the
             provider uses to send the information to their API.
             */
      rawPrompt: unknown;
      /**
             Raw settings that are used for the API call. Includes provider-specific
             settings.
             */
      rawSettings: Record<string, unknown>;
    };
    /**
         Optional response information for telemetry and debugging purposes.
         */
    rawResponse?: {
      /**
             Response headers.
             */
      headers?: Record<string, string>;
      /**
             Response body.
             */
      body?: unknown;
    };
    /**
         Optional request information for telemetry and debugging purposes.
         */
    request?: {
      /**
             Raw request HTTP body that was sent to the provider API as a string (JSON should be stringified).
             Non-HTTP(s) providers should not set this.
             */
      body?: string;
    };
    /**
         Optional response information for telemetry and debugging purposes.
         */
    response?: {
      /**
             ID for the generated response, if the provider sends one.
             */
      id?: string;
      /**
             Timestamp for the start of the generated response, if the provider sends one.
             */
      timestamp?: Date;
      /**
             The ID of the response model that was used to generate the response, if the provider sends one.
             */
      modelId?: string;
    };
    warnings?: LanguageModelV1CallWarning[];
    /**
         Additional provider-specific metadata. They are passed through
         from the provider to the AI SDK and enable provider-specific
         results that can be fully encapsulated in the provider.
         */
    providerMetadata?: LanguageModelV1ProviderMetadata;
    /**
         Sources that have been used as input to generate the response.
         */
    sources?: LanguageModelV1Source[];
    /**
         Logprobs for the completion.
         `undefined` if the mode does not support logprobs or if was not enabled

         @deprecated will be changed into a provider-specific extension in v2
         */
    logprobs?: LanguageModelV1LogProbs;
  }>;
  /**
     Generates a language model output (streaming).

     Naming: "do" prefix to prevent accidental direct usage of the method
     by the user.
     *
     @return A stream of higher-level language model output parts.
     */
  doStream(options: LanguageModelV1CallOptions): PromiseLike<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    /**
         Raw prompt and setting information for observability provider integration.
         */
    rawCall: {
      /**
             Raw prompt after expansion and conversion to the format that the
             provider uses to send the information to their API.
             */
      rawPrompt: unknown;
      /**
             Raw settings that are used for the API call. Includes provider-specific
             settings.
             */
      rawSettings: Record<string, unknown>;
    };
    /**
         Optional raw response data.
         */
    rawResponse?: {
      /**
             Response headers.
             */
      headers?: Record<string, string>;
    };
    /**
         Optional request information for telemetry and debugging purposes.
         */
    request?: {
      /**
             Raw request HTTP body that was sent to the provider API as a string (JSON should be stringified).
             Non-HTTP(s) providers should not set this.
             */
      body?: string;
    };
    /**
         Warnings for the call, e.g. unsupported settings.
         */
    warnings?: Array<LanguageModelV1CallWarning>;
  }>;
};

declare type LanguageModelV1CallOptions = LanguageModelV1CallSettings & {
  /**
     Whether the user provided the input as messages or as
     a prompt. This can help guide non-chat models in the
     expansion, bc different expansions can be needed for
     chat/non-chat use cases.
     */
  inputFormat: 'messages' | 'prompt';
  /**
     The mode affects the behavior of the language model. It is required to
     support provider-independent streaming and generation of structured objects.
     The model can take this information and e.g. configure json mode, the correct
     low level grammar, etc. It can also be used to optimize the efficiency of the
     streaming, e.g. tool-delta stream parts are only needed in the
     object-tool mode.

     @deprecated mode will be removed in v2.
     All necessary settings will be directly supported through the call settings,
     in particular responseFormat, toolChoice, and tools.
     */
  mode:
    | {
        type: 'regular';
        /**
         The tools that are available for the model.
         */
        tools?: Array<LanguageModelV1FunctionTool | LanguageModelV1ProviderDefinedTool>;
        /**
         Specifies how the tool should be selected. Defaults to 'auto'.
         */
        toolChoice?: LanguageModelV1ToolChoice;
      }
    | {
        type: 'object-json';
        /**
         * JSON schema that the generated output should conform to.
         */
        schema?: JSONSchema7;
        /**
         * Name of output that should be generated. Used by some providers for additional LLM guidance.
         */
        name?: string;
        /**
         * Description of the output that should be generated. Used by some providers for additional LLM guidance.
         */
        description?: string;
      }
    | {
        type: 'object-tool';
        tool: LanguageModelV1FunctionTool;
      };
  /**
     A language mode prompt is a standardized prompt type.

     Note: This is **not** the user-facing prompt. The AI SDK methods will map the
     user-facing prompt types such as chat or instruction prompts to this format.
     That approach allows us to evolve the user  facing prompts without breaking
     the language model interface.
     */
  prompt: LanguageModelV1Prompt;
  /**
     Additional provider-specific metadata.
     The metadata is passed through to the provider from the AI SDK and enables
     provider-specific functionality that can be fully encapsulated in the provider.
     */
  providerMetadata?: LanguageModelV1ProviderMetadata;
};

declare type LanguageModelV1CallSettings = {
  /**
     Maximum number of tokens to generate.
     */
  maxTokens?: number;
  /**
     Temperature setting.

     It is recommended to set either `temperature` or `topP`, but not both.
     */
  temperature?: number;
  /**
     Stop sequences.
     If set, the model will stop generating text when one of the stop sequences is generated.
     Providers may have limits on the number of stop sequences.
     */
  stopSequences?: string[];
  /**
     Nucleus sampling.

     It is recommended to set either `temperature` or `topP`, but not both.
     */
  topP?: number;
  /**
     Only sample from the top K options for each subsequent token.

     Used to remove "long tail" low probability responses.
     Recommended for advanced use cases only. You usually only need to use temperature.
     */
  topK?: number;
  /**
     Presence penalty setting. It affects the likelihood of the model to
     repeat information that is already in the prompt.
     */
  presencePenalty?: number;
  /**
     Frequency penalty setting. It affects the likelihood of the model
     to repeatedly use the same words or phrases.
     */
  frequencyPenalty?: number;
  /**
     Response format. The output can either be text or JSON. Default is text.

     If JSON is selected, a schema can optionally be provided to guide the LLM.
     */
  responseFormat?:
    | {
        type: 'text';
      }
    | {
        type: 'json';
        /**
         * JSON schema that the generated output should conform to.
         */
        schema?: JSONSchema7;
        /**
         * Name of output that should be generated. Used by some providers for additional LLM guidance.
         */
        name?: string;
        /**
         * Description of the output that should be generated. Used by some providers for additional LLM guidance.
         */
        description?: string;
      };
  /**
     The seed (integer) to use for random sampling. If set and supported
     by the model, calls will generate deterministic results.
     */
  seed?: number;
  /**
     Abort signal for cancelling the operation.
     */
  abortSignal?: AbortSignal;
  /**
     Additional HTTP headers to be sent with the request.
     Only applicable for HTTP-based providers.
     */
  headers?: Record<string, string | undefined>;
};

/**
 Warning from the model provider for this call. The call will proceed, but e.g.
 some settings might not be supported, which can lead to suboptimal results.
 */
declare type LanguageModelV1CallWarning =
  | {
      type: 'unsupported-setting';
      setting: keyof LanguageModelV1CallSettings;
      details?: string;
    }
  | {
      type: 'unsupported-tool';
      tool: LanguageModelV1FunctionTool | LanguageModelV1ProviderDefinedTool;
      details?: string;
    }
  | {
      type: 'other';
      message: string;
    };

/**
 File content part of a prompt. It contains a file.
 */
declare interface LanguageModelV1FilePart {
  type: 'file';
  /**
   * Optional filename of the file.
   */
  filename?: string;
  /**
     File data as base64 encoded string or as a URL.
     */
  data: string | URL;
  /**
     Mime type of the file.
     */
  mimeType: string;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
 Reason why a language model finished generating a response.

 Can be one of the following:
 - `stop`: model generated stop sequence
 - `length`: model generated maximum number of tokens
 - `content-filter`: content filter violation stopped the model
 - `tool-calls`: model triggered tool calls
 - `error`: model stopped because of an error
 - `other`: model stopped for other reasons
 - `unknown`: the model has not transmitted a finish reason
 */
declare type LanguageModelV1FinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'unknown';

/**
 A tool has a name, a description, and a set of parameters.

 Note: this is **not** the user-facing tool definition. The AI SDK methods will
 map the user-facing tool definitions to this format.
 */
declare type LanguageModelV1FunctionTool = {
  /**
     The type of the tool (always 'function').
     */
  type: 'function';
  /**
     The name of the tool. Unique within this model call.
     */
  name: string;
  /**
     A description of the tool. The language model uses this to understand the
     tool's purpose and to provide better completion suggestions.
     */
  description?: string;
  /**
     The parameters that the tool expects. The language model uses this to
     understand the tool's input requirements and to provide matching suggestions.
     */
  parameters: JSONSchema7;
};

declare type LanguageModelV1FunctionToolCall = {
  toolCallType: 'function';
  toolCallId: string;
  toolName: string;
  /**
     Stringified JSON object with the tool call arguments. Must match the
     parameters schema of the tool.
     */
  args: string;
};

/**
 Image content part of a prompt. It contains an image.
 */
declare interface LanguageModelV1ImagePart {
  type: 'image';
  /**
     Image data as a Uint8Array (e.g. from a Blob or Buffer) or a URL.
     */
  image: Uint8Array | URL;
  /**
     Optional mime type of the image.
     */
  mimeType?: string;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
 Log probabilities for each token and its top log probabilities.
 */
export declare type LanguageModelV1LogProbs = Array<{
  token: string;
  logprob: number;
  topLogprobs: Array<{
    token: string;
    logprob: number;
  }>;
}>;

export declare type LanguageModelV1Message = (
  | {
      role: 'system';
      content: string;
    }
  | {
      role: 'user';
      content: Array<LanguageModelV1TextPart | LanguageModelV1ImagePart | LanguageModelV1FilePart>;
    }
  | {
      role: 'assistant';
      content: Array<
        | LanguageModelV1TextPart
        | LanguageModelV1FilePart
        | LanguageModelV1ReasoningPart
        | LanguageModelV1RedactedReasoningPart
        | LanguageModelV1ToolCallPart
      >;
    }
  | {
      role: 'tool';
      content: Array<LanguageModelV1ToolResultPart>;
    }
) & {
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
};

/**
 The object generation modes available for use with a model. `undefined`
 represents no support for object generation.
 */
declare type LanguageModelV1ObjectGenerationMode = 'json' | 'tool' | undefined;

/**
 A prompt is a list of messages.

 Note: Not all models and prompt formats support multi-modal inputs and
 tool calls. The validation happens at runtime.

 Note: This is not a user-facing prompt. The AI SDK methods will map the
 user-facing prompt types such as chat or instruction prompts to this format.
 */
export declare type LanguageModelV1Prompt = Array<LanguageModelV1Message>;

/**
 The configuration of a tool that is defined by the provider.
 */
declare type LanguageModelV1ProviderDefinedTool = {
  /**
     The type of the tool (always 'provider-defined').
     */
  type: 'provider-defined';
  /**
     The ID of the tool. Should follow the format `<provider-name>.<tool-name>`.
     */
  id: `${string}.${string}`;
  /**
     The name of the tool. Unique within this model call.
     */
  name: string;
  /**
     The arguments for configuring the tool. Must match the expected arguments defined by the provider for this tool.
     */
  args: Record<string, unknown>;
};

/**
 * Additional provider-specific metadata. They are passed through
 * to the provider from the AI SDK and enable provider-specific
 * functionality that can be fully encapsulated in the provider.
 *
 * This enables us to quickly ship provider-specific functionality
 * without affecting the core AI SDK.
 *
 * The outer record is keyed by the provider name, and the inner
 * record is keyed by the provider-specific metadata key.
 *
 * ```ts
 * {
 *   "anthropic": {
 *     "cacheControl": { "type": "ephemeral" }
 *   }
 * }
 * ```
 */
declare type LanguageModelV1ProviderMetadata = Record<string, Record<string, JSONValue>>;

/**
 Reasoning content part of a prompt. It contains a string of reasoning text.
 */
declare interface LanguageModelV1ReasoningPart {
  type: 'reasoning';
  /**
     The reasoning text.
     */
  text: string;
  /**
     An optional signature for verifying that the reasoning originated from the model.
     */
  signature?: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
 Redacted reasoning content part of a prompt.
 */
declare interface LanguageModelV1RedactedReasoningPart {
  type: 'redacted-reasoning';
  /**
     Redacted reasoning data.
     */
  data: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
 * A source that has been used as input to generate the response.
 */
declare type LanguageModelV1Source = {
  /**
   * A URL source. This is return by web search RAG models.
   */
  sourceType: 'url';
  /**
   * The ID of the source.
   */
  id: string;
  /**
   * The URL of the source.
   */
  url: string;
  /**
   * The title of the source.
   */
  title?: string;
  /**
   * Additional provider metadata for the source.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
};

export declare type LanguageModelV1StreamPart =
  | {
      type: 'text-delta';
      textDelta: string;
    }
  | {
      type: 'reasoning';
      textDelta: string;
    }
  | {
      type: 'reasoning-signature';
      signature: string;
    }
  | {
      type: 'redacted-reasoning';
      data: string;
    }
  | {
      type: 'source';
      source: LanguageModelV1Source;
    }
  | {
      type: 'file';
      mimeType: string;
      /**
     Generated file data as base64 encoded strings or binary data.
     The file data should be returned without any unnecessary conversion.
     If the API returns base64 encoded strings, the file data should be returned
     as base64 encoded strings. If the API returns binary data, the file data should
     be returned as binary data.
     */
      data: string | Uint8Array;
    }
  | ({
      type: 'tool-call';
    } & LanguageModelV1FunctionToolCall)
  | {
      type: 'tool-call-delta';
      toolCallType: 'function';
      toolCallId: string;
      toolName: string;
      argsTextDelta: string;
    }
  | {
      type: 'response-metadata';
      id?: string;
      timestamp?: Date;
      modelId?: string;
    }
  | {
      type: 'finish';
      finishReason: LanguageModelV1FinishReason;
      providerMetadata?: LanguageModelV1ProviderMetadata;
      usage: {
        promptTokens: number;
        completionTokens: number;
      };
      logprobs?: LanguageModelV1LogProbs;
    }
  | {
      type: 'error';
      error: unknown;
    };

/**
 Text content part of a prompt. It contains a string of text.
 */
declare interface LanguageModelV1TextPart {
  type: 'text';
  /**
     The text content.
     */
  text: string;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
 Tool call content part of a prompt. It contains a tool call (usually generated by the AI model).
 */
declare interface LanguageModelV1ToolCallPart {
  type: 'tool-call';
  /**
     ID of the tool call. This ID is used to match the tool call with the tool result.
     */
  toolCallId: string;
  /**
     Name of the tool that is being called.
     */
  toolName: string;
  /**
     Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
     */
  args: unknown;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

declare type LanguageModelV1ToolChoice =
  | {
      type: 'auto';
    }
  | {
      type: 'none';
    }
  | {
      type: 'required';
    }
  | {
      type: 'tool';
      toolName: string;
    };

/**
 Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
declare interface LanguageModelV1ToolResultPart {
  type: 'tool-result';
  /**
     ID of the tool call that this result is associated with.
     */
  toolCallId: string;
  /**
     Name of the tool that generated this result.
     */
  toolName: string;
  /**
     Result of the tool call. This is a JSON-serializable object.
     */
  result: unknown;
  /**
     Optional flag if the result is an error or an error message.
     */
  isError?: boolean;
  /**
     Tool results as an array of parts. This enables advanced tool results including images.
     When this is used, the `result` field should be ignored (if the provider supports content).
     */
  content?: Array<
    | {
        type: 'text';
        /**
         Text content.
         */
        text: string;
      }
    | {
        type: 'image';
        /**
         base-64 encoded image data
         */
        data: string;
        /**
         Mime type of the image.
         */
        mimeType?: string;
      }
  >;
  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
 * A pointer from the current {@link Span} to another span in the same trace or
 * in a different trace.
 * Few examples of Link usage.
 * 1. Batch Processing: A batch of elements may contain elements associated
 *    with one or more traces/spans. Since there can only be one parent
 *    SpanContext, Link is used to keep reference to SpanContext of all
 *    elements in the batch.
 * 2. Public Endpoint: A SpanContext in incoming client request on a public
 *    endpoint is untrusted from service provider perspective. In such case it
 *    is advisable to start a new trace with appropriate sampling decision.
 *    However, it is desirable to associate incoming SpanContext to new trace
 *    initiated on service provider side so two traces (from Client and from
 *    Service Provider) can be correlated.
 */
declare interface Link {
  /** The {@link SpanContext} of a linked span. */
  context: SpanContext;
  /** A set of {@link SpanAttributes} on the link. */
  attributes?: SpanAttributes;
  /** Count of attributes of the link that were dropped due to collection limits */
  droppedAttributesCount?: number;
}

/**
 Log probabilities for each token and its top log probabilities.

 @deprecated Will become a provider extension in the future.
 */
declare type LogProbs = LanguageModelV1LogProbs;

/**
 * AI SDK UI Messages. They are used in the client and to communicate between the frontend and the API routes.
 */
export declare interface Message {
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
  data?: JSONValue_2;
  /**
   * Additional message-specific information added on the server via StreamData
   */
  annotations?: JSONValue_2[] | undefined;
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

export declare class MockLanguageModelV1 implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider: LanguageModelV1['provider'];
  readonly modelId: LanguageModelV1['modelId'];
  supportsUrl: LanguageModelV1['supportsUrl'];
  doGenerate: LanguageModelV1['doGenerate'];
  doStream: LanguageModelV1['doStream'];
  readonly defaultObjectGenerationMode: LanguageModelV1['defaultObjectGenerationMode'];
  readonly supportsStructuredOutputs: LanguageModelV1['supportsStructuredOutputs'];
  constructor({
    provider,
    modelId,
    supportsUrl,
    doGenerate,
    doStream,
    defaultObjectGenerationMode,
    supportsStructuredOutputs,
  }?: {
    provider?: LanguageModelV1['provider'];
    modelId?: LanguageModelV1['modelId'];
    supportsUrl?: LanguageModelV1['supportsUrl'];
    doGenerate?: LanguageModelV1['doGenerate'];
    doStream?: LanguageModelV1['doStream'];
    defaultObjectGenerationMode?: LanguageModelV1['defaultObjectGenerationMode'];
    supportsStructuredOutputs?: LanguageModelV1['supportsStructuredOutputs'];
  });
}

declare class NoSuchToolError extends AISDKError {
  private readonly [symbol$e];
  readonly toolName: string;
  readonly availableTools: string[] | undefined;
  constructor({
    toolName,
    availableTools,
    message,
  }: {
    toolName: string;
    availableTools?: string[] | undefined;
    message?: string;
  });
  static isInstance(error: unknown): error is NoSuchToolError;
}

declare type ObjectStreamPart<PARTIAL> =
  | {
      type: 'object';
      object: PARTIAL;
    }
  | {
      type: 'text-delta';
      textDelta: string;
    }
  | {
      type: 'error';
      error: unknown;
    }
  | {
      type: 'finish';
      finishReason: FinishReason;
      logprobs?: LogProbs;
      usage: LanguageModelUsage;
      response: LanguageModelResponseMetadata;
      providerMetadata?: ProviderMetadata;
    };

export declare namespace Output {
  export { output_Output as Output, output_object as object, output_text as text };
}

declare interface Output_2<OUTPUT, PARTIAL> {
  readonly type: 'object' | 'text';
  injectIntoSystemPrompt(options: { system: string | undefined; model: LanguageModel }): string | undefined;
  responseFormat: (options: { model: LanguageModel }) => LanguageModelV1CallOptions['responseFormat'];
  parsePartial(options: { text: string }):
    | {
        partial: PARTIAL;
      }
    | undefined;
  parseOutput(
    options: {
      text: string;
    },
    context: {
      response: LanguageModelResponseMetadata;
      usage: LanguageModelUsage;
      finishReason: FinishReason;
    },
  ): OUTPUT;
}

declare type PartialMap<KeyType, ValueType> = {} & Map<DeepPartialInternal<KeyType>, DeepPartialInternal<ValueType>>;

declare type PartialObject<ObjectType extends object> = {
  [KeyType in keyof ObjectType]?: DeepPartialInternal<ObjectType[KeyType]>;
};

declare type PartialReadonlyMap<KeyType, ValueType> = {} & ReadonlyMap<
  DeepPartialInternal<KeyType>,
  DeepPartialInternal<ValueType>
>;

declare type PartialReadonlySet<T> = {} & ReadonlySet<DeepPartialInternal<T>>;

declare type PartialSet<T> = {} & Set<DeepPartialInternal<T>>;

/**
 Prompt part of the AI function options.
 It contains a system message, a simple text prompt, or a list of messages.
 */
declare type Prompt = {
  /**
     System message to include in the prompt. Can be used with `prompt` or `messages`.
     */
  system?: string;
  /**
     A simple text prompt. You can either use `prompt` or `messages` but not both.
     */
  prompt?: string;
  /**
     A list of messages. You can either use `prompt` or `messages` but not both.
     */
  messages?: Array<CoreMessage> | Array<Omit<Message, 'id'>>;
};

/**
 Additional provider-specific metadata that is returned from the provider.

 This is needed to enable provider-specific functionality that can be
 fully encapsulated in the provider.
 */
declare type ProviderMetadata = LanguageModelV1ProviderMetadata;

/**
 Additional provider-specific options.

 They are passed through to the provider from the AI SDK and enable
 provider-specific functionality that can be fully encapsulated in the provider.
 */
declare type ProviderOptions = LanguageModelV1ProviderMetadata;

declare type ReasoningDetail =
  | {
      type: 'text';
      text: string;
      signature?: string;
    }
  | {
      type: 'redacted';
      data: string;
    };

/**
 * Reasoning content part of a prompt. It contains a reasoning.
 */
declare interface ReasoningPart {
  type: 'reasoning';
  /**
     The reasoning text.
     */
  text: string;
  /**
     An optional signature for verifying that the reasoning originated from the model.
     */
  signature?: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

/**
 * A reasoning part of a message.
 */
declare type ReasoningUIPart = {
  type: 'reasoning';
  /**
   * The reasoning text.
   */
  reasoning: string;
  details: Array<
    | {
        type: 'text';
        text: string;
        signature?: string;
      }
    | {
        type: 'redacted';
        data: string;
      }
  >;
};

/**
 Redacted reasoning content part of a prompt.
 */
declare interface RedactedReasoningPart {
  type: 'redacted-reasoning';
  /**
     Redacted reasoning data.
     */
  data: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

/**
 A function that attempts to repair the raw output of the mode
 to enable JSON parsing.

 Should return the repaired text or null if the text cannot be repaired.
 */
declare type RepairTextFunction = (options: {
  text: string;
  error: JSONParseError | TypeValidationError;
}) => Promise<string | null>;

/**
 A message that was generated during the generation process.
 It can be either an assistant message or a tool message.
 */
declare type ResponseMessage = (CoreAssistantMessage | CoreToolMessage) & {
  /**
     Message ID generated by the AI SDK.
     */
  id: string;
};

export declare type Schema<OBJECT = unknown> = Validator<OBJECT> & {
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
 * Used to mark schemas so we can support both Zod and custom schemas.
 */
declare const schemaSymbol: unique symbol;

/**
 * Creates a ReadableStream that emits the provided values with an optional delay between each value.
 *
 * @param options - The configuration options
 * @param options.chunks - Array of values to be emitted by the stream
 * @param options.initialDelayInMs - Optional initial delay in milliseconds before emitting the first value (default: 0). Can be set to `null` to skip the initial delay. The difference between `initialDelayInMs: null` and `initialDelayInMs: 0` is that `initialDelayInMs: null` will emit the values without any delay, while `initialDelayInMs: 0` will emit the values with a delay of 0 milliseconds.
 * @param options.chunkDelayInMs - Optional delay in milliseconds between emitting each value (default: 0). Can be set to `null` to skip the delay. The difference between `chunkDelayInMs: null` and `chunkDelayInMs: 0` is that `chunkDelayInMs: null` will emit the values without any delay, while `chunkDelayInMs: 0` will emit the values with a delay of 0 milliseconds.
 * @returns A ReadableStream that emits the provided values
 */
export declare function simulateReadableStream<T>({
  chunks,
  initialDelayInMs,
  chunkDelayInMs,
  _internal,
}: {
  chunks: T[];
  initialDelayInMs?: number | null;
  chunkDelayInMs?: number | null;
  _internal?: {
    delay?: (ms: number | null) => Promise<void>;
  };
}): ReadableStream<T>;

/**
 A source that has been used as input to generate the response.
 */
declare type Source = LanguageModelV1Source;

/**
 * A source part of a message.
 */
declare type SourceUIPart = {
  type: 'source';
  /**
   * The source.
   */
  source: LanguageModelV1Source;
};

/**
 * An interface that represents a span. A span represents a single operation
 * within a trace. Examples of span might include remote procedure calls or a
 * in-process function calls to sub-components. A Trace has a single, top-level
 * "root" Span that in turn may have zero or more child Spans, which in turn
 * may have children.
 *
 * Spans are created by the {@link Tracer.startSpan} method.
 */
declare interface Span {
  /**
   * Returns the {@link SpanContext} object associated with this Span.
   *
   * Get an immutable, serializable identifier for this span that can be used
   * to create new child spans. Returned SpanContext is usable even after the
   * span ends.
   *
   * @returns the SpanContext object associated with this Span.
   */
  spanContext(): SpanContext;
  /**
   * Sets an attribute to the span.
   *
   * Sets a single Attribute with the key and value passed as arguments.
   *
   * @param key the key for this attribute.
   * @param value the value for this attribute. Setting a value null or
   *              undefined is invalid and will result in undefined behavior.
   */
  setAttribute(key: string, value: SpanAttributeValue): this;
  /**
   * Sets attributes to the span.
   *
   * @param attributes the attributes that will be added.
   *                   null or undefined attribute values
   *                   are invalid and will result in undefined behavior.
   */
  setAttributes(attributes: SpanAttributes): this;
  /**
   * Adds an event to the Span.
   *
   * @param name the name of the event.
   * @param [attributesOrStartTime] the attributes that will be added; these are
   *     associated with this event. Can be also a start time
   *     if type is {@type TimeInput} and 3rd param is undefined
   * @param [startTime] start time of the event.
   */
  addEvent(name: string, attributesOrStartTime?: SpanAttributes | TimeInput, startTime?: TimeInput): this;
  /**
   * Adds a single link to the span.
   *
   * Links added after the creation will not affect the sampling decision.
   * It is preferred span links be added at span creation.
   *
   * @param link the link to add.
   */
  addLink(link: Link): this;
  /**
   * Adds multiple links to the span.
   *
   * Links added after the creation will not affect the sampling decision.
   * It is preferred span links be added at span creation.
   *
   * @param links the links to add.
   */
  addLinks(links: Link[]): this;
  /**
   * Sets a status to the span. If used, this will override the default Span
   * status. Default is {@link SpanStatusCode.UNSET}. SetStatus overrides the value
   * of previous calls to SetStatus on the Span.
   *
   * @param status the SpanStatus to set.
   */
  setStatus(status: SpanStatus): this;
  /**
   * Updates the Span name.
   *
   * This will override the name provided via {@link Tracer.startSpan}.
   *
   * Upon this update, any sampling behavior based on Span name will depend on
   * the implementation.
   *
   * @param name the Span name.
   */
  updateName(name: string): this;
  /**
   * Marks the end of Span execution.
   *
   * Call to End of a Span MUST not have any effects on child spans. Those may
   * still be running and can be ended later.
   *
   * Do not return `this`. The Span generally should not be used after it
   * is ended so chaining is not desired in this context.
   *
   * @param [endTime] the time to set as Span's end time. If not provided,
   *     use the current time as the span's end time.
   */
  end(endTime?: TimeInput): void;
  /**
   * Returns the flag whether this span will be recorded.
   *
   * @returns true if this Span is active and recording information like events
   *     with the `AddEvent` operation and attributes using `setAttributes`.
   */
  isRecording(): boolean;
  /**
   * Sets exception as a span event
   * @param exception the exception the only accepted values are string or Error
   * @param [time] the time to set as Span's event time. If not provided,
   *     use the current time.
   */
  recordException(exception: Exception, time?: TimeInput): void;
}

/**
 * @deprecated please use {@link Attributes}
 */
declare type SpanAttributes = Attributes;

/**
 * @deprecated please use {@link AttributeValue}
 */
declare type SpanAttributeValue = AttributeValue;

/**
 * A SpanContext represents the portion of a {@link Span} which must be
 * serialized and propagated along side of a {@link Baggage}.
 */
declare interface SpanContext {
  /**
   * The ID of the trace that this span belongs to. It is worldwide unique
   * with practically sufficient probability by being made as 16 randomly
   * generated bytes, encoded as a 32 lowercase hex characters corresponding to
   * 128 bits.
   */
  traceId: string;
  /**
   * The ID of the Span. It is globally unique with practically sufficient
   * probability by being made as 8 randomly generated bytes, encoded as a 16
   * lowercase hex characters corresponding to 64 bits.
   */
  spanId: string;
  /**
   * Only true if the SpanContext was propagated from a remote parent.
   */
  isRemote?: boolean;
  /**
   * Trace flags to propagate.
   *
   * It is represented as 1 byte (bitmap). Bit to represent whether trace is
   * sampled or not. When set, the least significant bit documents that the
   * caller may have recorded trace data. A caller who does not record trace
   * data out-of-band leaves this flag unset.
   *
   * see {@link TraceFlags} for valid flag values.
   */
  traceFlags: number;
  /**
   * Tracing-system-specific info to propagate.
   *
   * The tracestate field value is a `list` as defined below. The `list` is a
   * series of `list-members` separated by commas `,`, and a list-member is a
   * key/value pair separated by an equals sign `=`. Spaces and horizontal tabs
   * surrounding `list-members` are ignored. There can be a maximum of 32
   * `list-members` in a `list`.
   * More Info: https://www.w3.org/TR/trace-context/#tracestate-field
   *
   * Examples:
   *     Single tracing system (generic format):
   *         tracestate: rojo=00f067aa0ba902b7
   *     Multiple tracing systems (with different formatting):
   *         tracestate: rojo=00f067aa0ba902b7,congo=t61rcWkgMzE
   */
  traceState?: TraceState;
}

declare enum SpanKind {
  /** Default value. Indicates that the span is used internally. */
  INTERNAL = 0,
  /**
   * Indicates that the span covers server-side handling of an RPC or other
   * remote request.
   */
  SERVER = 1,
  /**
   * Indicates that the span covers the client-side wrapper around an RPC or
   * other remote request.
   */
  CLIENT = 2,
  /**
   * Indicates that the span describes producer sending a message to a
   * broker. Unlike client and server, there is no direct critical path latency
   * relationship between producer and consumer spans.
   */
  PRODUCER = 3,
  /**
   * Indicates that the span describes consumer receiving a message from a
   * broker. Unlike client and server, there is no direct critical path latency
   * relationship between producer and consumer spans.
   */
  CONSUMER = 4,
}

/**
 * Options needed for span creation
 */
declare interface SpanOptions {
  /**
   * The SpanKind of a span
   * @default {@link SpanKind.INTERNAL}
   */
  kind?: SpanKind;
  /** A span's attributes */
  attributes?: SpanAttributes;
  /** {@link Link}s span to other spans */
  links?: Link[];
  /** A manually specified start time for the created `Span` object. */
  startTime?: TimeInput;
  /** The new span should be a root span. (Ignore parent from context). */
  root?: boolean;
}

declare interface SpanStatus {
  /** The status code of this message. */
  code: SpanStatusCode;
  /** A developer-facing error message. */
  message?: string;
}

/**
 * An enumeration of status codes.
 */
declare enum SpanStatusCode {
  /**
   * The default status.
   */
  UNSET = 0,
  /**
   * The operation has been validated by an Application developer or
   * Operator to have completed successfully.
   */
  OK = 1,
  /**
   * The operation contains an error.
   */
  ERROR = 2,
}

/**
 * The result of a single step in the generation process.
 */
declare type StepResult<TOOLS extends ToolSet> = {
  /**
     The generated text.
     */
  readonly text: string;
  /**
     The reasoning that was generated during the generation.
     */
  readonly reasoning: string | undefined;
  readonly reasoningDetails: Array<ReasoningDetail>;
  /**
     The files that were generated during the generation.
     */
  readonly files: GeneratedFile[];
  /**
     The sources that were used to generate the text.
     */
  readonly sources: Source[];
  /**
     The tool calls that were made during the generation.
     */
  readonly toolCalls: ToolCallArray<TOOLS>;
  /**
     The results of the tool calls.
     */
  readonly toolResults: ToolResultArray<TOOLS>;
  /**
     The reason why the generation finished.
     */
  readonly finishReason: FinishReason;
  /**
     The token usage of the generated text.
     */
  readonly usage: LanguageModelUsage;
  /**
     Warnings from the model provider (e.g. unsupported settings).
     */
  readonly warnings: CallWarning[] | undefined;
  /**
     Logprobs for the completion.
     `undefined` if the mode does not support logprobs or if was not enabled.
     */
  readonly logprobs: LogProbs | undefined;
  /**
     Additional request information.
     */
  readonly request: LanguageModelRequestMetadata;
  /**
     Additional response information.
     */
  readonly response: LanguageModelResponseMetadata & {
    /**
         The response messages that were generated during the call.
         Response messages can be either assistant messages or tool messages.
         They contain a generated id.
         */
    readonly messages: Array<ResponseMessage>;
    /**
         Response body (available only for providers that use HTTP requests).
         */
    body?: unknown;
  };
  /**
     Additional provider-specific metadata. They are passed through
     from the provider to the AI SDK and enable provider-specific
     results that can be fully encapsulated in the provider.
     */
  readonly providerMetadata: ProviderMetadata | undefined;
  /**
     @deprecated Use `providerMetadata` instead.
     */
  readonly experimental_providerMetadata: ProviderMetadata | undefined;
  /**
     The type of step that this result is for. The first step is always
     an "initial" step, and subsequent steps are either "continue" steps
     or "tool-result" steps.
     */
  readonly stepType: 'initial' | 'continue' | 'tool-result';
  /**
     True when there will be a continuation step with a continuation text.
     */
  readonly isContinued: boolean;
};

/**
 * A step boundary part of a message.
 */
declare type StepStartUIPart = {
  type: 'step-start';
};

/**
 * A stream wrapper to send custom JSON-encoded data back to the client.
 *
 * @deprecated Please use `createDataStream`, `createDataStreamResponse`, and `pipeDataStreamToResponse` instead.
 */
declare class StreamData {
  private encoder;
  private controller;
  stream: ReadableStream<Uint8Array>;
  private isClosed;
  private warningTimeout;
  constructor();
  close(): Promise<void>;
  append(value: JSONValue_2): void;
  appendMessageAnnotation(value: JSONValue_2): void;
}

/**
 Generate a structured, typed object for a given prompt and schema using a language model.

 This function streams the output. If you do not want to stream the output, use `generateObject` instead.

 @return
 A result object for accessing the partial object stream and additional information.
 */
export declare function streamObject<OBJECT>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output?: 'object' | undefined;
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The schema of the object that the model should generate.
     */
      schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
      /**
     Optional name of the output that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema name.
     */
      schemaName?: string;
      /**
     Optional description of the output that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema description.
     */
      schemaDescription?: string;
      /**
     The mode to use for object generation.

     The schema is converted into a JSON schema and used in one of the following ways

     - 'auto': The provider will choose the best mode for the model.
     - 'tool': A tool with the JSON schema as parameters is provided and the provider is instructed to use it.
     - 'json': The JSON schema and an instruction are injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

     Please note that most providers do not support all modes.

     Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
     Callback that is invoked when an error occurs during streaming.
     You can use it to log errors.
     The stream processing will pause until the callback promise is resolved.
     */
      onError?: StreamObjectOnErrorCallback;
      /**
     Callback that is called when the LLM response and the final object validation are finished.
     */
      onFinish?: StreamObjectOnFinishCallback<OBJECT>;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
        now?: () => number;
      };
    },
): StreamObjectResult<DeepPartial<OBJECT>, OBJECT, never>;

/**
 Generate an array with structured, typed elements for a given prompt and element schema using a language model.

 This function streams the output. If you do not want to stream the output, use `generateObject` instead.

 @return
 A result object for accessing the partial object stream and additional information.
 */
export declare function streamObject<ELEMENT>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'array';
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The element schema of the array that the model should generate.
     */
      schema: z.Schema<ELEMENT, z.ZodTypeDef, any> | Schema<ELEMENT>;
      /**
     Optional name of the array that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema name.
     */
      schemaName?: string;
      /**
     Optional description of the array that should be generated.
     Used by some providers for additional LLM guidance, e.g.
     via tool or schema description.
     */
      schemaDescription?: string;
      /**
     The mode to use for object generation.

     The schema is converted into a JSON schema and used in one of the following ways

     - 'auto': The provider will choose the best mode for the model.
     - 'tool': A tool with the JSON schema as parameters is provided and the provider is instructed to use it.
     - 'json': The JSON schema and an instruction are injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

     Please note that most providers do not support all modes.

     Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
     Callback that is invoked when an error occurs during streaming.
     You can use it to log errors.
     The stream processing will pause until the callback promise is resolved.
     */
      onError?: StreamObjectOnErrorCallback;
      /**
     Callback that is called when the LLM response and the final object validation are finished.
     */
      onFinish?: StreamObjectOnFinishCallback<Array<ELEMENT>>;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
        now?: () => number;
      };
    },
): StreamObjectResult<Array<ELEMENT>, Array<ELEMENT>, AsyncIterableStream<ELEMENT>>;

/**
 Generate JSON with any schema for a given prompt using a language model.

 This function streams the output. If you do not want to stream the output, use `generateObject` instead.

 @return
 A result object for accessing the partial object stream and additional information.
 */
export declare function streamObject(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'no-schema';
      /**
     The language model to use.
     */
      model: LanguageModel;
      /**
     The mode to use for object generation. Must be "json" for no-schema output.
     */
      mode?: 'json';
      /**
     Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;
      /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
      providerOptions?: ProviderOptions;
      /**
     @deprecated Use `providerOptions` instead.
     */
      experimental_providerMetadata?: ProviderMetadata;
      /**
     Callback that is invoked when an error occurs during streaming.
     You can use it to log errors.
     The stream processing will pause until the callback promise is resolved.
     */
      onError?: StreamObjectOnErrorCallback;
      /**
     Callback that is called when the LLM response and the final object validation are finished.
     */
      onFinish?: StreamObjectOnFinishCallback<JSONValue>;
      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
        now?: () => number;
      };
    },
): StreamObjectResult<JSONValue, JSONValue, never>;

/**
 Callback that is set using the `onError` option.

 @param event - The event that is passed to the callback.
 */
declare type StreamObjectOnErrorCallback = (event: { error: unknown }) => Promise<void> | void;

/**
 Callback that is set using the `onFinish` option.

 @param event - The event that is passed to the callback.
 */
export declare type StreamObjectOnFinishCallback<RESULT> = (event: {
  /**
     The token usage of the generated response.
     */
  usage: LanguageModelUsage;
  /**
     The generated object. Can be undefined if the final object does not match the schema.
     */
  object: RESULT | undefined;
  /**
     Optional error object. This is e.g. a TypeValidationError when the final object does not match the schema.
     */
  error: unknown | undefined;
  /**
     Response metadata.
     */
  response: LanguageModelResponseMetadata;
  /**
     Warnings from the model provider (e.g. unsupported settings).
     */
  warnings?: CallWarning[];
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerMetadata: ProviderMetadata | undefined;
  /**
     @deprecated Use `providerMetadata` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}) => Promise<void> | void;

/**
 The result of a `streamObject` call that contains the partial object stream and additional information.
 */
export declare interface StreamObjectResult<PARTIAL, RESULT, ELEMENT_STREAM> {
  /**
     Warnings from the model provider (e.g. unsupported settings)
     */
  readonly warnings: Promise<CallWarning[] | undefined>;
  /**
     The token usage of the generated response. Resolved when the response is finished.
     */
  readonly usage: Promise<LanguageModelUsage>;
  /**
     Additional provider-specific metadata. They are passed through
     from the provider to the AI SDK and enable provider-specific
     results that can be fully encapsulated in the provider.
     */
  readonly providerMetadata: Promise<ProviderMetadata | undefined>;
  /**
     @deprecated Use `providerMetadata` instead.
     */
  readonly experimental_providerMetadata: Promise<ProviderMetadata | undefined>;
  /**
     Additional request information from the last step.
     */
  readonly request: Promise<LanguageModelRequestMetadata>;
  /**
     Additional response information.
     */
  readonly response: Promise<LanguageModelResponseMetadata>;
  /**
     The generated object (typed according to the schema). Resolved when the response is finished.
     */
  readonly object: Promise<RESULT>;
  /**
     Stream of partial objects. It gets more complete as the stream progresses.

     Note that the partial object is not validated.
     If you want to be certain that the actual content matches your schema, you need to implement your own validation for partial results.
     */
  readonly partialObjectStream: AsyncIterableStream<PARTIAL>;
  /**
   * Stream over complete array elements. Only available if the output strategy is set to `array`.
   */
  readonly elementStream: ELEMENT_STREAM;
  /**
     Text stream of the JSON representation of the generated object. It contains text chunks.
     When the stream is finished, the object is valid JSON that can be parsed.
     */
  readonly textStream: AsyncIterableStream<string>;
  /**
     Stream of different types of events, including partial objects, errors, and finish events.
     Only errors that stop the stream, such as network errors, are thrown.
     */
  readonly fullStream: AsyncIterableStream<ObjectStreamPart<PARTIAL>>;
  /**
     Writes text delta output to a Node.js response-like object.
     It sets a `Content-Type` header to `text/plain; charset=utf-8` and
     writes each text delta as a separate chunk.

     @param response A Node.js response-like object (ServerResponse).
     @param init Optional headers, status code, and status text.
     */
  pipeTextStreamToResponse(response: ServerResponse, init?: ResponseInit): void;
  /**
     Creates a simple text stream response.
     The response has a `Content-Type` header set to `text/plain; charset=utf-8`.
     Each text delta is encoded as UTF-8 and sent as a separate chunk.
     Non-text-delta events are ignored.

     @param init Optional headers, status code, and status text.
     */
  toTextStreamResponse(init?: ResponseInit): Response;
}

/**
 Generate a text and call tools for a given prompt using a language model.

 This function streams the output. If you do not want to stream the output, use `generateText` instead.

 @param model - The language model to use.
 @param tools - Tools that are accessible to and can be called by the model. The model needs to support calling tools.

 @param system - A system message that will be part of the prompt.
 @param prompt - A simple text prompt. You can either use `prompt` or `messages` but not both.
 @param messages - A list of messages. You can either use `prompt` or `messages` but not both.

 @param maxTokens - Maximum number of tokens to generate.
 @param temperature - Temperature setting.
 The value is passed through to the provider. The range depends on the provider and model.
 It is recommended to set either `temperature` or `topP`, but not both.
 @param topP - Nucleus sampling.
 The value is passed through to the provider. The range depends on the provider and model.
 It is recommended to set either `temperature` or `topP`, but not both.
 @param topK - Only sample from the top K options for each subsequent token.
 Used to remove "long tail" low probability responses.
 Recommended for advanced use cases only. You usually only need to use temperature.
 @param presencePenalty - Presence penalty setting.
 It affects the likelihood of the model to repeat information that is already in the prompt.
 The value is passed through to the provider. The range depends on the provider and model.
 @param frequencyPenalty - Frequency penalty setting.
 It affects the likelihood of the model to repeatedly use the same words or phrases.
 The value is passed through to the provider. The range depends on the provider and model.
 @param stopSequences - Stop sequences.
 If set, the model will stop generating text when one of the stop sequences is generated.
 @param seed - The seed (integer) to use for random sampling.
 If set and supported by the model, calls will generate deterministic results.

 @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 @param abortSignal - An optional abort signal that can be used to cancel the call.
 @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

 @param maxSteps - Maximum number of sequential LLM calls (steps), e.g. when you use tool calls.
 @param experimental_generateMessageId - Generate a unique ID for each message.

 @param onChunk - Callback that is called for each chunk of the stream. The stream processing will pause until the callback promise is resolved.
 @param onError - Callback that is called when an error occurs during streaming. You can use it to log errors.
 @param onStepFinish - Callback that is called when each step (LLM call) is finished, including intermediate steps.
 @param onFinish - Callback that is called when the LLM response and all request tool executions
 (for tools that have an `execute` function) are finished.

 @return
 A result object for accessing different stream types and additional information.
 */
export declare function streamText<TOOLS extends ToolSet, OUTPUT = never, PARTIAL_OUTPUT = never>({
  model,
  tools,
  toolChoice,
  system,
  prompt,
  messages,
  maxRetries,
  abortSignal,
  headers,
  maxSteps,
  experimental_generateMessageId: generateMessageId,
  experimental_output: output,
  experimental_continueSteps: continueSteps,
  experimental_telemetry: telemetry,
  experimental_providerMetadata,
  providerOptions,
  experimental_toolCallStreaming,
  toolCallStreaming,
  experimental_activeTools: activeTools,
  experimental_repairToolCall: repairToolCall,
  experimental_transform: transform,
  onChunk,
  onError,
  onFinish,
  onStepFinish,
  _internal: { now, generateId, currentDate },
  ...settings
}: CallSettings &
  Prompt & {
    /**
     The language model to use.
     */
    model: LanguageModel;
    /**
     The tools that the model can call. The model needs to support calling tools.
     */
    tools?: TOOLS;
    /**
     The tool choice strategy. Default: 'auto'.
     */
    toolChoice?: ToolChoice<TOOLS>;
    /**
     Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1.

     A maximum number is required to prevent infinite loops in the case of misconfigured tools.

     By default, it's set to 1, which means that only a single LLM call is made.
     */
    maxSteps?: number;
    /**
     Generate a unique ID for each message.
     */
    experimental_generateMessageId?: IDGenerator;
    /**
     When enabled, the model will perform additional steps if the finish reason is "length" (experimental).

     By default, it's set to false.
     */
    experimental_continueSteps?: boolean;
    /**
     Optional telemetry configuration (experimental).
     */
    experimental_telemetry?: TelemetrySettings;
    /**
     Additional provider-specific options. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
    providerOptions?: ProviderOptions;
    /**
     @deprecated Use `providerOptions` instead.
     */
    experimental_providerMetadata?: ProviderMetadata;
    /**
     Limits the tools that are available for the model to call without
     changing the tool call and result types in the result.
     */
    experimental_activeTools?: Array<keyof TOOLS>;
    /**
     Optional specification for parsing structured outputs from the LLM response.
     */
    experimental_output?: Output_2<OUTPUT, PARTIAL_OUTPUT>;
    /**
     A function that attempts to repair a tool call that failed to parse.
     */
    experimental_repairToolCall?: ToolCallRepairFunction<TOOLS>;
    /**
     Enable streaming of tool call deltas as they are generated. Disabled by default.
     */
    toolCallStreaming?: boolean;
    /**
     @deprecated Use `toolCallStreaming` instead.
     */
    experimental_toolCallStreaming?: boolean;
    /**
     Optional stream transformations.
     They are applied in the order they are provided.
     The stream transformations must maintain the stream structure for streamText to work correctly.
     */
    experimental_transform?: StreamTextTransform<TOOLS> | Array<StreamTextTransform<TOOLS>>;
    /**
     Callback that is called for each chunk of the stream.
     The stream processing will pause until the callback promise is resolved.
     */
    onChunk?: StreamTextOnChunkCallback<TOOLS>;
    /**
     Callback that is invoked when an error occurs during streaming.
     You can use it to log errors.
     The stream processing will pause until the callback promise is resolved.
     */
    onError?: StreamTextOnErrorCallback;
    /**
     Callback that is called when the LLM response and all request tool executions
     (for tools that have an `execute` function) are finished.

     The usage is the combined usage of all steps.
     */
    onFinish?: StreamTextOnFinishCallback<TOOLS>;
    /**
     Callback that is called when each step (LLM call) is finished, including intermediate steps.
     */
    onStepFinish?: StreamTextOnStepFinishCallback<TOOLS>;
    /**
     Internal. For test use only. May change without notice.
     */
    _internal?: {
      now?: () => number;
      generateId?: IDGenerator;
      currentDate?: () => Date;
    };
  }): StreamTextResult<TOOLS, PARTIAL_OUTPUT>;

/**
 Callback that is set using the `onChunk` option.

 @param event - The event that is passed to the callback.
 */
declare type StreamTextOnChunkCallback<TOOLS extends ToolSet> = (event: {
  chunk: Extract<
    TextStreamPart<TOOLS>,
    {
      type:
        | 'text-delta'
        | 'reasoning'
        | 'source'
        | 'tool-call'
        | 'tool-call-streaming-start'
        | 'tool-call-delta'
        | 'tool-result';
    }
  >;
}) => Promise<void> | void;

/**
 Callback that is set using the `onError` option.

 @param event - The event that is passed to the callback.
 */
declare type StreamTextOnErrorCallback = (event: { error: unknown }) => Promise<void> | void;

/**
 Callback that is set using the `onFinish` option.

 @param event - The event that is passed to the callback.
 */
export declare type StreamTextOnFinishCallback<TOOLS extends ToolSet> = (
  event: Omit<StepResult<TOOLS>, 'stepType' | 'isContinued'> & {
    /**
     Details for all steps.
     */
    readonly steps: StepResult<TOOLS>[];
  },
) => Promise<void> | void;

/**
 Callback that is set using the `onStepFinish` option.

 @param stepResult - The result of the step.
 */
export declare type StreamTextOnStepFinishCallback<TOOLS extends ToolSet> = (
  stepResult: StepResult<TOOLS>,
) => Promise<void> | void;

/**
 A result object for accessing different stream types and additional information.
 */
export declare interface StreamTextResult<TOOLS extends ToolSet, PARTIAL_OUTPUT> {
  /**
     Warnings from the model provider (e.g. unsupported settings) for the first step.
     */
  readonly warnings: Promise<CallWarning[] | undefined>;
  /**
     The total token usage of the generated response.
     When there are multiple steps, the usage is the sum of all step usages.

     Resolved when the response is finished.
     */
  readonly usage: Promise<LanguageModelUsage>;
  /**
     Sources that have been used as input to generate the response.
     For multi-step generation, the sources are accumulated from all steps.

     Resolved when the response is finished.
     */
  readonly sources: Promise<Source[]>;
  /**
     Files that have been generated by the model in the last step.

     Resolved when the response is finished.
     */
  readonly files: Promise<GeneratedFile[]>;
  /**
     The reason why the generation finished. Taken from the last step.

     Resolved when the response is finished.
     */
  readonly finishReason: Promise<FinishReason>;
  /**
     Additional provider-specific metadata from the last step.
     Metadata is passed through from the provider to the AI SDK and
     enables provider-specific results that can be fully encapsulated in the provider.
     */
  readonly providerMetadata: Promise<ProviderMetadata | undefined>;
  /**
     @deprecated Use `providerMetadata` instead.
     */
  readonly experimental_providerMetadata: Promise<ProviderMetadata | undefined>;
  /**
     The full text that has been generated by the last step.

     Resolved when the response is finished.
     */
  readonly text: Promise<string>;
  /**
     The reasoning that has been generated by the last step.

     Resolved when the response is finished.
     */
  readonly reasoning: Promise<string | undefined>;
  /**
     The full reasoning that the model has generated.

     Resolved when the response is finished.
     */
  readonly reasoningDetails: Promise<Array<ReasoningDetail>>;
  /**
     The tool calls that have been executed in the last step.

     Resolved when the response is finished.
     */
  readonly toolCalls: Promise<ToolCallUnion<TOOLS>[]>;
  /**
     The tool results that have been generated in the last step.

     Resolved when the all tool executions are finished.
     */
  readonly toolResults: Promise<ToolResultUnion<TOOLS>[]>;
  /**
     Details for all steps.
     You can use this to get information about intermediate steps,
     such as the tool calls or the response headers.
     */
  readonly steps: Promise<Array<StepResult<TOOLS>>>;
  /**
     Additional request information from the last step.
     */
  readonly request: Promise<LanguageModelRequestMetadata>;
  /**
     Additional response information from the last step.
     */
  readonly response: Promise<
    LanguageModelResponseMetadata & {
      /**
         The response messages that were generated during the call. It consists of an assistant message,
         potentially containing tool calls.

         When there are tool results, there is an additional tool message with the tool results that are available.
         If there are tools that do not have execute functions, they are not included in the tool results and
         need to be added separately.
         */
      messages: Array<ResponseMessage>;
    }
  >;
  /**
     A text stream that returns only the generated text deltas. You can use it
     as either an AsyncIterable or a ReadableStream. When an error occurs, the
     stream will throw the error.
     */
  readonly textStream: AsyncIterableStream<string>;
  /**
     A stream with all events, including text deltas, tool calls, tool results, and
     errors.
     You can use it as either an AsyncIterable or a ReadableStream.
     Only errors that stop the stream, such as network errors, are thrown.
     */
  readonly fullStream: AsyncIterableStream<TextStreamPart<TOOLS>>;
  /**
     A stream of partial outputs. It uses the `experimental_output` specification.
     */
  readonly experimental_partialOutputStream: AsyncIterableStream<PARTIAL_OUTPUT>;
  /**
     Consumes the stream without processing the parts.
     This is useful to force the stream to finish.
     It effectively removes the backpressure and allows the stream to finish,
     triggering the `onFinish` callback and the promise resolution.

     If an error occurs, it is passed to the optional `onError` callback.
     */
  consumeStream(options?: ConsumeStreamOptions): Promise<void>;
  /**
     Converts the result to a data stream.

     @param data an optional StreamData object that will be merged into the stream.
     @param getErrorMessage an optional function that converts an error to an error message.
     @param sendUsage whether to send the usage information to the client. Defaults to true.
     @param sendReasoning whether to send the reasoning information to the client. Defaults to false.
     @return A data stream.
     */
  toDataStream(
    options?: {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions,
  ): ReadableStream<Uint8Array>;
  /**
   * Merges the result as a data stream into another data stream.
   *
   * @param dataStream A data stream writer.
   * @param options.sendUsage Whether to send the usage information to the client. Defaults to true.
   * @param options.sendReasoning Whether to send the reasoning information to the client. Defaults to false.
   */
  mergeIntoDataStream(dataStream: DataStreamWriter, options?: DataStreamOptions): void;
  /**
     Writes data stream output to a Node.js response-like object.

     @param response A Node.js response-like object (ServerResponse).
     @param options.status The status code.
     @param options.statusText The status text.
     @param options.headers The headers.
     @param options.data The stream data.
     @param options.getErrorMessage An optional function that converts an error to an error message.
     @param options.sendUsage Whether to send the usage information to the client. Defaults to true.
     @param options.sendReasoning Whether to send the reasoning information to the client. Defaults to false.
     */
  pipeDataStreamToResponse(
    response: ServerResponse_2,
    options?: ResponseInit & {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions,
  ): void;
  /**
     Writes text delta output to a Node.js response-like object.
     It sets a `Content-Type` header to `text/plain; charset=utf-8` and
     writes each text delta as a separate chunk.

     @param response A Node.js response-like object (ServerResponse).
     @param init Optional headers, status code, and status text.
     */
  pipeTextStreamToResponse(response: ServerResponse_2, init?: ResponseInit): void;
  /**
     Converts the result to a streamed response object with a stream data part stream.
     It can be used with the `useChat` and `useCompletion` hooks.

     @param options.status The status code.
     @param options.statusText The status text.
     @param options.headers The headers.
     @param options.data The stream data.
     @param options.getErrorMessage An optional function that converts an error to an error message.
     @param options.sendUsage Whether to send the usage information to the client. Defaults to true.
     @param options.sendReasoning Whether to send the reasoning information to the client. Defaults to false.

     @return A response object.
     */
  toDataStreamResponse(
    options?: ResponseInit & {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions,
  ): Response;
  /**
     Creates a simple text stream response.
     Each text delta is encoded as UTF-8 and sent as a separate chunk.
     Non-text-delta events are ignored.

     @param init Optional headers, status code, and status text.
     */
  toTextStreamResponse(init?: ResponseInit): Response;
}

/**
 A transformation that is applied to the stream.

 @param stopStream - A function that stops the source stream.
 @param tools - The tools that are accessible to and can be called by the model. The model needs to support calling tools.
 */
declare type StreamTextTransform<TOOLS extends ToolSet> = (options: {
  tools: TOOLS;
  stopStream: () => void;
}) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>;

declare const symbol$1: unique symbol;

declare const symbol$7: unique symbol;

declare const symbol$d: unique symbol;

declare const symbol$e: unique symbol;

declare const symbol$f: unique symbol;

/**
 * Telemetry configuration.
 */
declare type TelemetrySettings = {
  /**
   * Enable or disable telemetry. Disabled by default while experimental.
   */
  isEnabled?: boolean;
  /**
   * Enable or disable input recording. Enabled by default.
   *
   * You might want to disable input recording to avoid recording sensitive
   * information, to reduce data transfers, or to increase performance.
   */
  recordInputs?: boolean;
  /**
   * Enable or disable output recording. Enabled by default.
   *
   * You might want to disable output recording to avoid recording sensitive
   * information, to reduce data transfers, or to increase performance.
   */
  recordOutputs?: boolean;
  /**
   * Identifier for this function. Used to group telemetry data by function.
   */
  functionId?: string;
  /**
   * Additional information to include in the telemetry data.
   */
  metadata?: Record<string, AttributeValue>;
  /**
   * A custom tracer to use for the telemetry data.
   */
  tracer?: Tracer;
};

/**
 Text content part of a prompt. It contains a string of text.
 */
export declare interface TextPart {
  type: 'text';
  /**
     The text content.
     */
  text: string;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

export declare type TextStreamPart<TOOLS extends ToolSet> =
  | {
      type: 'text-delta';
      textDelta: string;
    }
  | {
      type: 'reasoning';
      textDelta: string;
    }
  | {
      type: 'reasoning-signature';
      signature: string;
    }
  | {
      type: 'redacted-reasoning';
      data: string;
    }
  | {
      type: 'source';
      source: Source;
    }
  | ({
      type: 'file';
    } & GeneratedFile)
  | ({
      type: 'tool-call';
    } & ToolCallUnion<TOOLS>)
  | {
      type: 'tool-call-streaming-start';
      toolCallId: string;
      toolName: string;
    }
  | {
      type: 'tool-call-delta';
      toolCallId: string;
      toolName: string;
      argsTextDelta: string;
    }
  | ({
      type: 'tool-result';
    } & ToolResultUnion<TOOLS>)
  | {
      type: 'step-start';
      messageId: string;
      request: LanguageModelRequestMetadata;
      warnings: CallWarning[];
    }
  | {
      type: 'step-finish';
      messageId: string;
      logprobs?: LogProbs;
      request: LanguageModelRequestMetadata;
      warnings: CallWarning[] | undefined;
      response: LanguageModelResponseMetadata;
      usage: LanguageModelUsage;
      finishReason: FinishReason;
      providerMetadata: ProviderMetadata | undefined;
      /**
       * @deprecated Use `providerMetadata` instead.
       */
      experimental_providerMetadata?: ProviderMetadata;
      isContinued: boolean;
    }
  | {
      type: 'finish';
      finishReason: FinishReason;
      usage: LanguageModelUsage;
      providerMetadata: ProviderMetadata | undefined;
      /**
       * @deprecated Use `providerMetadata` instead.
       */
      experimental_providerMetadata?: ProviderMetadata;
      /**
       * @deprecated will be moved into provider metadata
       */
      logprobs?: LogProbs;
      /**
       * @deprecated use response on step-finish instead
       */
      response: LanguageModelResponseMetadata;
    }
  | {
      type: 'error';
      error: unknown;
    };

/**
 * A text part of a message.
 */
declare type TextUIPart = {
  type: 'text';
  /**
   * The text content.
   */
  text: string;
};

/**
 * Defines TimeInput.
 *
 * hrtime, epoch milliseconds, performance.now() or Date
 */
declare type TimeInput = HrTime | number | Date;

/**
 A tool contains the description and the schema of the input that the tool expects.
 This enables the language model to generate the input.

 The tool can also contain an optional execute function for the actual execution function of the tool.
 */
export declare type Tool<PARAMETERS extends ToolParameters = any, RESULT = any> = {
  /**
     The schema of the input that the tool expects. The language model will use this to generate the input.
     It is also used to validate the output of the language model.
     Use descriptions to make the input understandable for the language model.
     */
  parameters: PARAMETERS;
  /**
     An optional description of what the tool does.
     Will be used by the language model to decide whether to use the tool.
     Not used for provider-defined tools.
     */
  description?: string;
  /**
     Optional conversion function that maps the tool result to multi-part tool content for LLMs.
     */
  experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
  /**
     An async function that is called with the arguments from the tool call and produces a result.
     If not provided, the tool will not be executed automatically.

     @args is the input of the tool call.
     @options.abortSignal is a signal that can be used to abort the tool call.
     */
  execute?: (args: inferParameters<PARAMETERS>, options: ToolExecutionOptions) => PromiseLike<RESULT>;
} & (
  | {
      /**
     Function tool.
     */
      type?: undefined | 'function';
    }
  | {
      /**
     Provider-defined tool.
     */
      type: 'provider-defined';
      /**
     The ID of the tool. Should follow the format `<provider-name>.<tool-name>`.
     */
      id: `${string}.${string}`;
      /**
     The arguments for configuring the tool. Must match the expected arguments defined by the provider for this tool.
     */
      args: Record<string, unknown>;
    }
);

/**
 Typed tool call that is returned by generateText and streamText.
 It contains the tool call ID, the tool name, and the tool arguments.
 */
declare interface ToolCall<NAME extends string, ARGS> {
  /**
     ID of the tool call. This ID is used to match the tool call with the tool result.
     */
  toolCallId: string;
  /**
     Name of the tool that is being called.
     */
  toolName: NAME;
  /**
     Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
     */
  args: ARGS;
}

declare type ToolCallArray<TOOLS extends ToolSet> = Array<ToolCallUnion<TOOLS>>;

/**
 Tool call content part of a prompt. It contains a tool call (usually generated by the AI model).
 */
declare interface ToolCallPart {
  type: 'tool-call';
  /**
     ID of the tool call. This ID is used to match the tool call with the tool result.
     */
  toolCallId: string;
  /**
     Name of the tool that is being called.
     */
  toolName: string;
  /**
     Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
     */
  args: unknown;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

/**
 * A function that attempts to repair a tool call that failed to parse.
 *
 * It receives the error and the context as arguments and returns the repair
 * tool call JSON as text.
 *
 * @param options.system - The system prompt.
 * @param options.messages - The messages in the current generation step.
 * @param options.toolCall - The tool call that failed to parse.
 * @param options.tools - The tools that are available.
 * @param options.parameterSchema - A function that returns the JSON Schema for a tool.
 * @param options.error - The error that occurred while parsing the tool call.
 */
declare type ToolCallRepairFunction<TOOLS extends ToolSet> = (options: {
  system: string | undefined;
  messages: CoreMessage[];
  toolCall: LanguageModelV1FunctionToolCall;
  tools: TOOLS;
  parameterSchema: (options: { toolName: string }) => JSONSchema7;
  error: NoSuchToolError | InvalidToolArgumentsError;
}) => Promise<LanguageModelV1FunctionToolCall | null>;

declare type ToolCallUnion<TOOLS extends ToolSet> = ValueOf<{
  [NAME in keyof TOOLS]: {
    type: 'tool-call';
    toolCallId: string;
    toolName: NAME & string;
    args: inferParameters<TOOLS[NAME]['parameters']>;
  };
}>;

/**
 Tool choice for the generation. It supports the following settings:

 - `auto` (default): the model can choose whether and which tools to call.
 - `required`: the model must call a tool. It can choose which tool to call.
 - `none`: the model must not call tools
 - `{ type: 'tool', toolName: string (typed) }`: the model must call the specified tool
 */
declare type ToolChoice<TOOLS extends Record<string, unknown>> =
  | 'auto'
  | 'none'
  | 'required'
  | {
      type: 'tool';
      toolName: keyof TOOLS;
    };

/**
 Content of a tool message. It is an array of tool result parts.
 */
export declare type ToolContent = Array<ToolResultPart>;

export declare interface ToolExecutionOptions {
  /**
   * The ID of the tool call. You can use it e.g. when sending tool-call related information with stream data.
   */
  toolCallId: string;
  /**
   * Messages that were sent to the language model to initiate the response that contained the tool call.
   * The messages **do not** include the system prompt nor the assistant response that contained the tool call.
   */
  messages: CoreMessage[];
  /**
   * An optional abort signal that indicates that the overall operation should be aborted.
   */
  abortSignal?: AbortSignal;
}

/**
 Tool invocations are either tool calls or tool results. For each assistant tool call,
 there is one tool invocation. While the call is in progress, the invocation is a tool call.
 Once the call is complete, the invocation is a tool result.

 The step is used to track how to map an assistant UI message with many tool invocations
 back to a sequence of LLM assistant/tool result message pairs.
 It is optional for backwards compatibility.
 */
export declare type ToolInvocation =
  | ({
      state: 'partial-call';
      step?: number;
    } & ToolCall<string, any>)
  | ({
      state: 'call';
      step?: number;
    } & ToolCall<string, any>)
  | ({
      state: 'result';
      step?: number;
    } & ToolResult<string, any, any>);

/**
 * A tool invocation part of a message.
 */
declare type ToolInvocationUIPart = {
  type: 'tool-invocation';
  /**
   * The tool invocation.
   */
  toolInvocation: ToolInvocation;
};

declare type ToolParameters = z.ZodTypeAny | Schema<any>;

/**
 Typed tool result that is returned by `generateText` and `streamText`.
 It contains the tool call ID, the tool name, the tool arguments, and the tool result.
 */
declare interface ToolResult<NAME extends string, ARGS, RESULT> {
  /**
     ID of the tool call. This ID is used to match the tool call with the tool result.
     */
  toolCallId: string;
  /**
     Name of the tool that was called.
     */
  toolName: NAME;
  /**
     Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
     */
  args: ARGS;
  /**
     Result of the tool call. This is the result of the tool's execution.
     */
  result: RESULT;
}

declare type ToolResultArray<TOOLS extends ToolSet> = Array<ToolResultUnion<TOOLS>>;

declare type ToolResultContent = Array<
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      data: string;
      mimeType?: string;
    }
>;

/**
 Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
export declare interface ToolResultPart {
  type: 'tool-result';
  /**
     ID of the tool call that this result is associated with.
     */
  toolCallId: string;
  /**
     Name of the tool that generated this result.
     */
  toolName: string;
  /**
     Result of the tool call. This is a JSON-serializable object.
     */
  result: unknown;
  /**
     Multi-part content of the tool result. Only for tools that support multipart results.
     */
  experimental_content?: ToolResultContent;
  /**
     Optional flag if the result is an error or an error message.
     */
  isError?: boolean;
  /**
     Additional provider-specific metadata. They are passed through
     to the provider from the AI SDK and enable provider-specific
     functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions;
  /**
     @deprecated Use `providerOptions` instead.
     */
  experimental_providerMetadata?: ProviderMetadata;
}

declare type ToolResultUnion<TOOLS extends ToolSet> = ToToolResultObject<
  ToToolsWithDefinedExecute<ToToolsWithExecute<TOOLS>>
>;

export declare type ToolSet = Record<string, Tool>;

declare type ToToolResultObject<TOOLS extends ToolSet> = ValueOf<{
  [NAME in keyof TOOLS]: {
    type: 'tool-result';
    toolCallId: string;
    toolName: NAME & string;
    args: inferParameters<TOOLS[NAME]['parameters']>;
    result: Awaited<ReturnType<Exclude<TOOLS[NAME]['execute'], undefined>>>;
  };
}>;

declare type ToToolsWithDefinedExecute<TOOLS extends ToolSet> = {
  [K in keyof TOOLS as TOOLS[K]['execute'] extends undefined ? never : K]: TOOLS[K];
};

declare type ToToolsWithExecute<TOOLS extends ToolSet> = {
  [K in keyof TOOLS as TOOLS[K] extends {
    execute: any;
  }
    ? K
    : never]: TOOLS[K];
};

/**
 * Tracer provides an interface for creating {@link Span}s.
 */
declare interface Tracer {
  /**
   * Starts a new {@link Span}. Start the span without setting it on context.
   *
   * This method do NOT modify the current Context.
   *
   * @param name The name of the span
   * @param [options] SpanOptions used for span creation
   * @param [context] Context to use to extract parent
   * @returns Span The newly created span
   * @example
   *     const span = tracer.startSpan('op');
   *     span.setAttribute('key', 'value');
   *     span.end();
   */
  startSpan(name: string, options?: SpanOptions, context?: Context): Span;
  /**
   * Starts a new {@link Span} and calls the given function passing it the
   * created span as first argument.
   * Additionally the new span gets set in context and this context is activated
   * for the duration of the function call.
   *
   * @param name The name of the span
   * @param [options] SpanOptions used for span creation
   * @param [context] Context to use to extract parent
   * @param fn function called in the context of the span and receives the newly created span as an argument
   * @returns return value of fn
   * @example
   *     const something = tracer.startActiveSpan('op', span => {
   *       try {
   *         do some work
   *         span.setStatus({code: SpanStatusCode.OK});
   *         return something;
   *       } catch (err) {
   *         span.setStatus({
   *           code: SpanStatusCode.ERROR,
   *           message: err.message,
   *         });
   *         throw err;
   *       } finally {
   *         span.end();
   *       }
   *     });
   *
   * @example
   *     const span = tracer.startActiveSpan('op', span => {
   *       try {
   *         do some work
   *         return span;
   *       } catch (err) {
   *         span.setStatus({
   *           code: SpanStatusCode.ERROR,
   *           message: err.message,
   *         });
   *         throw err;
   *       }
   *     });
   *     do some more work
   *     span.end();
   */
  startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(name: string, options: SpanOptions, fn: F): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    context: Context,
    fn: F,
  ): ReturnType<F>;
}

declare interface TraceState {
  /**
   * Create a new TraceState which inherits from this TraceState and has the
   * given key set.
   * The new entry will always be added in the front of the list of states.
   *
   * @param key key of the TraceState entry.
   * @param value value of the TraceState entry.
   */
  set(key: string, value: string): TraceState;
  /**
   * Return a new TraceState which inherits from this TraceState but does not
   * contain the given key.
   *
   * @param key the key for the TraceState entry to be removed.
   */
  unset(key: string): TraceState;
  /**
   * Returns the value to which the specified key is mapped, or `undefined` if
   * this map contains no mapping for the key.
   *
   * @param key with which the specified value is to be associated.
   * @returns the value to which the specified key is mapped, or `undefined` if
   *     this map contains no mapping for the key.
   */
  get(key: string): string | undefined;
  /**
   * Serializes the TraceState to a `list` as defined below. The `list` is a
   * series of `list-members` separated by commas `,`, and a list-member is a
   * key/value pair separated by an equals sign `=`. Spaces and horizontal tabs
   * surrounding `list-members` are ignored. There can be a maximum of 32
   * `list-members` in a `list`.
   *
   * @returns the serialized string.
   */
  serialize(): string;
}

declare class TypeValidationError extends AISDKError {
  private readonly [symbol$1];
  readonly value: unknown;
  constructor({ value, cause }: { value: unknown; cause: unknown });
  static isInstance(error: unknown): error is TypeValidationError;
  /**
   * Wraps an error into a TypeValidationError.
   * If the cause is already a TypeValidationError with the same value, it returns the cause.
   * Otherwise, it creates a new TypeValidationError.
   *
   * @param {Object} params - The parameters for wrapping the error.
   * @param {unknown} params.value - The value that failed validation.
   * @param {unknown} params.cause - The original error or cause of the validation failure.
   * @returns {TypeValidationError} A TypeValidationError instance.
   */
  static wrap({ value, cause }: { value: unknown; cause: unknown }): TypeValidationError;
}

export declare type UIMessage = Message & {
  /**
   * The parts of the message. Use this for rendering the message in the UI.
   *
   * Assistant messages can have text, reasoning and tool invocation parts.
   * User messages can have text parts.
   */
  parts: Array<TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart>;
};

/**
 Content of a user message. It can be a string or an array of text and image parts.
 */
export declare type UserContent = string | Array<TextPart | ImagePart | FilePart>;

declare type ValidationResult<OBJECT> =
  | {
      success: true;
      value: OBJECT;
    }
  | {
      success: false;
      error: Error;
    };

declare type Validator<OBJECT = unknown> = {
  /**
   * Used to mark validator functions so we can support both Zod and custom schemas.
   */
  [validatorSymbol]: true;
  /**
   * Optional. Validates that the structure of a value matches this schema,
   * and returns a typed version of the value if it does.
   */
  readonly validate?: (value: unknown) => ValidationResult<OBJECT>;
};

/**
 * Used to mark validator functions so we can support both Zod and custom schemas.
 */
declare const validatorSymbol: unique symbol;

/**
 Create a union of the given object's values, and optionally specify which keys to get the values from.

 Please upvote [this issue](https://github.com/microsoft/TypeScript/issues/31438) if you want to have this type as a built-in in TypeScript.

 @example
 ```
 // data.json
 {
 'foo': 1,
 'bar': 2,
 'biz': 3
 }

 // main.ts
 import type {ValueOf} from 'type-fest';
 import data = require('./data.json');

 export function getData(name: string): ValueOf<typeof data> {
 return data[name];
 }

 export function onlyBar(name: string): ValueOf<typeof data, 'bar'> {
 return data[name];
 }

 // file.ts
 import {getData, onlyBar} from './main';

 getData('foo');
 //=> 1

 onlyBar('foo');
 //=> TypeError ...

 onlyBar('bar');
 //=> 2
 ```
 * @see https://github.com/sindresorhus/type-fest/blob/main/source/value-of.d.ts
 */
declare type ValueOf<ObjectType, ValueType extends keyof ObjectType = keyof ObjectType> = ObjectType[ValueType];

export {};
