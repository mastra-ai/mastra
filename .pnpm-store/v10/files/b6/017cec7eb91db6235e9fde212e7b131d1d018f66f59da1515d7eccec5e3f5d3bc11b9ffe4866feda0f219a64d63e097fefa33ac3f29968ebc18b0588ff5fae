import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { InferValidator, FetchFunction } from '@ai-sdk/provider-utils';
import { ProviderV2, LanguageModelV2, ImageModelV2, EmbeddingModelV2 } from '@ai-sdk/provider';

declare const googleErrorDataSchema: _ai_sdk_provider_utils.LazySchema<{
    error: {
        code: number | null;
        message: string;
        status: string;
    };
}>;
type GoogleErrorData = InferValidator<typeof googleErrorDataSchema>;

type GoogleGenerativeAIModelId = 'gemini-1.5-flash' | 'gemini-1.5-flash-latest' | 'gemini-1.5-flash-001' | 'gemini-1.5-flash-002' | 'gemini-1.5-flash-8b' | 'gemini-1.5-flash-8b-latest' | 'gemini-1.5-flash-8b-001' | 'gemini-1.5-pro' | 'gemini-1.5-pro-latest' | 'gemini-1.5-pro-001' | 'gemini-1.5-pro-002' | 'gemini-2.0-flash' | 'gemini-2.0-flash-001' | 'gemini-2.0-flash-live-001' | 'gemini-2.0-flash-lite' | 'gemini-2.0-pro-exp-02-05' | 'gemini-2.0-flash-thinking-exp-01-21' | 'gemini-2.0-flash-exp' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-image-preview' | 'gemini-2.5-flash-lite' | 'gemini-2.5-flash-lite-preview-09-2025' | 'gemini-2.5-flash-preview-04-17' | 'gemini-2.5-flash-preview-09-2025' | 'gemini-3-pro-preview' | 'gemini-pro-latest' | 'gemini-flash-latest' | 'gemini-flash-lite-latest' | 'gemini-2.5-pro-exp-03-25' | 'gemini-exp-1206' | 'gemma-3-12b-it' | 'gemma-3-27b-it' | (string & {});
declare const googleGenerativeAIProviderOptions: _ai_sdk_provider_utils.LazySchema<{
    responseModalities?: ("TEXT" | "IMAGE")[] | undefined;
    thinkingConfig?: {
        thinkingBudget?: number | undefined;
        includeThoughts?: boolean | undefined;
        thinkingLevel?: "low" | "medium" | "high" | undefined;
    } | undefined;
    cachedContent?: string | undefined;
    structuredOutputs?: boolean | undefined;
    safetySettings?: {
        category: "HARM_CATEGORY_UNSPECIFIED" | "HARM_CATEGORY_HATE_SPEECH" | "HARM_CATEGORY_DANGEROUS_CONTENT" | "HARM_CATEGORY_HARASSMENT" | "HARM_CATEGORY_SEXUALLY_EXPLICIT" | "HARM_CATEGORY_CIVIC_INTEGRITY";
        threshold: "HARM_BLOCK_THRESHOLD_UNSPECIFIED" | "BLOCK_LOW_AND_ABOVE" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_ONLY_HIGH" | "BLOCK_NONE" | "OFF";
    }[] | undefined;
    threshold?: "HARM_BLOCK_THRESHOLD_UNSPECIFIED" | "BLOCK_LOW_AND_ABOVE" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_ONLY_HIGH" | "BLOCK_NONE" | "OFF" | undefined;
    audioTimestamp?: boolean | undefined;
    labels?: Record<string, string> | undefined;
    mediaResolution?: "MEDIA_RESOLUTION_UNSPECIFIED" | "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH" | undefined;
    imageConfig?: {
        aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | undefined;
        imageSize?: "1K" | "2K" | "4K" | undefined;
    } | undefined;
}>;
type GoogleGenerativeAIProviderOptions = InferValidator<typeof googleGenerativeAIProviderOptions>;

