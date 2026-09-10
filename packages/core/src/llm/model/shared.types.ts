import type { LanguageModelV2, LanguageModelV2CallOptions, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { LanguageModelV3, LanguageModelV3CallOptions, SharedV3ProviderOptions } from '@ai-sdk/provider-v6';
import type { LanguageModelV4, LanguageModelV4CallOptions, SharedV4ProviderOptions } from '@ai-sdk/provider-v7';
import type { LanguageModelV1 } from '@internal/ai-sdk-v4';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod/v4';
import type { TracingPolicy } from '../../observability';
import type { StandardSchemaWithJSON, InferStandardSchemaOutput, ZodSchema } from '../../schema';
import type { ScoringData } from './base.types';
import type { ModelRouterModelId } from './provider-registry.js';

export type inferOutput<Output extends StandardSchemaWithJSON | ZodSchema | JSONSchema7 | undefined = undefined> =
  Output extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<Output>
    : Output extends ZodSchema
      ? z.infer<Output>
      : Output extends JSONSchema7
        ? unknown
        : undefined;

// Tripwire result extensions
export type TripwireProperties = {
  /** Tripwire data when processing was aborted */
  tripwire?: {
    reason: string;
    retry?: boolean;
    metadata?: unknown;
    processorId?: string;
  };
};

export type ScoringProperties = {
  scoringData?: ScoringData;
};

/**
 * Which OpenAI wire protocol a custom `url` endpoint speaks.
 *
 * - `'chat'` (default): `POST {url}/chat/completions` via `@ai-sdk/openai-compatible`.
 * - `'responses'`: `POST {url}/responses` via the OpenAI Responses model from `@ai-sdk/openai`.
 *   Use this for gateways that only expose some models or features (for example function
 *   tools combined with `reasoning_effort`) through the Responses API.
 *
 * Only applies when `url` is set. Provider options differ between the two protocols: the
 * chat model reads `providerOptions['openai-compatible']` / `providerOptions[providerId]`,
 * the Responses model reads `providerOptions.openai`.
 */
export type OpenAICompatibleApi = 'chat' | 'responses';

export type OpenAICompatibleConfig =
  | {
      id: `${string}/${string}`; // Model ID like "openai/gpt-4o" or "custom-provider/my-model"
      url?: string; // Optional custom URL endpoint
      apiKey?: string; // Optional API key (falls back to env vars)
      headers?: Record<string, string>; // Additional headers
      api?: OpenAICompatibleApi; // Wire protocol for custom URL endpoints (defaults to 'chat')
    }
  | {
      providerId: string; // Provider ID like "openai" or "custom-provider"
      modelId: string; // Model ID like "gpt-4o" or "my-model"
      url?: string; // Optional custom URL endpoint
      apiKey?: string; // Optional API key (falls back to env vars)
      headers?: Record<string, string>; // Additional headers
      api?: OpenAICompatibleApi; // Wire protocol for custom URL endpoints (defaults to 'chat')
    };

type DoStreamResultPromiseV2 = PromiseLike<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
type DoStreamResultPromiseV3 = PromiseLike<Awaited<ReturnType<LanguageModelV3['doStream']>>>;
type DoStreamResultPromiseV4 = PromiseLike<Awaited<ReturnType<LanguageModelV4['doStream']>>>;

/** Wrapped V2 model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV2 = Omit<LanguageModelV2, 'doGenerate' | 'doStream'> & {
  doGenerate: (options: LanguageModelV2CallOptions) => DoStreamResultPromiseV2;
  doStream: (options: LanguageModelV2CallOptions) => DoStreamResultPromiseV2;
};

/** Wrapped V3 model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV3 = Omit<LanguageModelV3, 'doGenerate' | 'doStream'> & {
  doGenerate: (options: LanguageModelV3CallOptions) => DoStreamResultPromiseV3;
  doStream: (options: LanguageModelV3CallOptions) => DoStreamResultPromiseV3;
};

/** Wrapped V4 model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV4 = Omit<LanguageModelV4, 'doGenerate' | 'doStream'> & {
  doGenerate: (options: LanguageModelV4CallOptions) => DoStreamResultPromiseV4;
  doStream: (options: LanguageModelV4CallOptions) => DoStreamResultPromiseV4;
};

export type MastraLanguageModelV1 = MastraLegacyLanguageModel;
export type MastraLegacyLanguageModel = LanguageModelV1;

/** Union of modern language models (V2/V3/V4) */
export type MastraLanguageModel = MastraLanguageModelV2 | MastraLanguageModelV3 | MastraLanguageModelV4;

export type SharedProviderOptions = SharedV2ProviderOptions | SharedV3ProviderOptions | SharedV4ProviderOptions;

// Support for:
// - "openai/gpt-4o" (magic string with autocomplete)
// - { id: "openai/gpt-4o", apiKey: "..." } (config object)
// - { id: "custom", url: "...", apiKey: "..." } (custom endpoint)
// - LanguageModelV1/V2/V3/V4 (existing AI SDK models)
export type MastraModelConfig =
  | LanguageModelV1
  | LanguageModelV2
  | LanguageModelV3
  | LanguageModelV4
  | ModelRouterModelId
  | OpenAICompatibleConfig
  | MastraLanguageModel;

export type MastraModelOptions = {
  tracingPolicy?: TracingPolicy;
};
