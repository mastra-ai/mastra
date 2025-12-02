import { LanguageModelV2, ProviderV2, EmbeddingModelV2, ImageModelV2, TypeValidationError } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { FetchFunction, InferValidator } from '@ai-sdk/provider-utils';

type GatewayModelId = 'alibaba/qwen-3-14b' | 'alibaba/qwen-3-235b' | 'alibaba/qwen-3-30b' | 'alibaba/qwen-3-32b' | 'alibaba/qwen3-235b-a22b-thinking' | 'alibaba/qwen3-coder' | 'alibaba/qwen3-coder-30b-a3b' | 'alibaba/qwen3-coder-plus' | 'alibaba/qwen3-max' | 'alibaba/qwen3-max-preview' | 'alibaba/qwen3-next-80b-a3b-instruct' | 'alibaba/qwen3-next-80b-a3b-thinking' | 'alibaba/qwen3-vl-instruct' | 'alibaba/qwen3-vl-thinking' | 'amazon/nova-lite' | 'amazon/nova-micro' | 'amazon/nova-pro' | 'anthropic/claude-3-haiku' | 'anthropic/claude-3-opus' | 'anthropic/claude-3.5-haiku' | 'anthropic/claude-3.5-sonnet' | 'anthropic/claude-3.5-sonnet-20240620' | 'anthropic/claude-3.7-sonnet' | 'anthropic/claude-haiku-4.5' | 'anthropic/claude-opus-4' | 'anthropic/claude-opus-4.1' | 'anthropic/claude-sonnet-4' | 'anthropic/claude-sonnet-4.5' | 'cohere/command-a' | 'deepseek/deepseek-r1' | 'deepseek/deepseek-v3' | 'deepseek/deepseek-v3.1' | 'deepseek/deepseek-v3.1-terminus' | 'deepseek/deepseek-v3.2-exp' | 'deepseek/deepseek-v3.2-exp-thinking' | 'google/gemini-2.0-flash' | 'google/gemini-2.0-flash-lite' | 'google/gemini-2.5-flash' | 'google/gemini-2.5-flash-image' | 'google/gemini-2.5-flash-image-preview' | 'google/gemini-2.5-flash-lite' | 'google/gemini-2.5-flash-lite-preview-09-2025' | 'google/gemini-2.5-flash-preview-09-2025' | 'google/gemini-2.5-pro' | 'google/gemini-3-pro-preview' | 'google/gemini-3-pro-image' | 'inception/mercury-coder-small' | 'meituan/longcat-flash-chat' | 'meituan/longcat-flash-thinking' | 'meta/llama-3.1-70b' | 'meta/llama-3.1-8b' | 'meta/llama-3.2-11b' | 'meta/llama-3.2-1b' | 'meta/llama-3.2-3b' | 'meta/llama-3.2-90b' | 'meta/llama-3.3-70b' | 'meta/llama-4-maverick' | 'meta/llama-4-scout' | 'minimax/minimax-m2' | 'mistral/codestral' | 'mistral/devstral-small' | 'mistral/magistral-medium' | 'mistral/magistral-medium-2506' | 'mistral/magistral-small' | 'mistral/magistral-small-2506' | 'mistral/ministral-3b' | 'mistral/ministral-8b' | 'mistral/mistral-large' | 'mistral/mistral-medium' | 'mistral/mistral-small' | 'mistral/mixtral-8x22b-instruct' | 'mistral/pixtral-12b' | 'mistral/pixtral-large' | 'moonshotai/kimi-k2' | 'moonshotai/kimi-k2-0905' | 'moonshotai/kimi-k2-thinking' | 'moonshotai/kimi-k2-thinking-turbo' | 'moonshotai/kimi-k2-turbo' | 'morph/morph-v3-fast' | 'morph/morph-v3-large' | 'openai/gpt-3.5-turbo' | 'openai/gpt-3.5-turbo-instruct' | 'openai/gpt-4-turbo' | 'openai/gpt-4.1' | 'openai/gpt-4.1-mini' | 'openai/gpt-4.1-nano' | 'openai/gpt-4o' | 'openai/gpt-4o-mini' | 'openai/gpt-5' | 'openai/gpt-5-chat' | 'openai/gpt-5-codex' | 'openai/gpt-5-mini' | 'openai/gpt-5-nano' | 'openai/gpt-5-pro' | 'openai/gpt-5.1-codex' | 'openai/gpt-5.1-codex-mini' | 'openai/gpt-5.1-instant' | 'openai/gpt-5.1-thinking' | 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b' | 'openai/gpt-oss-safeguard-20b' | 'openai/o1' | 'openai/o3' | 'openai/o3-deep-research' | 'openai/o3-mini' | 'openai/o4-mini' | 'perplexity/sonar' | 'perplexity/sonar-pro' | 'perplexity/sonar-reasoning' | 'perplexity/sonar-reasoning-pro' | 'stealth/sonoma-dusk-alpha' | 'stealth/sonoma-sky-alpha' | 'vercel/v0-1.0-md' | 'vercel/v0-1.5-md' | 'xai/grok-2' | 'xai/grok-2-vision' | 'xai/grok-3' | 'xai/grok-3-fast' | 'xai/grok-3-mini' | 'xai/grok-3-mini-fast' | 'xai/grok-4' | 'xai/grok-4-fast-non-reasoning' | 'xai/grok-4-fast-reasoning' | 'xai/grok-code-fast-1' | 'zai/glm-4.5' | 'zai/glm-4.5-air' | 'zai/glm-4.5v' | 'zai/glm-4.6' | (string & {});

