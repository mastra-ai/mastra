import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV1 } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { TracingPolicy } from '../../ai-tracing';
import type { ScoringData } from './base.types';

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

export type MastraLanguageModel = LanguageModelV1 | LanguageModelV2;
export type MastraLanguageModelV2 = LanguageModelV2;

export type MastraModelOptions = {
  tracingPolicy?: TracingPolicy;
};
