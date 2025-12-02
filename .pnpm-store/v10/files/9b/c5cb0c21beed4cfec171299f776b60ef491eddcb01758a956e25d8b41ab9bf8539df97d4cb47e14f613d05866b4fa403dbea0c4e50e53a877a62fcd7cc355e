import { ProviderV2, LanguageModelV2, EmbeddingModelV2 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

type MistralChatModelId = 'ministral-3b-latest' | 'ministral-8b-latest' | 'mistral-large-latest' | 'mistral-medium-latest' | 'mistral-medium-2508' | 'mistral-medium-2505' | 'mistral-small-latest' | 'pixtral-large-latest' | 'magistral-small-2507' | 'magistral-medium-2507' | 'magistral-small-2506' | 'magistral-medium-2506' | 'pixtral-12b-2409' | 'open-mistral-7b' | 'open-mixtral-8x7b' | 'open-mixtral-8x22b' | (string & {});
declare const mistralLanguageModelOptions: z.ZodObject<{
    safePrompt: z.ZodOptional<z.ZodBoolean>;
    documentImageLimit: z.ZodOptional<z.ZodNumber>;
    documentPageLimit: z.ZodOptional<z.ZodNumber>;
    structuredOutputs: z.ZodOptional<z.ZodBoolean>;
    strictJsonSchema: z.ZodOptional<z.ZodBoolean>;
    parallelToolCalls: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type MistralLanguageModelOptions = z.infer<typeof mistralLanguageModelOptions>;

type MistralEmbeddingModelId = 'mistral-embed' | (string & {});

interface MistralProvider extends ProviderV2 {
    (modelId: MistralChatModelId): LanguageModelV2;
    /**
  Creates a model for text generation.
  */
    languageModel(modelId: MistralChatModelId): LanguageModelV2;
    /**
  Creates a model for text generation.
  */
    chat(modelId: MistralChatModelId): LanguageModelV2;
    /**
  @deprecated Use `textEmbedding()` instead.
     */
    embedding(modelId: MistralEmbeddingModelId): EmbeddingModelV2<string>;
    textEmbedding(modelId: MistralEmbeddingModelId): EmbeddingModelV2<string>;
    textEmbeddingModel: (modelId: MistralEmbeddingModelId) => EmbeddingModelV2<string>;
}
interface MistralProviderSettings {
    /**
  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://api.mistral.ai/v1`.
     */
    baseURL?: string;
    /**
  API key that is being send using the `Authorization` header.
  It defaults to the `MISTRAL_API_KEY` environment variable.
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
    generateId?: () => string;
}
/**
Create a Mistral AI provider instance.
 */
declare function createMistral(options?: MistralProviderSettings): MistralProvider;
/**
Default Mistral provider instance.
 */
declare const mistral: MistralProvider;

declare const VERSION: string;

export { type MistralLanguageModelOptions, type MistralProvider, type MistralProviderSettings, VERSION, createMistral, mistral };
