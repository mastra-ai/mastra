/**
 * Code Mode — Type stub generation
 *
 * Converts Mastra tools into TypeScript `declare function external_<id>(...)`
 * stubs and assembles the instructions the model sees. The pipeline is:
 *
 *   tool.inputSchema (StandardSchemaWithJSON)
 *     -> standardSchemaToJSONSchema()  (already in core, zod v3 + v4 + arktype)
 *     -> jsonSchemaToTsString()        (this file, synchronous, dependency-free)
 *     -> stub string
 *
 * Only the subset of JSON Schema that tool schemas actually produce is handled;
 * anything else degrades to `unknown`.
 */

import type { JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from 'json-schema';
import type { ToolsInput } from '../../agent/types';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';
import type { StandardSchemaWithJSON } from '../../schema';
import type { CodeModeConfig } from './types';

/** A valid TypeScript identifier? (used to decide quoting of object keys). */
const SAFE_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Convert a JSON Schema (draft-07) node into a TypeScript type string.
 * Unsupported constructs return `unknown`.
 */
export function jsonSchemaToTsString(schema: JSONSchema7Definition | undefined): string {
  if (schema === undefined) return 'unknown';
  if (typeof schema === 'boolean') return schema ? 'unknown' : 'never';

  // enum / const
  if (schema.const !== undefined) return literal(schema.const);
  if (Array.isArray(schema.enum)) {
    return schema.enum.length ? schema.enum.map(literal).join(' | ') : 'never';
  }

  // unions
  const union = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(union) && union.length) {
    return union.map(jsonSchemaToTsString).join(' | ');
  }

  const type = normalizeType(schema.type);

  if (type === 'object' || schema.properties) {
    return objectType(schema);
  }
  if (type === 'array' || schema.items) {
    return arrayType(schema);
  }

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'unknown';
  }
}

function normalizeType(type: JSONSchema7['type']): JSONSchema7TypeName | undefined {
  if (Array.isArray(type)) {
    // e.g. ['string', 'null'] — caller folds null in via nullability; pick the
    // first non-null for the base type.
    return type.find(t => t !== 'null');
  }
  return type;
}

function objectType(schema: JSONSchema7): string {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const keys = Object.keys(props);

  if (!keys.length) {
    // Free-form object.
    const additional = schema.additionalProperties;
    if (additional !== undefined && additional !== false) {
      const valueType = typeof additional === 'object' ? jsonSchemaToTsString(additional) : 'unknown';
      return `Record<string, ${valueType}>`;
    }
    return 'Record<string, unknown>';
  }

  const fields = keys.map(key => {
    const optional = !required.has(key) ? '?' : '';
    const k = SAFE_IDENT.test(key) ? key : JSON.stringify(key);
    return `${k}${optional}: ${jsonSchemaToTsString(props[key])}`;
  });
  return `{ ${fields.join('; ')} }`;
}

function arrayType(schema: JSONSchema7): string {
  const items = schema.items;
  if (Array.isArray(items)) {
    // Tuple.
    return `[${items.map(jsonSchemaToTsString).join(', ')}]`;
  }
  const inner = jsonSchemaToTsString(items);
  // Use `Array<...>` form for top-level unions so `A | B[]` isn't misread as
  // `A | (B[])`. Object literals and other forms use the `T[]` shorthand.
  return isTopLevelUnion(inner) ? `Array<${inner}>` : `${inner}[]`;
}

/** True if `ts` is a union at the top level (a ` | ` not nested in braces/brackets). */
function isTopLevelUnion(ts: string): boolean {
  let depth = 0;
  for (let i = 0; i < ts.length; i++) {
    const c = ts[i];
    if (c === '{' || c === '[' || c === '(' || c === '<') depth++;
    else if (c === '}' || c === ']' || c === ')' || c === '>') depth--;
    else if (c === '|' && depth === 0) return true;
  }
  return false;
}

function literal(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return 'unknown';
}

function schemaToTs(schema: unknown, io: 'input' | 'output'): string {
  if (!isStandardSchemaWithJSON(schema)) return 'unknown';
  try {
    const json = standardSchemaToJSONSchema(schema as StandardSchemaWithJSON, { io });
    return jsonSchemaToTsString(json as JSONSchema7);
  } catch {
    return 'unknown';
  }
}

/** Strip non-identifier characters so a tool id is a legal function-name suffix. */
function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_$]/g, '_');
  return SAFE_IDENT.test(cleaned) ? cleaned : `_${cleaned}`;
}

/** A single tool's TS declaration plus the original/sanitized id mapping. */
export interface CodeModeStub {
  /** Original tool id (key used by the RPC dispatcher). */
  toolId: string;
  /** Sanitized identifier used in `external_<name>`. */
  externalName: string;
  /** The full `declare function ...` line(s). */
  declaration: string;
}

/** Generate stubs for every tool in the config. */
export function generateStubs(tools: ToolsInput): CodeModeStub[] {
  // Two distinct tool ids can sanitize to the same `external_*` name (e.g.
  // `a-b` and `a_b`). Without this check the later binding would silently
  // overwrite the earlier one in the runner, so fail fast instead.
  const seen = new Map<string, string>();
  return Object.entries(tools).map(([key, tool]) => {
    const toolId = (tool as { id?: string }).id ?? key;
    const description = (tool as { description?: string }).description;
    const inputType = schemaToTs((tool as { inputSchema?: unknown }).inputSchema, 'input');
    const outputType = schemaToTs((tool as { outputSchema?: unknown }).outputSchema, 'output');
    const externalName = sanitizeId(toolId);

    const prior = seen.get(externalName);
    if (prior !== undefined && prior !== toolId) {
      throw new Error(`Code Mode tool id collision: "${prior}" and "${toolId}" both map to external_${externalName}`);
    }
    seen.set(externalName, toolId);

    const doc = description ? `/** ${description.replace(/\*\//g, '* /')} */\n` : '';
    const declaration = `${doc}declare function external_${externalName}(input: ${inputType}): Promise<${outputType}>;`;

    return { toolId, externalName, declaration };
  });
}

const USAGE_CONTRACT = `# Code Mode

You have an \`execute_typescript\` tool. Instead of calling tools one at a time,
write a single TypeScript program that orchestrates them and returns one result.

Rules:
- Call the available tools via the \`external_*\` functions declared below. Each
  returns a Promise — \`await\` it.
- Batch independent calls with \`Promise.all\`. Do arithmetic and data shaping in
  JavaScript, not in your head.
- End the program by \`return\`-ing the final value (objects/arrays are fine).
- The program runs in a sandbox: no access to the host filesystem, network, or
  process. The only capabilities are the \`external_*\` functions.
- Use \`console.log\` for debugging; logs are captured and returned.

Available functions:`;

/** Build the full instructions string (usage contract + stubs). */
export function createCodeModeInstructions(config: CodeModeConfig): string {
  const stubs = generateStubs(config.tools);
  const declarations = stubs.map(s => s.declaration).join('\n\n');
  return `${USAGE_CONTRACT}\n\n${declarations}`;
}
