import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import type { LanguageModelV1 } from '@internal/ai-sdk-v4';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { TracingPolicy } from '../../observability';
import type { ScoringData } from './base.types';
import type { ModelRouterModelId } from './provider-registry.js';

export type inferOutput<Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Output extends ZodSchema
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
    }
  | {
      providerId: string; // Provider ID like "openai" or "custom-provider"
      modelId: string; // Model ID like "gpt-4o" or "my-model"
      url?: string; // Optional custom URL endpoint
      apiKey?: string; // Optional API key (falls back to env vars)
      headers?: Record<string, string>; // Additional headers
    };

type DoStreamResultPromise = PromiseLike<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
export type MastraLanguageModelV2 = Omit<LanguageModelV2, 'doGenerate' | 'doStream'> & {
  doGenerate: (options: LanguageModelV2CallOptions) => DoStreamResultPromise;
  doStream: (options: LanguageModelV2CallOptions) => DoStreamResultPromise;
};
export type MastraLanguageModelV1 = LanguageModelV1;
export type MastraLanguageModel = MastraLanguageModelV1 | MastraLanguageModelV2;

// Support for:
// - "openai/gpt-4o" (magic string with autocomplete)
// - { id: "openai/gpt-4o", apiKey: "..." } (config object)
// - { id: "custom", url: "...", apiKey: "..." } (custom endpoint)
// - LanguageModelV1/V2 (existing AI SDK models)
export type MastraModelConfig =
  | LanguageModelV1
  | LanguageModelV2
  | ModelRouterModelId
  | OpenAICompatibleConfig
  | MastraLanguageModel;

export type MastraModelOptions = {
  tracingPolicy?: TracingPolicy;
};
