import { ProviderV2, LanguageModelV2, EmbeddingModelV2, ImageModelV2, TranscriptionModelV2, SpeechModelV2 } from '@ai-sdk/provider';
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

type OpenAICompletionModelId = 'gpt-3.5-turbo-instruct' | (string & {});

type OpenAIEmbeddingModelId = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002' | (string & {});

type OpenAIImageModelId = 'gpt-image-1' | 'dall-e-3' | 'dall-e-2' | (string & {});

declare const webSearchToolFactory: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {
    /**
     * Filters for the search.
     */
    filters?: {
        /**
         * Allowed domains for the search.
         * If not provided, all domains are allowed.
         * Subdomains of the provided domains are allowed as well.
         */
        allowedDomains?: string[];
    };
    /**
     * Search context size to use for the web search.
     * - high: Most comprehensive context, highest cost, slower response
     * - medium: Balanced context, cost, and latency (default)
     * - low: Least context, lowest cost, fastest response
     */
    searchContextSize?: "low" | "medium" | "high";
    /**
     * User location information to provide geographically relevant search results.
     */
    userLocation?: {
        /**
         * Type of location (always 'approximate')
         */
        type: "approximate";
        /**
         * Two-letter ISO country code (e.g., 'US', 'GB')
         */
        country?: string;
        /**
         * City name (free text, e.g., 'Minneapolis')
         */
        city?: string;
        /**
         * Region name (free text, e.g., 'Minnesota')
         */
        region?: string;
        /**
         * IANA timezone (e.g., 'America/Chicago')
         */
        timezone?: string;
    };
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

declare const openaiTools: {
    /**
     * The Code Interpreter tool allows models to write and run Python code in a
     * sandboxed environment to solve complex problems in domains like data analysis,
     * coding, and math.
     *
     * @param container - The container to use for the code interpreter.
     *
     * Must have name `code_interpreter`.
     */
    codeInterpreter: (args?: {
        container?: string | {
            fileIds?: string[];
        };
    }) => _ai_sdk_provider_utils.Tool<{
        code?: string | null;
        containerId: string;
    }, {
        outputs?: Array<{
            type: "logs";
            logs: string;
        } | {
            type: "image";
            url: string;
        }> | null;
    }>;
    /**
     * File search is a tool available in the Responses API. It enables models to
     * retrieve information in a knowledge base of previously uploaded files through
     * semantic and keyword search.
     *
     * Must have name `file_search`.
     *
     * @param vectorStoreIds - The vector store IDs to use for the file search.
     * @param maxNumResults - The maximum number of results to return.
     * @param ranking - The ranking options to use for the file search.
     * @param filters - The filters to use for the file search.
     */
    fileSearch: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{}, {
        queries: string[];
        results: null | {
            attributes: Record<string, unknown>;
            fileId: string;
            filename: string;
            score: number;
            text: string;
        }[];
    }, {
        vectorStoreIds: string[];
        maxNumResults?: number;
        ranking?: {
            ranker?: string;
            scoreThreshold?: number;
        };
        filters?: OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter;
    }>;
    /**
     * The image generation tool allows you to generate images using a text prompt,
     * and optionally image inputs. It leverages the GPT Image model,
     * and automatically optimizes text inputs for improved performance.
     *
     * Must have name `image_generation`.
     *
     * @param size - Image dimensions (e.g., 1024x1024, 1024x1536)
     * @param quality - Rendering quality (e.g. low, medium, high)
     * @param format - File output format
     * @param compression - Compression level (0-100%) for JPEG and WebP formats
     * @param background - Transparent or opaque
     */
    imageGeneration: (args?: {
        background?: "auto" | "opaque" | "transparent";
        inputFidelity?: "low" | "high";
        inputImageMask?: {
            fileId?: string;
            imageUrl?: string;
        };
        model?: string;
        moderation?: "auto";
        outputCompression?: number;
        outputFormat?: "png" | "jpeg" | "webp";
        quality?: "auto" | "low" | "medium" | "high";
        size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
    }) => _ai_sdk_provider_utils.Tool<{}, {
        result: string;
    }>;
    /**
     * Local shell is a tool that allows agents to run shell commands locally
     * on a machine you or the user provides.
     *
     * Supported models: `gpt-5-codex` and `codex-mini-latest`
     *
     * Must have name `local_shell`.
     */
    localShell: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        action: {
            type: "exec";
            command: string[];
            timeoutMs?: number;
            user?: string;
            workingDirectory?: string;
            env?: Record<string, string>;
        };
    }, {
        output: string;
    }, {}>;
    /**
     * Web search allows models to access up-to-date information from the internet
     * and provide answers with sourced citations.
     *
     * Must have name `web_search_preview`.
     *
     * @param searchContextSize - The search context size to use for the web search.
     * @param userLocation - The user location to use for the web search.
     *
     * @deprecated Use `webSearch` instead.
     */
    webSearchPreview: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {
        searchContextSize?: "low" | "medium" | "high";
        userLocation?: {
            type: "approximate";
            country?: string;
            city?: string;
            region?: string;
            timezone?: string;
        };
    }>;
    /**
     * Web search allows models to access up-to-date information from the internet
     * and provide answers with sourced citations.
     *
     * Must have name `web_search`.
     *
     * @param filters - The filters to use for the web search.
     * @param searchContextSize - The search context size to use for the web search.
     * @param userLocation - The user location to use for the web search.
     */
    webSearch: (args?: Parameters<typeof webSearchToolFactory>[0]) => _ai_sdk_provider_utils.Tool<{}, unknown>;
};

