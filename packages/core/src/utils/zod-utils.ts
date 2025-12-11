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
 * @param schema - The Zod schema to get the type name from
 * @returns The Zod type name string or undefined
 */
export function getZodTypeName(schema: z.ZodTypeAny): string | undefined {
  const schemaAny = schema as any;
  // Zod 4 structure
  if (schemaAny._zod?.def?.typeName) {
    return schemaAny._zod.def.typeName;
  }
  // Zod 3 structure
  return schemaAny._def?.typeName;
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
