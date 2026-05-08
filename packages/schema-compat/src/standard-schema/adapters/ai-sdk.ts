import type { Schema } from '@internal/ai-v6';
import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
import type { JSONSchema7 } from 'json-schema';
import type { StandardSchemaWithJSON, StandardSchemaWithJSONProps } from '../standard-schema.types';

/**
 * Vendor name for AI SDK wrapped schemas.
 */
const VENDOR = 'ai-sdk';

/**
 * A wrapper class that makes AI SDK Schema compatible with @standard-schema/spec.
 *
 * This class implements both `StandardSchemaV1` (validation) and `StandardJSONSchemaV1`
 * (JSON Schema conversion) interfaces. It wraps an AI SDK Schema and adapts its
 * validation method and jsonSchema property to the standard-schema interface.
 *
 * @typeParam T - The TypeScript type that the AI SDK Schema represents
 *
 * @example
 * ```typescript
 * import { jsonSchema } from '@internal/ai-v6';
 * import { toStandardSchema } from '@mastra/schema-compat/adapters/ai-sdk';
 *
 * // Create an AI SDK schema
 * const aiSdkSchema = jsonSchema<{ name: string; age: number }>({
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name', 'age'],
 * });
 *
 * // Convert to standard-schema
 * const standardSchema = toStandardSchema(aiSdkSchema);
 *
 * // Use validation (from StandardSchemaV1)
 * const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });
 *
 * // Get JSON Schema (from StandardJSONSchemaV1)
 * const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
 * ```
 */
export class AiSdkSchemaWrapper<Input = unknown, Output = Input> implements StandardSchemaWithJSON<Input, Output> {
  readonly #schema: Schema<Output>;
  readonly '~standard': StandardSchemaWithJSONProps<Input, Output>;

  constructor(schema: Schema<Output>) {
    this.#schema = schema;

    // Create the ~standard property
    this['~standard'] = {
      version: 1,
      vendor: VENDOR,
      validate: this.#validate.bind(this),
      jsonSchema: {
        input: this.#toJsonSchema.bind(this),
        output: this.#toJsonSchema.bind(this),
      },
    };
  }

  /**
   * Validates a value against the AI SDK Schema.
   *
   * @param value - The value to validate
   * @returns A result object with either the validated value or validation issues
   */
  #validate(value: unknown): StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>> {
    // Check if the schema has a validate method (it's optional on AI SDK Schema)
    if (!this.#schema.validate) {
      // If no validate method, we can't validate - just pass through
      return { value: value as Output };
    }

    try {
      const result = this.#schema.validate(value);

      // Handle both sync and async validation results
      // The AI SDK Schema.validate returns ValidationResult<OBJECT> | PromiseLike<ValidationResult<OBJECT>>
      // We need to check if it's a thenable (promise-like)
      if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
        // Wrap PromiseLike in a proper Promise to satisfy the StandardSchemaV1 interface
        return Promise.resolve(
          result as PromiseLike<{ success: true; value: Output } | { success: false; error: Error }>,
        )
          .then(res => this.#convertValidationResult(res))
          .catch((error: unknown) => {
            // Convert rejected promises to the expected { issues: [...] } shape
            const message = error instanceof Error ? error.message : 'Unknown validation error';
            return {
              issues: [{ message: `Schema validation error: ${message}` }],
            } as StandardSchemaV1.Result<Output>;
          });
      }

      // It's a sync result
      return this.#convertValidationResult(
        result as { success: true; value: Output } | { success: false; error: Error },
      );
    } catch (error) {
      // If validation fails unexpectedly, return a validation error
      const message = error instanceof Error ? error.message : 'Unknown validation error';
      return {
        issues: [{ message: `Schema validation error: ${message}` }],
      };
    }
  }

  /**
   * Converts an AI SDK ValidationResult to a StandardSchemaV1.Result.
   *
   * @param result - The AI SDK validation result
   * @returns A StandardSchemaV1.Result
   */
  #convertValidationResult(
    result: { success: true; value: Output } | { success: false; error: Error },
  ): StandardSchemaV1.Result<Output> {
    if (result.success) {
      return { value: result.value };
    }

    // Convert the AI SDK error to a Standard Schema issue
    // Cast to the failure type since TypeScript can't narrow discriminated unions with private field access
    const failureResult = result as { success: false; error: Error };
    return {
      issues: [{ message: failureResult.error.message }],
    };
  }

  /**
   * Returns the JSON Schema in the requested target format.
   *
   * @param options - Options including the target format
   * @returns The JSON Schema as a Record
   */
  #toJsonSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown> {
    const { target } = options;

    // Clone the schema to avoid mutations
    const clonedSchema = JSON.parse(JSON.stringify(this.#schema.jsonSchema)) as Record<string, unknown>;

    // Add $schema if not present, based on target
    if (!clonedSchema.$schema) {
      switch (target) {
        case 'draft-07':
          clonedSchema.$schema = 'http://json-schema.org/draft-07/schema#';
          break;
        case 'draft-2020-12':
          clonedSchema.$schema = 'https://json-schema.org/draft/2020-12/schema';
          break;
        case 'openapi-3.0':
          // OpenAPI 3.0 doesn't use $schema
          break;
        default:
          // For unknown targets, don't add $schema
          break;
      }
    }

    return clonedSchema;
  }

  /**
   * Returns the original AI SDK Schema.
   */
  getSchema(): Schema<Output> {
    return this.#schema;
  }

  /**
   * Returns the original JSON Schema from the AI SDK Schema.
   */
  getJsonSchema(): JSONSchema7 {
    return this.#schema.jsonSchema as JSONSchema7;
  }
}

/**
 * Wraps an AI SDK Schema to implement the full @standard-schema/spec interface.
 *
 * This function creates a wrapper that implements both `StandardSchemaV1` (validation)
 * and `StandardJSONSchemaV1` (JSON Schema conversion) interfaces.
 *
 * @typeParam T - The TypeScript type that the AI SDK Schema represents
 * @param schema - The AI SDK Schema to wrap
 * @returns A wrapper implementing StandardSchemaWithJSON
 *
 * @example
 * ```typescript
 * import { jsonSchema } from '@internal/ai-v6';
 * import { toStandardSchema } from '@mastra/schema-compat/adapters/ai-sdk';
 *
 * const aiSdkSchema = jsonSchema<{ name: string; age: number }>({
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name', 'age'],
 * });
 *
 * const standardSchema = toStandardSchema(aiSdkSchema);
 *
 * // Validate data
 * const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });
 *
 * // Get JSON Schema
 * const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
 * ```
 */
export function toStandardSchema<T = unknown>(schema: Schema<T>): AiSdkSchemaWrapper<T, T> {
  return new AiSdkSchemaWrapper<T, T>(schema);
}
