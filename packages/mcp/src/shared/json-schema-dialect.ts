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

/**
 * Raw JSON values a single schema may contribute before generation widens it, and the total a whole
 * catalogue may contribute before generation widens the remainder. The node limit above counts only
 * schema-bearing keywords, so these bound the annotation and extension values it deliberately
 * ignores. They live here rather than with the generator so the CLI can apply them without loading
 * the converter.
 */
export const MAX_SCHEMA_VALUES = MAX_JSON_SCHEMA_NODES * 10;
export const MAX_CATALOG_VALUES = MAX_SCHEMA_VALUES * 10;

class Unconvertible extends Error {}

/**
 * Bounds the work a validator or type generator can be asked to do for an untrusted schema.
 * Only schema-bearing keywords are walked, so deeply nested annotation data such as `default`
 * or `examples` does not count. The counted nodes are returned so callers can also budget
 * across a whole catalogue rather than one schema at a time.
 *
 * The keyword lists are intentionally wider than the conversion sets above: this walk has to
 * reach every position that can carry validation rules, including `dependencies`,
 * `prefixItems`, and `contentSchema`.
 */
export function jsonSchemaComplexity(schema: unknown): {
  error?: string;
  limit?: 'depth' | 'nodes';
  nodes: number;
} {
  const seen = new Set<object>();
  let nodes = 0;
  const stack = [{ value: schema, depth: 0 }];
  const schemaMapKeywords = [
    '$defs',
    'definitions',
    'properties',
    'patternProperties',
    'dependentSchemas',
    'dependencies',
  ];
  const schemaArrayKeywords = ['prefixItems', 'allOf', 'anyOf', 'oneOf', 'items'];
  const schemaKeywords = [
    'additionalProperties',
    'unevaluatedProperties',
    'additionalItems',
    'unevaluatedItems',
    'items',
    'contains',
    'propertyNames',
    'not',
    'if',
    'then',
    'else',
    'contentSchema',
  ];

  while (stack.length > 0) {
    const { value, depth } = stack.pop()!;
    if (value === null || typeof value !== 'object' || Array.isArray(value) || seen.has(value)) continue;
    seen.add(value);

    nodes += 1;
    if (depth > MAX_JSON_SCHEMA_DEPTH) {
      return {
        error: `JSON Schema exceeds the maximum depth of ${MAX_JSON_SCHEMA_DEPTH}`,
        limit: 'depth',
        nodes,
      };
    }
    if (nodes > MAX_JSON_SCHEMA_NODES) {
      return {
        error: `JSON Schema exceeds the maximum node count of ${MAX_JSON_SCHEMA_NODES}`,
        limit: 'nodes',
        nodes,
      };
    }

    const record = value as Record<string, unknown>;
    for (const keyword of schemaMapKeywords) {
      const schemas = record[keyword];
      if (schemas && typeof schemas === 'object' && !Array.isArray(schemas)) {
        for (const child of Object.values(schemas)) stack.push({ value: child, depth: depth + 1 });
      }
    }
    for (const keyword of schemaArrayKeywords) {
      const schemas = record[keyword];
      if (Array.isArray(schemas)) {
        for (const child of schemas) stack.push({ value: child, depth: depth + 1 });
      }
    }
    for (const keyword of schemaKeywords) {
      if (record[keyword] !== undefined) stack.push({ value: record[keyword], depth: depth + 1 });
    }
  }

  return { nodes };
}

/**
 * Counts every value in a raw schema and stops once `limit` is exceeded. Unlike
 * {@link jsonSchemaComplexity}, which counts only schema-bearing keywords, this covers
 * annotation and extension data and boolean subschema entries, so callers that copy or transfer
 * the whole value can bound that work rather than the validation work a schema describes.
 *
 * Children are pulled one at a time, so a container wider than the budget is never expanded.
 * Values already seen are counted once, matching how this walk treats cycles.
 */
export function countJsonValues(value: unknown, limit: number): number {
  const seen = new Set<object>();
  const frames: Array<Generator<unknown>> = [];
  let nodes = 0;

  function count(current: unknown): boolean {
    if (++nodes > limit) return false;
    if (current === null || typeof current !== 'object' || seen.has(current)) return true;
    seen.add(current);
    frames.push(containerValues(current));
    return true;
  }

  if (!count(value)) return nodes;
  while (frames.length > 0) {
    const next = frames[frames.length - 1]!.next();
    if (next.done) frames.pop();
    else if (!count(next.value)) return nodes;
  }

  return nodes;
}

/** Yields a JSON container's children without materialising them. */
function* containerValues(value: object): Generator<unknown> {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) yield value[index];
    return;
  }
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) yield Reflect.get(value, key);
  }
}

/**
 * Converts a 2019-09 schema (e.g. from zod v3) into 2020-12 form. Tuples are the
 * only structural difference handled: array-form `items` becomes `prefixItems`,
 * and `additionalItems` becomes `items`.
 *
 * Returns `undefined` when the schema does not declare 2019-09, or relies on
 * features this conversion cannot preserve (`$recursiveRef`/`$recursiveAnchor`,
 * `$ref` pointers into tuple members, embedded `$schema` declarations,
 * `unevaluatedItems`, `prefixItems`, or `contentSchema`), or exceeds the depth/node limits.
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
  // Embedded resources may declare their own dialect. unevaluatedItems interacts with contains (including via
  // in-place applicators) differently in 2020-12, prefixItems is an annotation in 2019-09 but an assertion in
  // 2020-12, and contentSchema is not walked. zod v3 emits none of these, so decline rather than risk a change.
  if (!isRoot && '$schema' in out) throw new Unconvertible();
  if ('$recursiveRef' in out || '$recursiveAnchor' in out) throw new Unconvertible();
  if ('unevaluatedItems' in out || 'prefixItems' in out || 'contentSchema' in out) throw new Unconvertible();
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
