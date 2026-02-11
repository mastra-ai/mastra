import type { Schema } from '@internal/ai-v6';
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
  | Schema<Output>
  | JSONSchema7
  | StandardSchemaWithJSON<Input, Output>;

export type InferPublicSchema<T extends PublicSchema> = T extends PublicSchema<infer Output> ? Output : never;
