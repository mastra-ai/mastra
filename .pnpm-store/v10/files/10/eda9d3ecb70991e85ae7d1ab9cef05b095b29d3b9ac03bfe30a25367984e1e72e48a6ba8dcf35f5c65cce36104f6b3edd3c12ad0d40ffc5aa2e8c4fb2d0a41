import { z } from 'zod/v4';
import { ProviderV2, LanguageModelV2, ImageModelV2 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';

type XaiChatModelId = 'grok-4' | 'grok-4-0709' | 'grok-4-latest' | 'grok-3' | 'grok-3-latest' | 'grok-3-fast' | 'grok-3-fast-latest' | 'grok-3-mini' | 'grok-3-mini-latest' | 'grok-3-mini-fast' | 'grok-3-mini-fast-latest' | 'grok-2-vision-1212' | 'grok-2-vision' | 'grok-2-vision-latest' | 'grok-2-image-1212' | 'grok-2-image' | 'grok-2-image-latest' | 'grok-2-1212' | 'grok-2' | 'grok-2-latest' | 'grok-vision-beta' | 'grok-beta' | (string & {});
declare const xaiProviderOptions: z.ZodObject<{
    reasoningEffort: z.ZodOptional<z.ZodEnum<{
        low: "low";
        high: "high";
    }>>;
    searchParameters: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            off: "off";
            auto: "auto";
            on: "on";
        }>;
        returnCitations: z.ZodOptional<z.ZodBoolean>;
        fromDate: z.ZodOptional<z.ZodString>;
        toDate: z.ZodOptional<z.ZodString>;
        maxSearchResults: z.ZodOptional<z.ZodNumber>;
        sources: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"web">;
            country: z.ZodOptional<z.ZodString>;
            excludedWebsites: z.ZodOptional<z.ZodArray<z.ZodString>>;
            allowedWebsites: z.ZodOptional<z.ZodArray<z.ZodString>>;
            safeSearch: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"x">;
            xHandles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"news">;
            country: z.ZodOptional<z.ZodString>;
            excludedWebsites: z.ZodOptional<z.ZodArray<z.ZodString>>;
            safeSearch: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"rss">;
            links: z.ZodArray<z.ZodString>;
        }, z.core.$strip>]>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type XaiProviderOptions = z.infer<typeof xaiProviderOptions>;

declare const xaiErrorDataSchema: z.ZodObject<{
    error: z.ZodObject<{
        message: z.ZodString;
        type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        param: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
        code: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
type XaiErrorData = z.infer<typeof xaiErrorDataSchema>;

type XaiImageModelId = 'grok-2-image' | (string & {});

interface XaiProvider extends ProviderV2 {
    /**
  Creates an Xai chat model for text generation.
     */
    (modelId: XaiChatModelId): LanguageModelV2;
    /**
  Creates an Xai language model for text generation.
     */
    languageModel(modelId: XaiChatModelId): LanguageModelV2;
    /**
  Creates an Xai chat model for text generation.
     */
    chat: (modelId: XaiChatModelId) => LanguageModelV2;
    /**
  Creates an Xai image model for image generation.
     */
    image(modelId: XaiImageModelId): ImageModelV2;
    /**
  Creates an Xai image model for image generation.
     */
    imageModel(modelId: XaiImageModelId): ImageModelV2;
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

export { type XaiErrorData, type XaiProvider, type XaiProviderOptions, type XaiProviderSettings, createXai, xai };
