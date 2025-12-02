import { z } from 'zod';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { ProviderV1, LanguageModelV1, EmbeddingModelV1 } from '@ai-sdk/provider';

declare const googleErrorDataSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodNullable<z.ZodNumber>;
        message: z.ZodString;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        code: number | null;
        message: string;
    }, {
        status: string;
        code: number | null;
        message: string;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        status: string;
        code: number | null;
        message: string;
    };
}, {
    error: {
        status: string;
        code: number | null;
        message: string;
    };
}>;
type GoogleErrorData = z.infer<typeof googleErrorDataSchema>;

type GoogleGenerativeAIModelId = 'gemini-1.5-flash' | 'gemini-1.5-flash-latest' | 'gemini-1.5-flash-001' | 'gemini-1.5-flash-002' | 'gemini-1.5-flash-8b' | 'gemini-1.5-flash-8b-latest' | 'gemini-1.5-flash-8b-001' | 'gemini-1.5-pro' | 'gemini-1.5-pro-latest' | 'gemini-1.5-pro-001' | 'gemini-1.5-pro-002' | 'gemini-2.0-flash' | 'gemini-2.0-flash-001' | 'gemini-2.0-flash-live-001' | 'gemini-2.0-flash-lite' | 'gemini-2.0-pro-exp-02-05' | 'gemini-2.0-flash-thinking-exp-01-21' | 'gemini-2.0-flash-exp' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-pro-exp-03-25' | 'gemini-2.5-pro-preview-05-06' | 'gemini-2.5-flash-preview-04-17' | 'gemini-exp-1206' | 'gemma-3-27b-it' | 'learnlm-1.5-pro-experimental' | (string & {});
interface DynamicRetrievalConfig {
    /**
     * The mode of the predictor to be used in dynamic retrieval.
     */
    mode?: 'MODE_UNSPECIFIED' | 'MODE_DYNAMIC';
    /**
     * The threshold to be used in dynamic retrieval. If not set, a system default
     * value is used.
     */
    dynamicThreshold?: number;
}
interface GoogleGenerativeAISettings {
    /**
  Optional.
  The name of the cached content used as context to serve the prediction.
  Format: cachedContents/{cachedContent}
     */
    cachedContent?: string;
    /**
     * Optional. Enable structured output. Default is true.
     *
     * This is useful when the JSON Schema contains elements that are
     * not supported by the OpenAPI schema version that
     * Google Generative AI uses. You can use this to disable
     * structured outputs if you need to.
     */
    structuredOutputs?: boolean;
    /**
  Optional. A list of unique safety settings for blocking unsafe content.
     */
    safetySettings?: Array<{
        category: 'HARM_CATEGORY_UNSPECIFIED' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_DANGEROUS_CONTENT' | 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_CIVIC_INTEGRITY';
        threshold: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_NONE' | 'OFF';
    }>;
    /**
     * Optional. Enables timestamp understanding for audio-only files.
     *
     * https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/audio-understanding
     */
    audioTimestamp?: boolean;
    /**
  Optional. When enabled, the model will use Google search to ground the response.
  
  @see https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview
     */
    useSearchGrounding?: boolean;
    /**
  Optional. Specifies the dynamic retrieval configuration.
  
  @note Dynamic retrieval is only compatible with Gemini 1.5 Flash.
  
  @see https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/ground-with-google-search#dynamic-retrieval
     */
    dynamicRetrievalConfig?: DynamicRetrievalConfig;
}

