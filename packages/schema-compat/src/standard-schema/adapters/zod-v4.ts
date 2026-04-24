import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
import { toJSONSchema } from 'zod/v4';
import type { StandardSchemaWithJSON, StandardSchemaWithJSONProps } from '../standard-schema.types';

/**
 * Supported JSON Schema targets for z.toJSONSchema().
 * Works with both real Zod v4 and Zod 3.25's v4 compat layer.
 */
const SUPPORTED_TARGETS = new Set(['draft-07', 'draft-04', 'draft-2020-12']);

/**
 * Maps Mastra's target names to Zod v4's expected format.
 * Zod v4's z.toJSONSchema() expects "draft-7" instead of "draft-07",
 * and "draft-4" instead of "draft-04".
 */
const ZOD_V4_TARGET_MAP: Record<string, string> = {
  'draft-07': 'draft-7',
  'draft-04': 'draft-4',
};

/**
 * Options for the Zod v4 adapter's JSON Schema conversion.
 */
export interface ZodV4AdapterOptions {
  unrepresentable?: 'any' | 'error';
  override?: (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }) => undefined;
}

/**
 * Converts a Zod v4 schema to JSON Schema using z.toJSONSchema().
 *
 * Works with both real Zod v4 and Zod 3.25's v4 compat layer.
 *
 * @internal
 */
function convertToJsonSchema(
  zodSchema: unknown,
  options: StandardJSONSchemaV1.Options,
  adapterOptions: ZodV4AdapterOptions,
): Record<string, unknown> {
  const target = SUPPORTED_TARGETS.has(options.target) ? options.target : 'draft-07';

  const jsonSchemaOptions: Record<string, unknown> = {
    target: ZOD_V4_TARGET_MAP[target] ?? target,
  };

  if (adapterOptions.unrepresentable) {
    jsonSchemaOptions.unrepresentable = adapterOptions.unrepresentable;
  }

  // The override option works in real Zod v4 but is a no-op in 3.25 compat.
  if (adapterOptions.override) {
    jsonSchemaOptions.override = adapterOptions.override;
  }

  return toJSONSchema(zodSchema as Parameters<typeof toJSONSchema>[0], jsonSchemaOptions) as Record<string, unknown>;
}

/**
 * Wraps a Zod v4 schema to implement the full @standard-schema/spec interface.
 *
 * Zod v4 schemas (and Zod 3.25's v4 compat layer) implement `StandardSchemaV1`
 * (validation) but may not implement `StandardJSONSchemaV1` (JSON Schema conversion)
 * on the `~standard` property. This adapter adds the `jsonSchema` property using
 * `z.toJSONSchema()` to provide JSON Schema conversion capabilities.
 *
 * @param zodSchema - A Zod v4 schema (has `_zod` property)
 * @param adapterOptions - Options passed to z.toJSONSchema()
 * @returns The schema wrapped with StandardSchemaWithJSON support
 */
export function toStandardSchema<T>(
  zodSchema: T & { _zod: unknown; '~standard': StandardSchemaV1.Props },
  adapterOptions: ZodV4AdapterOptions = {},
): T & StandardSchemaWithJSON {
  // Create a wrapper object that preserves the original schema's prototype chain
  const wrapper = Object.create(zodSchema) as T & StandardSchemaWithJSON;

  // Get the existing ~standard property from Zod
  const existingStandard = (zodSchema as any)['~standard'] as StandardSchemaV1.Props;

  // Create the JSON Schema converter using z.toJSONSchema()
  const jsonSchemaConverter: StandardJSONSchemaV1.Converter = {
    input: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
      return convertToJsonSchema(zodSchema, options, adapterOptions);
    },
    output: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
      return convertToJsonSchema(zodSchema, options, adapterOptions);
    },
  };

  // Define the enhanced ~standard property
  Object.defineProperty(wrapper, '~standard', {
    value: {
      ...existingStandard,
      jsonSchema: jsonSchemaConverter,
    } satisfies StandardSchemaWithJSONProps,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return wrapper;
}
