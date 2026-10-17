import type { LanguageModelV4, LanguageModelV4CallOptions, SharedV4ProviderOptions } from '@ai-sdk/provider';
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

export type OpenAICompatibleConfig =
  | {
      id: `${string}/${string}`; // Model ID like "openai/gpt-4o" or "custom-provider/my-model"
      url?: string; // Optional custom URL endpoint
      apiKey?: string; // Optional API key (falls back to env vars)
      headers?: Record<string, string>; // Additional headers
      api?: 'chat' | 'responses'; // OpenAI wire API for custom url; defaults to 'chat'
    }
  | {
      providerId: string; // Provider ID like "openai" or "custom-provider"
      modelId: string; // Model ID like "gpt-4o" or "my-model"
      url?: string; // Optional custom URL endpoint
      apiKey?: string; // Optional API key (falls back to env vars)
      headers?: Record<string, string>; // Additional headers
      api?: 'chat' | 'responses'; // OpenAI wire API for custom url; defaults to 'chat'
    };

type DoStreamResultPromise = PromiseLike<Awaited<ReturnType<LanguageModelV4['doStream']>>>;

/** Wrapped AI SDK v7 (spec v4) model with unified doGenerate/doStream that returns streams */
export type MastraLanguageModelV4 = Omit<LanguageModelV4, 'doGenerate' | 'doStream'> & {
  /** Full `provider/model` ID the model was resolved from, when known (see {@link IdentifiedModelConfig}). */
  id?: string;
  doGenerate: (options: LanguageModelV4CallOptions) => DoStreamResultPromise;
  doStream: (options: LanguageModelV4CallOptions) => DoStreamResultPromise;
};

export type MastraLanguageModel = MastraLanguageModelV4;

export type SharedProviderOptions = SharedV4ProviderOptions;

// Support for:
// - "openai/gpt-4o" (magic string with autocomplete)
// - { id: "openai/gpt-4o", apiKey: "..." } (config object)
// - { id: "custom", url: "...", apiKey: "..." } (custom endpoint)
// - LanguageModelV4 (AI SDK v7 models)
// - { model, id: "mastra/openai/gpt-4o" } (any of the above, labeled with its full model ID)
type BaseModelConfig =
  | LanguageModelV4
  | ModelRouterModelId
  | OpenAICompatibleConfig
  | MastraLanguageModel;

/**
 * A model labeled with the full `provider/model` ID it was built from (including any route
 * prefix such as `mastra/`). Useful when a dynamic model function builds a model instance whose
 * own `provider`/`modelId` fields no longer carry that ID. The resolved model exposes it as `id`.
 */
export type IdentifiedModelConfig = {
  model: BaseModelConfig;
  id: string;
};

export type MastraModelConfig = BaseModelConfig | IdentifiedModelConfig;

/**
 * Replaces the model-id literal union (`ModelRouterModelId`) inside `T` with plain `string`,
 * leaving every other member (language model objects, config objects, functions, arrays) as-is.
 *
 * Keep `MastraModelConfig` on public config fields so users get autocomplete, but widen with
 * this before merging model values in internal code (`a ?? b`, ternaries, array literals):
 * those expressions make TypeScript subtype-reduce the union, which scales with the number of
 * model-id literals and fails with "union type is too complex" (TS2590) once the registry is
 * large enough. `string` is assignable back to `ModelRouterModelId`, so widened values can
 * still be passed anywhere the public type is expected.
 */
export type WidenModelId<T> = T extends ModelRouterModelId ? string : T;

/** `MastraModelConfig` with model-id literals widened to `string`. See {@link WidenModelId}. */
export type WidenedMastraModelConfig = WidenModelId<MastraModelConfig>;

export type MastraModelOptions = {
  tracingPolicy?: TracingPolicy;
};
