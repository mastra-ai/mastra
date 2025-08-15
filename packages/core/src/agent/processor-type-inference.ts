import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import type { GenerateTextResult, GenerateObjectResult } from '../llm/model/base.types';
import type { OutputProcessor } from '../processors';
import type { StructuredOutputProcessor } from '../processors/processors/structured-output';

/**
 * Extract schema type from StructuredOutputProcessor
 */
type ExtractExperimentalSchema<T> = T extends StructuredOutputProcessor<infer Schema> ? Schema : never;

/**
 * Extract all schemas from an array of processors
 * Returns the first StructuredOutputProcessor schema found, or never if none
 */
type ExtractProcessorSchemas<T extends readonly OutputProcessor[]> = T extends readonly [infer First, ...infer Rest]
  ? First extends StructuredOutputProcessor<any>
    ? ExtractExperimentalSchema<First>
    : Rest extends readonly OutputProcessor[]
      ? ExtractProcessorSchemas<Rest>
      : never
  : T extends readonly []
    ? never
    : never;

/**
 * Enhanced GenerateTextResult that includes properly typed object
 * based on the processors used
 */
export type GenerateTextResultWithProcessors<PROCESSORS extends readonly OutputProcessor[] = []> =
  GenerateTextResult<any> & {
    object?: ExtractProcessorSchemas<PROCESSORS> extends never ? undefined : ExtractProcessorSchemas<PROCESSORS>;
  };

/**
 * Type for the generate method return based on whether output or processors are used
 */
export type InferGenerateResult<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined,
  PROCESSORS extends readonly OutputProcessor[],
> = OUTPUT extends undefined ? GenerateTextResultWithProcessors<PROCESSORS> : GenerateObjectResult<OUTPUT>;
