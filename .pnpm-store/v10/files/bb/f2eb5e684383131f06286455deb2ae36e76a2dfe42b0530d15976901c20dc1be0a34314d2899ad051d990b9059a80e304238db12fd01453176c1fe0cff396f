import { IDGenerator } from '@ai-sdk/provider-utils';
export { CoreToolCall, CoreToolResult, IDGenerator, ToolCall, ToolResult, createIdGenerator, generateId } from '@ai-sdk/provider-utils';
import { DataStreamString, Message, Schema, DeepPartial, JSONValue as JSONValue$1, AssistantMessage, DataMessage } from '@ai-sdk/ui-utils';
export { AssistantMessage, AssistantStatus, Attachment, ChatRequest, ChatRequestOptions, CreateMessage, DataMessage, DataStreamPart, DeepPartial, IdGenerator, JSONValue, Message, RequestOptions, Schema, ToolInvocation, UIMessage, UseAssistantOptions, formatAssistantStreamPart, formatDataStreamPart, jsonSchema, parseAssistantStreamPart, parseDataStreamPart, processDataStream, processTextStream, zodSchema } from '@ai-sdk/ui-utils';
import { LanguageModelV1, LanguageModelV1FinishReason, LanguageModelV1LogProbs, LanguageModelV1CallWarning, LanguageModelV1Source, JSONValue, EmbeddingModelV1, EmbeddingModelV1Embedding, ImageModelV1, ImageModelV1CallWarning, LanguageModelV1ProviderMetadata, TranscriptionModelV1, TranscriptionModelV1CallWarning, SpeechModelV1, SpeechModelV1CallWarning, LanguageModelV1CallOptions, AISDKError, LanguageModelV1FunctionToolCall, JSONSchema7, JSONParseError, TypeValidationError, ProviderV1, NoSuchModelError } from '@ai-sdk/provider';
export { AISDKError, APICallError, EmptyResponseBodyError, InvalidPromptError, InvalidResponseDataError, JSONParseError, LanguageModelV1, LanguageModelV1CallOptions, LanguageModelV1Prompt, LanguageModelV1StreamPart, LoadAPIKeyError, NoContentGeneratedError, NoSuchModelError, TypeValidationError, UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { ServerResponse } from 'node:http';
import { AttributeValue, Tracer } from '@opentelemetry/api';
import { z } from 'zod';
import { ServerResponse as ServerResponse$1 } from 'http';

/**
Language model that is used by the AI SDK Core functions.
*/
type LanguageModel = LanguageModelV1;
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
type FinishReason = LanguageModelV1FinishReason;
/**
Log probabilities for each token and its top log probabilities.

@deprecated Will become a provider extension in the future.
 */
type LogProbs = LanguageModelV1LogProbs;
/**
Warning from the model provider for this call. The call will proceed, but e.g.
some settings might not be supported, which can lead to suboptimal results.
*/
type CallWarning = LanguageModelV1CallWarning;
/**
A source that has been used as input to generate the response.
*/
type Source = LanguageModelV1Source;
/**
Tool choice for the generation. It supports the following settings:

- `auto` (default): the model can choose whether and which tools to call.
- `required`: the model must call a tool. It can choose which tool to call.
- `none`: the model must not call tools
- `{ type: 'tool', toolName: string (typed) }`: the model must call the specified tool
 */
type ToolChoice<TOOLS extends Record<string, unknown>> = 'auto' | 'none' | 'required' | {
    type: 'tool';
    toolName: keyof TOOLS;
};
/**
 * @deprecated Use `ToolChoice` instead.
 */
type CoreToolChoice<TOOLS extends Record<string, unknown>> = ToolChoice<TOOLS>;

interface DataStreamWriter {
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

declare function createDataStream({ execute, onError, }: {
    execute: (dataStream: DataStreamWriter) => Promise<void> | void;
    onError?: (error: unknown) => string;
}): ReadableStream<DataStreamString>;

declare function createDataStreamResponse({ status, statusText, headers, execute, onError, }: ResponseInit & {
    execute: (dataStream: DataStreamWriter) => Promise<void> | void;
    onError?: (error: unknown) => string;
}): Response;

declare function pipeDataStreamToResponse(response: ServerResponse, { status, statusText, headers, execute, onError, }: ResponseInit & {
    execute: (writer: DataStreamWriter) => Promise<void> | void;
    onError?: (error: unknown) => string;
}): void;

/**
 * Telemetry configuration.
 */
type TelemetrySettings = {
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
Embedding model that is used by the AI SDK Core functions.
*/
type EmbeddingModel<VALUE> = EmbeddingModelV1<VALUE>;
/**
Embedding.
 */
type Embedding = EmbeddingModelV1Embedding;

/**
Image model that is used by the AI SDK Core functions.
  */
type ImageModel = ImageModelV1;
/**
Warning from the model provider for this call. The call will proceed, but e.g.
some settings might not be supported, which can lead to suboptimal results.
  */
type ImageGenerationWarning = ImageModelV1CallWarning;

type ImageModelResponseMetadata = {
    /**
  Timestamp for the start of the generated response.
     */
    timestamp: Date;
    /**
  The ID of the response model that was used to generate the response.
     */
    modelId: string;
    /**
  Response headers.
     */
    headers?: Record<string, string>;
};

type LanguageModelRequestMetadata = {
    /**
    Raw request HTTP body that was sent to the provider API as a string (JSON should be stringified).
       */
    body?: string;
};

type LanguageModelResponseMetadata = {
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
 * Provider for language, text embedding, and image models.
 */
type Provider = {
    /**
    Returns the language model with the given id.
    The model id is then passed to the provider function to get the model.
  
    @param {string} id - The id of the model to return.
  
    @returns {LanguageModel} The language model associated with the id
  
    @throws {NoSuchModelError} If no such model exists.
       */
    languageModel(modelId: string): LanguageModel;
    /**
    Returns the text embedding model with the given id.
    The model id is then passed to the provider function to get the model.
  
    @param {string} id - The id of the model to return.
  
    @returns {LanguageModel} The language model associated with the id
  
    @throws {NoSuchModelError} If no such model exists.
       */
    textEmbeddingModel(modelId: string): EmbeddingModel<string>;
    /**
    Returns the image model with the given id.
    The model id is then passed to the provider function to get the model.
  
    @param {string} id - The id of the model to return.
  
    @returns {ImageModel} The image model associated with the id
    */
    imageModel(modelId: string): ImageModel;
};

/**
Additional provider-specific metadata that is returned from the provider.

This is needed to enable provider-specific functionality that can be
fully encapsulated in the provider.
 */
type ProviderMetadata = LanguageModelV1ProviderMetadata;
/**
Additional provider-specific options.

They are passed through to the provider from the AI SDK and enable
provider-specific functionality that can be fully encapsulated in the provider.
 */
type ProviderOptions = LanguageModelV1ProviderMetadata;

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
/**
Represents the number of tokens used in an embedding.
 */
type EmbeddingModelUsage = {
    /**
  The number of tokens used in the embedding.
     */
    tokens: number;
};

/**
Transcription model that is used by the AI SDK Core functions.
  */
type TranscriptionModel = TranscriptionModelV1;
/**
Warning from the model provider for this call. The call will proceed, but e.g.
some settings might not be supported, which can lead to suboptimal results.
  */
type TranscriptionWarning = TranscriptionModelV1CallWarning;

type TranscriptionModelResponseMetadata = {
    /**
  Timestamp for the start of the generated response.
     */
    timestamp: Date;
    /**
  The ID of the response model that was used to generate the response.
     */
    modelId: string;
    /**
  Response headers.
     */
    headers?: Record<string, string>;
};

/**
Speech model that is used by the AI SDK Core functions.
  */
type SpeechModel = SpeechModelV1;
/**
Warning from the model provider for this call. The call will proceed, but e.g.
some settings might not be supported, which can lead to suboptimal results.
  */
type SpeechWarning = SpeechModelV1CallWarning;

type SpeechModelResponseMetadata = {
    /**
  Timestamp for the start of the generated response.
     */
    timestamp: Date;
    /**
  The ID of the response model that was used to generate the response.
     */
    modelId: string;
    /**
  Response headers.
     */
    headers?: Record<string, string>;
};

/**
The result of an `embed` call.
It contains the embedding, the value, and additional information.
 */
interface EmbedResult<VALUE> {
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
Embed a value using an embedding model. The type of the value is defined by the embedding model.

@param model - The embedding model to use.
@param value - The value that should be embedded.

@param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
@param abortSignal - An optional abort signal that can be used to cancel the call.
@param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

@returns A result object that contains the embedding, the value, and additional information.
 */
declare function embed<VALUE>({ model, value, maxRetries: maxRetriesArg, abortSignal, headers, experimental_telemetry: telemetry, }: {
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
The result of a `embedMany` call.
It contains the embeddings, the values, and additional information.
 */
interface EmbedManyResult<VALUE> {
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
Embed several values using an embedding model. The type of the value is defined
by the embedding model.

`embedMany` automatically splits large requests into smaller chunks if the model
has a limit on how many embeddings can be generated in a single call.

@param model - The embedding model to use.
@param values - The values that should be embedded.

@param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
@param abortSignal - An optional abort signal that can be used to cancel the call.
@param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

@returns A result object that contains the embeddings, the value, and additional information.
 */
declare function embedMany<VALUE>({ model, values, maxRetries: maxRetriesArg, abortSignal, headers, experimental_telemetry: telemetry, }: {
    /**
  The embedding model to use.
       */
    model: EmbeddingModel<VALUE>;
    /**
  The values that should be embedded.
     */
    values: Array<VALUE>;
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
}): Promise<EmbedManyResult<VALUE>>;

type CallSettings = {
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
Data content. Can either be a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer.
 */
type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

type ToolResultContent = Array<{
    type: 'text';
    text: string;
} | {
    type: 'image';
    data: string;
    mimeType?: string;
}>;

/**
Text content part of a prompt. It contains a string of text.
 */
interface TextPart {
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
/**
Image content part of a prompt. It contains an image.
 */
interface ImagePart {
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
/**
File content part of a prompt. It contains a file.
 */
interface FilePart {
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
 * Reasoning content part of a prompt. It contains a reasoning.
 */
interface ReasoningPart {
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
Redacted reasoning content part of a prompt.
 */
interface RedactedReasoningPart {
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
Tool call content part of a prompt. It contains a tool call (usually generated by the AI model).
 */
interface ToolCallPart {
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
Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
interface ToolResultPart {
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

/**
 A system message. It can contain system information.

 Note: using the "system" part of the prompt is strongly preferred
 to increase the resilience against prompt injection attacks,
 and because not all providers support several system messages.
 */
type CoreSystemMessage = {
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
declare const coreSystemMessageSchema: z.ZodType<CoreSystemMessage>;
/**
A user message. It can contain text or a combination of text and images.
 */
type CoreUserMessage = {
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
declare const coreUserMessageSchema: z.ZodType<CoreUserMessage>;
/**
Content of a user message. It can be a string or an array of text and image parts.
 */
type UserContent = string | Array<TextPart | ImagePart | FilePart>;
/**
An assistant message. It can contain text, tool calls, or a combination of text and tool calls.
 */
type CoreAssistantMessage = {
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
declare const coreAssistantMessageSchema: z.ZodType<CoreAssistantMessage>;
/**
Content of an assistant message.
It can be a string or an array of text, image, reasoning, redacted reasoning, and tool call parts.
 */
type AssistantContent = string | Array<TextPart | FilePart | ReasoningPart | RedactedReasoningPart | ToolCallPart>;
/**
A tool message. It contains the result of one or more tool calls.
 */
type CoreToolMessage = {
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
declare const coreToolMessageSchema: z.ZodType<CoreToolMessage>;
/**
Content of a tool message. It is an array of tool result parts.
 */
type ToolContent = Array<ToolResultPart>;
/**
A message that can be used in the `messages` field of a prompt.
It can be a user message, an assistant message, or a tool message.
 */
type CoreMessage = CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage;
declare const coreMessageSchema: z.ZodType<CoreMessage>;

/**
Prompt part of the AI function options.
It contains a system message, a simple text prompt, or a list of messages.
 */
type Prompt = {
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
 * A generated file.
 */
interface GeneratedFile {
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

type ReasoningDetail = {
    type: 'text';
    text: string;
    signature?: string;
} | {
    type: 'redacted';
    data: string;
};

type ToolParameters = z.ZodTypeAny | Schema<any>;
type inferParameters<PARAMETERS extends ToolParameters> = PARAMETERS extends Schema<any> ? PARAMETERS['_type'] : PARAMETERS extends z.ZodTypeAny ? z.infer<PARAMETERS> : never;
interface ToolExecutionOptions {
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
A tool contains the description and the schema of the input that the tool expects.
This enables the language model to generate the input.

The tool can also contain an optional execute function for the actual execution function of the tool.
 */
type Tool<PARAMETERS extends ToolParameters = any, RESULT = any> = {
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
} & ({
    /**
Function tool.
     */
    type?: undefined | 'function';
} | {
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
});
/**
 * @deprecated Use `Tool` instead.
 */
type CoreTool<PARAMETERS extends ToolParameters = any, RESULT = any> = Tool<PARAMETERS, RESULT>;
/**
Helper function for inferring the execute args of a tool.
 */
declare function tool<PARAMETERS extends ToolParameters, RESULT>(tool: Tool<PARAMETERS, RESULT> & {
    execute: (args: inferParameters<PARAMETERS>, options: ToolExecutionOptions) => PromiseLike<RESULT>;
}): Tool<PARAMETERS, RESULT> & {
    execute: (args: inferParameters<PARAMETERS>, options: ToolExecutionOptions) => PromiseLike<RESULT>;
};
declare function tool<PARAMETERS extends ToolParameters, RESULT>(tool: Tool<PARAMETERS, RESULT> & {
    execute?: undefined;
}): Tool<PARAMETERS, RESULT> & {
    execute: undefined;
};

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
type ValueOf<ObjectType, ValueType extends keyof ObjectType = keyof ObjectType> = ObjectType[ValueType];

declare const JSONRPCRequestSchema: z.ZodObject<z.objectUtil.extendShape<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    method: z.ZodString;
    params: z.ZodOptional<z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}>, "strict", z.ZodTypeAny, {
    id: string | number;
    method: string;
    jsonrpc: "2.0";
    params?: z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    id: string | number;
    method: string;
    jsonrpc: "2.0";
    params?: z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>;
type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;
declare const JSONRPCResponseSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    result: z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strict", z.ZodTypeAny, {
    result: {
        _meta?: z.objectOutputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    } & {
        [k: string]: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}, {
    result: {
        _meta?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    } & {
        [k: string]: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}>;
type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;
declare const JSONRPCErrorSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    error: z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: number;
        message: string;
        data?: unknown;
    }, {
        code: number;
        message: string;
        data?: unknown;
    }>;
}, "strict", z.ZodTypeAny, {
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}, {
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}>;
type JSONRPCError = z.infer<typeof JSONRPCErrorSchema>;
declare const JSONRPCNotificationSchema: z.ZodObject<z.objectUtil.extendShape<{
    jsonrpc: z.ZodLiteral<"2.0">;
}, {
    method: z.ZodString;
    params: z.ZodOptional<z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}>, "strict", z.ZodTypeAny, {
    method: string;
    jsonrpc: "2.0";
    params?: z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    method: string;
    jsonrpc: "2.0";
    params?: z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>;
type JSONRPCNotification = z.infer<typeof JSONRPCNotificationSchema>;
declare const JSONRPCMessageSchema: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    method: z.ZodString;
    params: z.ZodOptional<z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}>, "strict", z.ZodTypeAny, {
    id: string | number;
    method: string;
    jsonrpc: "2.0";
    params?: z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    id: string | number;
    method: string;
    jsonrpc: "2.0";
    params?: z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>, z.ZodObject<z.objectUtil.extendShape<{
    jsonrpc: z.ZodLiteral<"2.0">;
}, {
    method: z.ZodString;
    params: z.ZodOptional<z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}>, "strict", z.ZodTypeAny, {
    method: string;
    jsonrpc: "2.0";
    params?: z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    method: string;
    jsonrpc: "2.0";
    params?: z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>, z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    result: z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strict", z.ZodTypeAny, {
    result: {
        _meta?: z.objectOutputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    } & {
        [k: string]: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}, {
    result: {
        _meta?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    } & {
        [k: string]: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}>, z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    error: z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: number;
        message: string;
        data?: unknown;
    }, {
        code: number;
        message: string;
        data?: unknown;
    }>;
}, "strict", z.ZodTypeAny, {
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}, {
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: string | number;
    jsonrpc: "2.0";
}>]>;
type JSONRPCMessage = z.infer<typeof JSONRPCMessageSchema>;

/**
 * Transport interface for MCP (Model Context Protocol) communication.
 * Maps to the `Transport` interface in the MCP spec.
 */
interface MCPTransport {
    /**
     * Initialize and start the transport
     */
    start(): Promise<void>;
    /**
     * Send a JSON-RPC message through the transport
     * @param message The JSON-RPC message to send
     */
    send(message: JSONRPCMessage): Promise<void>;
    /**
     * Clean up and close the transport
     */
    close(): Promise<void>;
    /**
     * Event handler for transport closure
     */
    onclose?: () => void;
    /**
     * Event handler for transport errors
     */
    onerror?: (error: Error) => void;
    /**
     * Event handler for received messages
     */
    onmessage?: (message: JSONRPCMessage) => void;
}
type MCPTransportConfig = {
    type: 'sse';
    /**
     * The URL of the MCP server.
     */
    url: string;
    /**
     * Additional HTTP headers to be sent with requests.
     */
    headers?: Record<string, string>;
};

type ToolSchemas = Record<string, {
    parameters: ToolParameters;
}> | 'automatic' | undefined;
type McpToolSet<TOOL_SCHEMAS extends ToolSchemas = 'automatic'> = TOOL_SCHEMAS extends Record<string, {
    parameters: ToolParameters;
}> ? {
    [K in keyof TOOL_SCHEMAS]: Tool<TOOL_SCHEMAS[K]['parameters'], CallToolResult> & {
        execute: (args: inferParameters<TOOL_SCHEMAS[K]['parameters']>, options: ToolExecutionOptions) => PromiseLike<CallToolResult>;
    };
} : {
    [k: string]: Tool<z.ZodUnknown, CallToolResult> & {
        execute: (args: unknown, options: ToolExecutionOptions) => PromiseLike<CallToolResult>;
    };
};
declare const CallToolResultSchema: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
    _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, {
    content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, z.ZodTypeAny, "passthrough">>]>, "many">;
    isError: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
    _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, {
    content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, z.ZodTypeAny, "passthrough">>]>, "many">;
    isError: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
    _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, {
    content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"image">;
        data: z.ZodString;
        mimeType: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodLiteral<"resource">;
        resource: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            text: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
            /**
             * The URI of this resource.
             */
            uri: z.ZodString;
            /**
             * The MIME type of this resource, if known.
             */
            mimeType: z.ZodOptional<z.ZodString>;
        }, {
            blob: z.ZodString;
        }>, z.ZodTypeAny, "passthrough">>]>;
    }, z.ZodTypeAny, "passthrough">>]>, "many">;
    isError: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}>, z.ZodTypeAny, "passthrough">>, z.ZodObject<z.objectUtil.extendShape<{
    _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, {
    toolResult: z.ZodUnknown;
}>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
    _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, {
    toolResult: z.ZodUnknown;
}>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
    _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, {
    toolResult: z.ZodUnknown;
}>, z.ZodTypeAny, "passthrough">>]>;
type CallToolResult = z.infer<typeof CallToolResultSchema>;

interface MCPClientConfig {
    /** Transport configuration for connecting to the MCP server */
    transport: MCPTransportConfig | MCPTransport;
    /** Optional callback for uncaught errors */
    onUncaughtError?: (error: unknown) => void;
    /** Optional client name, defaults to 'ai-sdk-mcp-client' */
    name?: string;
}
declare function createMCPClient(config: MCPClientConfig): Promise<MCPClient>;
/**
 * A lightweight MCP Client implementation
 *
 * The primary purpose of this client is tool conversion between MCP<>AI SDK
 * but can later be extended to support other MCP features
 *
 * Tool parameters are automatically inferred from the server's JSON schema
 * if not explicitly provided in the tools configuration
 *
 * This client is meant to be used to communicate with a single server. To communicate and fetch tools across multiple servers, it's recommended to create a new client instance per server.
 *
 * Not supported:
 * - Client options (e.g. sampling, roots) as they are not needed for tool conversion
 * - Accepting notifications
 * - Session management (when passing a sessionId to an instance of the Streamable HTTP transport)
 * - Resumable SSE streams
 */
declare class MCPClient {
    private transport;
    private onUncaughtError?;
    private clientInfo;
    private requestMessageId;
    private responseHandlers;
    private serverCapabilities;
    private isClosed;
    constructor({ transport: transportConfig, name, onUncaughtError, }: MCPClientConfig);
    init(): Promise<this>;
    close(): Promise<void>;
    private assertCapability;
    private request;
    private listTools;
    private callTool;
    private notification;
    /**
     * Returns a set of AI SDK tools from the MCP server
     * @returns A record of tool names to their implementations
     */
    tools<TOOL_SCHEMAS extends ToolSchemas = 'automatic'>({ schemas, }?: {
        schemas?: TOOL_SCHEMAS;
    }): Promise<McpToolSet<TOOL_SCHEMAS>>;
    private onClose;
    private onError;
    private onResponse;
}

type ToolSet = Record<string, Tool>;

type ToolCallUnion<TOOLS extends ToolSet> = ValueOf<{
    [NAME in keyof TOOLS]: {
        type: 'tool-call';
        toolCallId: string;
        toolName: NAME & string;
        args: inferParameters<TOOLS[NAME]['parameters']>;
    };
}>;
/**
 * @deprecated Use `ToolCallUnion` instead.
 */
type CoreToolCallUnion<TOOLS extends ToolSet> = ToolCallUnion<ToolSet>;
type ToolCallArray<TOOLS extends ToolSet> = Array<ToolCallUnion<TOOLS>>;

type ToToolsWithExecute<TOOLS extends ToolSet> = {
    [K in keyof TOOLS as TOOLS[K] extends {
        execute: any;
    } ? K : never]: TOOLS[K];
};
type ToToolsWithDefinedExecute<TOOLS extends ToolSet> = {
    [K in keyof TOOLS as TOOLS[K]['execute'] extends undefined ? never : K]: TOOLS[K];
};
type ToToolResultObject<TOOLS extends ToolSet> = ValueOf<{
    [NAME in keyof TOOLS]: {
        type: 'tool-result';
        toolCallId: string;
        toolName: NAME & string;
        args: inferParameters<TOOLS[NAME]['parameters']>;
        result: Awaited<ReturnType<Exclude<TOOLS[NAME]['execute'], undefined>>>;
    };
}>;
type ToolResultUnion<TOOLS extends ToolSet> = ToToolResultObject<ToToolsWithDefinedExecute<ToToolsWithExecute<TOOLS>>>;
/**
 * @deprecated Use `ToolResultUnion` instead.
 */
type CoreToolResultUnion<TOOLS extends ToolSet> = ToolResultUnion<TOOLS>;
type ToolResultArray<TOOLS extends ToolSet> = Array<ToolResultUnion<TOOLS>>;

/**
A message that was generated during the generation process.
It can be either an assistant message or a tool message.
 */
type ResponseMessage = (CoreAssistantMessage | CoreToolMessage) & {
    /**
  Message ID generated by the AI SDK.
     */
    id: string;
};
/**
 * The result of a single step in the generation process.
 */
type StepResult<TOOLS extends ToolSet> = {
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
The result of a `generateText` call.
It contains the generated text, the tool calls that were made during the generation, and the results of the tool calls.
 */
interface GenerateTextResult<TOOLS extends ToolSet, OUTPUT> {
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

interface Output<OUTPUT, PARTIAL> {
    readonly type: 'object' | 'text';
    injectIntoSystemPrompt(options: {
        system: string | undefined;
        model: LanguageModel;
    }): string | undefined;
    responseFormat: (options: {
        model: LanguageModel;
    }) => LanguageModelV1CallOptions['responseFormat'];
    parsePartial(options: {
        text: string;
    }): {
        partial: PARTIAL;
    } | undefined;
    parseOutput(options: {
        text: string;
    }, context: {
        response: LanguageModelResponseMetadata;
        usage: LanguageModelUsage;
        finishReason: FinishReason;
    }): OUTPUT;
}
declare const text: () => Output<string, string>;
declare const object: <OUTPUT>({ schema: inputSchema, }: {
    schema: z.Schema<OUTPUT, z.ZodTypeDef, any> | Schema<OUTPUT>;
}) => Output<OUTPUT, DeepPartial<OUTPUT>>;

type output_Output<OUTPUT, PARTIAL> = Output<OUTPUT, PARTIAL>;
declare const output_object: typeof object;
declare const output_text: typeof text;
declare namespace output {
  export {
    output_Output as Output,
    output_object as object,
    output_text as text,
  };
}

declare const symbol$f: unique symbol;
declare class InvalidToolArgumentsError extends AISDKError {
    private readonly [symbol$f];
    readonly toolName: string;
    readonly toolArgs: string;
    constructor({ toolArgs, toolName, cause, message, }: {
        message?: string;
        toolArgs: string;
        toolName: string;
        cause: unknown;
    });
    static isInstance(error: unknown): error is InvalidToolArgumentsError;
}

declare const symbol$e: unique symbol;
declare class NoSuchToolError extends AISDKError {
    private readonly [symbol$e];
    readonly toolName: string;
    readonly availableTools: string[] | undefined;
    constructor({ toolName, availableTools, message, }: {
        toolName: string;
        availableTools?: string[] | undefined;
        message?: string;
    });
    static isInstance(error: unknown): error is NoSuchToolError;
}

/**
 * Appends a client message to the messages array.
 * If the last message in the array has the same id as the new message, it will be replaced.
 * Otherwise, the new message will be appended.
 */
declare function appendClientMessage({ messages, message, }: {
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
declare function appendResponseMessages({ messages, responseMessages, _internal: { currentDate }, }: {
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
Converts an array of messages from useChat into an array of CoreMessages that can be used
with the AI core functions (e.g. `streamText`).
 */
declare function convertToCoreMessages<TOOLS extends ToolSet = never>(messages: Array<Omit<Message, 'id'>>, options?: {
    tools?: TOOLS;
}): CoreMessage[];

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
type ToolCallRepairFunction<TOOLS extends ToolSet> = (options: {
    system: string | undefined;
    messages: CoreMessage[];
    toolCall: LanguageModelV1FunctionToolCall;
    tools: TOOLS;
    parameterSchema: (options: {
        toolName: string;
    }) => JSONSchema7;
    error: NoSuchToolError | InvalidToolArgumentsError;
}) => Promise<LanguageModelV1FunctionToolCall | null>;

/**
Callback that is set using the `onStepFinish` option.

@param stepResult - The result of the step.
 */
type GenerateTextOnStepFinishCallback<TOOLS extends ToolSet> = (stepResult: StepResult<TOOLS>) => Promise<void> | void;
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
declare function generateText<TOOLS extends ToolSet, OUTPUT = never, OUTPUT_PARTIAL = never>({ model, tools, toolChoice, system, prompt, messages, maxRetries: maxRetriesArg, abortSignal, headers, maxSteps, experimental_generateMessageId: generateMessageId, experimental_output: output, experimental_continueSteps: continueSteps, experimental_telemetry: telemetry, experimental_providerMetadata, providerOptions, experimental_activeTools: activeTools, experimental_prepareStep: prepareStep, experimental_repairToolCall: repairToolCall, _internal: { generateId, currentDate, }, onStepFinish, ...settings }: CallSettings & Prompt & {
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
    experimental_output?: Output<OUTPUT, OUTPUT_PARTIAL>;
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
    }) => PromiseLike<{
        model?: LanguageModel;
        toolChoice?: ToolChoice<TOOLS>;
        experimental_activeTools?: Array<keyof TOOLS>;
    } | undefined>;
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
    append(value: JSONValue$1): void;
    appendMessageAnnotation(value: JSONValue$1): void;
}

type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

type DataStreamOptions = {
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
type ConsumeStreamOptions = {
    onError?: (error: unknown) => void;
};
/**
A result object for accessing different stream types and additional information.
 */
interface StreamTextResult<TOOLS extends ToolSet, PARTIAL_OUTPUT> {
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
    readonly response: Promise<LanguageModelResponseMetadata & {
        /**
  The response messages that were generated during the call. It consists of an assistant message,
  potentially containing tool calls.
  
  When there are tool results, there is an additional tool message with the tool results that are available.
  If there are tools that do not have execute functions, they are not included in the tool results and
  need to be added separately.
         */
        messages: Array<ResponseMessage>;
    }>;
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
    toDataStream(options?: {
        data?: StreamData;
        getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions): ReadableStream<Uint8Array>;
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
    pipeDataStreamToResponse(response: ServerResponse, options?: ResponseInit & {
        data?: StreamData;
        getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions): void;
    /**
    Writes text delta output to a Node.js response-like object.
    It sets a `Content-Type` header to `text/plain; charset=utf-8` and
    writes each text delta as a separate chunk.
  
    @param response A Node.js response-like object (ServerResponse).
    @param init Optional headers, status code, and status text.
       */
    pipeTextStreamToResponse(response: ServerResponse, init?: ResponseInit): void;
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
    toDataStreamResponse(options?: ResponseInit & {
        data?: StreamData;
        getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions): Response;
    /**
    Creates a simple text stream response.
    Each text delta is encoded as UTF-8 and sent as a separate chunk.
    Non-text-delta events are ignored.
  
    @param init Optional headers, status code, and status text.
       */
    toTextStreamResponse(init?: ResponseInit): Response;
}
type TextStreamPart<TOOLS extends ToolSet> = {
    type: 'text-delta';
    textDelta: string;
} | {
    type: 'reasoning';
    textDelta: string;
} | {
    type: 'reasoning-signature';
    signature: string;
} | {
    type: 'redacted-reasoning';
    data: string;
} | {
    type: 'source';
    source: Source;
} | ({
    type: 'file';
} & GeneratedFile) | ({
    type: 'tool-call';
} & ToolCallUnion<TOOLS>) | {
    type: 'tool-call-streaming-start';
    toolCallId: string;
    toolName: string;
} | {
    type: 'tool-call-delta';
    toolCallId: string;
    toolName: string;
    argsTextDelta: string;
} | ({
    type: 'tool-result';
} & ToolResultUnion<TOOLS>) | {
    type: 'step-start';
    messageId: string;
    request: LanguageModelRequestMetadata;
    warnings: CallWarning[];
} | {
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
} | {
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
} | {
    type: 'error';
    error: unknown;
};

/**
 * Detects the first chunk in a buffer.
 *
 * @param buffer - The buffer to detect the first chunk in.
 *
 * @returns The first detected chunk, or `undefined` if no chunk was detected.
 */
type ChunkDetector = (buffer: string) => string | undefined | null;
/**
 * Smooths text streaming output.
 *
 * @param delayInMs - The delay in milliseconds between each chunk. Defaults to 10ms. Can be set to `null` to skip the delay.
 * @param chunking - Controls how the text is chunked for streaming. Use "word" to stream word by word (default), "line" to stream line by line, or provide a custom RegExp pattern for custom chunking.
 *
 * @returns A transform stream that smooths text streaming output.
 */
declare function smoothStream<TOOLS extends ToolSet>({ delayInMs, chunking, _internal: { delay }, }?: {
    delayInMs?: number | null;
    chunking?: 'word' | 'line' | RegExp | ChunkDetector;
    /**
     * Internal. For test use only. May change without notice.
     */
    _internal?: {
        delay?: (delayInMs: number | null) => Promise<void>;
    };
}): (options: {
    tools: TOOLS;
}) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>;

/**
A transformation that is applied to the stream.

@param stopStream - A function that stops the source stream.
@param tools - The tools that are accessible to and can be called by the model. The model needs to support calling tools.
 */
type StreamTextTransform<TOOLS extends ToolSet> = (options: {
    tools: TOOLS;
    stopStream: () => void;
}) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>;
/**
Callback that is set using the `onError` option.

@param event - The event that is passed to the callback.
 */
type StreamTextOnErrorCallback = (event: {
    error: unknown;
}) => Promise<void> | void;
/**
Callback that is set using the `onStepFinish` option.

@param stepResult - The result of the step.
 */
type StreamTextOnStepFinishCallback<TOOLS extends ToolSet> = (stepResult: StepResult<TOOLS>) => Promise<void> | void;
/**
Callback that is set using the `onChunk` option.

@param event - The event that is passed to the callback.
 */
type StreamTextOnChunkCallback<TOOLS extends ToolSet> = (event: {
    chunk: Extract<TextStreamPart<TOOLS>, {
        type: 'text-delta' | 'reasoning' | 'source' | 'tool-call' | 'tool-call-streaming-start' | 'tool-call-delta' | 'tool-result';
    }>;
}) => Promise<void> | void;
/**
Callback that is set using the `onFinish` option.

@param event - The event that is passed to the callback.
 */
type StreamTextOnFinishCallback<TOOLS extends ToolSet> = (event: Omit<StepResult<TOOLS>, 'stepType' | 'isContinued'> & {
    /**
Details for all steps.
   */
    readonly steps: StepResult<TOOLS>[];
}) => Promise<void> | void;
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
declare function streamText<TOOLS extends ToolSet, OUTPUT = never, PARTIAL_OUTPUT = never>({ model, tools, toolChoice, system, prompt, messages, maxRetries, abortSignal, headers, maxSteps, experimental_generateMessageId: generateMessageId, experimental_output: output, experimental_continueSteps: continueSteps, experimental_telemetry: telemetry, experimental_providerMetadata, providerOptions, experimental_toolCallStreaming, toolCallStreaming, experimental_activeTools: activeTools, experimental_repairToolCall: repairToolCall, experimental_transform: transform, onChunk, onError, onFinish, onStepFinish, _internal: { now, generateId, currentDate, }, ...settings }: CallSettings & Prompt & {
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
    experimental_output?: Output<OUTPUT, PARTIAL_OUTPUT>;
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
The result of a `generateImage` call.
It contains the images and additional information.
 */
interface GenerateImageResult {
    /**
  The first image that was generated.
     */
    readonly image: GeneratedFile;
    /**
  The images that were generated.
       */
    readonly images: Array<GeneratedFile>;
    /**
  Warnings for the call, e.g. unsupported settings.
       */
    readonly warnings: Array<ImageGenerationWarning>;
    /**
  Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.
     */
    readonly responses: Array<ImageModelResponseMetadata>;
}

/**
Generates images using an image model.

@param model - The image model to use.
@param prompt - The prompt that should be used to generate the image.
@param n - Number of images to generate. Default: 1.
@param size - Size of the images to generate. Must have the format `{width}x{height}`.
@param aspectRatio - Aspect ratio of the images to generate. Must have the format `{width}:{height}`.
@param seed - Seed for the image generation.
@param providerOptions - Additional provider-specific options that are passed through to the provider
as body parameters.
@param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
@param abortSignal - An optional abort signal that can be used to cancel the call.
@param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

@returns A result object that contains the generated images.
 */
declare function generateImage({ model, prompt, n, size, aspectRatio, seed, providerOptions, maxRetries: maxRetriesArg, abortSignal, headers, }: {
    /**
  The image model to use.
       */
    model: ImageModelV1;
    /**
  The prompt that should be used to generate the image.
     */
    prompt: string;
    /**
  Number of images to generate.
     */
    n?: number;
    /**
  Size of the images to generate. Must have the format `{width}x{height}`. If not provided, the default size will be used.
     */
    size?: `${number}x${number}`;
    /**
  Aspect ratio of the images to generate. Must have the format `{width}:{height}`. If not provided, the default aspect ratio will be used.
     */
    aspectRatio?: `${number}:${number}`;
    /**
  Seed for the image generation. If not provided, the default seed will be used.
     */
    seed?: number;
    /**
  Additional provider-specific options that are passed through to the provider
  as body parameters.
  
  The outer record is keyed by the provider name, and the inner
  record is keyed by the provider-specific metadata key.
  ```ts
  {
    "openai": {
      "style": "vivid"
    }
  }
  ```
       */
    providerOptions?: Record<string, Record<string, JSONValue>>;
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
}): Promise<GenerateImageResult>;

/**
The result of a `generateObject` call.
 */
interface GenerateObjectResult<OBJECT> {
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
A function that attempts to repair the raw output of the mode
to enable JSON parsing.

Should return the repaired text or null if the text cannot be repaired.
     */
type RepairTextFunction = (options: {
    text: string;
    error: JSONParseError | TypeValidationError;
}) => Promise<string | null>;
/**
Generate a structured, typed object for a given prompt and schema using a language model.

This function does not stream the output. If you want to stream the output, use `streamObject` instead.

@returns
A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
declare function generateObject<OBJECT>(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): Promise<GenerateObjectResult<OBJECT>>;
/**
Generate an array with structured, typed elements for a given prompt and element schema using a language model.

This function does not stream the output. If you want to stream the output, use `streamObject` instead.

@return
A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
declare function generateObject<ELEMENT>(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): Promise<GenerateObjectResult<Array<ELEMENT>>>;
/**
Generate a value from an enum (limited list of string values) using a language model.

This function does not stream the output.

@return
A result object that contains the generated value, the finish reason, the token usage, and additional information.
 */
declare function generateObject<ENUM extends string>(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): Promise<GenerateObjectResult<ENUM>>;
/**
Generate JSON with any schema for a given prompt using a language model.

This function does not stream the output. If you want to stream the output, use `streamObject` instead.

@returns
A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
declare function generateObject(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): Promise<GenerateObjectResult<JSONValue>>;

/**
The result of a `streamObject` call that contains the partial object stream and additional information.
 */
interface StreamObjectResult<PARTIAL, RESULT, ELEMENT_STREAM> {
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
    pipeTextStreamToResponse(response: ServerResponse$1, init?: ResponseInit): void;
    /**
    Creates a simple text stream response.
    The response has a `Content-Type` header set to `text/plain; charset=utf-8`.
    Each text delta is encoded as UTF-8 and sent as a separate chunk.
    Non-text-delta events are ignored.
  
    @param init Optional headers, status code, and status text.
       */
    toTextStreamResponse(init?: ResponseInit): Response;
}
type ObjectStreamPart<PARTIAL> = {
    type: 'object';
    object: PARTIAL;
} | {
    type: 'text-delta';
    textDelta: string;
} | {
    type: 'error';
    error: unknown;
} | {
    type: 'finish';
    finishReason: FinishReason;
    logprobs?: LogProbs;
    usage: LanguageModelUsage;
    response: LanguageModelResponseMetadata;
    providerMetadata?: ProviderMetadata;
};

/**
Callback that is set using the `onError` option.

@param event - The event that is passed to the callback.
 */
type StreamObjectOnErrorCallback = (event: {
    error: unknown;
}) => Promise<void> | void;
/**
Callback that is set using the `onFinish` option.

@param event - The event that is passed to the callback.
 */
type StreamObjectOnFinishCallback<RESULT> = (event: {
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
Generate a structured, typed object for a given prompt and schema using a language model.

This function streams the output. If you do not want to stream the output, use `generateObject` instead.

@return
A result object for accessing the partial object stream and additional information.
 */
declare function streamObject<OBJECT>(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): StreamObjectResult<DeepPartial<OBJECT>, OBJECT, never>;
/**
Generate an array with structured, typed elements for a given prompt and element schema using a language model.

This function streams the output. If you do not want to stream the output, use `generateObject` instead.

@return
A result object for accessing the partial object stream and additional information.
 */
declare function streamObject<ELEMENT>(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): StreamObjectResult<Array<ELEMENT>, Array<ELEMENT>, AsyncIterableStream<ELEMENT>>;
/**
Generate JSON with any schema for a given prompt using a language model.

This function streams the output. If you do not want to stream the output, use `generateObject` instead.

@return
A result object for accessing the partial object stream and additional information.
 */
declare function streamObject(options: Omit<CallSettings, 'stopSequences'> & Prompt & {
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
}): StreamObjectResult<JSONValue, JSONValue, never>;

/**
 * A generated audio file.
 */
interface GeneratedAudioFile extends GeneratedFile {
    /**
     * Audio format of the file (e.g., 'mp3', 'wav', etc.)
     */
    readonly format: string;
}

/**
The result of a `generateSpeech` call.
It contains the audio data and additional information.
 */
interface SpeechResult {
    /**
     * The audio data as a base64 encoded string or binary data.
     */
    readonly audio: GeneratedAudioFile;
    /**
    Warnings for the call, e.g. unsupported settings.
       */
    readonly warnings: Array<SpeechWarning>;
    /**
    Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.
     */
    readonly responses: Array<SpeechModelResponseMetadata>;
    /**
    Provider metadata from the provider.
     */
    readonly providerMetadata: Record<string, Record<string, JSONValue>>;
}

/**
Generates speech audio using a speech model.

@param model - The speech model to use.
@param text - The text to convert to speech.
@param voice - The voice to use for speech generation.
@param outputFormat - The output format to use for speech generation e.g. "mp3", "wav", etc.
@param instructions - Instructions for the speech generation e.g. "Speak in a slow and steady tone".
@param speed - The speed of the speech generation.
@param providerOptions - Additional provider-specific options that are passed through to the provider
as body parameters.
@param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
@param abortSignal - An optional abort signal that can be used to cancel the call.
@param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

@returns A result object that contains the generated audio data.
 */
declare function generateSpeech({ model, text, voice, outputFormat, instructions, speed, providerOptions, maxRetries: maxRetriesArg, abortSignal, headers, }: {
    /**
  The speech model to use.
       */
    model: SpeechModelV1;
    /**
  The text to convert to speech.
     */
    text: string;
    /**
  The voice to use for speech generation.
     */
    voice?: string;
    /**
     * The desired output format for the audio e.g. "mp3", "wav", etc.
     */
    outputFormat?: 'mp3' | 'wav' | (string & {});
    /**
      Instructions for the speech generation e.g. "Speak in a slow and steady tone".
    */
    instructions?: string;
    /**
    The speed of the speech generation.
     */
    speed?: number;
    /**
  Additional provider-specific options that are passed through to the provider
  as body parameters.
  
  The outer record is keyed by the provider name, and the inner
  record is keyed by the provider-specific metadata key.
  ```ts
  {
    "openai": {}
  }
  ```
       */
    providerOptions?: ProviderOptions;
    /**
  Maximum number of retries per speech model call. Set to 0 to disable retries.
  
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
}): Promise<SpeechResult>;

/**
The result of a `transcribe` call.
It contains the transcript and additional information.
 */
interface TranscriptionResult {
    /**
     * The complete transcribed text from the audio.
     */
    readonly text: string;
    /**
     * Array of transcript segments with timing information.
     * Each segment represents a portion of the transcribed text with start and end times.
     */
    readonly segments: Array<{
        /**
         * The text content of this segment.
         */
        readonly text: string;
        /**
         * The start time of this segment in seconds.
         */
        readonly startSecond: number;
        /**
         * The end time of this segment in seconds.
         */
        readonly endSecond: number;
    }>;
    /**
     * The detected language of the audio content, as an ISO-639-1 code (e.g., 'en' for English).
     * May be undefined if the language couldn't be detected.
     */
    readonly language: string | undefined;
    /**
     * The total duration of the audio file in seconds.
     * May be undefined if the duration couldn't be determined.
     */
    readonly durationInSeconds: number | undefined;
    /**
    Warnings for the call, e.g. unsupported settings.
       */
    readonly warnings: Array<TranscriptionWarning>;
    /**
    Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.
     */
    readonly responses: Array<TranscriptionModelResponseMetadata>;
    /**
    Provider metadata from the provider.
     */
    readonly providerMetadata: Record<string, Record<string, JSONValue>>;
}

/**
Generates transcripts using a transcription model.

@param model - The transcription model to use.
@param audio - The audio data to transcribe as DataContent (string | Uint8Array | ArrayBuffer | Buffer) or a URL.
@param providerOptions - Additional provider-specific options that are passed through to the provider
as body parameters.
@param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
@param abortSignal - An optional abort signal that can be used to cancel the call.
@param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.

@returns A result object that contains the generated transcript.
 */
declare function transcribe({ model, audio, providerOptions, maxRetries: maxRetriesArg, abortSignal, headers, }: {
    /**
  The transcription model to use.
       */
    model: TranscriptionModelV1;
    /**
  The audio data to transcribe.
     */
    audio: DataContent | URL;
    /**
  Additional provider-specific options that are passed through to the provider
  as body parameters.
  
  The outer record is keyed by the provider name, and the inner
  record is keyed by the provider-specific metadata key.
  ```ts
  {
    "openai": {
      "temperature": 0
    }
  }
  ```
       */
    providerOptions?: ProviderOptions;
    /**
  Maximum number of retries per transcript model call. Set to 0 to disable retries.
  
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
}): Promise<TranscriptionResult>;

/**
 * Experimental middleware for LanguageModelV1.
 * This type defines the structure for middleware that can be used to modify
 * the behavior of LanguageModelV1 operations.
 */
type LanguageModelV1Middleware = {
    /**
     * Middleware specification version. Use `v1` for the current version.
     */
    middlewareVersion?: 'v1' | undefined;
    /**
     * Transforms the parameters before they are passed to the language model.
     * @param options - Object containing the type of operation and the parameters.
     * @param options.type - The type of operation ('generate' or 'stream').
     * @param options.params - The original parameters for the language model call.
     * @returns A promise that resolves to the transformed parameters.
     */
    transformParams?: (options: {
        type: 'generate' | 'stream';
        params: LanguageModelV1CallOptions;
    }) => PromiseLike<LanguageModelV1CallOptions>;
    /**
     * Wraps the generate operation of the language model.
     * @param options - Object containing the generate function, parameters, and model.
     * @param options.doGenerate - The original generate function.
     * @param options.doStream - The original stream function.
     * @param options.params - The parameters for the generate call. If the
     * `transformParams` middleware is used, this will be the transformed parameters.
     * @param options.model - The language model instance.
     * @returns A promise that resolves to the result of the generate operation.
     */
    wrapGenerate?: (options: {
        doGenerate: () => ReturnType<LanguageModelV1['doGenerate']>;
        doStream: () => ReturnType<LanguageModelV1['doStream']>;
        params: LanguageModelV1CallOptions;
        model: LanguageModelV1;
    }) => Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>>;
    /**
     * Wraps the stream operation of the language model.
     *
     * @param options - Object containing the stream function, parameters, and model.
     * @param options.doGenerate - The original generate function.
     * @param options.doStream - The original stream function.
     * @param options.params - The parameters for the stream call. If the
     * `transformParams` middleware is used, this will be the transformed parameters.
     * @param options.model - The language model instance.
     * @returns A promise that resolves to the result of the stream operation.
     */
    wrapStream?: (options: {
        doGenerate: () => ReturnType<LanguageModelV1['doGenerate']>;
        doStream: () => ReturnType<LanguageModelV1['doStream']>;
        params: LanguageModelV1CallOptions;
        model: LanguageModelV1;
    }) => PromiseLike<Awaited<ReturnType<LanguageModelV1['doStream']>>>;
};
/**
 * @deprecated Use `LanguageModelV1Middleware` instead.
 */
type Experimental_LanguageModelV1Middleware = LanguageModelV1Middleware;

/**
 * Applies default settings for a language model.
 */
declare function defaultSettingsMiddleware({ settings, }: {
    settings: Partial<LanguageModelV1CallOptions & {
        providerMetadata?: LanguageModelV1ProviderMetadata;
    }>;
}): LanguageModelV1Middleware;

/**
 * Extract an XML-tagged reasoning section from the generated text and exposes it
 * as a `reasoning` property on the result.
 *
 * @param tagName - The name of the XML tag to extract reasoning from.
 * @param separator - The separator to use between reasoning and text sections.
 * @param startWithReasoning - Whether to start with reasoning tokens.
 */
declare function extractReasoningMiddleware({ tagName, separator, startWithReasoning, }: {
    tagName: string;
    separator?: string;
    startWithReasoning?: boolean;
}): LanguageModelV1Middleware;

/**
 * Simulates streaming chunks with the response from a generate call.
 */
declare function simulateStreamingMiddleware(): LanguageModelV1Middleware;

/**
 * Wraps a LanguageModelV1 instance with middleware functionality.
 * This function allows you to apply middleware to transform parameters,
 * wrap generate operations, and wrap stream operations of a language model.
 *
 * @param options - Configuration options for wrapping the language model.
 * @param options.model - The original LanguageModelV1 instance to be wrapped.
 * @param options.middleware - The middleware to be applied to the language model. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.
 * @param options.modelId - Optional custom model ID to override the original model's ID.
 * @param options.providerId - Optional custom provider ID to override the original model's provider.
 * @returns A new LanguageModelV1 instance with middleware applied.
 */
declare const wrapLanguageModel: ({ model, middleware: middlewareArg, modelId, providerId, }: {
    model: LanguageModelV1;
    middleware: LanguageModelV1Middleware | LanguageModelV1Middleware[];
    modelId?: string;
    providerId?: string;
}) => LanguageModelV1;
/**
 * @deprecated Use `wrapLanguageModel` instead.
 */
declare const experimental_wrapLanguageModel: ({ model, middleware: middlewareArg, modelId, providerId, }: {
    model: LanguageModelV1;
    middleware: LanguageModelV1Middleware | LanguageModelV1Middleware[];
    modelId?: string;
    providerId?: string;
}) => LanguageModelV1;

/**
 * Creates a custom provider with specified language models, text embedding models, and an optional fallback provider.
 *
 * @param {Object} options - The options for creating the custom provider.
 * @param {Record<string, LanguageModel>} [options.languageModels] - A record of language models, where keys are model IDs and values are LanguageModel instances.
 * @param {Record<string, EmbeddingModel<string>>} [options.textEmbeddingModels] - A record of text embedding models, where keys are model IDs and values are EmbeddingModel<string> instances.
 * @param {Record<string, ImageModel>} [options.imageModels] - A record of image models, where keys are model IDs and values are ImageModel instances.
 * @param {Provider} [options.fallbackProvider] - An optional fallback provider to use when a requested model is not found in the custom provider.
 * @returns {Provider} A Provider object with languageModel, textEmbeddingModel, and imageModel methods.
 *
 * @throws {NoSuchModelError} Throws when a requested model is not found and no fallback provider is available.
 */
declare function customProvider<LANGUAGE_MODELS extends Record<string, LanguageModel>, EMBEDDING_MODELS extends Record<string, EmbeddingModel<string>>, IMAGE_MODELS extends Record<string, ImageModel>>({ languageModels, textEmbeddingModels, imageModels, fallbackProvider, }: {
    languageModels?: LANGUAGE_MODELS;
    textEmbeddingModels?: EMBEDDING_MODELS;
    imageModels?: IMAGE_MODELS;
    fallbackProvider?: ProviderV1;
}): Provider & {
    languageModel(modelId: ExtractModelId<LANGUAGE_MODELS>): LanguageModel;
    textEmbeddingModel(modelId: ExtractModelId<EMBEDDING_MODELS>): EmbeddingModel<string>;
    imageModel(modelId: ExtractModelId<IMAGE_MODELS>): ImageModel;
};
/**
 * @deprecated Use `customProvider` instead.
 */
declare const experimental_customProvider: typeof customProvider;
type ExtractModelId<MODELS extends Record<string, unknown>> = Extract<keyof MODELS, string>;

declare const symbol$d: unique symbol;
declare class NoSuchProviderError extends NoSuchModelError {
    private readonly [symbol$d];
    readonly providerId: string;
    readonly availableProviders: string[];
    constructor({ modelId, modelType, providerId, availableProviders, message, }: {
        modelId: string;
        modelType: 'languageModel' | 'textEmbeddingModel';
        providerId: string;
        availableProviders: string[];
        message?: string;
    });
    static isInstance(error: unknown): error is NoSuchProviderError;
}

type ExtractLiteralUnion<T> = T extends string ? string extends T ? never : T : never;
interface ProviderRegistryProvider<PROVIDERS extends Record<string, ProviderV1> = Record<string, ProviderV1>, SEPARATOR extends string = ':'> {
    languageModel<KEY extends keyof PROVIDERS>(id: KEY extends string ? `${KEY & string}${SEPARATOR}${ExtractLiteralUnion<Parameters<NonNullable<PROVIDERS[KEY]['languageModel']>>[0]>}` : never): LanguageModel;
    languageModel<KEY extends keyof PROVIDERS>(id: KEY extends string ? `${KEY & string}${SEPARATOR}${string}` : never): LanguageModel;
    textEmbeddingModel<KEY extends keyof PROVIDERS>(id: KEY extends string ? `${KEY & string}${SEPARATOR}${ExtractLiteralUnion<Parameters<NonNullable<PROVIDERS[KEY]['textEmbeddingModel']>>[0]>}` : never): EmbeddingModel<string>;
    textEmbeddingModel<KEY extends keyof PROVIDERS>(id: KEY extends string ? `${KEY & string}${SEPARATOR}${string}` : never): EmbeddingModel<string>;
    imageModel<KEY extends keyof PROVIDERS>(id: KEY extends string ? `${KEY & string}${SEPARATOR}${ExtractLiteralUnion<Parameters<NonNullable<PROVIDERS[KEY]['imageModel']>>[0]>}` : never): ImageModel;
    imageModel<KEY extends keyof PROVIDERS>(id: KEY extends string ? `${KEY & string}${SEPARATOR}${string}` : never): ImageModel;
}
/**
 * Creates a registry for the given providers.
 */
declare function createProviderRegistry<PROVIDERS extends Record<string, ProviderV1>, SEPARATOR extends string = ':'>(providers: PROVIDERS, { separator, }?: {
    separator?: SEPARATOR;
}): ProviderRegistryProvider<PROVIDERS, SEPARATOR>;
/**
 * @deprecated Use `createProviderRegistry` instead.
 */
declare const experimental_createProviderRegistry: typeof createProviderRegistry;

/**
 * Calculates the cosine similarity between two vectors. This is a useful metric for
 * comparing the similarity of two vectors such as embeddings.
 *
 * @param vector1 - The first vector.
 * @param vector2 - The second vector.
 * @param options - Optional configuration.
 * @param options.throwErrorForEmptyVectors - If true, throws an error for empty vectors. Default: false.
 *
 * @returns The cosine similarity between vector1 and vector2.
 * @returns 0 if either vector is the zero vector.
 *
 * @throws {InvalidArgumentError} If throwErrorForEmptyVectors is true and vectors are empty.
 * @throws {InvalidArgumentError} If the vectors do not have the same length.
 */
declare function cosineSimilarity(vector1: number[], vector2: number[], options?: {
    /**
     * @deprecated will be removed in 5.0
     */
    throwErrorForEmptyVectors?: boolean;
}): number;

/**
 * Creates a ReadableStream that emits the provided values with an optional delay between each value.
 *
 * @param options - The configuration options
 * @param options.chunks - Array of values to be emitted by the stream
 * @param options.initialDelayInMs - Optional initial delay in milliseconds before emitting the first value (default: 0). Can be set to `null` to skip the initial delay. The difference between `initialDelayInMs: null` and `initialDelayInMs: 0` is that `initialDelayInMs: null` will emit the values without any delay, while `initialDelayInMs: 0` will emit the values with a delay of 0 milliseconds.
 * @param options.chunkDelayInMs - Optional delay in milliseconds between emitting each value (default: 0). Can be set to `null` to skip the delay. The difference between `chunkDelayInMs: null` and `chunkDelayInMs: 0` is that `chunkDelayInMs: null` will emit the values without any delay, while `chunkDelayInMs: 0` will emit the values with a delay of 0 milliseconds.
 * @returns A ReadableStream that emits the provided values
 */
declare function simulateReadableStream<T>({ chunks, initialDelayInMs, chunkDelayInMs, _internal, }: {
    chunks: T[];
    initialDelayInMs?: number | null;
    chunkDelayInMs?: number | null;
    _internal?: {
        delay?: (ms: number | null) => Promise<void>;
    };
}): ReadableStream<T>;

declare const symbol$c: unique symbol;
declare class InvalidArgumentError extends AISDKError {
    private readonly [symbol$c];
    readonly parameter: string;
    readonly value: unknown;
    constructor({ parameter, value, message, }: {
        parameter: string;
        value: unknown;
        message: string;
    });
    static isInstance(error: unknown): error is InvalidArgumentError;
}

type SingleRequestTextStreamPart<TOOLS extends ToolSet> = {
    type: 'text-delta';
    textDelta: string;
} | {
    type: 'reasoning';
    textDelta: string;
} | {
    type: 'reasoning-signature';
    signature: string;
} | {
    type: 'redacted-reasoning';
    data: string;
} | ({
    type: 'file';
} & GeneratedFile) | {
    type: 'source';
    source: Source;
} | ({
    type: 'tool-call';
} & ToolCallUnion<TOOLS>) | {
    type: 'tool-call-streaming-start';
    toolCallId: string;
    toolName: string;
} | {
    type: 'tool-call-delta';
    toolCallId: string;
    toolName: string;
    argsTextDelta: string;
} | ({
    type: 'tool-result';
} & ToolResultUnion<TOOLS>) | {
    type: 'response-metadata';
    id?: string;
    timestamp?: Date;
    modelId?: string;
} | {
    type: 'finish';
    finishReason: FinishReason;
    logprobs?: LogProbs;
    usage: LanguageModelUsage;
    experimental_providerMetadata?: ProviderMetadata;
} | {
    type: 'error';
    error: unknown;
};

declare const symbol$b: unique symbol;
declare class InvalidStreamPartError extends AISDKError {
    private readonly [symbol$b];
    readonly chunk: SingleRequestTextStreamPart<any>;
    constructor({ chunk, message, }: {
        chunk: SingleRequestTextStreamPart<any>;
        message: string;
    });
    static isInstance(error: unknown): error is InvalidStreamPartError;
}

declare const symbol$a: unique symbol;
/**
Thrown when no image could be generated. This can have multiple causes:

- The model failed to generate a response.
- The model generated a response that could not be parsed.
 */
declare class NoImageGeneratedError extends AISDKError {
    private readonly [symbol$a];
    /**
  The response metadata for each call.
     */
    readonly responses: Array<ImageModelResponseMetadata> | undefined;
    constructor({ message, cause, responses, }: {
        message?: string;
        cause?: Error;
        responses?: Array<ImageModelResponseMetadata>;
    });
    static isInstance(error: unknown): error is NoImageGeneratedError;
}

declare const symbol$9: unique symbol;
/**
Thrown when no object could be generated. This can have several causes:

- The model failed to generate a response.
- The model generated a response that could not be parsed.
- The model generated a response that could not be validated against the schema.

The error contains the following properties:

- `text`: The text that was generated by the model. This can be the raw text or the tool call text, depending on the model.
 */
declare class NoObjectGeneratedError extends AISDKError {
    private readonly [symbol$9];
    /**
    The text that was generated by the model. This can be the raw text or the tool call text, depending on the model.
     */
    readonly text: string | undefined;
    /**
    The response metadata.
     */
    readonly response: LanguageModelResponseMetadata | undefined;
    /**
    The usage of the model.
     */
    readonly usage: LanguageModelUsage | undefined;
    /**
    Reason why the model finished generating a response.
     */
    readonly finishReason: FinishReason | undefined;
    constructor({ message, cause, text, response, usage, finishReason, }: {
        message?: string;
        cause?: Error;
        text?: string;
        response: LanguageModelResponseMetadata;
        usage: LanguageModelUsage;
        finishReason: FinishReason;
    });
    static isInstance(error: unknown): error is NoObjectGeneratedError;
}

declare const symbol$8: unique symbol;
/**
Thrown when no output type is specified and output-related methods are called.
 */
declare class NoOutputSpecifiedError extends AISDKError {
    private readonly [symbol$8];
    constructor({ message }?: {
        message?: string;
    });
    static isInstance(error: unknown): error is NoOutputSpecifiedError;
}

declare const symbol$7: unique symbol;
declare class ToolCallRepairError extends AISDKError {
    private readonly [symbol$7];
    readonly originalError: NoSuchToolError | InvalidToolArgumentsError;
    constructor({ cause, originalError, message, }: {
        message?: string;
        cause: unknown;
        originalError: NoSuchToolError | InvalidToolArgumentsError;
    });
    static isInstance(error: unknown): error is ToolCallRepairError;
}

declare const symbol$6: unique symbol;
declare class ToolExecutionError extends AISDKError {
    private readonly [symbol$6];
    readonly toolName: string;
    readonly toolArgs: JSONValue;
    readonly toolCallId: string;
    constructor({ toolArgs, toolName, toolCallId, cause, message, }: {
        message?: string;
        toolArgs: JSONValue;
        toolName: string;
        toolCallId: string;
        cause: unknown;
    });
    static isInstance(error: unknown): error is ToolExecutionError;
}

declare const symbol$5: unique symbol;
/**
 * An error occurred with the MCP client.
 */
declare class MCPClientError extends AISDKError {
    private readonly [symbol$5];
    constructor({ name, message, cause, }: {
        name?: string;
        message: string;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is MCPClientError;
}

/**
Error that is thrown when a model with an unsupported version is used.
 */
declare class UnsupportedModelVersionError extends AISDKError {
    constructor();
}

declare const symbol$4: unique symbol;
declare class InvalidDataContentError extends AISDKError {
    private readonly [symbol$4];
    readonly content: unknown;
    constructor({ content, cause, message, }: {
        content: unknown;
        cause?: unknown;
        message?: string;
    });
    static isInstance(error: unknown): error is InvalidDataContentError;
}

declare const symbol$3: unique symbol;
declare class InvalidMessageRoleError extends AISDKError {
    private readonly [symbol$3];
    readonly role: string;
    constructor({ role, message, }: {
        role: string;
        message?: string;
    });
    static isInstance(error: unknown): error is InvalidMessageRoleError;
}

declare const symbol$2: unique symbol;
declare class MessageConversionError extends AISDKError {
    private readonly [symbol$2];
    readonly originalMessage: Omit<Message, 'id'>;
    constructor({ originalMessage, message, }: {
        originalMessage: Omit<Message, 'id'>;
        message: string;
    });
    static isInstance(error: unknown): error is MessageConversionError;
}

declare const symbol$1: unique symbol;
declare class DownloadError extends AISDKError {
    private readonly [symbol$1];
    readonly url: string;
    readonly statusCode?: number;
    readonly statusText?: string;
    constructor({ url, statusCode, statusText, cause, message, }: {
        url: string;
        statusCode?: number;
        statusText?: string;
        message?: string;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is DownloadError;
}

declare const symbol: unique symbol;
type RetryErrorReason = 'maxRetriesExceeded' | 'errorNotRetryable' | 'abort';
declare class RetryError extends AISDKError {
    private readonly [symbol];
    readonly reason: RetryErrorReason;
    readonly lastError: unknown;
    readonly errors: Array<unknown>;
    constructor({ message, reason, errors, }: {
        message: string;
        reason: RetryErrorReason;
        errors: Array<unknown>;
    });
    static isInstance(error: unknown): error is RetryError;
}

/**
You can pass the thread and the latest message into the `AssistantResponse`. This establishes the context for the response.
 */
type AssistantResponseSettings = {
    /**
  The thread ID that the response is associated with.
     */
    threadId: string;
    /**
  The ID of the latest message that the response is associated with.
   */
    messageId: string;
};
/**
The process parameter is a callback in which you can run the assistant on threads, and send messages and data messages to the client.
 */
type AssistantResponseCallback = (options: {
    /**
  Forwards an assistant message (non-streaming) to the client.
     */
    sendMessage: (message: AssistantMessage) => void;
    /**
  Send a data message to the client. You can use this to provide information for rendering custom UIs while the assistant is processing the thread.
   */
    sendDataMessage: (message: DataMessage) => void;
    /**
  Forwards the assistant response stream to the client. Returns the `Run` object after it completes, or when it requires an action.
     */
    forwardStream: (stream: any) => Promise<any | undefined>;
}) => Promise<void>;
/**
The `AssistantResponse` allows you to send a stream of assistant update to `useAssistant`.
It is designed to facilitate streaming assistant responses to the `useAssistant` hook.
It receives an assistant thread and a current message, and can send messages and data messages to the client.
 */
declare function AssistantResponse({ threadId, messageId }: AssistantResponseSettings, process: AssistantResponseCallback): Response;

/**
 * Configuration options and helper callback methods for stream lifecycle events.
 */
interface StreamCallbacks {
    /** `onStart`: Called once when the stream is initialized. */
    onStart?: () => Promise<void> | void;
    /**
     * `onCompletion`: Called for each tokenized message.
     *
     * @deprecated Use `onFinal` instead.
     */
    onCompletion?: (completion: string) => Promise<void> | void;
    /** `onFinal`: Called once when the stream is closed with the final completion message. */
    onFinal?: (completion: string) => Promise<void> | void;
    /** `onToken`: Called for each tokenized message. */
    onToken?: (token: string) => Promise<void> | void;
    /** `onText`: Called for each text chunk. */
    onText?: (text: string) => Promise<void> | void;
}

type LangChainImageDetail = 'auto' | 'low' | 'high';
type LangChainMessageContentText = {
    type: 'text';
    text: string;
};
type LangChainMessageContentImageUrl = {
    type: 'image_url';
    image_url: string | {
        url: string;
        detail?: LangChainImageDetail;
    };
};
type LangChainMessageContentComplex = LangChainMessageContentText | LangChainMessageContentImageUrl | (Record<string, any> & {
    type?: 'text' | 'image_url' | string;
}) | (Record<string, any> & {
    type?: never;
});
type LangChainMessageContent = string | LangChainMessageContentComplex[];
type LangChainAIMessageChunk = {
    content: LangChainMessageContent;
};
type LangChainStreamEvent = {
    event: string;
    data: any;
};
/**
Converts LangChain output streams to an AI SDK Data Stream.

The following streams are supported:
- `LangChainAIMessageChunk` streams (LangChain `model.stream` output)
- `string` streams (LangChain `StringOutputParser` output)
 */
declare function toDataStream$1(stream: ReadableStream<LangChainStreamEvent> | ReadableStream<LangChainAIMessageChunk> | ReadableStream<string>, callbacks?: StreamCallbacks): ReadableStream<Uint8Array>;
declare function toDataStreamResponse$1(stream: ReadableStream<LangChainStreamEvent> | ReadableStream<LangChainAIMessageChunk> | ReadableStream<string>, options?: {
    init?: ResponseInit;
    data?: StreamData;
    callbacks?: StreamCallbacks;
}): Response;
declare function mergeIntoDataStream$1(stream: ReadableStream<LangChainStreamEvent> | ReadableStream<LangChainAIMessageChunk> | ReadableStream<string>, options: {
    dataStream: DataStreamWriter;
    callbacks?: StreamCallbacks;
}): void;

declare namespace langchainAdapter {
  export {
    mergeIntoDataStream$1 as mergeIntoDataStream,
    toDataStream$1 as toDataStream,
    toDataStreamResponse$1 as toDataStreamResponse,
  };
}

type EngineResponse = {
    delta: string;
};
declare function toDataStream(stream: AsyncIterable<EngineResponse>, callbacks?: StreamCallbacks): ReadableStream<Uint8Array>;
declare function toDataStreamResponse(stream: AsyncIterable<EngineResponse>, options?: {
    init?: ResponseInit;
    data?: StreamData;
    callbacks?: StreamCallbacks;
}): Response;
declare function mergeIntoDataStream(stream: AsyncIterable<EngineResponse>, options: {
    dataStream: DataStreamWriter;
    callbacks?: StreamCallbacks;
}): void;

declare const llamaindexAdapter_mergeIntoDataStream: typeof mergeIntoDataStream;
declare const llamaindexAdapter_toDataStream: typeof toDataStream;
declare const llamaindexAdapter_toDataStreamResponse: typeof toDataStreamResponse;
declare namespace llamaindexAdapter {
  export {
    llamaindexAdapter_mergeIntoDataStream as mergeIntoDataStream,
    llamaindexAdapter_toDataStream as toDataStream,
    llamaindexAdapter_toDataStreamResponse as toDataStreamResponse,
  };
}

export { AssistantContent, AssistantResponse, CallWarning, ChunkDetector, CoreAssistantMessage, CoreMessage, CoreSystemMessage, CoreTool, CoreToolCallUnion, CoreToolChoice, CoreToolMessage, CoreToolResultUnion, CoreUserMessage, DataContent, DataStreamOptions, DataStreamWriter, DownloadError, EmbedManyResult, EmbedResult, Embedding, EmbeddingModel, EmbeddingModelUsage, GenerateImageResult as Experimental_GenerateImageResult, GeneratedFile as Experimental_GeneratedImage, Experimental_LanguageModelV1Middleware, SpeechResult as Experimental_SpeechResult, TranscriptionResult as Experimental_TranscriptionResult, FilePart, FinishReason, GenerateObjectResult, GenerateTextOnStepFinishCallback, GenerateTextResult, GeneratedAudioFile, GeneratedFile, ImageModel, ImageGenerationWarning as ImageModelCallWarning, ImageModelResponseMetadata, ImagePart, InvalidArgumentError, InvalidDataContentError, InvalidMessageRoleError, InvalidStreamPartError, InvalidToolArgumentsError, JSONRPCError, JSONRPCMessage, JSONRPCNotification, JSONRPCRequest, JSONRPCResponse, langchainAdapter as LangChainAdapter, LanguageModel, LanguageModelRequestMetadata, LanguageModelResponseMetadata, LanguageModelUsage, LanguageModelV1Middleware, llamaindexAdapter as LlamaIndexAdapter, LogProbs, MCPClientError, MCPTransport, MessageConversionError, NoImageGeneratedError, NoObjectGeneratedError, NoOutputSpecifiedError, NoSuchProviderError, NoSuchToolError, ObjectStreamPart, output as Output, Provider, ProviderMetadata, ProviderRegistryProvider, RepairTextFunction, RetryError, SpeechModel, SpeechModelResponseMetadata, SpeechWarning, StepResult, StreamData, StreamObjectOnFinishCallback, StreamObjectResult, StreamTextOnChunkCallback, StreamTextOnErrorCallback, StreamTextOnFinishCallback, StreamTextOnStepFinishCallback, StreamTextResult, StreamTextTransform, TelemetrySettings, TextPart, TextStreamPart, Tool, ToolCallPart, ToolCallRepairError, ToolCallRepairFunction, ToolCallUnion, ToolChoice, ToolContent, ToolExecutionError, ToolExecutionOptions, ToolResultPart, ToolResultUnion, ToolSet, TranscriptionModel, TranscriptionModelResponseMetadata, TranscriptionWarning, UnsupportedModelVersionError, UserContent, appendClientMessage, appendResponseMessages, convertToCoreMessages, coreAssistantMessageSchema, coreMessageSchema, coreSystemMessageSchema, coreToolMessageSchema, coreUserMessageSchema, cosineSimilarity, createDataStream, createDataStreamResponse, createProviderRegistry, customProvider, defaultSettingsMiddleware, embed, embedMany, createMCPClient as experimental_createMCPClient, experimental_createProviderRegistry, experimental_customProvider, generateImage as experimental_generateImage, generateSpeech as experimental_generateSpeech, transcribe as experimental_transcribe, experimental_wrapLanguageModel, extractReasoningMiddleware, generateObject, generateText, pipeDataStreamToResponse, simulateReadableStream, simulateStreamingMiddleware, smoothStream, streamObject, streamText, tool, wrapLanguageModel };