interface GatewayLanguageModelEntry {
    /**
     * The model id used by the remote provider in model settings and for specifying the
     * intended model for text generation.
     */
    id: string;
    /**
     * The display name of the model for presentation in user-facing contexts.
     */
    name: string;
    /**
     * Optional description of the model.
     */
    description?: string | null;
    /**
     * Optional pricing information for the model.
     */
    pricing?: {
        /**
         * Cost per input token in USD.
         */
        input: string;
        /**
         * Cost per output token in USD.
         */
        output: string;
        /**
         * Cost per cached input token in USD.
         * Only present for providers/models that support prompt caching.
         */
        cachedInputTokens?: string;
        /**
         * Cost per input token to create/write cache entries in USD.
         * Only present for providers/models that support prompt caching.
         */
        cacheCreationInputTokens?: string;
    } | null;
    /**
     * Additional AI SDK language model specifications for the model.
     */
    specification: GatewayLanguageModelSpecification;
    /**
     * Optional field to differentiate between model types.
     */
    modelType?: 'language' | 'embedding' | 'image' | null;
}
type GatewayLanguageModelSpecification = Pick<LanguageModelV2, 'specificationVersion' | 'provider' | 'modelId'>;

interface GatewayFetchMetadataResponse {
    models: GatewayLanguageModelEntry[];
}
interface GatewayCreditsResponse {
    /** The remaining gateway credit balance available for API usage */
    balance: string;
    /** The total amount of gateway credits that have been consumed */
    totalUsed: string;
}

type GatewayEmbeddingModelId = 'amazon/titan-embed-text-v2' | 'cohere/embed-v4.0' | 'google/gemini-embedding-001' | 'google/text-embedding-005' | 'google/text-multilingual-embedding-002' | 'mistral/codestral-embed' | 'mistral/mistral-embed' | 'openai/text-embedding-3-large' | 'openai/text-embedding-3-small' | 'openai/text-embedding-ada-002' | 'voyage/voyage-3-large' | 'voyage/voyage-3.5' | 'voyage/voyage-3.5-lite' | 'voyage/voyage-code-3' | 'voyage/voyage-finance-2' | 'voyage/voyage-law-2' | 'voyage/voyage-code-2' | (string & {});

type GatewayImageModelId = 'google/imagen-4.0-generate' | 'bfl/flux-kontext-max' | 'bfl/flux-kontext-pro' | 'bfl/flux-pro-1.0-fill' | 'bfl/flux-pro-1.1' | 'bfl/flux-pro-1.1-ultra' | (string & {});

interface GatewayProvider extends ProviderV2 {
    (modelId: GatewayModelId): LanguageModelV2;
    /**
  Creates a model for text generation.
  */
    languageModel(modelId: GatewayModelId): LanguageModelV2;
    /**
  Returns available providers and models for use with the remote provider.
   */
    getAvailableModels(): Promise<GatewayFetchMetadataResponse>;
    /**
  Returns credit information for the authenticated user.
   */
    getCredits(): Promise<GatewayCreditsResponse>;
    /**
  Creates a model for generating text embeddings.
  */
    textEmbeddingModel(modelId: GatewayEmbeddingModelId): EmbeddingModelV2<string>;
    /**
  Creates a model for generating images.
  */
    imageModel(modelId: GatewayImageModelId): ImageModelV2;
}
interface GatewayProviderSettings {
    /**
  The base URL prefix for API calls. Defaults to `https://ai-gateway.vercel.sh/v1/ai`.
     */
    baseURL?: string;
    /**
  API key that is being sent using the `Authorization` header.
     */
    apiKey?: string;
    /**
  Custom headers to include in the requests.
       */
    headers?: Record<string, string>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
    /**
  How frequently to refresh the metadata cache in milliseconds.
     */
    metadataCacheRefreshMillis?: number;
}
/**
Create a remote provider instance.
 */
