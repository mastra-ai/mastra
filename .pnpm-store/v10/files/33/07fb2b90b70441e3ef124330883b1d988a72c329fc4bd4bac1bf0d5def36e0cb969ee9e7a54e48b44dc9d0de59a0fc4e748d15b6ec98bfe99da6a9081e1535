import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { Resolvable, FetchFunction, InferValidator } from '@ai-sdk/provider-utils';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { z } from 'zod/v4';

type GoogleGenerativeAIModelId = 'gemini-1.5-flash' | 'gemini-1.5-flash-latest' | 'gemini-1.5-flash-001' | 'gemini-1.5-flash-002' | 'gemini-1.5-flash-8b' | 'gemini-1.5-flash-8b-latest' | 'gemini-1.5-flash-8b-001' | 'gemini-1.5-pro' | 'gemini-1.5-pro-latest' | 'gemini-1.5-pro-001' | 'gemini-1.5-pro-002' | 'gemini-2.0-flash' | 'gemini-2.0-flash-001' | 'gemini-2.0-flash-live-001' | 'gemini-2.0-flash-lite' | 'gemini-2.0-pro-exp-02-05' | 'gemini-2.0-flash-thinking-exp-01-21' | 'gemini-2.0-flash-exp' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-image-preview' | 'gemini-2.5-flash-lite' | 'gemini-2.5-flash-lite-preview-09-2025' | 'gemini-2.5-flash-preview-04-17' | 'gemini-2.5-flash-preview-09-2025' | 'gemini-3-pro-preview' | 'gemini-pro-latest' | 'gemini-flash-latest' | 'gemini-flash-lite-latest' | 'gemini-2.5-pro-exp-03-25' | 'gemini-exp-1206' | 'gemma-3-12b-it' | 'gemma-3-27b-it' | (string & {});

type GoogleGenerativeAIConfig = {
    provider: string;
    baseURL: string;
    headers: Resolvable<Record<string, string | undefined>>;
    fetch?: FetchFunction;
    generateId: () => string;
    /**
     * The supported URLs for the model.
     */
    supportedUrls?: () => LanguageModelV2['supportedUrls'];
};
declare class GoogleGenerativeAILanguageModel implements LanguageModelV2 {
    readonly specificationVersion = "v2";
    readonly modelId: GoogleGenerativeAIModelId;
    private readonly config;
    private readonly generateId;
    constructor(modelId: GoogleGenerativeAIModelId, config: GoogleGenerativeAIConfig);
    get provider(): string;
    get supportedUrls(): Record<string, RegExp[]> | PromiseLike<Record<string, RegExp[]>>;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV2['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
}
declare const getGroundingMetadataSchema: () => z.ZodObject<{
    webSearchQueries: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    retrievalQueries: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    searchEntryPoint: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        renderedContent: z.ZodString;
    }, z.core.$strip>>>;
    groundingChunks: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        web: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uri: z.ZodString;
            title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        retrievedContext: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uri: z.ZodString;
            title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>;
    groundingSupports: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        segment: z.ZodObject<{
            startIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            endIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        segment_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        groundingChunkIndices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber>>>;
        supportChunkIndices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber>>>;
        confidenceScores: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber>>>;
        confidenceScore: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber>>>;
    }, z.core.$strip>>>>;
    retrievalMetadata: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodObject<{
        webDynamicRetrievalScore: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{}, z.core.$strip>]>>>;
}, z.core.$strip>;
declare const getUrlContextMetadataSchema: () => z.ZodObject<{
    urlMetadata: z.ZodArray<z.ZodObject<{
        retrievedUrl: z.ZodString;
        urlRetrievalStatus: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
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

export { GoogleGenerativeAILanguageModel, type GoogleGenerativeAIModelId, type GroundingMetadataSchema, type SafetyRatingSchema, type UrlContextMetadataSchema, getGroundingMetadataSchema, getUrlContextMetadataSchema, googleTools };