declare const responseSchema: _ai_sdk_provider_utils.LazySchema<{
    candidates: {
        content?: Record<string, never> | {
            parts?: ({
                functionCall: {
                    name: string;
                    args: unknown;
                };
                thoughtSignature?: string | null | undefined;
            } | {
                inlineData: {
                    mimeType: string;
                    data: string;
                };
            } | {
                executableCode?: {
                    language: string;
                    code: string;
                } | null | undefined;
                codeExecutionResult?: {
                    outcome: string;
                    output: string;
                } | null | undefined;
                text?: string | null | undefined;
                thought?: boolean | null | undefined;
                thoughtSignature?: string | null | undefined;
            })[] | null | undefined;
        } | null | undefined;
        finishReason?: string | null | undefined;
        safetyRatings?: {
            category?: string | null | undefined;
            probability?: string | null | undefined;
            probabilityScore?: number | null | undefined;
            severity?: string | null | undefined;
            severityScore?: number | null | undefined;
            blocked?: boolean | null | undefined;
        }[] | null | undefined;
        groundingMetadata?: {
            webSearchQueries?: string[] | null | undefined;
            retrievalQueries?: string[] | null | undefined;
            searchEntryPoint?: {
                renderedContent: string;
            } | null | undefined;
            groundingChunks?: {
                web?: {
                    uri: string;
                    title?: string | null | undefined;
                } | null | undefined;
                retrievedContext?: {
                    uri: string;
                    title?: string | null | undefined;
                    text?: string | null | undefined;
                } | null | undefined;
            }[] | null | undefined;
            groundingSupports?: {
                segment: {
                    startIndex?: number | null | undefined;
                    endIndex?: number | null | undefined;
                    text?: string | null | undefined;
                };
                segment_text?: string | null | undefined;
                groundingChunkIndices?: number[] | null | undefined;
                supportChunkIndices?: number[] | null | undefined;
                confidenceScores?: number[] | null | undefined;
                confidenceScore?: number[] | null | undefined;
            }[] | null | undefined;
            retrievalMetadata?: Record<string, never> | {
                webDynamicRetrievalScore: number;
            } | null | undefined;
        } | null | undefined;
        urlContextMetadata?: {
            urlMetadata: {
                retrievedUrl: string;
                urlRetrievalStatus: string;
            }[];
        } | null | undefined;
    }[];
    usageMetadata?: {
        cachedContentTokenCount?: number | null | undefined;
        thoughtsTokenCount?: number | null | undefined;
        promptTokenCount?: number | null | undefined;
        candidatesTokenCount?: number | null | undefined;
        totalTokenCount?: number | null | undefined;
        trafficType?: string | null | undefined;
    } | null | undefined;
    promptFeedback?: {
        blockReason?: string | null | undefined;
        safetyRatings?: {
            category?: string | null | undefined;
            probability?: string | null | undefined;
            probabilityScore?: number | null | undefined;
            severity?: string | null | undefined;
            severityScore?: number | null | undefined;
            blocked?: boolean | null | undefined;
        }[] | null | undefined;
    } | null | undefined;
}>;
type GroundingMetadataSchema = NonNullable<InferValidator<typeof responseSchema>['candidates'][number]['groundingMetadata']>;
type UrlContextMetadataSchema = NonNullable<InferValidator<typeof responseSchema>['candidates'][number]['urlContextMetadata']>;
type SafetyRatingSchema = NonNullable<InferValidator<typeof responseSchema>['candidates'][number]['safetyRatings']>[number];

type GoogleGenerativeAIGroundingMetadata = GroundingMetadataSchema;
type GoogleGenerativeAIUrlContextMetadata = UrlContextMetadataSchema;
type GoogleGenerativeAISafetyRating = SafetyRatingSchema;
interface GoogleGenerativeAIProviderMetadata {
    groundingMetadata: GoogleGenerativeAIGroundingMetadata | null;
    urlContextMetadata: GoogleGenerativeAIUrlContextMetadata | null;
    safetyRatings: GoogleGenerativeAISafetyRating[] | null;
}

type GoogleGenerativeAIImageModelId = 'imagen-3.0-generate-002' | (string & {});
interface GoogleGenerativeAIImageSettings {
    /**
  Override the maximum number of images per call (default 4)
     */
    maxImagesPerCall?: number;
}

declare const googleImageProviderOptionsSchema: _ai_sdk_provider_utils.LazySchema<{
    personGeneration?: "dont_allow" | "allow_adult" | "allow_all" | null | undefined;
    aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | null | undefined;
}>;
type GoogleGenerativeAIImageProviderOptions = InferValidator<typeof googleImageProviderOptionsSchema>;

type GoogleGenerativeAIEmbeddingModelId = 'gemini-embedding-001' | 'text-embedding-004' | (string & {});
declare const googleGenerativeAIEmbeddingProviderOptions: _ai_sdk_provider_utils.LazySchema<{
    outputDimensionality?: number | undefined;
    taskType?: "SEMANTIC_SIMILARITY" | "CLASSIFICATION" | "CLUSTERING" | "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "QUESTION_ANSWERING" | "FACT_VERIFICATION" | "CODE_RETRIEVAL_QUERY" | undefined;
}>;
type GoogleGenerativeAIEmbeddingProviderOptions = InferValidator<typeof googleGenerativeAIEmbeddingProviderOptions>;

