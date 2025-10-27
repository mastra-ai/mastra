import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

// Symbol to mark schemas as already patched (for idempotency)
const PATCHED = Symbol('__mastra_patched__');

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
    def.keyType = (z as any).string();
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

export function zodToJsonSchema(
  zodSchema: ZodSchemaV3 | ZodSchemaV4,
  target: Targets = 'jsonSchema7',
  strategy: 'none' | 'seen' | 'root' | 'relative' = 'relative',
) {
  const fn = 'toJSONSchema';

  if (fn in z) {
    // Zod v4 path - patch record schemas before converting
    patchRecordSchemas(zodSchema);

    return (z as any)[fn](zodSchema, {
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
  } else {
    // Zod v3 path - use the original converter
    return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
      $refStrategy: strategy,
      target,
    }) as JSONSchema7;
  }
}
