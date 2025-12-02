import { LanguageModelV2 } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { Resolvable, FetchFunction } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

type GoogleGenerativeAIModelId = 'gemini-1.5-flash' | 'gemini-1.5-flash-latest' | 'gemini-1.5-flash-001' | 'gemini-1.5-flash-002' | 'gemini-1.5-flash-8b' | 'gemini-1.5-flash-8b-latest' | 'gemini-1.5-flash-8b-001' | 'gemini-1.5-pro' | 'gemini-1.5-pro-latest' | 'gemini-1.5-pro-001' | 'gemini-1.5-pro-002' | 'gemini-2.0-flash' | 'gemini-2.0-flash-001' | 'gemini-2.0-flash-live-001' | 'gemini-2.0-flash-lite' | 'gemini-2.0-pro-exp-02-05' | 'gemini-2.0-flash-thinking-exp-01-21' | 'gemini-2.0-flash-exp' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro-exp-03-25' | 'gemini-2.5-flash-preview-04-17' | 'gemini-exp-1206' | 'gemma-3-12b-it' | 'gemma-3-27b-it' | (string & {});

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
declare const safetyRatingSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    probability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    probabilityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    severity: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    severityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    blocked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$strip>;

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

export { GoogleGenerativeAILanguageModel, type GoogleGenerativeAIModelId, googleTools, safetyRatingSchema };
