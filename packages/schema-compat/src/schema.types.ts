import type { Schema as SchemaV4 } from '@internal/ai-sdk-v4';
import type { Schema as SchemaV5 } from '@internal/ai-sdk-v5';
import type { Schema as SchemaV6 } from '@internal/ai-v6';
import type { JSONSchema7 } from 'json-schema';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import type { StandardSchemaWithJSON } from './standard-schema/standard-schema.types';

export type ZodType = z4.ZodType<any, any> | z3.Schema<any, z3.ZodTypeDef, any>;
export type ZodOptional = z4.ZodOptional<any> | z3.ZodOptional<any>;
export type ZodObject = z4.ZodObject<any, any> | z3.ZodObject<any, any, any, any, any>;
export type ZodArray = z4.ZodArray<any> | z3.ZodArray<any, any>;
export type ZodUnion = z4.ZodUnion<any> | z3.ZodUnion<any>;
export type ZodString = z4.ZodString | z3.ZodString;
export type ZodNumber = z4.ZodNumber | z3.ZodNumber;
export type ZodDate = z4.ZodDate | z3.ZodDate;
export type ZodDefault = z4.ZodDefault<any> | z3.ZodDefault<any>;

export type PublicSchema<Output = unknown, Input = Output> =
  | z4.ZodType<Output, Input>
  | z3.Schema<Output, z3.ZodTypeDef, Input>
  | SchemaV4<Output>
  | SchemaV5<Output>
  | SchemaV6<Output>
  | JSONSchema7
  | StandardSchemaWithJSON<Input, Output>;

/**
 * Infers the output type from a PublicSchema using cascading structural checks.
 *
 * Inferring directly from the PublicSchema union (`T extends PublicSchema<infer O>`)
 * is fragile — third-party module augmentations on ZodType (e.g. @hono/zod-openapi)
 * can exceed TypeScript's inference limits, silently widening the result to `any`.
 *
 * Checking each union member individually via structural properties (`_output`,
 * `_type`, `~standard`) keeps each inference site simple and isolated. The original
 * union inference is preserved as a final fallback for non-Zod types (e.g.
 * `StandardSchemaWithJSON<X>`) where augmentation is not a concern.
 */
export type InferPublicSchema<T extends PublicSchema> = T extends { _output: infer Output }
  ? Output
  : T extends { _type: infer Output }
    ? Output
    : T extends { '~standard': { types: { output: infer Output } } }
      ? Output
      : T extends JSONSchema7
        ? unknown
        : T extends PublicSchema<infer Output>
          ? Output
          : never;
