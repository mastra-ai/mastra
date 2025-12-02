import { JSONSchema7 } from 'json-schema';
export { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/**
An embedding is a vector, i.e. an array of numbers.
It is e.g. used to represent a text as a vector of word embeddings.
 */
type EmbeddingModelV1Embedding = Array<number>;

/**
Specification for an embedding model that implements the embedding model
interface version 1.

VALUE is the type of the values that the model can embed.
This will allow us to go beyond text embeddings in the future,
e.g. to support image embeddings
 */
type EmbeddingModelV1<VALUE> = {
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

declare const symbol$d: unique symbol;
/**
 * Custom error class for AI SDK related errors.
 * @extends Error
 */
declare class AISDKError extends Error {
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
    constructor({ name, message, cause, }: {
        name: string;
        message: string;
        cause?: unknown;
    });
    /**
     * Checks if the given error is an AI SDK Error.
     * @param {unknown} error - The error to check.
     * @returns {boolean} True if the error is an AI SDK Error, false otherwise.
     */
    static isInstance(error: unknown): error is AISDKError;
    protected static hasMarker(error: unknown, marker: string): boolean;
}

declare const symbol$c: unique symbol;
declare class APICallError extends AISDKError {
    private readonly [symbol$c];
    readonly url: string;
    readonly requestBodyValues: unknown;
    readonly statusCode?: number;
    readonly responseHeaders?: Record<string, string>;
    readonly responseBody?: string;
    readonly isRetryable: boolean;
    readonly data?: unknown;
    constructor({ message, url, requestBodyValues, statusCode, responseHeaders, responseBody, cause, isRetryable, // server error
    data, }: {
        message: string;
        url: string;
        requestBodyValues: unknown;
        statusCode?: number;
        responseHeaders?: Record<string, string>;
        responseBody?: string;
        cause?: unknown;
        isRetryable?: boolean;
        data?: unknown;
    });
    static isInstance(error: unknown): error is APICallError;
}

declare const symbol$b: unique symbol;
declare class EmptyResponseBodyError extends AISDKError {
    private readonly [symbol$b];
    constructor({ message }?: {
        message?: string;
    });
    static isInstance(error: unknown): error is EmptyResponseBodyError;
}

declare function getErrorMessage(error: unknown | undefined): string;

declare const symbol$a: unique symbol;
/**
 * A function argument is invalid.
 */
declare class InvalidArgumentError extends AISDKError {
    private readonly [symbol$a];
    readonly argument: string;
    constructor({ message, cause, argument, }: {
        argument: string;
        message: string;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is InvalidArgumentError;
}

declare const symbol$9: unique symbol;
/**
 * A prompt is invalid. This error should be thrown by providers when they cannot
 * process a prompt.
 */
declare class InvalidPromptError extends AISDKError {
    private readonly [symbol$9];
    readonly prompt: unknown;
    constructor({ prompt, message, cause, }: {
        prompt: unknown;
        message: string;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is InvalidPromptError;
}

declare const symbol$8: unique symbol;
/**
 * Server returned a response with invalid data content.
 * This should be thrown by providers when they cannot parse the response from the API.
 */
declare class InvalidResponseDataError extends AISDKError {
    private readonly [symbol$8];
    readonly data: unknown;
    constructor({ data, message, }: {
        data: unknown;
        message?: string;
    });
    static isInstance(error: unknown): error is InvalidResponseDataError;
}

declare const symbol$7: unique symbol;
declare class JSONParseError extends AISDKError {
    private readonly [symbol$7];
    readonly text: string;
    constructor({ text, cause }: {
        text: string;
        cause: unknown;
    });
    static isInstance(error: unknown): error is JSONParseError;
}

declare const symbol$6: unique symbol;
declare class LoadAPIKeyError extends AISDKError {
    private readonly [symbol$6];
    constructor({ message }: {
        message: string;
    });
    static isInstance(error: unknown): error is LoadAPIKeyError;
}

declare const symbol$5: unique symbol;
declare class LoadSettingError extends AISDKError {
    private readonly [symbol$5];
    constructor({ message }: {
        message: string;
    });
    static isInstance(error: unknown): error is LoadSettingError;
}

declare const symbol$4: unique symbol;
/**
Thrown when the AI provider fails to generate any content.
 */
declare class NoContentGeneratedError extends AISDKError {
    private readonly [symbol$4];
    constructor({ message, }?: {
        message?: string;
    });
    static isInstance(error: unknown): error is NoContentGeneratedError;
}

declare const symbol$3: unique symbol;
declare class NoSuchModelError extends AISDKError {
    private readonly [symbol$3];
    readonly modelId: string;
    readonly modelType: 'languageModel' | 'textEmbeddingModel' | 'imageModel';
    constructor({ errorName, modelId, modelType, message, }: {
        errorName?: string;
        modelId: string;
        modelType: 'languageModel' | 'textEmbeddingModel' | 'imageModel';
        message?: string;
    });
    static isInstance(error: unknown): error is NoSuchModelError;
}

declare const symbol$2: unique symbol;
declare class TooManyEmbeddingValuesForCallError extends AISDKError {
    private readonly [symbol$2];
    readonly provider: string;
    readonly modelId: string;
    readonly maxEmbeddingsPerCall: number;
    readonly values: Array<unknown>;
    constructor(options: {
        provider: string;
        modelId: string;
        maxEmbeddingsPerCall: number;
        values: Array<unknown>;
    });
    static isInstance(error: unknown): error is TooManyEmbeddingValuesForCallError;
}

declare const symbol$1: unique symbol;
declare class TypeValidationError extends AISDKError {
    private readonly [symbol$1];
    readonly value: unknown;
    constructor({ value, cause }: {
        value: unknown;
        cause: unknown;
    });
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
    static wrap({ value, cause, }: {
        value: unknown;
        cause: unknown;
    }): TypeValidationError;
}

declare const symbol: unique symbol;
declare class UnsupportedFunctionalityError extends AISDKError {
    private readonly [symbol];
    readonly functionality: string;
    constructor({ functionality, message, }: {
        functionality: string;
        message?: string;
    });
    static isInstance(error: unknown): error is UnsupportedFunctionalityError;
}

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
type JSONObject = {
    [key: string]: JSONValue;
};
type JSONArray = JSONValue[];

type ImageModelV1CallOptions = {
    /**
  Prompt for the image generation.
       */
    prompt: string;
    /**
  Number of images to generate.
   */
    n: number;
    /**
  Size of the images to generate.
  Must have the format `{width}x{height}`.
  `undefined` will use the provider's default size.
   */
    size: `${number}x${number}` | undefined;
    /**
  Aspect ratio of the images to generate.
  Must have the format `{width}:{height}`.
  `undefined` will use the provider's default aspect ratio.
   */
    aspectRatio: `${number}:${number}` | undefined;
    /**
  Seed for the image generation.
  `undefined` will use the provider's default seed.
   */
    seed: number | undefined;
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
    providerOptions: Record<string, Record<string, JSONValue>>;
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
type ImageModelV1CallWarning = {
    type: 'unsupported-setting';
    setting: keyof ImageModelV1CallOptions;
    details?: string;
} | {
    type: 'other';
    message: string;
};

/**
Image generation model specification version 1.
 */
type ImageModelV1 = {
    /**
  The image model must specify which image model interface
  version it implements. This will allow us to evolve the image
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
  Limit of how many images can be generated in a single API call.
  If undefined, we will max generate one image per call.
     */
    readonly maxImagesPerCall: number | undefined;
    /**
  Generates an array of images.
     */
    doGenerate(options: ImageModelV1CallOptions): PromiseLike<{
        /**
    Generated images as base64 encoded strings or binary data.
    The images should be returned without any unnecessary conversion.
    If the API returns base64 encoded strings, the images should be returned
    as base64 encoded strings. If the API returns binary data, the images should
    be returned as binary data.
         */
        images: Array<string> | Array<Uint8Array>;
        /**
    Warnings for the call, e.g. unsupported settings.
         */
        warnings: Array<ImageModelV1CallWarning>;
        /**
    Response information for telemetry and debugging purposes.
         */
        response: {
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
            headers: Record<string, string> | undefined;
        };
    }>;
};

declare function isJSONValue(value: unknown): value is JSONValue;
declare function isJSONArray(value: unknown): value is JSONArray;
declare function isJSONObject(value: unknown): value is JSONObject;

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
type LanguageModelV1ProviderMetadata = Record<string, Record<string, JSONValue>>;

/**
 * A source that has been used as input to generate the response.
 */
type LanguageModelV1Source = {
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

type LanguageModelV1CallSettings = {
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
    responseFormat?: {
        type: 'text';
    } | {
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
A tool has a name, a description, and a set of parameters.

Note: this is **not** the user-facing tool definition. The AI SDK methods will
map the user-facing tool definitions to this format.
 */
type LanguageModelV1FunctionTool = {
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

/**
A prompt is a list of messages.

Note: Not all models and prompt formats support multi-modal inputs and
tool calls. The validation happens at runtime.

Note: This is not a user-facing prompt. The AI SDK methods will map the
user-facing prompt types such as chat or instruction prompts to this format.
 */
type LanguageModelV1Prompt = Array<LanguageModelV1Message>;
type LanguageModelV1Message = ({
    role: 'system';
    content: string;
} | {
    role: 'user';
    content: Array<LanguageModelV1TextPart | LanguageModelV1ImagePart | LanguageModelV1FilePart>;
} | {
    role: 'assistant';
    content: Array<LanguageModelV1TextPart | LanguageModelV1FilePart | LanguageModelV1ReasoningPart | LanguageModelV1RedactedReasoningPart | LanguageModelV1ToolCallPart>;
} | {
    role: 'tool';
    content: Array<LanguageModelV1ToolResultPart>;
}) & {
    /**
     * Additional provider-specific metadata. They are passed through
     * to the provider from the AI SDK and enable provider-specific
     * functionality that can be fully encapsulated in the provider.
     */
    providerMetadata?: LanguageModelV1ProviderMetadata;
};
/**
Text content part of a prompt. It contains a string of text.
 */
interface LanguageModelV1TextPart {
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
Reasoning content part of a prompt. It contains a string of reasoning text.
 */
interface LanguageModelV1ReasoningPart {
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
interface LanguageModelV1RedactedReasoningPart {
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
Image content part of a prompt. It contains an image.
 */
interface LanguageModelV1ImagePart {
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
File content part of a prompt. It contains a file.
 */
interface LanguageModelV1FilePart {
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
Tool call content part of a prompt. It contains a tool call (usually generated by the AI model).
 */
interface LanguageModelV1ToolCallPart {
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
/**
Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
interface LanguageModelV1ToolResultPart {
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
    content?: Array<{
        type: 'text';
        /**
Text content.
         */
        text: string;
    } | {
        type: 'image';
        /**
base-64 encoded image data
         */
        data: string;
        /**
Mime type of the image.
         */
        mimeType?: string;
    }>;
    /**
     * Additional provider-specific metadata. They are passed through
     * to the provider from the AI SDK and enable provider-specific
     * functionality that can be fully encapsulated in the provider.
     */
    providerMetadata?: LanguageModelV1ProviderMetadata;
}

/**
The configuration of a tool that is defined by the provider.
 */
type LanguageModelV1ProviderDefinedTool = {
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

type LanguageModelV1ToolChoice = {
    type: 'auto';
} | {
    type: 'none';
} | {
    type: 'required';
} | {
    type: 'tool';
    toolName: string;
};

type LanguageModelV1CallOptions = LanguageModelV1CallSettings & {
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
    mode: {
        type: 'regular';
        /**
The tools that are available for the model.
         */
        tools?: Array<LanguageModelV1FunctionTool | LanguageModelV1ProviderDefinedTool>;
        /**
Specifies how the tool should be selected. Defaults to 'auto'.
         */
        toolChoice?: LanguageModelV1ToolChoice;
    } | {
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
    } | {
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

/**
Warning from the model provider for this call. The call will proceed, but e.g.
some settings might not be supported, which can lead to suboptimal results.
 */
type LanguageModelV1CallWarning = {
    type: 'unsupported-setting';
    setting: keyof LanguageModelV1CallSettings;
    details?: string;
} | {
    type: 'unsupported-tool';
    tool: LanguageModelV1FunctionTool | LanguageModelV1ProviderDefinedTool;
    details?: string;
} | {
    type: 'other';
    message: string;
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
- `unknown`: the model has not transmitted a finish reason
 */
type LanguageModelV1FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';

type LanguageModelV1FunctionToolCall = {
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
Log probabilities for each token and its top log probabilities.
 */
type LanguageModelV1LogProbs = Array<{
    token: string;
    logprob: number;
    topLogprobs: Array<{
        token: string;
        logprob: number;
    }>;
}>;

/**
Specification for a language model that implements the language model interface version 1.
 */
type LanguageModelV1 = {
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
        reasoning?: string | Array<{
            type: 'text';
            text: string;
            /**
An optional signature for verifying that the reasoning originated from the model.
 */
            signature?: string;
        } | {
            type: 'redacted';
            data: string;
        }>;
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
type LanguageModelV1StreamPart = {
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
    source: LanguageModelV1Source;
} | {
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
} | ({
    type: 'tool-call';
} & LanguageModelV1FunctionToolCall) | {
    type: 'tool-call-delta';
    toolCallType: 'function';
    toolCallId: string;
    toolName: string;
    argsTextDelta: string;
} | {
    type: 'response-metadata';
    id?: string;
    timestamp?: Date;
    modelId?: string;
} | {
    type: 'finish';
    finishReason: LanguageModelV1FinishReason;
    providerMetadata?: LanguageModelV1ProviderMetadata;
    usage: {
        promptTokens: number;
        completionTokens: number;
    };
    logprobs?: LanguageModelV1LogProbs;
} | {
    type: 'error';
    error: unknown;
};
/**
The object generation modes available for use with a model. `undefined`
represents no support for object generation.
   */
type LanguageModelV1ObjectGenerationMode = 'json' | 'tool' | undefined;

type TranscriptionModelV1ProviderOptions = Record<string, Record<string, JSONValue>>;
type TranscriptionModelV1CallOptions = {
    /**
  Audio data to transcribe.
  Accepts a `Uint8Array` or `string`, where `string` is a base64 encoded audio file.
       */
    audio: Uint8Array | string;
    /**
  The IANA media type of the audio data.
  
  @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
    mediaType: string;
    /**
  Additional provider-specific options that are passed through to the provider
  as body parameters.
  
  The outer record is keyed by the provider name, and the inner
  record is keyed by the provider-specific metadata key.
  ```ts
  {
  "openai": {
  "timestampGranularities": ["word"]
  }
  }
  ```
   */
    providerOptions?: TranscriptionModelV1ProviderOptions;
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
type TranscriptionModelV1CallWarning = {
    type: 'unsupported-setting';
    setting: keyof TranscriptionModelV1CallOptions;
    details?: string;
} | {
    type: 'other';
    message: string;
};

/**
Transcription model specification version 1.
 */
type TranscriptionModelV1 = {
    /**
  The transcription model must specify which transcription model interface
  version it implements. This will allow us to evolve the transcription
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
  Generates a transcript.
     */
    doGenerate(options: TranscriptionModelV1CallOptions): PromiseLike<{
        /**
         * The complete transcribed text from the audio.
         */
        text: string;
        /**
         * Array of transcript segments with timing information.
         * Each segment represents a portion of the transcribed text with start and end times.
         */
        segments: Array<{
            /**
             * The text content of this segment.
             */
            text: string;
            /**
             * The start time of this segment in seconds.
             */
            startSecond: number;
            /**
             * The end time of this segment in seconds.
             */
            endSecond: number;
        }>;
        /**
         * The detected language of the audio content, as an ISO-639-1 code (e.g., 'en' for English).
         * May be undefined if the language couldn't be detected.
         */
        language: string | undefined;
        /**
         * The total duration of the audio file in seconds.
         * May be undefined if the duration couldn't be determined.
         */
        durationInSeconds: number | undefined;
        /**
    Warnings for the call, e.g. unsupported settings.
         */
        warnings: Array<TranscriptionModelV1CallWarning>;
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
    Response information for telemetry and debugging purposes.
         */
        response: {
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
            headers: Record<string, string> | undefined;
            /**
      Response body.
            */
            body?: unknown;
        };
        /**
    Additional provider-specific metadata. They are passed through
    from the provider to the AI SDK and enable provider-specific
    results that can be fully encapsulated in the provider.
         */
        providerMetadata?: Record<string, Record<string, JSONValue>>;
    }>;
};

type SpeechModelV1ProviderOptions = Record<string, Record<string, JSONValue>>;
type SpeechModelV1CallOptions = {
    /**
     * Text to convert to speech.
     */
    text: string;
    /**
     * The voice to use for speech synthesis.
     * This is provider-specific and may be a voice ID, name, or other identifier.
     */
    voice?: string;
    /**
     * The desired output format for the audio e.g. "mp3", "wav", etc.
     */
    outputFormat?: string;
    /**
     * Instructions for the speech generation e.g. "Speak in a slow and steady tone".
     */
    instructions?: string;
    /**
     * The speed of the speech generation.
     */
    speed?: number;
    /**
     * Additional provider-specific options that are passed through to the provider
     * as body parameters.
     *
     * The outer record is keyed by the provider name, and the inner
     * record is keyed by the provider-specific metadata key.
     * ```ts
     * {
     *   "openai": {}
     * }
     * ```
     */
    providerOptions?: SpeechModelV1ProviderOptions;
    /**
     * Abort signal for cancelling the operation.
     */
    abortSignal?: AbortSignal;
    /**
     * Additional HTTP headers to be sent with the request.
     * Only applicable for HTTP-based providers.
     */
    headers?: Record<string, string | undefined>;
};

/**
 * Warning from the model provider for this call. The call will proceed, but e.g.
 * some settings might not be supported, which can lead to suboptimal results.
 */
type SpeechModelV1CallWarning = {
    type: 'unsupported-setting';
    setting: keyof SpeechModelV1CallOptions;
    details?: string;
} | {
    type: 'other';
    message: string;
};

/**
 * Speech model specification version 1.
 */
type SpeechModelV1 = {
    /**
     * The speech model must specify which speech model interface
     * version it implements. This will allow us to evolve the speech
     * model interface and retain backwards compatibility. The different
     * implementation versions can be handled as a discriminated union
     * on our side.
     */
    readonly specificationVersion: 'v1';
    /**
     * Name of the provider for logging purposes.
     */
    readonly provider: string;
    /**
     * Provider-specific model ID for logging purposes.
     */
    readonly modelId: string;
    /**
     * Generates speech audio from text.
     */
    doGenerate(options: SpeechModelV1CallOptions): PromiseLike<{
        /**
         * Generated audio as an ArrayBuffer.
         * The audio should be returned without any unnecessary conversion.
         * If the API returns base64 encoded strings, the audio should be returned
         * as base64 encoded strings. If the API returns binary data, the audio
         * should be returned as binary data.
         */
        audio: string | Uint8Array;
        /**
         * Warnings for the call, e.g. unsupported settings.
         */
        warnings: Array<SpeechModelV1CallWarning>;
        /**
         * Optional request information for telemetry and debugging purposes.
         */
        request?: {
            /**
             * Response body (available only for providers that use HTTP requests).
             */
            body?: unknown;
        };
        /**
         * Response information for telemetry and debugging purposes.
         */
        response: {
            /**
             * Timestamp for the start of the generated response.
             */
            timestamp: Date;
            /**
             * The ID of the response model that was used to generate the response.
             */
            modelId: string;
            /**
             * Response headers.
             */
            headers: Record<string, string> | undefined;
            /**
             * Response body.
             */
            body?: unknown;
        };
        /**
         * Additional provider-specific metadata. They are passed through
         * from the provider to the AI SDK and enable provider-specific
         * results that can be fully encapsulated in the provider.
         */
        providerMetadata?: Record<string, Record<string, JSONValue>>;
    }>;
};

/**
 * Provider for language, text embedding, and image generation models.
 */
interface ProviderV1 {
    /**
  Returns the language model with the given id.
  The model id is then passed to the provider function to get the model.
  
  @param {string} modelId - The id of the model to return.
  
  @returns {LanguageModel} The language model associated with the id
  
  @throws {NoSuchModelError} If no such model exists.
     */
    languageModel(modelId: string): LanguageModelV1;
    /**
  Returns the text embedding model with the given id.
  The model id is then passed to the provider function to get the model.
  
  @param {string} modelId - The id of the model to return.
  
  @returns {LanguageModel} The language model associated with the id
  
  @throws {NoSuchModelError} If no such model exists.
     */
    textEmbeddingModel(modelId: string): EmbeddingModelV1<string>;
    /**
  Returns the image model with the given id.
  The model id is then passed to the provider function to get the model.
  
  @param {string} modelId - The id of the model to return.
  
  @returns {ImageModel} The image model associated with the id
  */
    readonly imageModel?: (modelId: string) => ImageModelV1;
    /**
  Returns the transcription model with the given id.
  The model id is then passed to the provider function to get the model.
  
  @param {string} modelId - The id of the model to return.
  
  @returns {TranscriptionModel} The transcription model associated with the id
  */
    readonly transcriptionModel?: (modelId: string) => TranscriptionModelV1;
    /**
  Returns the speech model with the given id.
  The model id is then passed to the provider function to get the model.
  
  @param {string} modelId - The id of the model to return.
  
  @returns {SpeechModel} The speech model associated with the id
  */
    readonly speechModel?: (modelId: string) => SpeechModelV1;
}

export { AISDKError, APICallError, type EmbeddingModelV1, type EmbeddingModelV1Embedding, EmptyResponseBodyError, type ImageModelV1, type ImageModelV1CallOptions, type ImageModelV1CallWarning, InvalidArgumentError, InvalidPromptError, InvalidResponseDataError, type JSONArray, type JSONObject, JSONParseError, type JSONValue, type LanguageModelV1, type LanguageModelV1CallOptions, type LanguageModelV1CallWarning, type LanguageModelV1FilePart, type LanguageModelV1FinishReason, type LanguageModelV1FunctionTool, type LanguageModelV1FunctionToolCall, type LanguageModelV1ImagePart, type LanguageModelV1LogProbs, type LanguageModelV1Message, type LanguageModelV1ObjectGenerationMode, type LanguageModelV1Prompt, type LanguageModelV1ProviderDefinedTool, type LanguageModelV1ProviderMetadata, type LanguageModelV1ReasoningPart, type LanguageModelV1RedactedReasoningPart, type LanguageModelV1Source, type LanguageModelV1StreamPart, type LanguageModelV1TextPart, type LanguageModelV1ToolCallPart, type LanguageModelV1ToolChoice, type LanguageModelV1ToolResultPart, LoadAPIKeyError, LoadSettingError, NoContentGeneratedError, NoSuchModelError, type ProviderV1, type SpeechModelV1, type SpeechModelV1CallOptions, type SpeechModelV1CallWarning, TooManyEmbeddingValuesForCallError, type TranscriptionModelV1, type TranscriptionModelV1CallOptions, type TranscriptionModelV1CallWarning, TypeValidationError, UnsupportedFunctionalityError, getErrorMessage, isJSONArray, isJSONObject, isJSONValue };