declare const groundingMetadataSchema: z.ZodObject<{
    webSearchQueries: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    retrievalQueries: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    searchEntryPoint: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        renderedContent: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        renderedContent: string;
    }, {
        renderedContent: string;
    }>>>;
    groundingChunks: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        web: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uri: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            uri: string;
            title: string;
        }, {
            uri: string;
            title: string;
        }>>>;
        retrievedContext: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uri: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            uri: string;
            title: string;
        }, {
            uri: string;
            title: string;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        web?: {
            uri: string;
            title: string;
        } | null | undefined;
        retrievedContext?: {
            uri: string;
            title: string;
        } | null | undefined;
    }, {
        web?: {
            uri: string;
            title: string;
        } | null | undefined;
        retrievedContext?: {
            uri: string;
            title: string;
        } | null | undefined;
    }>, "many">>>;
    groundingSupports: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        segment: z.ZodObject<{
            startIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            endIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            startIndex?: number | null | undefined;
            endIndex?: number | null | undefined;
            text?: string | null | undefined;
        }, {
            startIndex?: number | null | undefined;
            endIndex?: number | null | undefined;
            text?: string | null | undefined;
        }>;
        segment_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        groundingChunkIndices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber, "many">>>;
        supportChunkIndices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber, "many">>>;
        confidenceScores: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber, "many">>>;
        confidenceScore: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber, "many">>>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>, "many">>>;
    retrievalMetadata: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodObject<{
        webDynamicRetrievalScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        webDynamicRetrievalScore: number;
    }, {
        webDynamicRetrievalScore: number;
    }>, z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>]>>>;
}, "strip", z.ZodTypeAny, {
    webSearchQueries?: string[] | null | undefined;
    retrievalQueries?: string[] | null | undefined;
    searchEntryPoint?: {
        renderedContent: string;
    } | null | undefined;
    groundingChunks?: {
        web?: {
            uri: string;
            title: string;
        } | null | undefined;
        retrievedContext?: {
            uri: string;
            title: string;
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
    retrievalMetadata?: {
        webDynamicRetrievalScore: number;
    } | {} | null | undefined;
}, {
    webSearchQueries?: string[] | null | undefined;
    retrievalQueries?: string[] | null | undefined;
    searchEntryPoint?: {
        renderedContent: string;
    } | null | undefined;
    groundingChunks?: {
        web?: {
            uri: string;
            title: string;
        } | null | undefined;
        retrievedContext?: {
            uri: string;
            title: string;
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
    retrievalMetadata?: {
        webDynamicRetrievalScore: number;
    } | {} | null | undefined;
}>;
declare const safetyRatingSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    probability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    probabilityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    severity: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    severityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    blocked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    category?: string | null | undefined;
    probability?: string | null | undefined;
    probabilityScore?: number | null | undefined;
    severity?: string | null | undefined;
    severityScore?: number | null | undefined;
    blocked?: boolean | null | undefined;
}, {
    category?: string | null | undefined;
    probability?: string | null | undefined;
    probabilityScore?: number | null | undefined;
    severity?: string | null | undefined;
    severityScore?: number | null | undefined;
    blocked?: boolean | null | undefined;
}>;
declare const googleGenerativeAIProviderOptionsSchema: z.ZodObject<{
    responseModalities: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodEnum<["TEXT", "IMAGE"]>, "many">>>;
    thinkingConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        thinkingBudget: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        includeThoughts: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        thinkingBudget?: number | null | undefined;
        includeThoughts?: boolean | null | undefined;
    }, {
        thinkingBudget?: number | null | undefined;
        includeThoughts?: boolean | null | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    responseModalities?: ("TEXT" | "IMAGE")[] | null | undefined;
    thinkingConfig?: {
        thinkingBudget?: number | null | undefined;
        includeThoughts?: boolean | null | undefined;
    } | null | undefined;
}, {
    responseModalities?: ("TEXT" | "IMAGE")[] | null | undefined;
    thinkingConfig?: {
        thinkingBudget?: number | null | undefined;
        includeThoughts?: boolean | null | undefined;
    } | null | undefined;
}>;
type GoogleGenerativeAIProviderOptions = z.infer<typeof googleGenerativeAIProviderOptionsSchema>;

type GoogleGenerativeAIGroundingMetadata = z.infer<typeof groundingMetadataSchema>;
type GoogleGenerativeAISafetyRating = z.infer<typeof safetyRatingSchema>;
interface GoogleGenerativeAIProviderMetadata {
    groundingMetadata: GoogleGenerativeAIGroundingMetadata | null;
    safetyRatings: GoogleGenerativeAISafetyRating[] | null;
}

type GoogleGenerativeAIEmbeddingModelId = 'text-embedding-004' | (string & {});
interface GoogleGenerativeAIEmbeddingSettings {
    /**
     * Optional. Optional reduced dimension for the output embedding.
     * If set, excessive values in the output embedding are truncated from the end.
     */
    outputDimensionality?: number;
    /**
     * Optional. Specifies the task type for generating embeddings.
     * Supported task types:
     * - SEMANTIC_SIMILARITY: Optimized for text similarity.
     * - CLASSIFICATION: Optimized for text classification.
     * - CLUSTERING: Optimized for clustering texts based on similarity.
     * - RETRIEVAL_DOCUMENT: Optimized for document retrieval.
     * - RETRIEVAL_QUERY: Optimized for query-based retrieval.
     * - QUESTION_ANSWERING: Optimized for answering questions.
     * - FACT_VERIFICATION: Optimized for verifying factual information.
     * - CODE_RETRIEVAL_QUERY: Optimized for retrieving code blocks based on natural language queries.
     */
    taskType?: 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING' | 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'QUESTION_ANSWERING' | 'FACT_VERIFICATION' | 'CODE_RETRIEVAL_QUERY';
}

interface GoogleGenerativeAIProvider extends ProviderV1 {
    (modelId: GoogleGenerativeAIModelId, settings?: GoogleGenerativeAISettings): LanguageModelV1;
    languageModel(modelId: GoogleGenerativeAIModelId, settings?: GoogleGenerativeAISettings): LanguageModelV1;
    chat(modelId: GoogleGenerativeAIModelId, settings?: GoogleGenerativeAISettings): LanguageModelV1;
    /**
     * @deprecated Use `chat()` instead.
     */
    generativeAI(modelId: GoogleGenerativeAIModelId, settings?: GoogleGenerativeAISettings): LanguageModelV1;
    /**
  @deprecated Use `textEmbeddingModel()` instead.
     */
    embedding(modelId: GoogleGenerativeAIEmbeddingModelId, settings?: GoogleGenerativeAIEmbeddingSettings): EmbeddingModelV1<string>;
    /**
  @deprecated Use `textEmbeddingModel()` instead.
   */
    textEmbedding(modelId: GoogleGenerativeAIEmbeddingModelId, settings?: GoogleGenerativeAIEmbeddingSettings): EmbeddingModelV1<string>;
    textEmbeddingModel(modelId: GoogleGenerativeAIEmbeddingModelId, settings?: GoogleGenerativeAIEmbeddingSettings): EmbeddingModelV1<string>;
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
}
/**
Create a Google Generative AI provider instance.
 */
declare function createGoogleGenerativeAI(options?: GoogleGenerativeAIProviderSettings): GoogleGenerativeAIProvider;
/**
Default Google Generative AI provider instance.
 */
declare const google: GoogleGenerativeAIProvider;

export { type GoogleErrorData, type GoogleGenerativeAIProvider, type GoogleGenerativeAIProviderMetadata, type GoogleGenerativeAIProviderOptions, type GoogleGenerativeAIProviderSettings, createGoogleGenerativeAI, google };