type OpenAIResponsesModelId = 'o1' | 'o1-2024-12-17' | 'o3-mini' | 'o3-mini-2025-01-31' | 'o3' | 'o3-2025-04-16' | 'gpt-5' | 'gpt-5-2025-08-07' | 'gpt-5-mini' | 'gpt-5-mini-2025-08-07' | 'gpt-5-nano' | 'gpt-5-nano-2025-08-07' | 'gpt-5-chat-latest' | 'gpt-5-codex' | 'gpt-4.1' | 'gpt-4.1-2025-04-14' | 'gpt-4.1-mini' | 'gpt-4.1-mini-2025-04-14' | 'gpt-4.1-nano' | 'gpt-4.1-nano-2025-04-14' | 'gpt-4o' | 'gpt-4o-2024-05-13' | 'gpt-4o-2024-08-06' | 'gpt-4o-2024-11-20' | 'gpt-4o-mini' | 'gpt-4o-mini-2024-07-18' | 'gpt-4-turbo' | 'gpt-4-turbo-2024-04-09' | 'gpt-4' | 'gpt-4-0613' | 'gpt-3.5-turbo-0125' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-1106' | 'chatgpt-4o-latest' | (string & {});

type OpenAISpeechModelId = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts' | (string & {});

type OpenAITranscriptionModelId = 'whisper-1' | 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe' | (string & {});

interface OpenAIProvider extends ProviderV2 {
    (modelId: OpenAIResponsesModelId): LanguageModelV2;
    /**
  Creates an OpenAI model for text generation.
     */
    languageModel(modelId: OpenAIResponsesModelId): LanguageModelV2;
    /**
  Creates an OpenAI chat model for text generation.
     */
    chat(modelId: OpenAIChatModelId): LanguageModelV2;
    /**
  Creates an OpenAI responses API model for text generation.
     */
    responses(modelId: OpenAIResponsesModelId): LanguageModelV2;
    /**
  Creates an OpenAI completion model for text generation.
     */
    completion(modelId: OpenAICompletionModelId): LanguageModelV2;
    /**
  Creates a model for text embeddings.
     */
    embedding(modelId: OpenAIEmbeddingModelId): EmbeddingModelV2<string>;
    /**
  Creates a model for text embeddings.
     */
    textEmbedding(modelId: OpenAIEmbeddingModelId): EmbeddingModelV2<string>;
    /**
  Creates a model for text embeddings.
     */
    textEmbeddingModel(modelId: OpenAIEmbeddingModelId): EmbeddingModelV2<string>;
    /**
  Creates a model for image generation.
     */
    image(modelId: OpenAIImageModelId): ImageModelV2;
    /**
  Creates a model for image generation.
     */
    imageModel(modelId: OpenAIImageModelId): ImageModelV2;
    /**
  Creates a model for transcription.
     */
    transcription(modelId: OpenAITranscriptionModelId): TranscriptionModelV2;
    /**
  Creates a model for speech generation.
     */
    speech(modelId: OpenAISpeechModelId): SpeechModelV2;
    /**
  OpenAI-specific tools.
     */
    tools: typeof openaiTools;
}
interface OpenAIProviderSettings {
    /**
  Base URL for the OpenAI API calls.
       */
    baseURL?: string;
    /**
  API key for authenticating requests.
       */
    apiKey?: string;
    /**
  OpenAI Organization.
       */
    organization?: string;
    /**
  OpenAI project.
       */
    project?: string;
    /**
  Custom headers to include in the requests.
       */
    headers?: Record<string, string>;
    /**
  Provider name. Overrides the `openai` default name for 3rd party providers.
     */
    name?: string;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
}
/**
Create an OpenAI provider instance.
 */
declare function createOpenAI(options?: OpenAIProviderSettings): OpenAIProvider;
/**
Default OpenAI provider instance.
 */
declare const openai: OpenAIProvider;

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

declare const VERSION: string;

export { type OpenAIChatLanguageModelOptions, type OpenAIProvider, type OpenAIProviderSettings, type OpenAIResponsesProviderOptions, VERSION, createOpenAI, openai };
