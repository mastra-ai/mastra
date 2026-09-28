export const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

/** Keywords whose values are instance data, not subschemas. */
const DATA_KEYWORDS = new Set(['default', 'examples', 'const', 'enum']);
/** Keywords whose values map arbitrary names to subschemas. */
const SCHEMA_MAP_KEYWORDS = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);

/**
 * Rewrites a pre-2020-12 schema (e.g. 2019-09 from zod v3) into 2020-12 form.
 * The only structural difference that matters in practice is tuples: array-form
 * `items` becomes `prefixItems`, and `additionalItems` becomes `items`.
 */
export function toJsonSchema2020<T>(schema: T): T {
  return rewrite(schema, false) as T;
}

function rewrite(value: unknown, isSchemaMap: boolean): unknown {
  if (Array.isArray(value)) return value.map(item => rewrite(item, false));
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] =
      !isSchemaMap && DATA_KEYWORDS.has(key) ? child : rewrite(child, !isSchemaMap && SCHEMA_MAP_KEYWORDS.has(key));
  }
  if (isSchemaMap || !Array.isArray(out.items)) return out;

  out.prefixItems = out.items;
  if ('additionalItems' in out) out.items = out.additionalItems;
  else delete out.items;
  delete out.additionalItems;
  return out;
}
