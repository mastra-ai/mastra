import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { StandardSchemaWithJSON } from './standard-schema/standard-schema.types';

/**
 * Recursively converts null values to undefined in an object based on which
 * properties are optional in the JSON Schema. This is needed because OpenAI
 * strict mode sends null for optional fields, but schemas like Zod's .optional()
 * reject null.
 *
 * Only converts null→undefined for properties that are NOT in the schema's
 * `required` array, preserving null for explicitly .nullable() fields.
 */
export function transformNullToUndefined(value: unknown, jsonSchema: Record<string, unknown>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    if (Array.isArray(value) && jsonSchema.items && typeof jsonSchema.items === 'object') {
      return value.map(item => transformNullToUndefined(item, jsonSchema.items as Record<string, unknown>));
    }
    return value;
  }

  const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) {
    return value;
  }

  const required = (jsonSchema.required as string[]) || [];
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === null && !required.includes(key)) {
      // Optional field with null value → convert to undefined
      result[key] = undefined;
    } else if (val !== null && typeof val === 'object' && properties[key]) {
      // Recurse into nested objects/arrays
      result[key] = transformNullToUndefined(val, properties[key]);
    } else {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Resolve a nullable wrapper (`anyOf: [<schema>, { type: 'null' }]`) down to its
 * non-null variant, matching the resolution the provider `#traverse` helpers do.
 */
function resolveNullableVariant(schema: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(schema.anyOf)) {
    const nonNull = (schema.anyOf as unknown[]).find(
      (s): s is Record<string, unknown> =>
        !!s && typeof s === 'object' && (s as Record<string, unknown>).type !== 'null',
    );
    if (nonNull) {
      return nonNull;
    }
  }
  return schema;
}

/**
 * Recursively convert `null` → `undefined` for the optional fields of a
 * processed schema.
 *
 * Providers return `null` for an "absent" optional/defaulted field, but the
 * different compat layers express optionality two ways:
 *
 * - **Standard JSON Schema** (Anthropic, Google, DeepSeek, Meta): the field is
 *   simply omitted from the object's `required` array.
 * - **OpenAI strict mode**: every property must appear in `required`, so the
 *   originally optional / defaulted fields are instead tracked in `x-optional`.
 *
 * A field is therefore treated as optional when it is listed in `x-optional`
 * **or** not present in `required`. Genuinely required fields — including
 * `.nullable()` ones, which stay in `required` — keep their `null` so explicit
 * null values survive. Converting optional nulls back to `undefined` lets the
 * original Zod schema apply `.optional()` / `.default()` semantics when the
 * tool-call / structured-output result is validated; without it the result
 * fails with "expected <type>, received null".
 *
 * Mutates and returns `value` (matching the provider `#traverse` convention).
 */
export function convertOptionalNullsToUndefined(value: unknown, jsonSchema: Record<string, unknown>): unknown {
  if (value === null || value === undefined || typeof jsonSchema !== 'object' || jsonSchema === null) {
    return value;
  }

  const resolved = resolveNullableVariant(jsonSchema);

  const isArrayType =
    resolved.type === 'array' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('array'));
  if (isArrayType) {
    const items = resolved.items;
    if (Array.isArray(value) && items && typeof items === 'object') {
      const itemSchema = items as Record<string, unknown>;
      for (let i = 0; i < value.length; i++) {
        value[i] = convertOptionalNullsToUndefined(value[i], itemSchema);
      }
    }
    return value;
  }

  const isObjectType =
    resolved.type === 'object' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('object'));
  if (!isObjectType || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const properties = resolved.properties as Record<string, Record<string, unknown>> | undefined;
  const requiredKeys = new Set((resolved.required as string[] | undefined) ?? []);
  const optionalKeys = new Set((resolved['x-optional'] as string[] | undefined) ?? []);
  const isOptional = (key: string) => optionalKeys.has(key) || !requiredKeys.has(key);
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (obj[key] === null && isOptional(key)) {
      obj[key] = undefined;
    } else if (properties?.[key]) {
      obj[key] = convertOptionalNullsToUndefined(obj[key], properties[key]);
    }
  }

  return obj;
}

/**
 * Wraps a StandardSchemaWithJSON to transform null values to undefined for
 * optional fields before validation. This is a schema-agnostic solution for
 * OpenAI strict mode, which sends null for optional fields.
 *
 * The wrapper:
 * 1. Extracts the JSON Schema from the inner schema to determine optional fields
 * 2. Before validation, transforms null→undefined for non-required properties
 * 3. Delegates validation to the inner schema with the transformed value
 * 4. Delegates JSON Schema conversion to the inner schema unchanged
 */
export function wrapSchemaWithNullTransform<Input = unknown, Output = Input>(
  schema: StandardSchemaWithJSON<Input, Output>,
): StandardSchemaWithJSON<Input, Output> {
  // Extract JSON Schema to know which fields are optional
  let jsonSchema: Record<string, unknown> | undefined;
  try {
    jsonSchema = schema['~standard'].jsonSchema.input({ target: 'draft-07' });
  } catch {
    // If we can't get JSON Schema, fall through to unwrapped validation
  }

  if (!jsonSchema) {
    return schema;
  }

  const innerProps = schema['~standard'];

  return {
    '~standard': {
      version: innerProps.version,
      vendor: innerProps.vendor,
      types: innerProps.types,
      validate: (
        value: unknown,
        options?: StandardSchemaV1.Options,
      ): StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>> => {
        const transformed = transformNullToUndefined(value, jsonSchema);
        return innerProps.validate(transformed, options);
      },
      jsonSchema: innerProps.jsonSchema,
    },
  } as StandardSchemaWithJSON<Input, Output>;
}
