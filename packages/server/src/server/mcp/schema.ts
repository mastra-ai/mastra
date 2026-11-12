import type { JSONSchema7 } from '@mastra/schema-compat';
import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/schema-compat/schema';

export const object = (properties: Record<string, JSONSchema7>, required: string[] = []): JSONSchema7 => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
export const str = (description: string): JSONSchema7 => ({ type: 'string', description });

/** MCP tool schemas default to JSON Schema 2020-12 (e.g. tuples are `prefixItems`, not array-valued `items`). */
export function toJSONSchema(schema: unknown): JSONSchema7 | undefined {
  if (!schema) return undefined;
  try {
    const { $schema: _dialect, ...json } = standardSchemaToJSONSchema(toStandardSchema(schema as any), {
      io: 'input',
      target: 'draft-2020-12',
    }) as JSONSchema7;
    return json;
  } catch {
    return undefined;
  }
}

/**
 * Shrinks a tool schema without changing what it accepts, and keeps it portable:
 * - drops regex `pattern`s that only restate `format: date-time` (most of a time-range schema's size);
 * - spells a closed tuple (`prefixItems` + `items: false`) as `maxItems`, since some clients reject bare `false`.
 */
export function compact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(compact);
  if (!node || typeof node !== 'object') return node;
  const { pattern, ...rest } = node as Record<string, unknown>;
  const kept = rest.format === 'date-time' || pattern === undefined ? rest : { ...rest, pattern };
  if (kept.items === false && Array.isArray(kept.prefixItems)) {
    delete kept.items;
    kept.maxItems ??= kept.prefixItems.length;
  }
  return Object.fromEntries(Object.entries(kept).map(([key, value]) => [key, compact(value)]));
}

/**
 * Moves sub-schemas repeated within one tool schema (e.g. predicate operands) into `$defs`. The schema
 * accepts exactly the same input; it is just shorter. Schemas here already use `$defs`/`$ref`.
 */
const MAPS = new Set(['properties', 'patternProperties', '$defs', 'definitions']);
const SCHEMA_KEYS = new Set([
  'items',
  'additionalProperties',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'prefixItems',
  'contains',
]);

export function hoistRepeated(schema: JSONSchema7): JSONSchema7 {
  const root = schema as JSONSchema7 & { $defs?: Record<string, unknown> };
  const defs = { ...root.$defs };
  let body: Record<string, unknown> = { ...root, $defs: undefined };
  for (let n = 0; ; n++) {
    const counts = new Map<string, number>();
    // Only schemas are hoisted, never keyword maps such as `properties` (their values are schemas).
    const visit = (node: unknown, isSchema: boolean) => {
      if (!node || typeof node !== 'object') return;
      const json = JSON.stringify(node);
      if (isSchema && !Array.isArray(node) && json.length > 150) counts.set(json, (counts.get(json) ?? 0) + 1);
      for (const [key, child] of Object.entries(node)) {
        if (MAPS.has(key) && !Array.isArray(node)) {
          for (const value of Object.values(child ?? {})) visit(value, true);
        } else visit(child, Array.isArray(node) || SCHEMA_KEYS.has(key));
      }
    };
    for (const [key, value] of Object.entries(body)) {
      if (MAPS.has(key)) for (const child of Object.values(value ?? {})) visit(child, true);
      else visit(value, SCHEMA_KEYS.has(key));
    }
    for (const value of Object.values(defs)) visit(value, false);
    const [repeated] = [...counts].filter(([, count]) => count > 1).sort(([a], [b]) => b.length - a.length);
    if (!repeated) break;
    const name = `mcp${n}`;
    const target = repeated[0];
    defs[name] = JSON.parse(target);
    const replace = (node: unknown, isSchema = true): unknown => {
      if (!node || typeof node !== 'object') return node;
      if (isSchema && !Array.isArray(node) && JSON.stringify(node) === target) return { $ref: `#/$defs/${name}` };
      if (Array.isArray(node)) return node.map(item => replace(item));
      return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [
          key,
          MAPS.has(key)
            ? Object.fromEntries(Object.entries(value ?? {}).map(([k, v]) => [k, replace(v)]))
            : replace(value, SCHEMA_KEYS.has(key)),
        ]),
      );
    };
    body = replace(body, false) as Record<string, unknown>;
    for (const key of Object.keys(defs)) if (key !== name) defs[key] = replace(defs[key], false);
  }
  const { $defs: _unused, ...rest } = body;
  return (Object.keys(defs).length ? { ...rest, $defs: defs } : rest) as JSONSchema7;
}
