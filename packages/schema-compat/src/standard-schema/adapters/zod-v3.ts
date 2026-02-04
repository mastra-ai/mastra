import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
import traverse from 'json-schema-traverse';
// Use zod/v3 types for v3 compatibility (v4's v3-compat layer)
import type { ZodType, ZodTypeDef } from 'zod/v3';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';
import type {
  StandardSchemaWithJSON,
  StandardSchemaWithJSONProps,
  ZodToJsonSchemaTarget,
} from '../standard-schema.types';
/**
 * Target mapping from Standard Schema targets to zod-to-json-schema targets.
 */
const TARGET_MAP: Record<string, ZodToJsonSchemaTarget> = {
  'draft-07': 'jsonSchema7',
  'openapi-3.0': 'openApi3',
};

/**
 * Converts a Zod schema to JSON Schema using the specified target format.
 *
 * @param zodSchema - The Zod schema to convert
 * @param options - Standard Schema JSON options including the target format
 * @returns The JSON Schema representation
 * @throws Error if the target format is not supported
 *
 * @internal
 */
function convertToJsonSchema<T extends ZodType<any, ZodTypeDef, any>>(
  zodSchema: T,
  options: StandardJSONSchemaV1.Options,
): Record<string, unknown> {
  const target = TARGET_MAP[options.target];

  if (!target) {
    // For unknown targets, try to use jsonSchema7 as fallback or throw
    const supportedTargets = Object.keys(TARGET_MAP);
    throw new Error(
      `Unsupported JSON Schema target: "${options.target}". ` + `Supported targets are: ${supportedTargets.join(', ')}`,
    );
  }

  const jsonSchema = zodToJsonSchemaOriginal(zodSchema, {
    $refStrategy: 'none',
    target,
  });

  traverse(jsonSchema, {
    cb: {
      pre: schema => {
        if (schema.type === 'string' && schema.format === 'email') {
          schema.pattern = `^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$`;
        }
      },
      // post: (schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema) => {
      //   this.postProcessJSONNode(schema, parentSchema);
      // },
    },
  });

  return jsonSchema as Record<string, unknown>;
}

/**
 * Wraps a Zod v3 schema to implement the full @standard-schema/spec interface.
 *
 * While Zod v3 natively implements `StandardSchemaV1` (validation), it does not
 * implement `StandardJSONSchemaV1` (JSON Schema conversion). This adapter adds
 * the `jsonSchema` property to provide JSON Schema conversion capabilities.
 *
 * @typeParam T - The Zod schema type
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { toStandardSchema } from '@mastra/schema-compat/adapters/zod-v3';
 *
 * const userSchema = z.object({
 *   name: z.string(),
 *   age: z.number().min(0),
 * });
 *
 * const standardSchema = toStandardSchema(userSchema);
 *
 * // Use validation (from StandardSchemaV1)
 * const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });
 *
 * // Get JSON Schema (from StandardJSONSchemaV1)
 * const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
 * ```
 */
export function toStandardSchema<T>(zodSchema: ZodType<T, ZodTypeDef, T>): T & StandardSchemaWithJSON<T, T> {
  // Create a wrapper object that includes the jsonSchema converter
  const wrapper = Object.create(zodSchema) as T & StandardSchemaWithJSON<T, T>;

  // Get the existing ~standard property from Zod
  const existingStandard = zodSchema['~standard'] as StandardSchemaV1.Props<T, T>;

  // Create the JSON Schema converter
  const jsonSchemaConverter: StandardJSONSchemaV1.Converter = {
    input: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
      return convertToJsonSchema(zodSchema, options);
    },
    output: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
      // For Zod schemas, input and output JSON Schema are typically the same
      // unless using transforms, which would need special handling
      return convertToJsonSchema(zodSchema, options);
    },
  };

  // Define the enhanced ~standard property
  Object.defineProperty(wrapper, '~standard', {
    value: {
      ...existingStandard,
      jsonSchema: jsonSchemaConverter,
    } satisfies StandardSchemaWithJSONProps<T, T>,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return wrapper;
}
