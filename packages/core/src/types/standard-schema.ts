/**
 * Standard Schema types for Mastra
 *
 * This module provides types for working with Standard Schema (https://standardschema.dev/),
 * a universal schema interface that allows different validation libraries
 * (Zod, Valibot, ArkType, etc.) to interoperate.
 *
 * By embracing Standard Schema, Mastra users can bring their own validation library
 * while maintaining full compatibility with Mastra's tool system.
 */

/**
 * Standard Schema V1 interface.
 *
 * This is the core interface that validation libraries implement to be
 * Standard Schema compliant. Libraries like Zod (v3.25+), Valibot, ArkType,
 * and others implement this interface.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (value: unknown, options?: Options | undefined) => Result<Output> | Promise<Result<Output>>;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Options for validate function. */
  export interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** A falsy value for `issues` indicates success. */
    readonly issues?: undefined;
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }

  /** Infers the input type of a Standard Schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input'];

  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output'];
}

/**
 * Standard JSON Schema V1 interface.
 *
 * This interface extends StandardTypedV1 to add JSON Schema generation capabilities.
 * Libraries that can convert their schemas to JSON Schema implement this interface.
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  /** The Standard JSON Schema properties. */
  readonly '~standard': StandardJSONSchemaV1.Props<Input, Output>;
}

export namespace StandardJSONSchemaV1 {
  /** The Standard JSON Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
    /** Methods for generating the input/output JSON Schema. */
    readonly jsonSchema: Converter;
  }

  /** The Standard JSON Schema converter interface. */
  export interface Converter {
    /** Converts the input type to JSON Schema. May throw if conversion is not supported. */
    readonly input: (options: Options) => Record<string, unknown>;
    /** Converts the output type to JSON Schema. May throw if conversion is not supported. */
    readonly output: (options: Options) => Record<string, unknown>;
  }

  /**
   * The target version of the generated JSON Schema.
   *
   * It is *strongly recommended* that implementers support `"draft-2020-12"` and `"draft-07"`,
   * as they are both in wide use. All other targets can be implemented on a best-effort basis.
   */
  export type Target = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | ({} & string);

  /** The options for the input/output methods. */
  export interface Options {
    /** Specifies the target version of the generated JSON Schema. */
    readonly target: Target;
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The Standard types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Infers the input type of a Standard JSON Schema. */
  export type InferInput<Schema extends StandardJSONSchemaV1> = NonNullable<Schema['~standard']['types']>['input'];

  /** Infers the output type of a Standard JSON Schema. */
  export type InferOutput<Schema extends StandardJSONSchemaV1> = NonNullable<Schema['~standard']['types']>['output'];
}

/**
 * Checks if a value is a Standard Schema (implements the ~standard interface).
 *
 * @param value - The value to check
 * @returns True if the value implements StandardSchemaV1, false otherwise
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as any)['~standard'] === 'object' &&
    (value as any)['~standard'] !== null &&
    typeof (value as any)['~standard'].version === 'number' &&
    typeof (value as any)['~standard'].vendor === 'string' &&
    typeof (value as any)['~standard'].validate === 'function'
  );
}

/**
 * Checks if a value is a Standard JSON Schema (implements JSON Schema generation).
 *
 * @param value - The value to check
 * @returns True if the value implements StandardJSONSchemaV1, false otherwise
 */
export function isStandardJSONSchema(value: unknown): value is StandardJSONSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as any)['~standard'] === 'object' &&
    (value as any)['~standard'] !== null &&
    typeof (value as any)['~standard'].jsonSchema === 'object' &&
    typeof (value as any)['~standard'].jsonSchema.input === 'function'
  );
}
