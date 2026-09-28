export const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

const JSON_SCHEMA_2019_09 = /^https?:\/\/json-schema\.org\/draft\/2019-09\/schema#?$/;

/** Keywords whose values are instance data, not subschemas. */
const DATA_KEYWORDS = new Set(['default', 'examples', 'const', 'enum']);
/** Keywords whose values map arbitrary names to subschemas. */
const SCHEMA_MAP_KEYWORDS = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);

/** Complexity limits for untrusted schemas; also enforced by the client before validation. */
export const MAX_JSON_SCHEMA_DEPTH = 128;
export const MAX_JSON_SCHEMA_NODES = 10_000;

class Unconvertible extends Error {}

/**
 * Converts a 2019-09 schema (e.g. from zod v3) into 2020-12 form. Tuples are the
 * only structural difference handled: array-form `items` becomes `prefixItems`,
 * and `additionalItems` becomes `items`.
 *
 * Returns `undefined` when the schema does not declare 2019-09, or relies on
 * features this conversion cannot preserve (`$recursiveRef`/`$recursiveAnchor`,
 * or `$ref` pointers into tuple members), or exceeds the depth/node limits.
 * Callers should then keep the original.
 */
export function toJsonSchema2020<T extends { $schema?: string }>(schema: T): T | undefined {
  if (!schema.$schema || !JSON_SCHEMA_2019_09.test(schema.$schema)) return undefined;
  try {
    return { ...(rewrite(schema, false, 0, { nodes: 0 }) as T), $schema: JSON_SCHEMA_2020_12 };
  } catch (error) {
    if (error instanceof Unconvertible) return undefined;
    throw error;
  }
}

function rewrite(value: unknown, isSchemaMap: boolean, depth: number, budget: { nodes: number }): unknown {
  if (!value || typeof value !== 'object') return value;
  if (depth > MAX_JSON_SCHEMA_DEPTH || ++budget.nodes > MAX_JSON_SCHEMA_NODES) throw new Unconvertible();
  if (Array.isArray(value)) return value.map(item => rewrite(item, false, depth + 1, budget));

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!isSchemaMap) {
      if (key === '$recursiveRef' || key === '$recursiveAnchor') throw new Unconvertible();
      if (key === '$ref' && typeof child === 'string' && /\/(items\/\d+|additionalItems)(\/|$)/.test(child)) {
        throw new Unconvertible();
      }
    }
    out[key] =
      !isSchemaMap && DATA_KEYWORDS.has(key)
        ? child
        : rewrite(child, !isSchemaMap && SCHEMA_MAP_KEYWORDS.has(key), depth + 1, budget);
  }
  if (isSchemaMap || !Array.isArray(out.items)) return out;

  out.prefixItems = out.items;
  if ('additionalItems' in out) out.items = out.additionalItems;
  else delete out.items;
  delete out.additionalItems;
  return out;
}
