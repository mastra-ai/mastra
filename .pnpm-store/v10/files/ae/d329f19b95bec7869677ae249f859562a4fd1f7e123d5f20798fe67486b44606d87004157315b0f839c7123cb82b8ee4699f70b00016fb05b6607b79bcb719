import { LanguageModelV2, EmbeddingModelV2, ImageModelV2, TranscriptionModelV2CallOptions, TranscriptionModelV2, SpeechModelV2 } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

type OpenAIChatModelId = 'o1' | 'o1-2024-12-17' | 'o3-mini' | 'o3-mini-2025-01-31' | 'o3' | 'o3-2025-04-16' | 'gpt-4.1' | 'gpt-4.1-2025-04-14' | 'gpt-4.1-mini' | 'gpt-4.1-mini-2025-04-14' | 'gpt-4.1-nano' | 'gpt-4.1-nano-2025-04-14' | 'gpt-4o' | 'gpt-4o-2024-05-13' | 'gpt-4o-2024-08-06' | 'gpt-4o-2024-11-20' | 'gpt-4o-mini' | 'gpt-4o-mini-2024-07-18' | 'gpt-4-turbo' | 'gpt-4-turbo-2024-04-09' | 'gpt-4' | 'gpt-4-0613' | 'gpt-4.5-preview' | 'gpt-4.5-preview-2025-02-27' | 'gpt-3.5-turbo-0125' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-1106' | 'chatgpt-4o-latest' | 'gpt-5' | 'gpt-5-2025-08-07' | 'gpt-5-mini' | 'gpt-5-mini-2025-08-07' | 'gpt-5-nano' | 'gpt-5-nano-2025-08-07' | 'gpt-5-chat-latest' | (string & {});
declare const openaiChatLanguageModelOptions: z.ZodObject<{
    logitBias: z.ZodOptional<z.ZodRecord<z.ZodCoercedNumber<string>, z.ZodNumber>>;
    logprobs: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodNumber]>>;
    parallelToolCalls: z.ZodOptional<z.ZodBoolean>;
    user: z.ZodOptional<z.ZodString>;
    reasoningEffort: z.ZodOptional<z.ZodEnum<{
        minimal: "minimal";
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    maxCompletionTokens: z.ZodOptional<z.ZodNumber>;
    store: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    prediction: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    structuredOutputs: z.ZodOptional<z.ZodBoolean>;
    serviceTier: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        flex: "flex";
        priority: "priority";
    }>>;
    strictJsonSchema: z.ZodOptional<z.ZodBoolean>;
    textVerbosity: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    promptCacheKey: z.ZodOptional<z.ZodString>;
    safetyIdentifier: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type OpenAIChatLanguageModelOptions = z.infer<typeof openaiChatLanguageModelOptions>;

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
declare const openaiCompletionProviderOptions: z.ZodObject<{
    echo: z.ZodOptional<z.ZodBoolean>;
    logitBias: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    suffix: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodString>;
    logprobs: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodNumber]>>;
}, z.core.$strip>;
type OpenAICompletionProviderOptions = z.infer<typeof openaiCompletionProviderOptions>;

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
declare const openaiEmbeddingProviderOptions: z.ZodObject<{
    dimensions: z.ZodOptional<z.ZodNumber>;
    user: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type OpenAIEmbeddingProviderOptions = z.infer<typeof openaiEmbeddingProviderOptions>;

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

type OpenAIImageModelId = 'gpt-image-1' | 'dall-e-3' | 'dall-e-2' | (string & {});
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
declare const openAITranscriptionProviderOptions: z.ZodObject<{
    include: z.ZodOptional<z.ZodArray<z.ZodString>>;
    language: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    temperature: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    timestampGranularities: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<{
        word: "word";
        segment: "segment";
    }>>>>;
}, z.core.$strip>;
type OpenAITranscriptionProviderOptions = z.infer<typeof openAITranscriptionProviderOptions>;

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

declare const OpenAIProviderOptionsSchema: z.ZodObject<{
    instructions: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    speed: z.ZodOptional<z.ZodNullable<z.ZodDefault<z.ZodNumber>>>;
}, z.core.$strip>;
type OpenAISpeechCallOptions = z.infer<typeof OpenAIProviderOptionsSchema>;
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

type OpenAIResponsesModelId = 'o1' | 'o1-2024-12-17' | 'o3-mini' | 'o3-mini-2025-01-31' | 'o3' | 'o3-2025-04-16' | 'gpt-5' | 'gpt-5-2025-08-07' | 'gpt-5-mini' | 'gpt-5-mini-2025-08-07' | 'gpt-5-nano' | 'gpt-5-nano-2025-08-07' | 'gpt-5-chat-latest' | 'gpt-5-codex' | 'gpt-4.1' | 'gpt-4.1-2025-04-14' | 'gpt-4.1-mini' | 'gpt-4.1-mini-2025-04-14' | 'gpt-4.1-nano' | 'gpt-4.1-nano-2025-04-14' | 'gpt-4o' | 'gpt-4o-2024-05-13' | 'gpt-4o-2024-08-06' | 'gpt-4o-2024-11-20' | 'gpt-4o-mini' | 'gpt-4o-mini-2024-07-18' | 'gpt-4-turbo' | 'gpt-4-turbo-2024-04-09' | 'gpt-4' | 'gpt-4-0613' | 'gpt-3.5-turbo-0125' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-1106' | 'chatgpt-4o-latest' | (string & {});

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
declare const openaiResponsesProviderOptionsSchema: z.ZodObject<{
    include: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodEnum<{
        "file_search_call.results": "file_search_call.results";
        "message.output_text.logprobs": "message.output_text.logprobs";
        "reasoning.encrypted_content": "reasoning.encrypted_content";
    }>>>>;
    instructions: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    logprobs: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodNumber]>>;
    maxToolCalls: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    parallelToolCalls: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    previousResponseId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    promptCacheKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reasoningEffort: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reasoningSummary: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    safetyIdentifier: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceTier: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        auto: "auto";
        flex: "flex";
        priority: "priority";
    }>>>;
    store: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    strictJsonSchema: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    textVerbosity: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>>;
    user: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
