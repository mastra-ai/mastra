/**
 * Pure JSON-Schema helpers shared by schema-flow analysis and mapping-config
 * analysis. Everything here is best-effort and three-valued: a check only
 * reports `incompatible` when it can prove a mismatch, so absent or partial
 * schemas degrade to `unknown` instead of producing false positives.
 */
import { standardSchemaToJSONSchema, toStandardSchema } from '../../../schema';
import type { JsonSchema } from '../json-schema-to-zod';

export type SchemaCompatibility = 'compatible' | 'incompatible' | 'unknown';

/**
 * Best-effort conversion of a live (Zod / standard) schema to JSON Schema for
 * registry-index building. Unconvertible or absent schemas yield `undefined`
 * ("unknown"), which schema-flow treats as never-incompatible.
 */
export function toJsonSchemaOrUndefined(schema: unknown): JsonSchema | undefined {
  if (schema === undefined || schema === null) return undefined;
  try {
    return standardSchemaToJSONSchema(toStandardSchema(schema)) as JsonSchema;
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural compatibility of `source` output feeding a `destination` input.
 * Recurses through array items and object properties; a destination `required`
 * key missing from the source is a proven incompatibility.
 */
export function schemaCompatibility(source: unknown, destination: unknown): SchemaCompatibility {
  if (!isRecord(source) || !isRecord(destination)) return 'unknown';
  const sourceType = typeof source.type === 'string' ? source.type : undefined;
  const destinationType = typeof destination.type === 'string' ? destination.type : undefined;
  if (!sourceType || !destinationType) return 'unknown';
  if (sourceType !== destinationType) return 'incompatible';
  if (destinationType === 'array') return schemaCompatibility(source.items, destination.items);
  if (destinationType !== 'object') return 'compatible';

  const sourceProperties = isRecord(source.properties) ? source.properties : {};
  const destinationProperties = isRecord(destination.properties) ? destination.properties : {};
  const required = Array.isArray(destination.required)
    ? destination.required.filter((key): key is string => typeof key === 'string')
    : [];
  for (const key of required) {
    if (!(key in sourceProperties)) return 'incompatible';
  }
  for (const [key, destinationProperty] of Object.entries(destinationProperties)) {
    if (!(key in sourceProperties)) continue;
    if (schemaCompatibility(sourceProperties[key], destinationProperty) === 'incompatible') return 'incompatible';
  }
  return 'compatible';
}

/** Follows a dotted mapping path through object `properties`; `''`/`'.'` is the root. */
export function schemaAtPath(schema: JsonSchema | undefined, path: string): JsonSchema | undefined {
  if (!schema || path === '' || path === '.') return schema;
  let current: unknown = schema;
  for (const segment of path.split('.')) {
    if (!isRecord(current) || !isRecord(current.properties) || !isRecord(current.properties[segment])) return undefined;
    current = current.properties[segment];
  }
  return current as JsonSchema;
}

/** Plain dotted segments only — no `$.`, brackets, or empty segments. */
export function isCanonicalMappingPath(path: string): boolean {
  return path === '' || path === '.' || /^[^.[$\]]+(?:\.[^.[$\]]+)*$/.test(path);
}

/** Infers a JSON Schema for a literal `{ value }` mapping source. */
export function schemaForValue(value: unknown): JsonSchema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array' };
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return { type: typeof value };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'object':
      return { type: 'object' };
    default:
      return {};
  }
}