declare function createGatewayProvider(options?: GatewayProviderSettings): GatewayProvider;
declare const gateway: GatewayProvider;

declare const gatewayProviderOptions: _ai_sdk_provider_utils.LazyValidator<{
    only?: string[] | undefined;
    order?: string[] | undefined;
    user?: string | undefined;
    tags?: string[] | undefined;
    models?: string[] | undefined;
}>;
type GatewayProviderOptions = InferValidator<typeof gatewayProviderOptions>;

declare const symbol$6: unique symbol;
declare abstract class GatewayError extends Error {
    private readonly [symbol$6];
    abstract readonly name: string;
    abstract readonly type: string;
    readonly statusCode: number;
    readonly cause?: unknown;
    constructor({ message, statusCode, cause, }: {
        message: string;
        statusCode?: number;
        cause?: unknown;
    });
    /**
     * Checks if the given error is a Gateway Error.
     * @param {unknown} error - The error to check.
     * @returns {boolean} True if the error is a Gateway Error, false otherwise.
     */
    static isInstance(error: unknown): error is GatewayError;
    static hasMarker(error: unknown): error is GatewayError;
}

declare const gatewayErrorResponseSchema: _ai_sdk_provider_utils.LazyValidator<{
    error: {
        message: string;
        type?: string | null | undefined;
        param?: unknown;
        code?: string | number | null | undefined;
    };
}>;
type GatewayErrorResponse = InferValidator<typeof gatewayErrorResponseSchema>;

declare const symbol$5: unique symbol;
/**
 * Authentication failed - invalid API key or OIDC token
 */
declare class GatewayAuthenticationError extends GatewayError {
    private readonly [symbol$5];
    readonly name = "GatewayAuthenticationError";
    readonly type = "authentication_error";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayAuthenticationError;
    /**
     * Creates a contextual error message when authentication fails
     */
    static createContextualError({ apiKeyProvided, oidcTokenProvided, message, statusCode, cause, }: {
        apiKeyProvided: boolean;
        oidcTokenProvided: boolean;
        message?: string;
        statusCode?: number;
        cause?: unknown;
    }): GatewayAuthenticationError;
}

declare const symbol$4: unique symbol;
/**
 * Internal server error from the Gateway
 */
declare class GatewayInternalServerError extends GatewayError {
    private readonly [symbol$4];
    readonly name = "GatewayInternalServerError";
    readonly type = "internal_server_error";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayInternalServerError;
}

declare const symbol$3: unique symbol;
/**
 * Invalid request - missing headers, malformed data, etc.
 */
declare class GatewayInvalidRequestError extends GatewayError {
    private readonly [symbol$3];
    readonly name = "GatewayInvalidRequestError";
    readonly type = "invalid_request_error";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayInvalidRequestError;
}

declare const symbol$2: unique symbol;
/**
 * Model not found or not available
 */
declare class GatewayModelNotFoundError extends GatewayError {
    private readonly [symbol$2];
    readonly name = "GatewayModelNotFoundError";
    readonly type = "model_not_found";
    readonly modelId?: string;
    constructor({ message, statusCode, modelId, cause, }?: {
        message?: string;
        statusCode?: number;
        modelId?: string;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayModelNotFoundError;
}

declare const symbol$1: unique symbol;
/**
 * Rate limit exceeded.
 */
declare class GatewayRateLimitError extends GatewayError {
    private readonly [symbol$1];
    readonly name = "GatewayRateLimitError";
    readonly type = "rate_limit_exceeded";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayRateLimitError;
}

declare const symbol: unique symbol;
/**
 * Gateway response parsing error
 */
declare class GatewayResponseError extends GatewayError {
    private readonly [symbol];
    readonly name = "GatewayResponseError";
    readonly type = "response_error";
    readonly response?: unknown;
    readonly validationError?: TypeValidationError;
    constructor({ message, statusCode, response, validationError, cause, }?: {
        message?: string;
        statusCode?: number;
        response?: unknown;
        validationError?: TypeValidationError;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayResponseError;
}

export { GatewayAuthenticationError, type GatewayCreditsResponse, GatewayError, type GatewayErrorResponse, GatewayInternalServerError, GatewayInvalidRequestError, type GatewayLanguageModelEntry, type GatewayLanguageModelSpecification, type GatewayLanguageModelEntry as GatewayModelEntry, type GatewayModelId, GatewayModelNotFoundError, type GatewayProvider, type GatewayProviderOptions, type GatewayProviderSettings, GatewayRateLimitError, GatewayResponseError, createGatewayProvider as createGateway, createGatewayProvider, gateway };