type OpenAIResponsesProviderOptions = z.infer<typeof openaiResponsesProviderOptionsSchema>;

declare const codeInterpreterInputSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    containerId: z.ZodString;
}, z.core.$strip>;
declare const codeInterpreterOutputSchema: z.ZodObject<{
    outputs: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"logs">;
        logs: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        url: z.ZodString;
    }, z.core.$strip>]>>>>;
}, z.core.$strip>;
declare const codeInterpreterArgsSchema: z.ZodObject<{
    container: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        fileIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
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

declare const fileSearchArgsSchema: z.ZodObject<{
    vectorStoreIds: z.ZodArray<z.ZodString>;
    maxNumResults: z.ZodOptional<z.ZodNumber>;
    ranking: z.ZodOptional<z.ZodObject<{
        ranker: z.ZodOptional<z.ZodString>;
        scoreThreshold: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    filters: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        key: z.ZodString;
        type: z.ZodEnum<{
            lt: "lt";
            ne: "ne";
            eq: "eq";
            gt: "gt";
            gte: "gte";
            lte: "lte";
        }>;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
    }, z.core.$strip>, z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>]>>;
}, z.core.$strip>;
declare const fileSearchOutputSchema: z.ZodObject<{
    queries: z.ZodArray<z.ZodString>;
    results: z.ZodNullable<z.ZodArray<z.ZodObject<{
        attributes: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        fileId: z.ZodString;
        filename: z.ZodString;
        score: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
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

declare const imageGenerationArgsSchema: z.ZodObject<{
    background: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        opaque: "opaque";
        transparent: "transparent";
    }>>;
    inputFidelity: z.ZodOptional<z.ZodEnum<{
        low: "low";
        high: "high";
    }>>;
    inputImageMask: z.ZodOptional<z.ZodObject<{
        fileId: z.ZodOptional<z.ZodString>;
        imageUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    model: z.ZodOptional<z.ZodString>;
    moderation: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
    }>>;
    outputCompression: z.ZodOptional<z.ZodNumber>;
    outputFormat: z.ZodOptional<z.ZodEnum<{
        png: "png";
        jpeg: "jpeg";
        webp: "webp";
    }>>;
    quality: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        auto: "auto";
    }>>;
    size: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        "1024x1024": "1024x1024";
        "1024x1536": "1024x1536";
        "1536x1024": "1536x1024";
    }>>;
}, z.core.$strict>;
declare const imageGenerationOutputSchema: z.ZodObject<{
    result: z.ZodString;
}, z.core.$strip>;
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

export { OpenAIChatLanguageModel, type OpenAIChatLanguageModelOptions, type OpenAIChatModelId, OpenAICompletionLanguageModel, type OpenAICompletionModelId, type OpenAICompletionProviderOptions, OpenAIEmbeddingModel, type OpenAIEmbeddingModelId, type OpenAIEmbeddingProviderOptions, OpenAIImageModel, type OpenAIImageModelId, OpenAIResponsesLanguageModel, type OpenAIResponsesProviderOptions, type OpenAISpeechCallOptions, OpenAISpeechModel, type OpenAISpeechModelId, type OpenAITranscriptionCallOptions, OpenAITranscriptionModel, type OpenAITranscriptionModelId, type OpenAITranscriptionProviderOptions, codeInterpreter, codeInterpreterArgsSchema, codeInterpreterInputSchema, codeInterpreterOutputSchema, codeInterpreterToolFactory, fileSearch, fileSearchArgsSchema, fileSearchOutputSchema, hasDefaultResponseFormat, imageGeneration, imageGenerationArgsSchema, imageGenerationOutputSchema, modelMaxImagesPerCall, openAITranscriptionProviderOptions, openaiChatLanguageModelOptions, openaiCompletionProviderOptions, openaiEmbeddingProviderOptions };
