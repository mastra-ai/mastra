import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

// Symbol to mark schemas as already patched (for idempotency)
const PATCHED = Symbol('__mastra_patched__');

// Lazy-loaded Zod v4 'z' export (only loaded when needed)
let _zv4Cache: typeof import('zod/v4').z | undefined;

/**
 * Get the Zod v4 'z' export, loading it lazily on first use.
 * This avoids breaking in v3-only environments where 'zod/v4' doesn't exist.
 */
function getZodV4(): typeof import('zod/v4').z {
  if (!_zv4Cache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _zv4Cache = require('zod/v4').z;
  }
  return _zv4Cache!;
}

/**
 * Recursively patch Zod v4 record schemas that are missing valueType.
 * This fixes a bug in Zod v4 where z.record(valueSchema) doesn't set def.valueType.
 * The single-arg form should set valueType but instead only sets keyType.
 */
function patchRecordSchemas(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  // Skip if already patched (idempotency check)
  if ((schema as any)[PATCHED]) return schema;
  (schema as any)[PATCHED] = true;

  // Check the _zod.def location (v4 structure)
  const def = schema._zod?.def;

  // Fix record schemas with missing valueType
  if (def?.type === 'record' && def.keyType && !def.valueType) {
    // The bug: z.record(valueSchema) puts the value in keyType instead of valueType
    // Fix: move it to valueType and set keyType to string (the default)
    def.valueType = def.keyType;
    def.keyType = getZodV4().string();
  }

  // Recursively patch nested schemas
  if (!def) return schema;

  if (def.type === 'object' && def.shape) {
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
    for (const key of Object.keys(shape)) {
      patchRecordSchemas(shape[key]);
    }
  }

  if (def.type === 'array' && def.element) {
    patchRecordSchemas(def.element);
  }

  if (def.type === 'union' && def.options) {
    def.options.forEach(patchRecordSchemas);
  }

  if (def.type === 'record') {
    if (def.keyType) patchRecordSchemas(def.keyType);
    if (def.valueType) patchRecordSchemas(def.valueType);
  }

  // Handle intersection types
  if (def.type === 'intersection') {
    if (def.left) patchRecordSchemas(def.left);
    if (def.right) patchRecordSchemas(def.right);
  }

  // Handle lazy types - patch the schema returned by the getter
  if (def.type === 'lazy') {
    // For lazy schemas, we need to patch the schema when it's accessed
    // Store the original getter and wrap it
    if (def.getter && typeof def.getter === 'function') {
      const originalGetter = def.getter;
      def.getter = function () {
        const innerSchema = originalGetter();
        if (innerSchema) {
          patchRecordSchemas(innerSchema);
        }
        return innerSchema;
      };
    }
  }

  // Handle wrapper types that have innerType
  // This covers: optional, nullable, default, catch, nullish, and any other wrappers
  if (def.innerType) {
    patchRecordSchemas(def.innerType);
  }

  return schema;
}

/**
 * Recursively fixes anyOf patterns that some providers (like OpenAI) don't accept.
 * Converts anyOf: [{type: X}, {type: "null"}] to type: [X, "null"]
 * Also fixes empty {} property schemas by converting to a union of primitive types.
 */
function fixAnyOfNullable(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  // Fix anyOf pattern: [{type: X}, {type: "null"}] or [{type: "null"}, {type: X}]
  if (result.anyOf && Array.isArray(result.anyOf) && result.anyOf.length === 2) {
    const nullSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type === 'null');
    const otherSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type !== 'null');

    if (nullSchema && otherSchema && typeof otherSchema === 'object' && otherSchema.type) {
      // Convert anyOf to type array format
      // Normalize sibling fields (like properties/items) before returning
      const { anyOf, ...rest } = result;
      const fixedRest = fixAnyOfNullable(rest as JSONSchema7);
      const fixedOther = fixAnyOfNullable(otherSchema as JSONSchema7);
      return {
        ...fixedRest,
        ...fixedOther,
        type: (Array.isArray(fixedOther.type)
          ? [...fixedOther.type, 'null']
          : [fixedOther.type, 'null']) as JSONSchema7['type'],
      };
    }
  }

  // Fix empty property schemas {} - OpenAI requires a type key
  if (result.properties && typeof result.properties === 'object' && !Array.isArray(result.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => {
        const propSchema = value as JSONSchema7;

        // If property is an empty object {}, convert to allow primitive types
        // Note: We exclude 'object' (requires additionalProperties) and 'array' (requires items) for OpenAI
        if (
          typeof propSchema === 'object' &&
          propSchema !== null &&
          !Array.isArray(propSchema) &&
          Object.keys(propSchema).length === 0
        ) {
          return [key, { type: ['string', 'number', 'boolean', 'null'] as JSONSchema7['type'] }];
        }

        // Recursively fix nested schemas
        return [key, fixAnyOfNullable(propSchema)];
      }),
    );
  }

  // Recursively fix items in arrays
  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map(item => fixAnyOfNullable(item as JSONSchema7));
    } else {
      result.items = fixAnyOfNullable(result.items as JSONSchema7);
    }
  }

  // Recursively fix anyOf/oneOf/allOf schemas
  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map(s => fixAnyOfNullable(s as JSONSchema7));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map(s => fixAnyOfNullable(s as JSONSchema7));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map(s => fixAnyOfNullable(s as JSONSchema7));
  }

  return result;
}

/**
 * Detect if a schema is a Zod v4 schema by checking its internal structure.
 * Zod v4 schemas have a `_zod` property with a nested `def` object.
 * Zod v3 schemas have a `_def` property with a `typeName` string.
 */
function isZodV4Schema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false;
  // Zod v4 schemas have _zod.def.type structure
  const maybeV4 = schema as { _zod?: { def?: { type?: string } } };
  return typeof maybeV4._zod?.def?.type === 'string';
}

export function zodToJsonSchema(
  zodSchema: ZodSchemaV3 | ZodSchemaV4,
  target: Targets = 'jsonSchema7',
  strategy: 'none' | 'seen' | 'root' | 'relative' = 'relative',
): JSONSchema7 {
  // Detect Zod version by schema structure, not by import
  if (isZodV4Schema(zodSchema)) {
    // Zod v4 path - patch record schemas before converting
    patchRecordSchemas(zodSchema);

    // Try v4 converter first, fall back to v3 if it fails (e.g., mixed v3/v4 schemas)
    try {
      const jsonSchema = getZodV4().toJSONSchema(zodSchema as ZodSchemaV4, {
        unrepresentable: 'any',
        override: (ctx: any) => {
          // Handle both Zod v4 structures: _def directly or nested in _zod
          const def = ctx.zodSchema?._def || ctx.zodSchema?._zod?.def;
          // Check for date type using both possible property names
          if (def && (def.typeName === 'ZodDate' || def.type === 'date')) {
            ctx.jsonSchema.type = 'string';
            ctx.jsonSchema.format = 'date-time';
          }
        },
      }) as JSONSchema7;

      // Fix anyOf patterns for nullable fields - required for OpenAI compatibility
      return fixAnyOfNullable(jsonSchema);
    } catch {
      // Fall back to v3 converter for mixed v3/v4 schemas
      return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
        $refStrategy: strategy,
        target,
      }) as JSONSchema7;
    }
  } else {
    // Zod v3 path - use the original converter
    return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
      $refStrategy: strategy,
      target,
    }) as JSONSchema7;
  }
}
