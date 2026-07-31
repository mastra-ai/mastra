// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

// Pre-payment payload guard. x402 spends the USDC before the seller validates the body, so a
// payload the server will reject still costs money for a guaranteed 422. This catches those cases
// for free using what the seller published: declared enums, and for enum-less selectors like
// `return_fields`, the field names its OpenAPI response defines. Fails open.

// Names that mark an input as a selector over the service's own output fields.
const SELECTOR_NAME = /(^|[._-])(return[._-]?)?(fields?|columns?|includes?|select)$/i;
const SELECTOR_DESCRIPTION = /fields to (return|include)|return(ed)? fields|which fields/i;
const MAX_LISTED = 40;
const SPEC_FETCH_TIMEOUT_MS = 15_000;
// Guards against pathological or cyclic schemas while collecting field names.
const MAX_SCHEMA_DEPTH = 12;

export interface FieldValidation {
  properties: Record<string, unknown>;
  required: string[];
  // Null when no spec was available.
  vocab: Set<string> | null;
}

// Where an inspect schema may nest request inputs, most specific first. `queryParams` must stay
// listed, or every GET falls through to the root, which has no `properties`, silently disabling
// the guard on the methods it is most needed for.
const SCHEMA_CONTAINERS = ['body', 'queryParams', 'query', 'querystring', 'params'] as const;

export function requestSchemaShape(
  schema: unknown,
): { properties: Record<string, unknown>; required: string[] } | null {
  if (!schema || typeof schema !== 'object') return null;
  const s = schema as Record<string, unknown>;
  const containers = [...SCHEMA_CONTAINERS.map(k => s[k]), s];
  for (const c of containers) {
    if (c && typeof c === 'object') {
      const props = (c as Record<string, unknown>).properties;
      if (props && typeof props === 'object') {
        const req = (c as Record<string, unknown>).required;
        return {
          properties: props as Record<string, unknown>,
          required: Array.isArray(req) ? req.map(String) : [],
        };
      }
    }
  }
  return null;
}

// Null means unknown rather than empty, so an unrecognised schema mislabels nothing.
export function declaredQueryParams(schema: unknown): Set<string> | null {
  if (!schema || typeof schema !== 'object') return null;
  const s = schema as Record<string, unknown>;
  for (const key of ['queryParams', 'query', 'querystring'] as const) {
    const container = s[key];
    if (!container || typeof container !== 'object') continue;
    const props = (container as Record<string, unknown>).properties;
    if (props && typeof props === 'object') {
      const names = Object.keys(props as Record<string, unknown>);
      if (names.length) return new Set(names);
    }
  }
  return null;
}

const specCache = new Map<string, Promise<Record<string, unknown> | null>>();

async function fetchOpenApi(url: string): Promise<Record<string, unknown> | null> {
  let pending = specCache.get(url);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SPEC_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const doc = (await res.json()) as unknown;
        return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    specCache.set(url, pending);
  }
  return pending;
}

// Follows `$ref` chains and guards against cycles.
function resolveRef(spec: Record<string, unknown>, node: unknown, seen = new Set<string>()): unknown {
  if (node && typeof node === 'object' && typeof (node as { $ref?: unknown }).$ref === 'string') {
    const ref = (node as { $ref: string }).$ref;
    if (!ref.startsWith('#/') || seen.has(ref)) return {};
    seen.add(ref);
    let cur: unknown = spec;
    for (const part of ref.slice(2).split('/')) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined;
    }
    return resolveRef(spec, cur, seen);
  }
  return node;
}

