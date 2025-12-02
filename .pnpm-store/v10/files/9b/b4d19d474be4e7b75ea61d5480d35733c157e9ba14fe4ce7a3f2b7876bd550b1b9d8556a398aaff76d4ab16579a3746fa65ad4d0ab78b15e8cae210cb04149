import { LanguageModelV2, EmbeddingModelV2, ImageModelV2, TranscriptionModelV2CallOptions, TranscriptionModelV2, SpeechModelV2 } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { InferValidator, FetchFunction } from '@ai-sdk/provider-utils';

type OpenAIChatModelId = 'o1' | 'o1-2024-12-17' | 'o3-mini' | 'o3-mini-2025-01-31' | 'o3' | 'o3-2025-04-16' | 'gpt-4.1' | 'gpt-4.1-2025-04-14' | 'gpt-4.1-mini' | 'gpt-4.1-mini-2025-04-14' | 'gpt-4.1-nano' | 'gpt-4.1-nano-2025-04-14' | 'gpt-4o' | 'gpt-4o-2024-05-13' | 'gpt-4o-2024-08-06' | 'gpt-4o-2024-11-20' | 'gpt-4o-mini' | 'gpt-4o-mini-2024-07-18' | 'gpt-4-turbo' | 'gpt-4-turbo-2024-04-09' | 'gpt-4' | 'gpt-4-0613' | 'gpt-4.5-preview' | 'gpt-4.5-preview-2025-02-27' | 'gpt-3.5-turbo-0125' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-1106' | 'chatgpt-4o-latest' | 'gpt-5' | 'gpt-5-2025-08-07' | 'gpt-5-mini' | 'gpt-5-mini-2025-08-07' | 'gpt-5-nano' | 'gpt-5-nano-2025-08-07' | 'gpt-5-chat-latest' | (string & {});
declare const openaiChatLanguageModelOptions: _ai_sdk_provider_utils.LazyValidator<{
    logitBias?: Record<number, number> | undefined;
    logprobs?: number | boolean | undefined;
    parallelToolCalls?: boolean | undefined;
    user?: string | undefined;
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | undefined;
    maxCompletionTokens?: number | undefined;
    store?: boolean | undefined;
    metadata?: Record<string, string> | undefined;
    prediction?: Record<string, any> | undefined;
    structuredOutputs?: boolean | undefined;
    serviceTier?: "default" | "auto" | "flex" | "priority" | undefined;
    strictJsonSchema?: boolean | undefined;
    textVerbosity?: "low" | "medium" | "high" | undefined;
    promptCacheKey?: string | undefined;
    safetyIdentifier?: string | undefined;
}>;
type OpenAIChatLanguageModelOptions = InferValidator<typeof openaiChatLanguageModelOptions>;

