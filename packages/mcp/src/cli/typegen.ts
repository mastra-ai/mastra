import { compile } from 'json-schema-to-typescript';
import type { SerializableMCPToolCatalog } from '../client/types';
import {
  countJsonValues,
  jsonSchemaComplexity,
  MAX_CATALOG_VALUES,
  MAX_JSON_SCHEMA_DEPTH,
  MAX_SCHEMA_VALUES,
} from '../shared/json-schema-dialect';

type Schema = boolean | Record<string, unknown>;

const maps = new Set(['properties', 'patternProperties', 'definitions', '$defs', 'dependentSchemas']);
const singles = new Set([
  'additionalProperties',
  'additionalItems',
  'contains',
  'not',
  'if',
  'then',
  'else',
  'propertyNames',
  'unevaluatedProperties',
  'unevaluatedItems',
]);
const lists = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
const annotations = new Set([
  'title',
  'description',
  '$comment',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
  '$schema',
]);
/** Keywords whose value must be a string. */
const strings = new Set([
  'title',
  'description',
  '$comment',
  '$schema',
  '$id',
  '$anchor',
  '$dynamicRef',
  'format',
  'pattern',
]);
/** Keywords whose value must be a boolean. */
const booleans = new Set(['deprecated', 'readOnly', 'writeOnly', 'uniqueItems']);
/** Keywords whose value must be a number, with `multipleOf` additionally positive. */
const bounds = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']);
/** Keywords whose value must be a non-negative integer. */
const counts = new Set(['minLength', 'maxLength', 'minProperties', 'maxProperties', 'minContains', 'maxContains']);
const supported = new Set([
  'type',
  'properties',
  'definitions',
  '$defs',
  'required',
  'items',
  'additionalItems',
  'additionalProperties',
  'enum',
  'const',
  'allOf',
  'anyOf',
  'oneOf',
  '$ref',
  'minItems',
  'maxItems',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'uniqueItems',
  'minProperties',
  'maxProperties',
]);
const types = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Generation failure whose message is safe to surface: it is built from server and tool names,
 * keyword names, and positions, so it never carries schema values or transport details.
 */
export class TypegenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypegenError';
  }
}

function fail(reason: string, position: string): never {
  throw new TypegenError(`${reason} at ${position}`);
}

// JSON roundtripping is not enough: schema object insertion order affects declaration order.
function canonical(value: unknown, position: string, ancestors = new Set<object>(), depth = 0): unknown {
  if (depth > MAX_JSON_SCHEMA_DEPTH) fail(`Schema exceeds the maximum depth of ${MAX_JSON_SCHEMA_DEPTH}`, position);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') fail('Schema contains a value that is not JSON', position);
  if (ancestors.has(value)) fail('Schema contains a circular reference', position);
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map(item => canonical(item, position, ancestors, depth + 1))
    : Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, canonical(Reflect.get(value, key), position, ancestors, depth + 1)]),
      );
  ancestors.delete(value);
  return result;
}

