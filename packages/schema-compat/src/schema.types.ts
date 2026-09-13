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

export type AISdkSchemaLike<Output = unknown> = { _type: Output };

/**
 * A shallow structural boundary for Zod schemas.
 *
 * Using the full Zod v3 and v4 types in `PublicSchema` forces TypeScript to
 * deeply compare both type trees whenever a concrete schema is inferred. The
 * properties below are shared by supported Zod versions and mirror the shape
 * checked by the runtime Zod guard.
 */
type StructuralZodSchema<Output = unknown, Input = Output> = {
  readonly _output: Output;
  readonly _input: Input;
  parse(data: unknown): Output;
  safeParse(data: unknown): unknown;
} & ({ readonly _def: unknown } | { readonly _zod: unknown });

export type PublicSchema<Output = unknown, Input = Output> =
  | StructuralZodSchema<Output, Input>
  | SchemaV4<Output>
  | SchemaV5<Output>
  | SchemaV6<Output>
  | JSONSchema7
  | StandardSchemaWithJSON<Input, Output>
  | AISdkSchemaLike<Output>;

export type InferPublicSchema<T extends PublicSchema> = T extends { _output: infer Output }
  ? Output
  : T extends { _type: infer Output }
    ? Output
    : T extends { '~standard': { types: { output: infer O } } }
      ? O
      : T extends PublicSchema<infer Output>
        ? Output
        : never;