type OpenAIChatConfig = {
    provider: string;
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
};
declare class OpenAIChatLanguageModel implements LanguageModelV2 {
    readonly specificationVersion = "v2";
    readonly modelId: OpenAIChatModelId;
    readonly supportedUrls: {
        'image/*': RegExp[];
    };
    private readonly config;
    constructor(modelId: OpenAIChatModelId, config: OpenAIChatConfig);
    get provider(): string;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV2['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
}

type OpenAICompletionModelId = 'gpt-3.5-turbo-instruct' | (string & {});
declare const openaiCompletionProviderOptions: _ai_sdk_provider_utils.LazyValidator<{
    echo?: boolean | undefined;
    logitBias?: Record<string, number> | undefined;
    suffix?: string | undefined;
    user?: string | undefined;
    logprobs?: number | boolean | undefined;
}>;
type OpenAICompletionProviderOptions = InferValidator<typeof openaiCompletionProviderOptions>;

type OpenAICompletionConfig = {
    provider: string;
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
};
declare class OpenAICompletionLanguageModel implements LanguageModelV2 {
    readonly specificationVersion = "v2";
    readonly modelId: OpenAICompletionModelId;
    private readonly config;
    private get providerOptionsName();
    constructor(modelId: OpenAICompletionModelId, config: OpenAICompletionConfig);
    get provider(): string;
    readonly supportedUrls: Record<string, RegExp[]>;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV2['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
}

type OpenAIConfig = {
    provider: string;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    headers: () => Record<string, string | undefined>;
    fetch?: FetchFunction;
    generateId?: () => string;
    /**
     * File ID prefixes used to identify file IDs in Responses API.
     * When undefined, all file data is treated as base64 content.
     *
     * Examples:
     * - OpenAI: ['file-'] for IDs like 'file-abc123'
     * - Azure OpenAI: ['assistant-'] for IDs like 'assistant-abc123'
     */
    fileIdPrefixes?: readonly string[];
};

type OpenAIEmbeddingModelId = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002' | (string & {});
declare const openaiEmbeddingProviderOptions: _ai_sdk_provider_utils.LazyValidator<{
    dimensions?: number | undefined;
    user?: string | undefined;
}>;
type OpenAIEmbeddingProviderOptions = InferValidator<typeof openaiEmbeddingProviderOptions>;

declare class OpenAIEmbeddingModel implements EmbeddingModelV2<string> {
    readonly specificationVersion = "v2";
    readonly modelId: OpenAIEmbeddingModelId;
    readonly maxEmbeddingsPerCall = 2048;
    readonly supportsParallelCalls = true;
    private readonly config;
    get provider(): string;
    constructor(modelId: OpenAIEmbeddingModelId, config: OpenAIConfig);
    doEmbed({ values, headers, abortSignal, providerOptions, }: Parameters<EmbeddingModelV2<string>['doEmbed']>[0]): Promise<Awaited<ReturnType<EmbeddingModelV2<string>['doEmbed']>>>;
}

type OpenAIImageModelId = 'dall-e-3' | 'dall-e-2' | 'gpt-image-1' | 'gpt-image-1-mini' | (string & {});
declare const modelMaxImagesPerCall: Record<OpenAIImageModelId, number>;
declare const hasDefaultResponseFormat: Set<string>;

interface OpenAIImageModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAIImageModel implements ImageModelV2 {
    readonly modelId: OpenAIImageModelId;
    private readonly config;
    readonly specificationVersion = "v2";
    get maxImagesPerCall(): number;
    get provider(): string;
    constructor(modelId: OpenAIImageModelId, config: OpenAIImageModelConfig);
    doGenerate({ prompt, n, size, aspectRatio, seed, providerOptions, headers, abortSignal, }: Parameters<ImageModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<ImageModelV2['doGenerate']>>>;
}

type OpenAITranscriptionModelId = 'whisper-1' | 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe' | (string & {});
declare const openAITranscriptionProviderOptions: _ai_sdk_provider_utils.LazyValidator<{
    include?: string[] | undefined;
    language?: string | undefined;
    prompt?: string | undefined;
    temperature?: number | undefined;
    timestampGranularities?: ("word" | "segment")[] | undefined;
}>;
type OpenAITranscriptionProviderOptions = InferValidator<typeof openAITranscriptionProviderOptions>;

type OpenAITranscriptionCallOptions = Omit<TranscriptionModelV2CallOptions, 'providerOptions'> & {
    providerOptions?: {
        openai?: OpenAITranscriptionProviderOptions;
    };
};
interface OpenAITranscriptionModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAITranscriptionModel implements TranscriptionModelV2 {
    readonly modelId: OpenAITranscriptionModelId;
    private readonly config;
    readonly specificationVersion = "v2";
    get provider(): string;
    constructor(modelId: OpenAITranscriptionModelId, config: OpenAITranscriptionModelConfig);
    private getArgs;
    doGenerate(options: OpenAITranscriptionCallOptions): Promise<Awaited<ReturnType<TranscriptionModelV2['doGenerate']>>>;
}

type OpenAISpeechModelId = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts' | (string & {});
declare const openaiSpeechProviderOptionsSchema: _ai_sdk_provider_utils.LazyValidator<{
    instructions?: string | null | undefined;
    speed?: number | null | undefined;
}>;
type OpenAISpeechCallOptions = InferValidator<typeof openaiSpeechProviderOptionsSchema>;

interface OpenAISpeechModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAISpeechModel implements SpeechModelV2 {
    readonly modelId: OpenAISpeechModelId;
    private readonly config;
    readonly specificationVersion = "v2";
    get provider(): string;
    constructor(modelId: OpenAISpeechModelId, config: OpenAISpeechModelConfig);
    private getArgs;
    doGenerate(options: Parameters<SpeechModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<SpeechModelV2['doGenerate']>>>;
}

type OpenAIResponsesModelId = 'chatgpt-4o-latest' | 'gpt-3.5-turbo-0125' | 'gpt-3.5-turbo-1106' | 'gpt-3.5-turbo' | 'gpt-4-0613' | 'gpt-4-turbo-2024-04-09' | 'gpt-4-turbo' | 'gpt-4.1-2025-04-14' | 'gpt-4.1-mini-2025-04-14' | 'gpt-4.1-mini' | 'gpt-4.1-nano-2025-04-14' | 'gpt-4.1-nano' | 'gpt-4.1' | 'gpt-4' | 'gpt-4o-2024-05-13' | 'gpt-4o-2024-08-06' | 'gpt-4o-2024-11-20' | 'gpt-4o-mini-2024-07-18' | 'gpt-4o-mini' | 'gpt-4o' | 'gpt-5-2025-08-07' | 'gpt-5-chat-latest' | 'gpt-5-codex' | 'gpt-5-mini-2025-08-07' | 'gpt-5-mini' | 'gpt-5-nano-2025-08-07' | 'gpt-5-nano' | 'gpt-5-pro-2025-10-06' | 'gpt-5-pro' | 'gpt-5' | 'o1-2024-12-17' | 'o1' | 'o3-2025-04-16' | 'o3-mini-2025-01-31' | 'o3-mini' | 'o3' | (string & {});

declare class OpenAIResponsesLanguageModel implements LanguageModelV2 {
    readonly specificationVersion = "v2";
    readonly modelId: OpenAIResponsesModelId;
    private readonly config;
    constructor(modelId: OpenAIResponsesModelId, config: OpenAIConfig);
    readonly supportedUrls: Record<string, RegExp[]>;
    get provider(): string;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV2['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
}

declare const codeInterpreterInputSchema: _ai_sdk_provider_utils.LazySchema<{
    containerId: string;
    code?: string | null | undefined;
}>;
declare const codeInterpreterOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    outputs?: ({
        type: "logs";
        logs: string;
    } | {
        type: "image";
        url: string;
    })[] | null | undefined;
}>;
declare const codeInterpreterArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    container?: string | {
        fileIds?: string[] | undefined;
    } | undefined;
}>;
type CodeInterpreterArgs = {
    /**
     * The code interpreter container.
     * Can be a container ID
     * or an object that specifies uploaded file IDs to make available to your code.
     */
    container?: string | {
        fileIds?: string[];
    };
};
declare const codeInterpreterToolFactory: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
    /**
     * The code to run, or null if not available.
     */
    code?: string | null;
    /**
     * The ID of the container used to run the code.
     */
    containerId: string;
}, {
    /**
     * The outputs generated by the code interpreter, such as logs or images.
     * Can be null if no outputs are available.
     */
    outputs?: Array<{
        type: "logs";
        /**
         * The logs output from the code interpreter.
         */
        logs: string;
    } | {
        type: "image";
        /**
         * The URL of the image output from the code interpreter.
         */
        url: string;
    }> | null;
}, CodeInterpreterArgs>;
declare const codeInterpreter: (args?: CodeInterpreterArgs) => _ai_sdk_provider_utils.Tool<{
    /**
     * The code to run, or null if not available.
     */
    code?: string | null;
    /**
     * The ID of the container used to run the code.
     */
    containerId: string;
}, {
    /**
     * The outputs generated by the code interpreter, such as logs or images.
     * Can be null if no outputs are available.
     */
    outputs?: Array<{
        type: "logs";
        /**
         * The logs output from the code interpreter.
         */
        logs: string;
    } | {
        type: "image";
        /**
         * The URL of the image output from the code interpreter.
         */
        url: string;
    }> | null;
}>;

/**
 * A filter used to compare a specified attribute key to a given value using a defined comparison operation.
 */
type OpenAIResponsesFileSearchToolComparisonFilter = {
    /**
     * The key to compare against the value.
     */
    key: string;
    /**
     * Specifies the comparison operator: eq, ne, gt, gte, lt, lte.
     */
    type: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
    /**
     * The value to compare against the attribute key; supports string, number, or boolean types.
     */
    value: string | number | boolean;
};
/**
 * Combine multiple filters using and or or.
 */
type OpenAIResponsesFileSearchToolCompoundFilter = {
    /**
     * Type of operation: and or or.
     */
    type: 'and' | 'or';
    /**
     * Array of filters to combine. Items can be ComparisonFilter or CompoundFilter.
     */
    filters: Array<OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter>;
};

declare const fileSearchArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    vectorStoreIds: string[];
    maxNumResults?: number | undefined;
    ranking?: {
        ranker?: string | undefined;
        scoreThreshold?: number | undefined;
    } | undefined;
    filters?: any;
}>;
declare const fileSearchOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    queries: string[];
    results: {
        attributes: Record<string, unknown>;
        fileId: string;
        filename: string;
        score: number;
        text: string;
    }[] | null;
}>;
declare const fileSearch: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{}, {
    /**
     * The search query to execute.
     */
    queries: string[];
    /**
     * The results of the file search tool call.
     */
    results: null | {
        /**
         * Set of 16 key-value pairs that can be attached to an object.
         * This can be useful for storing additional information about the object
         * in a structured format, and querying for objects via API or the dashboard.
         * Keys are strings with a maximum length of 64 characters.
         * Values are strings with a maximum length of 512 characters, booleans, or numbers.
         */
        attributes: Record<string, unknown>;
        /**
         * The unique ID of the file.
         */
        fileId: string;
        /**
         * The name of the file.
         */
        filename: string;
        /**
         * The relevance score of the file - a value between 0 and 1.
         */
        score: number;
        /**
         * The text that was retrieved from the file.
         */
        text: string;
    }[];
}, {
    /**
     * List of vector store IDs to search through.
     */
    vectorStoreIds: string[];
    /**
     * Maximum number of search results to return. Defaults to 10.
     */
    maxNumResults?: number;
    /**
     * Ranking options for the search.
     */
    ranking?: {
        /**
         * The ranker to use for the file search.
         */
        ranker?: string;
        /**
         * The score threshold for the file search, a number between 0 and 1.
         * Numbers closer to 1 will attempt to return only the most relevant results,
         * but may return fewer results.
         */
        scoreThreshold?: number;
    };
    /**
     * A filter to apply.
     */
    filters?: OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter;
}>;