declare const googleTools: {
    /**
     * Creates a Google search tool that gives Google direct access to real-time web content.
     * Must have name "google_search".
     */
    googleSearch: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {
        mode?: "MODE_DYNAMIC" | "MODE_UNSPECIFIED";
        dynamicThreshold?: number;
    }>;
    /**
     * Creates a URL context tool that gives Google direct access to real-time web content.
     * Must have name "url_context".
     */
    urlContext: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {}>;
    /**
     * Enables Retrieval Augmented Generation (RAG) via the Gemini File Search tool.
     * Must have name "file_search".
     *
     * @param fileSearchStoreNames - Fully-qualified File Search store resource names.
     * @param metadataFilter - Optional filter expression to restrict the files that can be retrieved.
     * @param topK - Optional result limit for the number of chunks returned from File Search.
     *
     * @see https://ai.google.dev/gemini-api/docs/file-search
     */
    fileSearch: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {
        [x: string]: unknown;
        fileSearchStoreNames: string[];
        topK?: number | undefined;
        metadataFilter?: string | undefined;
    }>;
    /**
     * A tool that enables the model to generate and run Python code.
     * Must have name "code_execution".
     *
     * @note Ensure the selected model supports Code Execution.
     * Multi-tool usage with the code execution tool is typically compatible with Gemini >=2 models.
     *
     * @see https://ai.google.dev/gemini-api/docs/code-execution (Google AI)
     * @see https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/code-execution-api (Vertex AI)
     */
    codeExecution: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        language: string;
        code: string;
    }, {
        outcome: string;
        output: string;
    }, {}>;
    /**
     * Creates a Vertex RAG Store tool that enables the model to perform RAG searches against a Vertex RAG Store.
     * Must have name "vertex_rag_store".
     */
    vertexRagStore: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {
        ragCorpus: string;
        topK?: number;
    }>;
};

interface GoogleGenerativeAIProvider extends ProviderV2 {
    (modelId: GoogleGenerativeAIModelId): LanguageModelV2;
    languageModel(modelId: GoogleGenerativeAIModelId): LanguageModelV2;
    chat(modelId: GoogleGenerativeAIModelId): LanguageModelV2;
    /**
  Creates a model for image generation.
   */
    image(modelId: GoogleGenerativeAIImageModelId, settings?: GoogleGenerativeAIImageSettings): ImageModelV2;
    /**
     * @deprecated Use `chat()` instead.
     */
    generativeAI(modelId: GoogleGenerativeAIModelId): LanguageModelV2;
    /**
  @deprecated Use `textEmbedding()` instead.
     */
    embedding(modelId: GoogleGenerativeAIEmbeddingModelId): EmbeddingModelV2<string>;
    textEmbedding(modelId: GoogleGenerativeAIEmbeddingModelId): EmbeddingModelV2<string>;
    textEmbeddingModel(modelId: GoogleGenerativeAIEmbeddingModelId): EmbeddingModelV2<string>;
    tools: typeof googleTools;
}
interface GoogleGenerativeAIProviderSettings {
    /**
  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://generativelanguage.googleapis.com/v1beta`.
     */
    baseURL?: string;
    /**
  API key that is being send using the `x-goog-api-key` header.
  It defaults to the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.
     */
    apiKey?: string;
    /**
  Custom headers to include in the requests.
       */
    headers?: Record<string, string | undefined>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
    /**
  Optional function to generate a unique ID for each request.
       */
    generateId?: () => string;
    /**
     * Custom provider name
     * Defaults to 'google.generative-ai'.
     */
    name?: string;
}
/**
Create a Google Generative AI provider instance.
 */
declare function createGoogleGenerativeAI(options?: GoogleGenerativeAIProviderSettings): GoogleGenerativeAIProvider;
/**
Default Google Generative AI provider instance.
 */
declare const google: GoogleGenerativeAIProvider;

declare const VERSION: string;

export { type GoogleErrorData, type GoogleGenerativeAIEmbeddingProviderOptions, type GoogleGenerativeAIImageProviderOptions, type GoogleGenerativeAIProvider, type GoogleGenerativeAIProviderMetadata, type GoogleGenerativeAIProviderOptions, type GoogleGenerativeAIProviderSettings, VERSION, createGoogleGenerativeAI, google };
