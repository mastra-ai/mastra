import type { StandardJSONSchemaV1, StandardSchemaV1, StandardTypedV1 } from '@standard-schema/spec';

/**
 * Type for schemas that implement both StandardSchemaV1 and StandardJSONSchemaV1.
 * This combined type provides both validation and JSON Schema conversion capabilities.
 */
export type StandardSchemaWithJSON<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output> &
  StandardJSONSchemaV1<Input, Output>;

/**
 * Props type for the combined standard schema interface.
 */
export type StandardSchemaWithJSONProps<Input = unknown, Output = Input> = StandardSchemaV1.Props<Input, Output> &
  StandardJSONSchemaV1.Props<Input, Output>;

/**
 * Utility type to infer the input type from a StandardSchemaV1 or StandardJSONSchemaV1.
 */
export type InferInput<T extends StandardTypedV1> = StandardTypedV1.InferInput<T>;

/**
 * Utility type to infer the output type from a StandardSchemaV1 or StandardJSONSchemaV1.
 */
export type InferOutput<T extends StandardTypedV1> = StandardTypedV1.InferOutput<T>;

/**
 * Supported targets for zod-to-json-schema conversion.
 */
export type ZodToJsonSchemaTarget = 'jsonSchema7' | 'openApi3' | 'jsonSchema2019-09';

export type StandardSchemaIssue = StandardSchemaV1.Issue;
