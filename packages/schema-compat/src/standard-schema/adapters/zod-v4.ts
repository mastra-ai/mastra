import { createRequire } from 'node:module';
import type { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
import type { StandardSchemaWithJSON, StandardSchemaWithJSONProps } from '../standard-schema.types';

/**
 * Supported JSON Schema targets for z.toJSONSchema().
 * Works with both real Zod v4 and Zod 3.25's v4 compat layer.
 */
const SUPPORTED_TARGETS = new Set(['draft-07', 'draft-04', 'draft-2020-12']);

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
  const toJSONSchema = getToJSONSchema();
  if (!toJSONSchema) {
    throw new Error('z.toJSONSchema is not available. Ensure zod >= 3.25.0 is installed.');
  }

  const target = SUPPORTED_TARGETS.has(options.target) ? options.target : 'draft-07';

  const jsonSchemaOptions: Record<string, unknown> = {
    target,
  };

  if (adapterOptions.unrepresentable) {
    jsonSchemaOptions.unrepresentable = adapterOptions.unrepresentable;
  }

  // The override option works in real Zod v4 but is a no-op in 3.25 compat.
  if (adapterOptions.override) {
    jsonSchemaOptions.override = adapterOptions.override;
  }

  return toJSONSchema(zodSchema, jsonSchemaOptions) as Record<string, unknown>;
}

/**
 * Cached reference to z.toJSONSchema.
 */
let _toJSONSchema: ((schema: unknown, options?: unknown) => unknown) | null = null;
let _toJSONSchemaResolved = false;
const __require = typeof require === 'function' ? require : createRequire(import.meta.url);

function pickToJSONSchema(mod: unknown): ((schema: unknown, options?: unknown) => unknown) | null {
  const candidate = mod as {
    toJSONSchema?: unknown;
    z?: { toJSONSchema?: unknown };
    default?: { toJSONSchema?: unknown; z?: { toJSONSchema?: unknown } };
  };

  const picks = [
    candidate?.toJSONSchema,
    candidate?.z?.toJSONSchema,
    candidate?.default?.toJSONSchema,
    candidate?.default?.z?.toJSONSchema,
  ];

  const toJSONSchema = picks.find(fn => typeof fn === 'function');
  return (toJSONSchema as ((schema: unknown, options?: unknown) => unknown) | undefined) ?? null;
}

function resolveToJSONSchema(
  loadModule: (moduleName: 'zod/v4' | 'zod') => unknown,
): ((schema: unknown, options?: unknown) => unknown) | null {
  for (const moduleName of ['zod/v4', 'zod'] as const) {
    try {
      const zodModule = loadModule(moduleName);
      const toJSONSchema = pickToJSONSchema(zodModule);
      if (toJSONSchema) {
        return toJSONSchema;
      }
    } catch {
      // Try next module path.
    }
  }

  return null;
}

function getToJSONSchema(): ((schema: unknown, options?: unknown) => unknown) | null {
  if (_toJSONSchemaResolved) {
    return _toJSONSchema;
  }

  _toJSONSchema = resolveToJSONSchema(moduleName => __require(moduleName));
  _toJSONSchemaResolved = true;
  return _toJSONSchema;
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
