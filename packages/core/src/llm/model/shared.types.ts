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

/** Model routing configuration with a combined identifier or separate provider and model identifiers. */
export type OpenAICompatibleConfig =
  | {
      /** Provider and model identifiers separated by a slash. */
      id: `${string}/${string}`;
      /** Custom provider endpoint URL. */
      url?: string;
      /** API key supplied to the provider. */
      apiKey?: string;
      /** Additional provider request headers. */
      headers?: Record<string, string>;
    }
  | {
      /** Provider identifier used to route the request. */
      providerId: string;
      /** Model identifier within the provider. */
      modelId: string;
      /** Custom provider endpoint URL. */
      url?: string;
      /** API key supplied to the provider. */
      apiKey?: string;
      /** Additional provider request headers. */
      headers?: Record<string, string>;
    };

/** Asynchronous stream result from a V2 language model. */
type DoStreamResultPromiseV2 = PromiseLike<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
/** Asynchronous stream result from a V3 language model. */
type DoStreamResultPromiseV3 = PromiseLike<Awaited<ReturnType<LanguageModelV3['doStream']>>>;
/** Asynchronous stream result from a V4 language model. */
type DoStreamResultPromiseV4 = PromiseLike<Awaited<ReturnType<LanguageModelV4['doStream']>>>;

/** Wrapped V2 model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV2 = Omit<LanguageModelV2, 'doGenerate' | 'doStream'> & {
  /**
   * Generates a response through the wrapped model's stream-result interface.
   * @param options - Model call settings, prompt and cancellation signal.
   */
  doGenerate: (options: LanguageModelV2CallOptions) => DoStreamResultPromiseV2;
  /**
   * Starts a streaming model call.
   * @param options - Model call settings, prompt and cancellation signal.
   */
  doStream: (options: LanguageModelV2CallOptions) => DoStreamResultPromiseV2;
};

/** Wrapped V3 model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV3 = Omit<LanguageModelV3, 'doGenerate' | 'doStream'> & {
  /**
   * Generates a response through the wrapped model's stream-result interface.
   * @param options - Model call settings, prompt and cancellation signal.
   */
  doGenerate: (options: LanguageModelV3CallOptions) => DoStreamResultPromiseV3;
  /**
   * Starts a streaming model call.
   * @param options - Model call settings, prompt and cancellation signal.
   */
  doStream: (options: LanguageModelV3CallOptions) => DoStreamResultPromiseV3;
};

/** Wrapped V4 model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV4 = Omit<LanguageModelV4, 'doGenerate' | 'doStream'> & {
  /**
   * Generates a response through the wrapped model's stream-result interface.
   * @param options - Model call settings, prompt and cancellation signal.
   */
  doGenerate: (options: LanguageModelV4CallOptions) => DoStreamResultPromiseV4;
  /**
   * Starts a streaming model call.
   * @param options - Model call settings, prompt and cancellation signal.
   */
  doStream: (options: LanguageModelV4CallOptions) => DoStreamResultPromiseV4;
};

export type MastraLanguageModelV1 = MastraLegacyLanguageModel;
export type MastraLegacyLanguageModel = LanguageModelV1;

/** Union of modern language models (V2/V3/V4) */
export type MastraLanguageModel = MastraLanguageModelV2 | MastraLanguageModelV3 | MastraLanguageModelV4;

/** Provider-keyed options accepted by the supported modern AI SDK model interfaces. */
export type SharedProviderOptions = SharedV2ProviderOptions | SharedV3ProviderOptions | SharedV4ProviderOptions;

// Support for:
// - "openai/gpt-4o" (magic string with autocomplete)
// - { id: "openai/gpt-4o", apiKey: "..." } (config object)
// - { id: "custom", url: "...", apiKey: "..." } (custom endpoint)
// - LanguageModelV1/V2/V3/V4 (existing AI SDK models)
/** Model selected by router identifier, connection configuration or a supported model instance. */
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
