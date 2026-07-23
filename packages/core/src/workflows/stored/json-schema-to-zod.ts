/**
 * Minimal JSON-Schema ↔ Zod bridge for stored workflows: a converter for the
 * static subset Zod round-trips through `standardSchemaToJSONSchema`, plus a
 * non-throwing validator for the write path.
 */
import { z } from 'zod';

/**
 * Minimal JSON-Schema shape we accept. Intentionally untyped on the value side
 * — different JSON Schema producers emit slightly different shapes and the
 * inline converter below just inspects the fields it cares about.
 */
export type JsonSchema = Record<string, any>;

/**
 * Options controlling how `jsonSchemaToZod` handles JSON Schema keywords the
 * MVP converter doesn't support.
 *
 * - `throw` (default): hard-crash with a targeted error. Correct for the save
 *   path — the author is right there and can simplify the schema.
 * - `warn`: emit a warning via `onUnsupported` (if provided) and fall back to
 *   `z.any()` for the unsupported subtree. Correct for the boot-time load
 *   path — one bad pre-existing row must not take down startup for every
 *   other workflow.
 */
export interface JsonSchemaToZodOptions {
  onUnsupportedSchema?: 'throw' | 'warn';
  onUnsupported?: (message: string) => void;
}

/**
 * Inline converter sufficient for the static subset Zod typically emits when
 * round-tripped through `standardSchemaToJSONSchema`. Handles:
 *
 *  - `object` with `properties` + `required`
 *  - `string` / `number` / `integer` / `boolean` / `null`
 *  - `array` with `items`
 *  - `enum`
 *  - `description` (propagated via `.describe`)
 *
 * For more exotic schemas (unions, intersections, recursive refs) swap in
 * `json-schema-to-zod` from npm. Kept inline to avoid pulling a dependency
 * for the MVP demo.
 */
export function jsonSchemaToZod(schema: JsonSchema, opts?: JsonSchemaToZodOptions): z.ZodTypeAny {
  return walk(schema, opts ?? {});
}

// JSON Schema keywords that this MVP converter does not support. If a stored
// workflow's inputSchema/outputSchema uses any of these, silently converting
// to z.any() would strip the constraint at rehydration and let bad data flow
// through at execution — hard-crash instead so the corruption surfaces at
// load time.
const UNSUPPORTED_SCHEMA_KEYS = [
  'oneOf',
  'anyOf',
  'allOf',
  'not',
  '$ref',
  'patternProperties',
  'discriminator',
] as const;

function walk(schema: JsonSchema, opts: JsonSchemaToZodOptions): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') return z.any();

  for (const key of UNSUPPORTED_SCHEMA_KEYS) {
    if (key in schema) {
      const message =
        `Stored workflow schema uses unsupported JSON Schema keyword "${key}". ` +
        `This converter only supports the static subset that Zod round-trips through ` +
        `standardSchemaToJSONSchema (object, array, string, number, integer, boolean, null, enum). ` +
        `Simplify the schema or extend jsonSchemaToZod to cover this keyword.`;
      if (opts.onUnsupportedSchema === 'warn') {
        opts.onUnsupported?.(message);
        return z.any();
      }
      throw new Error(message);
    }
  }

  let out: z.ZodTypeAny;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    out = z.enum(schema.enum.map(String) as [string, ...string[]]);
  } else if (Array.isArray(schema.type)) {
    const options = schema.type.map((t: string) => walk({ ...schema, type: t }, opts));
    // z.union requires a tuple of at least two members; guard shorter arrays.
    if (options.length === 1) {
      out = options[0]!;
    } else {
      out = z.union(options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    }
  } else {
    switch (schema.type) {
      case 'object': {
        const shape: Record<string, z.ZodTypeAny> = {};
        const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
          const childSchema = walk(child as JsonSchema, opts);
          shape[key] = required.has(key) ? childSchema : childSchema.optional();
        }
        const obj = z.object(shape);
        out = schema.additionalProperties === true ? obj.passthrough() : obj;
        break;
      }
      case 'array':
        out = z.array(walk(schema.items ?? {}, opts));
        break;
      case 'string':
        out = z.string();
        break;
      case 'number':
        out = z.number();
        break;
      case 'integer':
        out = z.number().int();
        break;
      case 'boolean':
        out = z.boolean();
        break;
      case 'null':
        out = z.null();
        break;
      case undefined:
        // No `type` and no enum/typed-array — schema is just a description
        // or annotation wrapper; permit z.any() for these.
        out = z.any();
        break;
      default:
        throw new Error(
          `Stored workflow schema uses unsupported JSON Schema type "${String(schema.type)}". ` +
            `This converter only supports object, array, string, number, integer, boolean, null, and enum.`,
        );
    }
  }

  if (typeof schema.description === 'string' && schema.description.length > 0) {
    out = out.describe(schema.description);
  }
  return out;
}

/**
 * Result of a `validateStorableJsonSchema` call.
 * `unsupported` lists every offending keyword usage as `<jsonPointer>: <keyword>`
 * so callers can log or surface a targeted message per offense.
 */
export type StorableJsonSchemaValidation = { ok: true } | { ok: false; unsupported: string[] };

/**
 * Non-throwing companion to `jsonSchemaToZod`. Walks a JSON Schema and reports
 * every unsupported-keyword usage without converting. Use this at write time
 * (e.g. inside `Mastra.addStoredWorkflow`) to surface a warning before the
 * schema is persisted — the row will still fail to rehydrate on the next boot
 * (`jsonSchemaToZod` throws), so this is a heads-up, not a guarantee.
 *
 * Callers decide whether to warn, reject, or ignore. This function never
 * throws for any input shape.
 */
export function validateStorableJsonSchema(schema: JsonSchema | undefined): StorableJsonSchemaValidation {
  if (!schema || typeof schema !== 'object') return { ok: true };
  const unsupported: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    for (const key of UNSUPPORTED_SCHEMA_KEYS) {
      if (key in n) unsupported.push(`${path || '#'}: ${key}`);
    }
    if (n.properties && typeof n.properties === 'object') {
      for (const [prop, child] of Object.entries(n.properties as Record<string, unknown>)) {
        visit(child, `${path}/properties/${prop}`);
      }
    }
    if (n.items) {
      if (Array.isArray(n.items)) {
        n.items.forEach((child, i) => visit(child, `${path}/items/${i}`));
      } else {
        visit(n.items, `${path}/items`);
      }
    }
    if (n.additionalProperties && typeof n.additionalProperties === 'object') {
      visit(n.additionalProperties, `${path}/additionalProperties`);
    }
  };
  visit(schema, '');
  return unsupported.length === 0 ? { ok: true } : { ok: false, unsupported };
}