declare const imageGenerationArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    background?: "auto" | "opaque" | "transparent" | undefined;
    inputFidelity?: "low" | "high" | undefined;
    inputImageMask?: {
        fileId?: string | undefined;
        imageUrl?: string | undefined;
    } | undefined;
    model?: string | undefined;
    moderation?: "auto" | undefined;
    outputCompression?: number | undefined;
    outputFormat?: "png" | "jpeg" | "webp" | undefined;
    partialImages?: number | undefined;
    quality?: "auto" | "low" | "medium" | "high" | undefined;
    size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024" | undefined;
}>;
declare const imageGenerationOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    result: string;
}>;
type ImageGenerationArgs = {
    /**
     * Background type for the generated image. Default is 'auto'.
     */
    background?: 'auto' | 'opaque' | 'transparent';
    /**
     * Input fidelity for the generated image. Default is 'low'.
     */
    inputFidelity?: 'low' | 'high';
    /**
     * Optional mask for inpainting.
     * Contains image_url (string, optional) and file_id (string, optional).
     */
    inputImageMask?: {
        /**
         * File ID for the mask image.
         */
        fileId?: string;
        /**
         * Base64-encoded mask image.
         */
        imageUrl?: string;
    };
    /**
     * The image generation model to use. Default: gpt-image-1.
     */
    model?: string;
    /**
     * Moderation level for the generated image. Default: auto.
     */
    moderation?: 'auto';
    /**
     * Compression level for the output image. Default: 100.
     */
    outputCompression?: number;
    /**
     * The output format of the generated image. One of png, webp, or jpeg.
     * Default: png
     */
    outputFormat?: 'png' | 'jpeg' | 'webp';
    /**
     * The quality of the generated image.
     * One of low, medium, high, or auto. Default: auto.
     */
    quality?: 'auto' | 'low' | 'medium' | 'high';
    /**
     * The size of the generated image.
     * One of 1024x1024, 1024x1536, 1536x1024, or auto.
     * Default: auto.
     */
    size?: 'auto' | '1024x1024' | '1024x1536' | '1536x1024';
};
declare const imageGeneration: (args?: ImageGenerationArgs) => _ai_sdk_provider_utils.Tool<{}, {
    /**
     * The generated image encoded in base64.
     */
    result: string;
}>;

export { OpenAIChatLanguageModel, type OpenAIChatLanguageModelOptions, type OpenAIChatModelId, OpenAICompletionLanguageModel, type OpenAICompletionModelId, type OpenAICompletionProviderOptions, OpenAIEmbeddingModel, type OpenAIEmbeddingModelId, type OpenAIEmbeddingProviderOptions, OpenAIImageModel, type OpenAIImageModelId, OpenAIResponsesLanguageModel, type OpenAISpeechCallOptions, OpenAISpeechModel, type OpenAISpeechModelId, type OpenAITranscriptionCallOptions, OpenAITranscriptionModel, type OpenAITranscriptionModelId, type OpenAITranscriptionProviderOptions, codeInterpreter, codeInterpreterArgsSchema, codeInterpreterInputSchema, codeInterpreterOutputSchema, codeInterpreterToolFactory, fileSearch, fileSearchArgsSchema, fileSearchOutputSchema, hasDefaultResponseFormat, imageGeneration, imageGenerationArgsSchema, imageGenerationOutputSchema, modelMaxImagesPerCall, openAITranscriptionProviderOptions, openaiChatLanguageModelOptions, openaiCompletionProviderOptions, openaiEmbeddingProviderOptions, openaiSpeechProviderOptionsSchema };
