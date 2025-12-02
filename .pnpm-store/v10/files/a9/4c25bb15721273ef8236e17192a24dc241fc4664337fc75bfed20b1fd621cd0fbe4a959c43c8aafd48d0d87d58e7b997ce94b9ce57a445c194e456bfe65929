import { LanguageModelV1ProviderMetadata, LanguageModelV1, LanguageModelV1ObjectGenerationMode, EmbeddingModelV1, ImageModelV1, ProviderV1 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { ZodSchema, z } from 'zod';

type OpenAICompatibleChatModelId = string;
interface OpenAICompatibleChatSettings {
    /**
  A unique identifier representing your end-user, which can help the provider to
  monitor and detect abuse.
    */
    user?: string;
    /**
  Simulates streaming by using a normal generate call and returning it as a stream.
  Enable this if the model that you are using does not support streaming.
  
  Defaults to `false`.
  @deprecated Use `simulateStreamingMiddleware` instead.
     */
    simulateStreaming?: boolean;
}

declare const openaiCompatibleErrorDataSchema: z.ZodObject<{
    error: z.ZodObject<{
        message: z.ZodString;
        type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        param: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
        code: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type?: string | null | undefined;
        code?: string | number | null | undefined;
        param?: any;
    }, {
        message: string;
        type?: string | null | undefined;
        code?: string | number | null | undefined;
        param?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        message: string;
        type?: string | null | undefined;
        code?: string | number | null | undefined;
        param?: any;
    };
}, {
    error: {
        message: string;
        type?: string | null | undefined;
        code?: string | number | null | undefined;
        param?: any;
    };
}>;
type OpenAICompatibleErrorData = z.infer<typeof openaiCompatibleErrorDataSchema>;
type ProviderErrorStructure<T> = {
    errorSchema: ZodSchema<T>;
    errorToMessage: (error: T) => string;
    isRetryable?: (response: Response, error?: T) => boolean;
};

/**
Extracts provider-specific metadata from API responses.
Used to standardize metadata handling across different LLM providers while allowing
provider-specific metadata to be captured.
*/
type MetadataExtractor = {
    /**
     * Extracts provider metadata from a complete, non-streaming response.
     *
     * @param parsedBody - The parsed response JSON body from the provider's API.
     *
     * @returns Provider-specific metadata or undefined if no metadata is available.
     *          The metadata should be under a key indicating the provider id.
     */
    extractMetadata: ({ parsedBody, }: {
        parsedBody: unknown;
    }) => LanguageModelV1ProviderMetadata | undefined;
    /**
     * Creates an extractor for handling streaming responses. The returned object provides
     * methods to process individual chunks and build the final metadata from the accumulated
     * stream data.
     *
     * @returns An object with methods to process chunks and build metadata from a stream
     */
    createStreamExtractor: () => {
        /**
         * Process an individual chunk from the stream. Called for each chunk in the response stream
         * to accumulate metadata throughout the streaming process.
         *
         * @param parsedChunk - The parsed JSON response chunk from the provider's API
         */
        processChunk(parsedChunk: unknown): void;
        /**
         * Builds the metadata object after all chunks have been processed.
         * Called at the end of the stream to generate the complete provider metadata.
         *
         * @returns Provider-specific metadata or undefined if no metadata is available.
         *          The metadata should be under a key indicating the provider id.
         */
        buildMetadata(): LanguageModelV1ProviderMetadata | undefined;
    };
};

type OpenAICompatibleChatConfig = {
    provider: string;
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
    includeUsage?: boolean;
    errorStructure?: ProviderErrorStructure<any>;
    metadataExtractor?: MetadataExtractor;
    /**
  Default object generation mode that should be used with this model when
  no mode is specified. Should be the mode with the best results for this
  model. `undefined` can be specified if object generation is not supported.
    */
    defaultObjectGenerationMode?: LanguageModelV1ObjectGenerationMode;
    /**
     * Whether the model supports structured outputs.
     */
    supportsStructuredOutputs?: boolean;
};
declare class OpenAICompatibleChatLanguageModel implements LanguageModelV1 {
    readonly specificationVersion = "v1";
    readonly supportsStructuredOutputs: boolean;
    readonly modelId: OpenAICompatibleChatModelId;
    readonly settings: OpenAICompatibleChatSettings;
    private readonly config;
    private readonly failedResponseHandler;
    private readonly chunkSchema;
    constructor(modelId: OpenAICompatibleChatModelId, settings: OpenAICompatibleChatSettings, config: OpenAICompatibleChatConfig);
    get defaultObjectGenerationMode(): 'json' | 'tool' | undefined;
    get provider(): string;
    private get providerOptionsName();
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>>;
}

type OpenAICompatibleCompletionModelId = string;
interface OpenAICompatibleCompletionSettings {
    /**
  Echo back the prompt in addition to the completion.
     */
    echo?: boolean;
    /**
  Modify the likelihood of specified tokens appearing in the completion.
  
  Accepts a JSON object that maps tokens (specified by their token ID in
  the GPT tokenizer) to an associated bias value from -100 to 100. You
  can use this tokenizer tool to convert text to token IDs. Mathematically,
  the bias is added to the logits generated by the model prior to sampling.
  The exact effect will vary per model, but values between -1 and 1 should
  decrease or increase likelihood of selection; values like -100 or 100
  should result in a ban or exclusive selection of the relevant token.
  
  As an example, you can pass {"50256": -100} to prevent the <|endoftext|>
  token from being generated.
     */
    logitBias?: Record<number, number>;
    /**
  The suffix that comes after a completion of inserted text.
     */
    suffix?: string;
    /**
  A unique identifier representing your end-user, which can help OpenAI to
  monitor and detect abuse. Learn more.
     */
    user?: string;
}

type OpenAICompatibleCompletionConfig = {
    provider: string;
    includeUsage?: boolean;
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
    errorStructure?: ProviderErrorStructure<any>;
};
declare class OpenAICompatibleCompletionLanguageModel implements LanguageModelV1 {
    readonly specificationVersion = "v1";
    readonly defaultObjectGenerationMode: undefined;
    readonly modelId: OpenAICompatibleCompletionModelId;
    readonly settings: OpenAICompatibleCompletionSettings;
    private readonly config;
    private readonly failedResponseHandler;
    private readonly chunkSchema;
    constructor(modelId: OpenAICompatibleCompletionModelId, settings: OpenAICompatibleCompletionSettings, config: OpenAICompatibleCompletionConfig);
    get provider(): string;
    private get providerOptionsName();
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>>;
}

type OpenAICompatibleEmbeddingModelId = string;
interface OpenAICompatibleEmbeddingSettings {
    /**
  The number of dimensions the resulting output embeddings should have.
  Only supported in text-embedding-3 and later models.
     */
    dimensions?: number;
    /**
  A unique identifier representing your end-user, which can help OpenAI to
  monitor and detect abuse. Learn more.
  */
    user?: string;
}

type OpenAICompatibleEmbeddingConfig = {
    /**
  Override the maximum number of embeddings per call.
     */
    maxEmbeddingsPerCall?: number;
    /**
  Override the parallelism of embedding calls.
    */
    supportsParallelCalls?: boolean;
    provider: string;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    headers: () => Record<string, string | undefined>;
    fetch?: FetchFunction;
    errorStructure?: ProviderErrorStructure<any>;
};
declare class OpenAICompatibleEmbeddingModel implements EmbeddingModelV1<string> {
    readonly specificationVersion = "v1";
    readonly modelId: OpenAICompatibleEmbeddingModelId;
    private readonly config;
    private readonly settings;
    get provider(): string;
    get maxEmbeddingsPerCall(): number;
    get supportsParallelCalls(): boolean;
    constructor(modelId: OpenAICompatibleEmbeddingModelId, settings: OpenAICompatibleEmbeddingSettings, config: OpenAICompatibleEmbeddingConfig);
    doEmbed({ values, headers, abortSignal, }: Parameters<EmbeddingModelV1<string>['doEmbed']>[0]): Promise<Awaited<ReturnType<EmbeddingModelV1<string>['doEmbed']>>>;
}

type OpenAICompatibleImageModelId = string;
interface OpenAICompatibleImageSettings {
    /**
  A unique identifier representing your end-user, which can help the provider to
  monitor and detect abuse.
    */
    user?: string;
    /**
     * The maximum number of images to generate.
     */
    maxImagesPerCall?: number;
}

type OpenAICompatibleImageModelConfig = {
    provider: string;
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
    errorStructure?: ProviderErrorStructure<any>;
    _internal?: {
        currentDate?: () => Date;
    };
};
declare class OpenAICompatibleImageModel implements ImageModelV1 {
    readonly modelId: OpenAICompatibleImageModelId;
    private readonly settings;
    private readonly config;
    readonly specificationVersion = "v1";
    get maxImagesPerCall(): number;
    get provider(): string;
    constructor(modelId: OpenAICompatibleImageModelId, settings: OpenAICompatibleImageSettings, config: OpenAICompatibleImageModelConfig);
    doGenerate({ prompt, n, size, aspectRatio, seed, providerOptions, headers, abortSignal, }: Parameters<ImageModelV1['doGenerate']>[0]): Promise<Awaited<ReturnType<ImageModelV1['doGenerate']>>>;
}

interface OpenAICompatibleProvider<CHAT_MODEL_IDS extends string = string, COMPLETION_MODEL_IDS extends string = string, EMBEDDING_MODEL_IDS extends string = string, IMAGE_MODEL_IDS extends string = string> extends Omit<ProviderV1, 'imageModel'> {
    (modelId: CHAT_MODEL_IDS, settings?: OpenAICompatibleChatSettings, config?: Partial<OpenAICompatibleChatConfig>): LanguageModelV1;
    languageModel(modelId: CHAT_MODEL_IDS, settings?: OpenAICompatibleChatSettings, config?: Partial<OpenAICompatibleChatConfig>): LanguageModelV1;
    chatModel(modelId: CHAT_MODEL_IDS, settings?: OpenAICompatibleChatSettings, config?: Partial<OpenAICompatibleChatConfig>): LanguageModelV1;
    completionModel(modelId: COMPLETION_MODEL_IDS, settings?: OpenAICompatibleCompletionSettings): LanguageModelV1;
    textEmbeddingModel(modelId: EMBEDDING_MODEL_IDS, settings?: OpenAICompatibleEmbeddingSettings): EmbeddingModelV1<string>;
    imageModel(modelId: IMAGE_MODEL_IDS, settings?: OpenAICompatibleImageSettings): ImageModelV1;
}
interface OpenAICompatibleProviderSettings {
    /**
  Base URL for the API calls.
     */
    baseURL: string;
    /**
  Provider name.
     */
    name: string;
    /**
  API key for authenticating requests. If specified, adds an `Authorization`
  header to request headers with the value `Bearer <apiKey>`. This will be added
  before any headers potentially specified in the `headers` option.
     */
    apiKey?: string;
    /**
  Optional custom headers to include in requests. These will be added to request headers
  after any headers potentially added by use of the `apiKey` option.
     */
    headers?: Record<string, string>;
    /**
  Optional custom url query parameters to include in request urls.
     */
    queryParams?: Record<string, string>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
     */
    fetch?: FetchFunction;
}
/**
Create an OpenAICompatible provider instance.
 */
declare function createOpenAICompatible<CHAT_MODEL_IDS extends string, COMPLETION_MODEL_IDS extends string, EMBEDDING_MODEL_IDS extends string, IMAGE_MODEL_IDS extends string>(options: OpenAICompatibleProviderSettings): OpenAICompatibleProvider<CHAT_MODEL_IDS, COMPLETION_MODEL_IDS, EMBEDDING_MODEL_IDS, IMAGE_MODEL_IDS>;

export { type MetadataExtractor, OpenAICompatibleChatLanguageModel, type OpenAICompatibleChatSettings, OpenAICompatibleCompletionLanguageModel, type OpenAICompatibleCompletionSettings, OpenAICompatibleEmbeddingModel, type OpenAICompatibleEmbeddingSettings, type OpenAICompatibleErrorData, OpenAICompatibleImageModel, type OpenAICompatibleImageSettings, type OpenAICompatibleProvider, type OpenAICompatibleProviderSettings, type ProviderErrorStructure, createOpenAICompatible };
