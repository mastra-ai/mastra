/**
 * Whether a JSON schema has an object with free-form keys (e.g. `z.record()`), which OpenAI
 * strict mode cannot express: it requires every object to list fixed keys with
 * `additionalProperties: false`.
 */
export function hasFreeFormObject(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  const node = schema as Record<string, unknown>;
  const additional = node.additionalProperties;
  if (additional === true || (additional && typeof additional === 'object')) return true;
  if (node.patternProperties || node.propertyNames) return true;

  // Only descend into keywords that hold subschemas. Data keywords (`default`, `const`,
  // `enum`, `examples`) and property names are not schemas and must not trigger a match.
  const subschemas: unknown[] = [];
  for (const key of ['properties', '$defs', 'definitions'] as const) {
    const map = node[key];
    if (map && typeof map === 'object' && !Array.isArray(map)) subschemas.push(...Object.values(map));
  }
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const list = node[key];
    if (Array.isArray(list)) subschemas.push(...list);
  }
  const items = node.items;
  if (Array.isArray(items)) subschemas.push(...items);
  else if (items) subschemas.push(items);
  if (Array.isArray(node.prefixItems)) subschemas.push(...node.prefixItems);
  return subschemas.some(hasFreeFormObject);
}
