import { ProviderV1, LanguageModelV1, ImageModelV1 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { OpenAICompatibleChatSettings } from '@ai-sdk/openai-compatible';
import { z } from 'zod';

type XaiChatModelId = 'grok-3' | 'grok-3-latest' | 'grok-3-fast' | 'grok-3-fast-latest' | 'grok-3-mini' | 'grok-3-mini-latest' | 'grok-3-mini-fast' | 'grok-3-mini-fast-latest' | 'grok-2-vision-1212' | 'grok-2-vision' | 'grok-2-vision-latest' | 'grok-2-image-1212' | 'grok-2-image' | 'grok-2-image-latest' | 'grok-2-1212' | 'grok-2' | 'grok-2-latest' | 'grok-vision-beta' | 'grok-beta' | (string & {});
interface XaiChatSettings extends OpenAICompatibleChatSettings {
}

type XaiImageModelId = 'grok-2-image' | (string & {});
interface XaiImageSettings {
    /**
  Override the maximum number of images per call. Default is 10.
     */
    maxImagesPerCall?: number;
}

interface XaiProvider extends ProviderV1 {
    /**
  Creates an Xai chat model for text generation.
     */
    (modelId: XaiChatModelId, settings?: XaiChatSettings): LanguageModelV1;
    /**
  Creates an Xai language model for text generation.
     */
    languageModel(modelId: XaiChatModelId, settings?: XaiChatSettings): LanguageModelV1;
    /**
  Creates an Xai chat model for text generation.
     */
    chat: (modelId: XaiChatModelId, settings?: XaiChatSettings) => LanguageModelV1;
    /**
  Creates an Xai image model for image generation.
     */
    image(modelId: XaiImageModelId, settings?: XaiImageSettings): ImageModelV1;
    /**
  Creates an Xai image model for image generation.
     */
    imageModel(modelId: XaiImageModelId, settings?: XaiImageSettings): ImageModelV1;
}
interface XaiProviderSettings {
    /**
  Base URL for the xAI API calls.
       */
    baseURL?: string;
    /**
  API key for authenticating requests.
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
}
declare function createXai(options?: XaiProviderSettings): XaiProvider;
declare const xai: XaiProvider;

declare const xaiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    error: string;
}, {
    code: string;
    error: string;
}>;
type XaiErrorData = z.infer<typeof xaiErrorSchema>;

export { type XaiErrorData, type XaiProvider, type XaiProviderSettings, createXai, xai };
