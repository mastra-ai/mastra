import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV1 } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { TracingPolicy } from '../../ai-tracing';
import type { ScoringData } from './base.types';
import type { ModelRouterModelId } from './provider-registry.generated';

export type inferOutput<Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Output extends ZodSchema
  ? z.infer<Output>
  : Output extends JSONSchema7
    ? unknown
    : undefined;

// Tripwire result extensions
export type TripwireProperties = {
  tripwire?: boolean;
  tripwireReason?: string;
};

export type ScoringProperties = {
  scoringData?: ScoringData;
};

export type OpenAICompatibleConfig = {
  id: string; // Model ID like "gpt-4o" or "openai/gpt-4o"
  url?: string; // Optional custom URL endpoint
  apiKey?: string; // Optional API key (falls back to env vars)
  headers?: Record<string, string>; // Additional headers
};

export type MastraLanguageModel = LanguageModelV1 | LanguageModelV2;

// Support for:
// - "openai/gpt-4o" (magic string with autocomplete)
// - { id: "openai/gpt-4o", apiKey: "..." } (config object)
// - { id: "custom", url: "...", apiKey: "..." } (custom endpoint)
// - LanguageModelV1/V2 (existing AI SDK models)
export type MastraModelConfig = MastraLanguageModel | ModelRouterModelId | OpenAICompatibleConfig;

export type MastraLanguageModelV2 = LanguageModelV2;

export type MastraModelOptions = {
  tracingPolicy?: TracingPolicy;
};
