import type { Schema } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import type { StandardSchemaWithJSON } from './standard-schema.types';

export type { StandardSchemaWithJSON, InferOutput as InferStandardSchemaOutput } from './standard-schema.types';

export type PublicSchema<Output = unknown, Input = Output> =
  | z4.ZodType<Output, Input>
  | z3.Schema<Output, z3.ZodTypeDef, Input>
  | Schema<Output>
  | JSONSchema7
  | StandardSchemaWithJSON<Input, Output>;

export type InferPublicSchema<T extends PublicSchema> = T extends PublicSchema<infer Output> ? Output : never;

export { toStandardSchema, isStandardSchemaWithJSON } from './standard-schema';
