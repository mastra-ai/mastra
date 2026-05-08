/**
 * Zod v3/v4 compatibility layer.
 *
 * Zod v3 stores schema internals in `schema._def`.
 * Zod v4 stores schema internals in `schema._zod.def`.
 *
 * This module provides helpers that work with both versions.
 */

type AnySchema = any;

export function isV4(schema: AnySchema): boolean {
  return schema != null && typeof schema === 'object' && '_zod' in schema;
}

/**
 * Get the internal definition object for a schema, regardless of Zod version.
 * v3: schema._def
 * v4: schema._zod.def
 */
export function getDef(schema: AnySchema): any {
  if (schema == null || typeof schema !== 'object') {
    return undefined;
  }
  if (isV4(schema)) {
    return schema._zod.def;
  }
  return schema._def;
}

/**
 * Check if a schema is optional (works for both v3 and v4).
 */
export function isOptional(schema: AnySchema): boolean {
  if (typeof schema.isOptional === 'function') {
    return schema.isOptional();
  }
  if (typeof schema.safeParse === 'function') {
    return schema.safeParse(undefined).success;
  }
  return false;
}

/**
 * Get the shape of an object schema (works for both v3 and v4).
 * v3: schema.shape (getter) or schema._def.shape()
 * v4: schema.shape (getter) or schema._zod.def.shape
 */
export function getShape(schema: AnySchema): Record<string, AnySchema> | undefined {
  if (schema.shape && typeof schema.shape === 'object') {
    return schema.shape;
  }
  const def = getDef(schema);
  if (def?.shape) {
    return typeof def.shape === 'function' ? def.shape() : def.shape;
  }
  return undefined;
}

/**
 * Unwrap to the base schema, stripping wrappers like ZodOptional, ZodDefault, ZodEffects, etc.
 * Works for both v3 (_def.innerType, _def.schema) and v4 (_zod.def.innerType, _zod.def.schema).
 */
export function getBaseSchema(schema: AnySchema): AnySchema {
  const def = getDef(schema);
  if (!def) return schema;
  if ('innerType' in def) {
    return getBaseSchema(def.innerType);
  }
  if ('schema' in def) {
    return getBaseSchema(def.schema);
  }
  return schema;
}

/**
 * Get enum entries/values from a schema.
 * v3: schema._def.values (array or object)
 * v4: schema._zod.def.entries (array or object)
 */
export function getEnumValues(schema: AnySchema): any[] | Record<string, any> | undefined {
  const def = getDef(schema);
  // v4 uses "entries" for enums
  if (def?.entries) return def.entries;
  // v3 uses "values" for enums
  if (def?.values) return def.values;
  return undefined;
}

/**
 * Get array element schema.
 * v3: schema._def.type
 * v4: schema._zod.def.element
 */
export function getArrayElement(schema: AnySchema): AnySchema | undefined {
  const def = getDef(schema);
  return def?.element ?? def?.type;
}

/**
 * Get literal value(s) from a ZodLiteral schema.
 * v3: schema._def.value (single value)
 * v4: schema._zod.def.values (array or single value)
 */
export function getLiteralValue(schema: AnySchema): any {
  const def = getDef(schema);
  // v4: values (may be array)
  if (def?.values !== undefined) {
    return Array.isArray(def.values) ? def.values[0] : def.values;
  }
  // v3: value (single)
  if (def?.value !== undefined) {
    return def.value;
  }
  return undefined;
}

/**
 * Get literal values array from a ZodLiteral schema (for fieldConfig customData).
 * v4: schema._zod.def.values
 * v3: schema._def.value (wrapped in array)
 */
export function getLiteralValues(schema: AnySchema): any {
  const def = getDef(schema);
  if (def?.values !== undefined) return def.values;
  if (def?.value !== undefined) return [def.value];
  return undefined;
}

/**
 * Get default value from a ZodDefault schema.
 * v3: schema._def.defaultValue() — it's a function
 * v4: schema._zod.def.defaultValue — it's a direct value
 */
export function getDefaultValue(schema: AnySchema): any {
  const def = getDef(schema);
  if (def?.defaultValue !== undefined) {
    return typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
  }
  return undefined;
}

/**
 * Get union options from a ZodUnion or ZodDiscriminatedUnion schema.
 * v3: schema._def.options
 * v4: schema._zod.def.options
 */
export function getUnionOptions(schema: AnySchema): AnySchema[] | undefined {
  const def = getDef(schema);
  return def?.options;
}

/**
 * Get intersection left/right from a ZodIntersection schema.
 * v3: schema._def.left, schema._def.right
 * v4: schema._zod.def.left, schema._zod.def.right
 */
export function getIntersection(schema: AnySchema): { left: AnySchema; right: AnySchema } | undefined {
  const def = getDef(schema);
  if (def?.left && def?.right) {
    return { left: def.left, right: def.right };
  }
  // v4 also exposes schema.def directly
  if (schema.def?.left && schema.def?.right) {
    return { left: schema.def.left, right: schema.def.right };
  }
  return undefined;
}

/**
 * Get string checks from a ZodString schema.
 * v3: schema._def.checks (array of { kind, ... })
 * v4: schema._zod.def.checks (array of check schemas with _zod.def.check and _zod.def.format)
 */
export function getStringChecks(schema: AnySchema): any[] {
  const def = getDef(schema);
  return def?.checks ?? [];
}

/**
 * Check if a string schema has a datetime check.
 * v3: check.kind === 'datetime'
 * v4: check._zod.def.check === 'string_format' && check._zod.def.format === 'datetime'
 */
export function hasDateTimeCheck(checks: any[]): boolean {
  return checks.some(check => {
    // v4 format
    if (isV4(check)) {
      const checkDef = getDef(check);
      return checkDef?.check === 'string_format' && checkDef?.format === 'datetime';
    }
    // v3 format
    return check.kind === 'datetime';
  });
}

/**
 * Detect if a schema is a ZodObject-like (either v3 or v4).
 */
export function isObjectSchema(schema: AnySchema): boolean {
  return getShape(schema) !== undefined && !isIntersectionSchema(schema);
}

/**
 * Detect if a schema is a ZodDefault (either v3 or v4).
 */
export function isDefaultSchema(schema: AnySchema): boolean {
  const def = getDef(schema);
  return def?.typeName === 'ZodDefault' || def?.type === 'default' || getDefaultValue(schema) !== undefined;
}

/**
 * Detect if a schema is a ZodLiteral (either v3 or v4).
 */
export function isLiteralSchema(schema: AnySchema): boolean {
  const def = getDef(schema);
  return (
    def?.typeName === 'ZodLiteral' || def?.type === 'literal' || schema?.constructor?.name?.slice(1) === 'ZodLiteral'
  );
}

/**
 * Detect if a schema is a ZodIntersection (either v3 or v4).
 */
export function isIntersectionSchema(schema: AnySchema): boolean {
  const intersection = getIntersection(schema);
  if (!intersection) return false;
  const def = getDef(schema);
  return (
    def?.typeName === 'ZodIntersection' ||
    def?.type === 'intersection' ||
    schema?.constructor?.name?.slice(1) === 'ZodIntersection'
  );
}