// A superset of the response's field names, which only makes the guard more permissive.
function collectPropertyNames(
  spec: Record<string, unknown>,
  node: unknown,
  out: Set<string>,
  depth = 0,
  seen = new Set<unknown>(),
): void {
  if (depth > MAX_SCHEMA_DEPTH) return;
  const n = resolveRef(spec, node);
  if (!n || typeof n !== 'object' || seen.has(n)) return;
  seen.add(n);
  const obj = n as Record<string, unknown>;
  const props = obj.properties;
  if (props && typeof props === 'object') {
    for (const [name, child] of Object.entries(props as Record<string, unknown>)) {
      out.add(name);
      collectPropertyNames(spec, child, out, depth + 1, seen);
    }
  }
  for (const key of ['items', 'additionalProperties']) {
    if (obj[key]) collectPropertyNames(spec, obj[key], out, depth + 1, seen);
  }
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    const branch = obj[key];
    if (Array.isArray(branch)) {
      for (const b of branch) collectPropertyNames(spec, b, out, depth + 1, seen);
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findOperation(spec: Record<string, unknown>, url: string, method: string): Record<string, unknown> | null {
  const paths = spec.paths;
  if (!paths || typeof paths !== 'object') return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const keys = Object.keys(paths as Record<string, unknown>);
  const templated = (k: string) => {
    if (!k.includes('{')) return false;
    const re = new RegExp(`(^|/)${escapeRegExp(k).replace(/\\\{[^/]+\\\}/g, '[^/]+')}$`);
    return re.test(pathname);
  };
  const key = keys.find(k => k === pathname) ?? keys.find(k => pathname.endsWith(k)) ?? keys.find(templated);
  if (!key) return null;
  const item = (paths as Record<string, unknown>)[key];
  if (!item || typeof item !== 'object') return null;
  const op = (item as Record<string, unknown>)[method.toLowerCase()];
  return op && typeof op === 'object' ? (op as Record<string, unknown>) : null;
}

function responseFieldVocab(spec: Record<string, unknown>, op: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const responses = op.responses;
  if (!responses || typeof responses !== 'object') return out;
  for (const [code, resp] of Object.entries(responses as Record<string, unknown>)) {
    if (!code.startsWith('2')) continue;
    const content = (resp as { content?: Record<string, unknown> } | null)?.content;
    const schema = content?.['application/json'] as { schema?: unknown } | undefined;
    if (schema?.schema) collectPropertyNames(spec, schema.schema, out);
  }
  return out;
}

// Null when no spec is advertised, it is unreachable, or the operation cannot be located.
export async function buildResponseVocab(
  openApiUrl: string | undefined,
  url: string,
  method: string,
): Promise<Set<string> | null> {
  if (!openApiUrl) return null;
  const spec = await fetchOpenApi(openApiUrl);
  if (!spec) return null;
  const op = findOperation(spec, url, method);
  if (!op) return null;
  const vocab = responseFieldVocab(spec, op);
  return vocab.size ? vocab : null;
}

function isFieldSelector(name: string, fieldSchema: Record<string, unknown>): boolean {
  if (SELECTOR_NAME.test(name)) return true;
  const desc = typeof fieldSchema.description === 'string' ? fieldSchema.description : '';
  return SELECTOR_DESCRIPTION.test(desc);
}

function fieldEnum(fieldSchema: Record<string, unknown>): string[] | null {
  if (Array.isArray(fieldSchema.enum)) return fieldSchema.enum.map(String);
  const items = fieldSchema.items;
  if (items && typeof items === 'object' && Array.isArray((items as { enum?: unknown }).enum)) {
    return (items as { enum: unknown[] }).enum.map(String);
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function formatList(values: string[]): string {
  const shown = values
    .slice(0, MAX_LISTED)
    .map(v => `\`${v}\``)
    .join(', ');
  const extra = values.length - MAX_LISTED;
  return extra > 0 ? `${shown}, … (+${extra} more)` : shown;
}

// Values the service will reject. An empty list is not a promise that the call succeeds.
export function findFieldViolations(data: Record<string, unknown>, validation: FieldValidation): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const fieldSchema = validation.properties[key];
    if (!fieldSchema || typeof fieldSchema !== 'object') continue;
    const fs = fieldSchema as Record<string, unknown>;

    // An enum in the schema is authoritative.
    const allowed = fieldEnum(fs);
    if (allowed) {
      const bad = asArray(value)
        .map(String)
        .filter(v => !allowed.includes(v));
      if (bad.length) {
        problems.push(
          `\`${key}\`: ${formatList(bad)} ${bad.length > 1 ? 'are' : 'is'} not among the ` +
            `allowed values ${formatList(allowed)}`,
        );
      }
      continue;
    }

    // Enum-less field selector: reject values the service can never return.
    if (validation.vocab && validation.vocab.size && Array.isArray(value) && isFieldSelector(key, fs)) {
      const vocab = validation.vocab;
      const bad = value.map(String).filter(v => !vocab.has(v));
      if (bad.length) {
        problems.push(
          `\`${key}\`: ${formatList(bad)} ${bad.length > 1 ? 'are' : 'is'} not a field this ` +
            `service returns. Valid fields: ${formatList([...vocab])}. This is an optional ` +
            `selector — omit it entirely to return all fields.`,
        );
      }
    }
  }
  return problems;
}

// States plainly that no money moved, so the caller knows it is safe to fix the values and retry.
export function preSpendErrorMessage(url: string, problems: string[]): string {
  return (
    `Not paying ${url}: the payload contains values this service will reject, and x402 ` +
    'charges before the server validates, so submitting it as-is would spend USDC on a ' +
    'guaranteed rejection. NO PAYMENT WAS MADE and none is needed to fix this. Correct or ' +
    'omit the following, then retry:\n- ' +
    problems.join('\n- ')
  );
}
