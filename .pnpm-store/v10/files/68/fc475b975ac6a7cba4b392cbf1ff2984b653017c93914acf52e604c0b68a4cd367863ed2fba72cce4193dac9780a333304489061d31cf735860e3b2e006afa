import { z } from 'zod/v4';
import { ProviderV2, LanguageModelV2, ImageModelV2, EmbeddingModelV2 } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { FetchFunction } from '@ai-sdk/provider-utils';

declare const googleErrorDataSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodNullable<z.ZodNumber>;
        message: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
type GoogleErrorData = z.infer<typeof googleErrorDataSchema>;

type GoogleGenerativeAIModelId = 'gemini-1.5-flash' | 'gemini-1.5-flash-latest' | 'gemini-1.5-flash-001' | 'gemini-1.5-flash-002' | 'gemini-1.5-flash-8b' | 'gemini-1.5-flash-8b-latest' | 'gemini-1.5-flash-8b-001' | 'gemini-1.5-pro' | 'gemini-1.5-pro-latest' | 'gemini-1.5-pro-001' | 'gemini-1.5-pro-002' | 'gemini-2.0-flash' | 'gemini-2.0-flash-001' | 'gemini-2.0-flash-live-001' | 'gemini-2.0-flash-lite' | 'gemini-2.0-pro-exp-02-05' | 'gemini-2.0-flash-thinking-exp-01-21' | 'gemini-2.0-flash-exp' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro-exp-03-25' | 'gemini-2.5-flash-preview-04-17' | 'gemini-exp-1206' | 'gemma-3-12b-it' | 'gemma-3-27b-it' | (string & {});
declare const googleGenerativeAIProviderOptions: z.ZodObject<{
    responseModalities: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        TEXT: "TEXT";
        IMAGE: "IMAGE";
    }>>>;
    thinkingConfig: z.ZodOptional<z.ZodObject<{
        thinkingBudget: z.ZodOptional<z.ZodNumber>;
        includeThoughts: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    cachedContent: z.ZodOptional<z.ZodString>;
    structuredOutputs: z.ZodOptional<z.ZodBoolean>;
    safetySettings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<{
            HARM_CATEGORY_UNSPECIFIED: "HARM_CATEGORY_UNSPECIFIED";
            HARM_CATEGORY_HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH";
            HARM_CATEGORY_DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT";
            HARM_CATEGORY_HARASSMENT: "HARM_CATEGORY_HARASSMENT";
            HARM_CATEGORY_SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT";
            HARM_CATEGORY_CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY";
        }>;
        threshold: z.ZodEnum<{
            HARM_BLOCK_THRESHOLD_UNSPECIFIED: "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
            BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE";
            BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE";
            BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH";
            BLOCK_NONE: "BLOCK_NONE";
            OFF: "OFF";
        }>;
    }, z.core.$strip>>>;
    threshold: z.ZodOptional<z.ZodEnum<{
        HARM_BLOCK_THRESHOLD_UNSPECIFIED: "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
        BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE";
        BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE";
        BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH";
        BLOCK_NONE: "BLOCK_NONE";
        OFF: "OFF";
    }>>;
    audioTimestamp: z.ZodOptional<z.ZodBoolean>;
    labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
type GoogleGenerativeAIProviderOptions = z.infer<typeof googleGenerativeAIProviderOptions>;

declare const groundingMetadataSchema: z.ZodObject<{
    webSearchQueries: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    retrievalQueries: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    searchEntryPoint: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        renderedContent: z.ZodString;
    }, z.core.$strip>>>;
    groundingChunks: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        web: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uri: z.ZodString;
            title: z.ZodString;
        }, z.core.$strip>>>;
        retrievedContext: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uri: z.ZodString;
            title: z.ZodString;
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

declare const urlContextMetadataSchema: z.ZodObject<{
    urlMetadata: z.ZodArray<z.ZodObject<{
        retrievedUrl: z.ZodString;
        urlRetrievalStatus: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;

declare const safetyRatingSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    probability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    probabilityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    severity: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    severityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    blocked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$strip>;

type GoogleGenerativeAIGroundingMetadata = z.infer<typeof groundingMetadataSchema>;
type GoogleGenerativeAIUrlContextMetadata = z.infer<typeof urlContextMetadataSchema>;
type GoogleGenerativeAISafetyRating = z.infer<typeof safetyRatingSchema>;
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

declare const googleImageProviderOptionsSchema: z.ZodObject<{
    personGeneration: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        dont_allow: "dont_allow";
        allow_adult: "allow_adult";
        allow_all: "allow_all";
    }>>>;
    aspectRatio: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        "1:1": "1:1";
        "3:4": "3:4";
        "4:3": "4:3";
        "9:16": "9:16";
        "16:9": "16:9";
    }>>>;
}, z.core.$strip>;
type GoogleGenerativeAIImageProviderOptions = z.infer<typeof googleImageProviderOptionsSchema>;

type GoogleGenerativeAIEmbeddingModelId = 'gemini-embedding-001' | 'text-embedding-004' | (string & {});
declare const googleGenerativeAIEmbeddingProviderOptions: z.ZodObject<{
    outputDimensionality: z.ZodOptional<z.ZodNumber>;
    taskType: z.ZodOptional<z.ZodEnum<{
        SEMANTIC_SIMILARITY: "SEMANTIC_SIMILARITY";
        CLASSIFICATION: "CLASSIFICATION";
        CLUSTERING: "CLUSTERING";
        RETRIEVAL_DOCUMENT: "RETRIEVAL_DOCUMENT";
        RETRIEVAL_QUERY: "RETRIEVAL_QUERY";
        QUESTION_ANSWERING: "QUESTION_ANSWERING";
        FACT_VERIFICATION: "FACT_VERIFICATION";
        CODE_RETRIEVAL_QUERY: "CODE_RETRIEVAL_QUERY";
    }>>;
}, z.core.$strip>;
type GoogleGenerativeAIEmbeddingProviderOptions = z.infer<typeof googleGenerativeAIEmbeddingProviderOptions>;

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
}
/**
Create a Google Generative AI provider instance.
 */
declare function createGoogleGenerativeAI(options?: GoogleGenerativeAIProviderSettings): GoogleGenerativeAIProvider;
/**
Default Google Generative AI provider instance.
 */
declare const google: GoogleGenerativeAIProvider;

export { type GoogleErrorData, type GoogleGenerativeAIEmbeddingProviderOptions, type GoogleGenerativeAIImageProviderOptions, type GoogleGenerativeAIProvider, type GoogleGenerativeAIProviderMetadata, type GoogleGenerativeAIProviderOptions, type GoogleGenerativeAIProviderSettings, createGoogleGenerativeAI, google };
