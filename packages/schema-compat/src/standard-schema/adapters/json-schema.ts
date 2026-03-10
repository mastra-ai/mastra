import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
import Ajv from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import traverse from 'json-schema-traverse';
import type { StandardSchemaWithJSON, StandardSchemaWithJSONProps } from '../standard-schema.types';

/**
 * Vendor name for JSON Schema wrapped schemas.
 */
const VENDOR = 'json-schema';

/**
 * Options for creating a Standard Schema from JSON Schema.
 */
export interface JsonSchemaAdapterOptions {
  /**
   * Custom name for the schema (used for error messages).
   */
  name?: string;

  /**
   * Ajv options to customize validation behavior.
   * @see https://ajv.js.org/options.html
   */
  ajvOptions?: ConstructorParameters<typeof Ajv>[0];
}

/**
 * A wrapper class that makes JSON Schema compatible with @standard-schema/spec.
 *
 * This class implements both `StandardSchemaV1` (validation) and `StandardJSONSchemaV1`
 * (JSON Schema conversion) interfaces. Validation is performed using Ajv (Another JSON
 * Schema Validator).
 *
 * @typeParam T - The TypeScript type that the JSON Schema represents
 *
 * @example
 * ```typescript
 * import { toStandardSchema } from '@mastra/schema-compat/adapters/json-schema';
 *
 * const userJsonSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number', minimum: 0 },
 *   },
 *   required: ['name', 'age'],
 * } as const;
 *
 * const standardSchema = toStandardSchema<{ name: string; age: number }>(userJsonSchema);
 *
 * // Use validation (from StandardSchemaV1)
 * const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });
 *
 * // Get JSON Schema (from StandardJSONSchemaV1)
 * const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
 * ```
 */
export class JsonSchemaWrapper<Input = unknown, Output = Input> implements StandardSchemaWithJSON<Input, Output> {
  readonly #schema: JSONSchema7;
  readonly #options: JsonSchemaAdapterOptions;
  #ajvValidateCache: ReturnType<Ajv['compile']> | null = null;
  #ajvInstance: Ajv | null = null;

  readonly '~standard': StandardSchemaWithJSONProps<Input, Output>;

  constructor(schema: JSONSchema7, options: JsonSchemaAdapterOptions = {}) {
    this.#schema = schema;
    this.#options = options;

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
   * Validates a value against the JSON Schema using Ajv.
   *
   * @param value - The value to validate
   * @returns A result object with either the validated value or validation issues
   */
  #validate(value: unknown): StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>> {
    try {
      const validateFn = this.#getAjvValidator();
      const result = validateFn(value);

      // Handle async validators (when schema uses $async: true)
      if ((validateFn as any).$async) {
        return (result as Promise<void>)
          .then(() => ({ value: value as Output }))
          .catch(err => {
            const errors = (err as any)?.errors ?? [];
            const issues: StandardSchemaV1.Issue[] = errors.map((e: any) => ({
              message: e.message ?? 'Validation error',
              path: this.#ajvPathToStandardPath(e.instancePath),
            }));
            return { issues };
          });
      }

      if (result) {
        return { value: value as Output };
      }

      // Convert Ajv errors to Standard Schema issues
      const issues: StandardSchemaV1.Issue[] = (validateFn.errors ?? []).map(err => ({
        message: err.message ?? 'Validation error',
        path: this.#ajvPathToStandardPath(err.instancePath),
      }));

      return { issues };
    } catch (error) {
      // If validation fails unexpectedly, return a validation error
      const message = error instanceof Error ? error.message : 'Unknown validation error';
      return {
        issues: [{ message: `Schema validation error: ${message}` }],
      };
    }
  }

  /**
   * Converts an Ajv instance path (e.g., "/foo/0/bar") to a Standard Schema path array.
   *
   * @param instancePath - The Ajv instance path
   * @returns An array of path segments
   */
  #ajvPathToStandardPath(instancePath: string): Array<PropertyKey> {
    if (!instancePath || instancePath === '') {
      return [];
    }

    // Remove leading slash and split by '/'
    const parts = instancePath.slice(1).split('/');

    return parts.map(part => {
      // Try to parse as number for array indices
      const num = parseInt(part, 10);
      if (!isNaN(num) && String(num) === part) {
        return num;
      }
      // Decode JSON Pointer escapes: ~1 -> /, ~0 -> ~
      return part.replace(/~1/g, '/').replace(/~0/g, '~');
    });
  }

  /**
   * Returns the JSON Schema in the requested target format.
   *
   * Since we're already working with JSON Schema, this is mostly a pass-through.
   * Different targets may require slight modifications in the future.
   *
   * @param options - Options including the target format
   * @returns The JSON Schema as a Record
   */
  #toJsonSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown> {
    const { target } = options;

    // Clone the schema to avoid mutations
    const clonedSchema = JSON.parse(JSON.stringify(this.#schema)) as Record<string, unknown>;

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

    if (options?.libraryOptions?.override) {
      const override = options.libraryOptions.override as (ctx: { jsonSchema: traverse.SchemaObject }) => void;
      traverse(clonedSchema, {
        cb: {
          post: schema => {
            override({
              jsonSchema: schema,
            });
          },
        },
      });
    }

    return clonedSchema;
  }

  /**
   * Gets or creates an Ajv validator for the schema.
   * The validator is cached for performance.
   */
  #getAjvValidator(): ReturnType<Ajv['compile']> {
    if (!this.#ajvValidateCache) {
      this.#ajvInstance = new Ajv({
        allErrors: true, // Report all errors, not just the first one
        strict: false, // Be lenient with schema keywords
        ...this.#options.ajvOptions,
      });

      this.#ajvValidateCache = this.#ajvInstance.compile(this.#schema);
    }
    return this.#ajvValidateCache;
  }

  /**
   * Returns the original JSON Schema.
   */
  getSchema(): JSONSchema7 {
    return this.#schema;
  }

  /**
   * Returns the Ajv instance used for validation.
   * Useful for advanced use cases like adding custom formats or keywords.
   */
  getAjv(): Ajv {
    // Ensure the validator is created (which creates the Ajv instance)
    this.#getAjvValidator();
    return this.#ajvInstance!;
  }
}

/**
 * Wraps a JSON Schema to implement the full @standard-schema/spec interface.
 *
 * This function creates a wrapper that implements both `StandardSchemaV1` (validation)
 * and `StandardJSONSchemaV1` (JSON Schema conversion) interfaces. Validation is performed
 * using Ajv (Another JSON Schema Validator).
 *
 * @typeParam T - The TypeScript type that the JSON Schema represents
 * @param schema - The JSON Schema to wrap
 * @param options - Optional configuration options
 * @returns A wrapper implementing StandardSchemaWithJSON
 *
 * @example
 * ```typescript
 * import { toStandardSchema } from '@mastra/schema-compat/adapters/json-schema';
 *
 * const userSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name'],
 * } as const;
 *
 * type User = { name: string; age?: number };
 *
 * const standardSchema = toStandardSchema<User>(userSchema);
 *
 * // Validate data
 * const result = standardSchema['~standard'].validate({ name: 'John' });
 *
 * // Get JSON Schema
 * const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
 * ```
 */
export function toStandardSchema<T = unknown>(
  schema: JSONSchema7,
  options?: JsonSchemaAdapterOptions,
): JsonSchemaWrapper<T, T> {
  return new JsonSchemaWrapper<T, T>(schema, options);
}
