import { z } from 'zod';

/**
 * Build a Zod schema from a JSON Schema at runtime.
 *
 * Studio previously produced its form schemas by generating Zod *source code*
 * with `json-schema-to-zod` and evaluating it through `Function()`. That works,
 * but it forces every self-hosted deployment to relax its Content Security
 * Policy with `'unsafe-eval'`, which is a poor trade for building a form.
 *
 * This constructs the same schemas by calling the Zod API directly, so no
 * string is ever compiled. The supported surface is deliberately matched to
 * what the generator emitted for the schemas Studio receives — tool inputs,
 * workflow trigger/resume/state schemas, and request context schemas — and
 * `__tests__/json-schema-to-zod-runtime.test.ts` pins that equivalence.
 *
 * Anything unrecognized degrades to `z.any()`, which is what the generator did
 * too: an unusual schema renders a permissive field rather than breaking Studio.
 */

type JsonSchema = Record<string, any>;

const STRING_FORMATS: Record<string, (s: z.ZodString) => z.ZodString> = {
  'date-time': s => s.datetime(),
  email: s => s.email(),
  uri: s => s.url(),
  url: s => s.url(),
  uuid: s => s.uuid(),
  ipv4: s => s.ip({ version: 'v4' }),
  ipv6: s => s.ip({ version: 'v6' }),
};

function buildString(schema: JsonSchema): z.ZodTypeAny {
  let out = z.string();
  const format = typeof schema.format === 'string' ? STRING_FORMATS[schema.format] : undefined;
  if (format) out = format(out);
  if (typeof schema.minLength === 'number') out = out.min(schema.minLength);
  if (typeof schema.maxLength === 'number') out = out.max(schema.maxLength);
  if (typeof schema.pattern === 'string') {
    try {
      out = out.regex(new RegExp(schema.pattern));
    } catch {
      // An invalid or non-JS-compatible pattern should not break the form; the
      // rest of the field's validation still applies.
    }
  }
  return out;
}

function buildNumber(schema: JsonSchema, integer: boolean): z.ZodTypeAny {
  let out = z.number();
  if (integer) out = out.int();
  if (typeof schema.minimum === 'number') out = out.min(schema.minimum);
  if (typeof schema.maximum === 'number') out = out.max(schema.maximum);
  if (typeof schema.exclusiveMinimum === 'number') out = out.gt(schema.exclusiveMinimum);
  if (typeof schema.exclusiveMaximum === 'number') out = out.lt(schema.exclusiveMaximum);
  if (typeof schema.multipleOf === 'number') out = out.multipleOf(schema.multipleOf);
  return out;
}

function buildArray(schema: JsonSchema): z.ZodTypeAny {
  const items = schema.items && !Array.isArray(schema.items) ? convert(schema.items) : z.any();
  let out = z.array(items);
  if (typeof schema.minItems === 'number') out = out.min(schema.minItems);
  if (typeof schema.maxItems === 'number') out = out.max(schema.maxItems);
  return out;
}

function buildObject(schema: JsonSchema): z.ZodTypeAny {
  const properties = schema.properties as Record<string, JsonSchema> | undefined;
  const additional = schema.additionalProperties;

  // An object with no declared properties but a schema for additional ones is a
  // dictionary. Studio renders these with its record field, so they must not
  // collapse into an empty object — that would silently discard every entry.
  if (!properties || Object.keys(properties).length === 0) {
    if (additional && typeof additional === 'object') {
      return z.record(convert(additional));
    }
    if (additional === true) {
      return z.record(z.any());
    }
    return z.object({});
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    let field = convert(propSchema);
    const hasDefault = propSchema && typeof propSchema === 'object' && propSchema.default !== undefined;
    // A property with a default is satisfiable without the caller supplying it,
    // so it is not marked optional on top of the default.
    if (!hasDefault && !required.includes(key)) field = field.optional();
    shape[key] = field;
  }

  const out = z.object(shape);
  return additional && typeof additional === 'object' ? out.catchall(convert(additional)) : out;
}

function buildComposite(schemas: JsonSchema[]): z.ZodTypeAny {
  const options = schemas.map(convert);
  if (options.length === 0) return z.any();
  if (options.length === 1) return options[0]!;
  return z.union(options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function buildForType(schema: JsonSchema, type: string): z.ZodTypeAny {
  switch (type) {
    case 'string':
      return buildString(schema);
    case 'number':
      return buildNumber(schema, false);
    case 'integer':
      return buildNumber(schema, true);
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    case 'array':
      return buildArray(schema);
    case 'object':
      return buildObject(schema);
    default:
      return z.any();
  }
}

function convert(schema: JsonSchema | boolean | undefined): z.ZodTypeAny {
  if (schema === undefined || schema === true) return z.any();
  if (schema === false) return z.never();
  if (typeof schema !== 'object') return z.any();

  let out: z.ZodTypeAny;

  if (schema.const !== undefined) {
    out = z.literal(schema.const);
  } else if (Array.isArray(schema.enum)) {
    const values = schema.enum;
    out = values.every((v: unknown) => typeof v === 'string')
      ? z.enum(values as [string, ...string[]])
      : buildComposite(values.map((v: unknown) => ({ const: v })));
  } else if (Array.isArray(schema.anyOf)) {
    out = buildComposite(schema.anyOf);
  } else if (Array.isArray(schema.oneOf)) {
    out = buildComposite(schema.oneOf);
  } else if (Array.isArray(schema.allOf)) {
    // Intersections of more than two members nest pairwise.
    const parts = schema.allOf.map(convert);
    out = parts.length ? parts.reduce((left, right) => z.intersection(left, right)) : z.any();
  } else if (Array.isArray(schema.type)) {
    out = buildComposite(schema.type.map((t: string) => ({ ...schema, type: t })));
  } else if (typeof schema.type === 'string') {
    out = buildForType(schema, schema.type);
  } else {
    out = z.any();
  }

  if (typeof schema.description === 'string') out = out.describe(schema.description);
  if (schema.default !== undefined) out = out.default(schema.default);

  return out;
}

/**
 * Convert a JSON Schema into a Zod schema without evaluating generated code.
 */
export function jsonSchemaToZodRuntime(schema: JsonSchema | boolean | undefined): z.ZodTypeAny {
  return convert(schema);
}