function prepare(raw: unknown, position: string, warnings: string[]): Schema {
  const root = canonical(raw, position);
  const locations = new Map<string, Schema>();
  const references: string[] = [];
  const pointer = (part: string) => part.replace(/~/g, '~0').replace(/\//g, '~1');

  function visit(value: unknown, path: string): Schema {
    if (typeof value === 'boolean') {
      locations.set(path, value);
      return value;
    }
    const schema = object(value) ? value : undefined;
    locations.set(path, schema ?? true);
    const nodePosition = `${position}/schema[${locations.size - 1}]`;
    if (!schema) {
      warnings.push(`Schema is not an object at ${nodePosition}; widened to unknown`);
      return true;
    }
    const output: Record<string, unknown> = Object.create(null);
    const reasons: string[] = [];
    const invalid = (key: string) => reasons.push(`invalid ${JSON.stringify(key)} value`);
    for (const [key, entry] of Object.entries(schema)) {
      const here = `${path}/${pointer(key)}`;
      // Annotations never reach the emitted type, so a malformed one cannot widen or fail it.
      if (annotations.has(key)) continue;
      if (!supported.has(key)) reasons.push(`unsupported keyword ${JSON.stringify(key)}`);
      // A keyword with a value outside its allowed shape widens this schema rather than failing
      // the run: one sloppy tool must not stop generation for every other server.
      if (strings.has(key) && typeof entry !== 'string') {
        invalid(key);
        continue;
      }
      if (booleans.has(key) && typeof entry !== 'boolean') {
        invalid(key);
        continue;
      }
      if (bounds.has(key) && (typeof entry !== 'number' || (key === 'multipleOf' && entry <= 0))) {
        invalid(key);
        continue;
      }
      if (counts.has(key) && !count(entry)) {
        invalid(key);
        continue;
      }
      if (maps.has(key)) {
        if (!object(entry)) {
          invalid(key);
          continue;
        }
        output[key] = Object.fromEntries(
          Object.entries(entry).map(([name, child]) => [name, visit(child, `${here}/${pointer(name)}`)]),
        );
      } else if (singles.has(key)) {
        output[key] = visit(entry, here);
      } else if (lists.has(key) || (key === 'items' && Array.isArray(entry))) {
        if (!Array.isArray(entry) || entry.length === 0) {
          invalid(key);
          continue;
        }
        output[key] = entry.map((child, index) => visit(child, `${here}/${index}`));
      } else if (key === 'items') {
        output[key] = visit(entry, here);
      } else if (key === '$ref') {
        if (typeof entry !== 'string') {
          invalid(key);
          continue;
        }
        if (entry === '#' || entry.startsWith('#/')) {
          references.push(entry);
          output[key] = entry;
        } else {
          reasons.push('external reference');
        }
      } else if (key === 'type') {
        const entries = Array.isArray(entry) ? entry : [entry];
        if (!entries.length || entries.some(type => typeof type !== 'string' || !types.has(type))) {
          invalid(key);
          continue;
        }
        output[key] = entry;
      } else if (key === 'required') {
        if (
          !Array.isArray(entry) ||
          entry.some(name => typeof name !== 'string') ||
          new Set(entry).size !== entry.length
        ) {
          invalid(key);
          continue;
        }
        output[key] = entry;
      } else if (key === 'enum') {
        if (!Array.isArray(entry) || entry.length === 0) {
          invalid(key);
          continue;
        }
        output[key] = entry;
      } else if (key === 'minItems' || key === 'maxItems') {
        if (!count(entry)) {
          invalid(key);
          continue;
        }
        if (entry > 100) reasons.push(`${JSON.stringify(key)} bound above 100`);
        output[key] = entry;
      } else if (key === 'const') {
        output[key] = entry;
      }
    }
    if (reasons.length) {
      const reason = reasons.join('; ');
      warnings.push(`${reason.charAt(0).toUpperCase()}${reason.slice(1)} at ${nodePosition}; widened to unknown`);
      // Keep reference targets even when their containing schema cannot be represented.
      return { ...output, tsType: 'unknown' };
    }
    return output;
  }

  const result = visit(root, '');
  for (const ref of references) {
    let target: string;
    try {
      target = decodeURIComponent(ref.slice(1));
    } catch {
      fail('Local reference is not a valid URI fragment', position);
    }
    if (!locations.has(target) || /~(?![01])/u.test(target))
      fail(`Unresolved local reference ${JSON.stringify(ref)}`, position);
  }
  // Reference/combinator-only cycles emit illegal aliases such as type X = X.
  // Properties and array items guard recursion and may refer back to their container.
  const active = new Set<string>();
  const complete = new Set<string>();
  function checkCycle(path: string, depth = 0): void {
    if (depth > MAX_JSON_SCHEMA_DEPTH) fail(`Schema exceeds the maximum depth of ${MAX_JSON_SCHEMA_DEPTH}`, position);
    if (active.has(path)) fail('Unresolvable recursive schema', position);
    if (complete.has(path)) return;
    active.add(path);
    const schema = locations.get(path);
    if (object(schema)) {
      if (typeof schema.$ref === 'string' && (schema.$ref === '#' || schema.$ref.startsWith('#/'))) {
        checkCycle(decodeURIComponent(schema.$ref.slice(1)), depth + 1);
      }
      for (const key of ['allOf', 'anyOf', 'oneOf']) {
        const children = schema[key];
        if (Array.isArray(children)) children.forEach((_, index) => checkCycle(`${path}/${key}/${index}`, depth + 1));
      }
    }
    active.delete(path);
    complete.add(path);
  }
  for (const path of locations.keys()) checkCycle(path);
  return result;
}

function identifier(name: string): string {
  const normalized = name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/ +/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `Server${normalized || 'Unnamed'}`;
}

/** Internal catalog-to-source boundary. No connections, loading, or filesystem writes. */
export async function generateToolTypes(
  catalog: SerializableMCPToolCatalog,
): Promise<{ source: string; warnings: string[] }> {
  const declarations: string[] = [];
  const servers: string[] = [];
  const warnings: string[] = [];
  const serverNames = new Map<string, string>();
  const flatNames = new Set<string>();
  let schemaIndex = 0;
  const budget = { values: 0 };

  function widen(name: string, position: string, reason: string): string {
    warnings.push(`${reason} at ${position}; widened to unknown`);
    declarations.push(`export type ${name} = unknown;\n`);
    return name;
  }

  async function convert(raw: unknown, position: string): Promise<string> {
    const name = `ToolSchema${++schemaIndex}`;
    // The value count comes first and gates the walk below: `jsonSchemaComplexity` expands the
    // schema-bearing containers it visits, so it must only ever see a schema already bounded by
    // value. An over-budget schema is then widened without being copied, walked, or converted.
    const values = countJsonValues(raw, MAX_SCHEMA_VALUES);
    budget.values += values;
    if (values > MAX_SCHEMA_VALUES) {
      return widen(name, position, `Schema exceeds the maximum value count of ${MAX_SCHEMA_VALUES}`);
    }
    if (budget.values > MAX_CATALOG_VALUES) {
      return widen(name, position, `Catalogue exceeds the maximum value count of ${MAX_CATALOG_VALUES}`);
    }
    const { error, limit } = jsonSchemaComplexity(raw);
    // Depth is a structural violation, not merely an expensive schema: keep failing it.
    if (limit === 'depth') fail(`Schema exceeds the maximum depth of ${MAX_JSON_SCHEMA_DEPTH}`, position);
    if (error) return widen(name, position, error);
    const schema = prepare(raw, position, warnings);
    if (typeof schema === 'boolean') {
      declarations.push(`export type ${name} = ${schema ? 'unknown' : 'never'};\n`);
    } else {
      const names = new WeakMap<object, string>();
      let nested = 0;
      try {
        declarations.push(
          await compile({ ...schema, title: name }, name, {
            bannerComment: '',
            unknownAny: true,
            enableConstEnums: false,
            $refOptions: { resolve: { external: false, file: false, http: false } },
            customName: value => {
              if (value.title === name) return name;
              if (!names.has(value)) names.set(value, `${name}Value${++nested}`);
              return names.get(value);
            },
          }),
        );
      } catch {
        // The converter is a black box: anything it refuses is a portion we cannot represent, and
        // one such tool must not stop generation for every other server.
        return widen(name, position, 'Schema conversion failed');
      }
    }
    return name;
  }

  for (const server of Object.keys(catalog).sort()) {
    const serverName = identifier(server);
    const collision = serverNames.get(serverName);
    if (collision !== undefined)
      throw new TypegenError(
        `Server interface name collision between ${JSON.stringify(collision)} and ${JSON.stringify(server)}`,
      );
    serverNames.set(serverName, server);
    const tools: string[] = [];
    for (const tool of Object.keys(catalog[server]!).sort()) {
      const flat = `${server}_${tool}`;
      if (flatNames.has(flat)) throw new TypegenError(`Flattened tool name collision for ${JSON.stringify(flat)}`);
      flatNames.add(flat);
      const definition = catalog[server]![tool]!;
      const position = `server ${JSON.stringify(server)} tool ${JSON.stringify(tool)}`;
      const input = await convert(definition.inputSchema, `${position} input`);
      const output =
        definition.outputSchema === undefined
          ? 'unknown'
          : await convert(definition.outputSchema, `${position} output`);
      tools.push(`    ${JSON.stringify(tool)}: { input: ${input}; output: ${output} };`);
    }
    declarations.push(`export interface ${serverName} {\n  tools: {\n${tools.join('\n')}\n  };\n}\n`);
    servers.push(`  ${JSON.stringify(server)}: ${serverName};`);
  }
  return {
    source: `// Generated MCP tool contracts. Regenerate when server schemas change.\n\n${declarations.join('\n')}\nexport interface MCPServers {\n${servers.join('\n')}\n}\n`,
    warnings,
  };
}
