export const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

const JSON_SCHEMA_2019_09 = /^https?:\/\/json-schema\.org\/draft\/2019-09\/schema#?$/;

/** Keywords whose value is a subschema (`items` may also be an array of subschemas). */
const SCHEMA_KEYWORDS = new Set([
  'items',
  'additionalItems',
  'contains',
  'additionalProperties',
  'propertyNames',
  'unevaluatedItems',
  'unevaluatedProperties',
  'if',
  'then',
  'else',
  'not',
]);
/** Keywords whose value is an array of subschemas. */
const SCHEMA_ARRAY_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf']);
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
 * `$ref` pointers into tuple members, embedded `$schema` declarations, or
 * `contains` combined with `unevaluatedItems`), or exceeds the depth/node limits.
 * Callers should then keep the original.
 */
export function toJsonSchema2020<T extends { $schema?: string }>(schema: T): T | undefined {
  if (!schema.$schema || !JSON_SCHEMA_2019_09.test(schema.$schema)) return undefined;
  try {
    return { ...(rewrite(schema, 0, { nodes: 0 }, true) as T), $schema: JSON_SCHEMA_2020_12 };
  } catch (error) {
    if (error instanceof Unconvertible) return undefined;
    throw error;
  }
}

function checkBudget(depth: number, budget: { nodes: number }) {
  if (depth > MAX_JSON_SCHEMA_DEPTH || ++budget.nodes > MAX_JSON_SCHEMA_NODES) throw new Unconvertible();
}

/** Rewrites a value in a subschema position. Only known schema keywords are walked; everything else is copied as-is. */
function rewrite(schema: unknown, depth: number, budget: { nodes: number }, isRoot = false): unknown {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  checkBudget(depth, budget);

  const out: Record<string, unknown> = { ...schema };
  // Embedded resources may declare their own dialect; unevaluatedItems interacts with contains differently in 2020-12.
  if (!isRoot && '$schema' in out) throw new Unconvertible();
  if ('$recursiveRef' in out || '$recursiveAnchor' in out) throw new Unconvertible();
  if ('contains' in out && 'unevaluatedItems' in out) throw new Unconvertible();
  if (typeof out.$ref === 'string' && /\/(items\/\d+|additionalItems)(\/|$)/.test(out.$ref)) {
    throw new Unconvertible();
  }

  for (const [key, child] of Object.entries(out)) {
    if (SCHEMA_KEYWORDS.has(key)) {
      out[key] = Array.isArray(child)
        ? (checkBudget(depth + 1, budget), child.map(item => rewrite(item, depth + 2, budget)))
        : rewrite(child, depth + 1, budget);
    } else if (SCHEMA_ARRAY_KEYWORDS.has(key) && Array.isArray(child)) {
      checkBudget(depth + 1, budget);
      out[key] = child.map(item => rewrite(item, depth + 2, budget));
    } else if (SCHEMA_MAP_KEYWORDS.has(key) && child && typeof child === 'object' && !Array.isArray(child)) {
      checkBudget(depth + 1, budget);
      out[key] = Object.fromEntries(
        Object.entries(child).map(([name, sub]) => [name, rewrite(sub, depth + 2, budget)]),
      );
    }
  }
  if (!Array.isArray(out.items)) return out;

  out.prefixItems = out.items;
  if ('additionalItems' in out) out.items = out.additionalItems;
  else delete out.items;
  delete out.additionalItems;
  return out;
}
