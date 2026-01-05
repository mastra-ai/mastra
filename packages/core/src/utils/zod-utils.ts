import type { z } from 'zod';

/**
 * Checks if a value is a Zod type
 * @param value - The value to check
 * @returns True if the value is a Zod type, false otherwise
 */
export function isZodType(value: unknown): value is z.ZodType {
  // Check if it's a Zod schema by looking for common Zod properties and methods
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

/**
 * Get the Zod typeName from a schema, compatible with both Zod 3 and Zod 4.
 * Uses string-based typeName instead of instanceof to avoid dual-package hazard
 * where multiple Zod instances can cause instanceof checks to fail.
 *
 * Zod 3 uses `_def.typeName` with values like "ZodString", "ZodOptional", etc.
 * Zod 4 uses `_def.type` with lowercase values like "string", "optional", etc.
 *
 * This function normalizes to Zod 3 format (e.g., "ZodString") for compatibility.
 *
 * @param schema - The Zod schema to get the type name from
 * @returns The Zod type name string (e.g., "ZodString", "ZodOptional") or undefined
 */
export function getZodTypeName(schema: z.ZodTypeAny): string | undefined {
  const schemaAny = schema as any;

  // Zod 3 structure: _def.typeName = "ZodString", "ZodOptional", etc.
  if (schemaAny._def?.typeName) {
    return schemaAny._def.typeName;
  }

  // Zod 4 structure: _def.type = "string", "optional", etc. (lowercase, no prefix)
  const zod4Type = schemaAny._def?.type;
  if (typeof zod4Type === 'string' && zod4Type) {
    // Normalize to Zod 3 format: "string" -> "ZodString", "optional" -> "ZodOptional"
    return 'Zod' + zod4Type.charAt(0).toUpperCase() + zod4Type.slice(1);
  }

  return undefined;
}

/**
 * Check if a value is a ZodArray type
 * @param value - The value to check (can be any type)
 * @returns True if the value is a ZodArray
 */
export function isZodArray(value: unknown): value is z.ZodArray<z.ZodTypeAny> {
  if (!isZodType(value)) return false;
  return getZodTypeName(value as z.ZodTypeAny) === 'ZodArray';
}

/**
 * Check if a value is a ZodObject type
 * @param value - The value to check (can be any type)
 * @returns True if the value is a ZodObject
 */
export function isZodObject(value: unknown): value is z.ZodObject<any> {
  if (!isZodType(value)) return false;
  return getZodTypeName(value as z.ZodTypeAny) === 'ZodObject';
}

/**
 * Get the def object from a Zod schema, compatible with both Zod 3 and Zod 4.
 * @param schema - The Zod schema
 * @returns The def object
 */
export function getZodDef(schema: z.ZodTypeAny): any {
  const schemaAny = schema as any;
  return schemaAny._zod?.def ?? schemaAny._def;
}
