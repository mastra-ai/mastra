import { z } from 'zod/v4';

import { GENUI_PROTOCOL_VERSION } from './types';
import type { GenUIEnvelope, GenUILimits, GenUIOperation, GenUISpec, JSONObject, JSONValue } from './types';

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: 'invalid' | 'limit-exceeded' | 'invalid-graph' };

type Failure = Extract<GenUIParseResult<unknown>, { ok: false }>;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class GenUIValidationError extends Error {
  constructor(
    message: string,
    readonly code: Failure['code'] = 'invalid',
  ) {
    super(message);
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Deep-copy an untrusted value into a fresh JSON value.
 *
 * Rejects non-JSON types (functions, symbols, class instances, non-finite numbers), prototype-polluting
 * keys and excessive nesting; drops `undefined` object entries. The copy is built from scratch so
 * callers never hold a reference to the input.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function toSafeJSONValue(value: unknown, maxDepth: number, path = '$', depth = 0): JSONValue {
  if (depth > maxDepth) throw new GenUIValidationError(`${path} exceeds max nesting depth ${maxDepth}`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new GenUIValidationError(`${path} must be a finite number`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => toSafeJSONValue(item, maxDepth, `${path}[${index}]`, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: JSONObject = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) throw new GenUIValidationError(`${path} contains forbidden key "${key}"`);
      if (value[key] === undefined) continue;
      out[key] = toSafeJSONValue(value[key], maxDepth, `${path}.${key}`, depth + 1);
    }
    return out;
  }
  throw new GenUIValidationError(`${path} is not a JSON value`);
}

/** @experimental Generative UI is in beta and may change without notice. */
export function toSafeJSONObject(value: unknown, maxDepth: number, path = '$'): JSONObject {
  if (!isPlainObject(value)) throw new GenUIValidationError(`${path} must be a plain object`);
  return toSafeJSONValue(value, maxDepth, path) as JSONObject;
}

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_\-.:]+$/, 'contains unsupported characters')
  .refine(value => !FORBIDDEN_KEYS.has(value), 'is a reserved id');

const idList = z.array(id).refine(ids => new Set(ids).size === ids.length, 'contains duplicate ids');

const pointer = z
  .string()
  .max(1024)
  .regex(/^\/(root|elements|state)(\/|$)/, 'must start with /root, /elements or /state')
  .refine(
    value => !value.split('/').some(segment => FORBIDDEN_KEYS.has(segment.replace(/~1/g, '/').replace(/~0/g, '~'))),
    'contains a reserved segment',
  );

const json = z.custom<JSONValue>(value => value !== undefined, 'is required');

const patchSchema = z.discriminatedUnion('op', [
  z.object({ op: z.enum(['add', 'replace', 'test']), path: pointer, value: json }),
  z.object({ op: z.literal('remove'), path: pointer }),
  z.object({ op: z.enum(['move', 'copy']), path: pointer, from: pointer }),
]);

/** Element fields json-render renders from (`visible`, `on`, `repeat`, `watch`, …) pass through to its own checks. */
const elementSchema = z.looseObject({
  type: id,
  props: z.record(z.string(), json),
  children: idList.optional(),
  slots: z.record(z.string(), idList).optional(),
});

const specSchema = z.object({
  root: z.union([id, z.literal('')]),
  elements: z.record(id, elementSchema),
  state: z.record(z.string(), json).optional(),
});

const sourceSchema = z.object({
  agentId: z.string().max(512).optional(),
  runId: z.string().max(512).optional(),
  toolCallId: z.string().max(512).optional(),
  workflowId: z.string().max(512).optional(),
});

const operationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('createSurface'),
    spec: specSchema.optional(),
    replace: z.boolean().optional(),
    placement: z.enum(['inline', 'panel', 'standalone', 'overlay']).optional(),
    title: z.string().max(512).optional(),
    source: sourceSchema.optional(),
  }),
  z.object({ op: z.literal('patch'), patches: z.array(patchSchema).min(1) }),
  z.object({
    op: z.literal('setStatus'),
    status: z.enum(['streaming', 'ready', 'suspended', 'failed', 'aborted']),
    error: z.string().max(4096).optional(),
  }),
  z.object({ op: z.literal('deleteSurface') }),
]);

const operationsSchema = z.array(operationSchema).min(1);

const envelopeSchema = z.object({
  version: z.literal(GENUI_PROTOCOL_VERSION),
  eventId: id,
  surfaceId: id,
  baseRevision: z.int().nonnegative().optional(),
  operations: operationsSchema,
});

const formatIssue = (error: z.ZodError) => {
  const issue = error.issues[0]!;
  return issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
};

/** Safe-copy untrusted input, check its shape with `schema`, then run `check` for limits. */
const parse = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  limits: GenUILimits,
  check?: (value: T) => void,
): GenUIParseResult<T> => {
  try {
    const parsed = schema.safeParse(toSafeJSONValue(value, limits.maxValueDepth + 4));
    if (!parsed.success) return { ok: false, error: formatIssue(parsed.error), code: 'invalid' };
    check?.(parsed.data);
    return { ok: true, value: parsed.data };
  } catch (error) {
    if (error instanceof GenUIValidationError) return { ok: false, error: error.message, code: error.code };
    throw error;
  }
};

const checkOperations = (operations: readonly GenUIOperation[], limits: GenUILimits) => {
  if (operations.length > limits.maxOperationsPerEnvelope) {
    throw new GenUIValidationError(`operations exceed ${limits.maxOperationsPerEnvelope} entries`, 'limit-exceeded');
  }
  for (const op of operations) {
    if (op.op === 'patch' && op.patches.length > limits.maxPatchesPerOperation) {
      throw new GenUIValidationError(`patches exceed ${limits.maxPatchesPerOperation} entries`, 'limit-exceeded');
    }
  }
};

/**
 * Validate and deep-copy a list of untrusted GenUI operations (e.g. tool output before it is written).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parseGenUIOperations(value: unknown, limits: GenUILimits): GenUIParseResult<GenUIOperation[]> {
  return parse(operationsSchema as z.ZodType<GenUIOperation[]>, value, limits, ops => checkOperations(ops, limits));
}

/**
 * Validate and deep-copy an untrusted GenUI envelope.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parseGenUIEnvelope(value: unknown, limits: GenUILimits): GenUIParseResult<GenUIEnvelope> {
  return parse(envelopeSchema as z.ZodType<GenUIEnvelope>, value, limits, envelope =>
    checkOperations(envelope.operations, limits),
  );
}

/**
 * Check a spec after an envelope applied: its shape, its size, and that its elements form a tree.
 * json-render's renderer recurses into children without cycle or sharing checks, so an element with
 * two parents (exponential re-rendering) or a cycle (infinite recursion) must never reach it.
 * Children that have not streamed in yet are fine; they render as loading.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function checkGenUISpec(spec: GenUISpec, limits: GenUILimits): GenUIParseResult<GenUISpec> {
  const parsed = specSchema.safeParse(spec);
  if (!parsed.success) return { ok: false, error: `spec.${formatIssue(parsed.error)}`, code: 'invalid' };
  const fail = (error: string, code: Failure['code']): Failure => ({ ok: false, error, code });

  const ids = Object.keys(spec.elements);
  if (ids.length > limits.maxElementsPerSurface) {
    return fail(`spec exceeds ${limits.maxElementsPerSurface} elements`, 'limit-exceeded');
  }
  const parentOf = new Map<string, string>();
  for (const [parent, element] of Object.entries(parsed.data.elements)) {
    const children = [...(element.children ?? []), ...Object.values(element.slots ?? {}).flat()];
    if (children.length > limits.maxChildrenPerElement) {
      return fail(`element "${parent}" exceeds ${limits.maxChildrenPerElement} children`, 'limit-exceeded');
    }
    for (const child of new Set(children)) {
      if (child === parent) return fail(`element "${parent}" lists itself as a child`, 'invalid-graph');
      const other = parentOf.get(child);
      if (other !== undefined) {
        return fail(
          `element "${child}" has two parents ("${other}" and "${parent}"); to move it, update both parents in the same envelope`,
          'invalid-graph',
        );
      }
      parentOf.set(child, parent);
    }
  }
  // Every element has at most one parent, so walking up from any element either ends or loops.
  for (const start of ids) {
    let depth = 1;
    for (let at = parentOf.get(start); at !== undefined; at = parentOf.get(at)) {
      if (at === start) return fail(`element "${start}" is part of a cycle`, 'invalid-graph');
      if (++depth > limits.maxTreeDepth) {
        return fail(`element "${start}" is nested deeper than ${limits.maxTreeDepth}`, 'limit-exceeded');
      }
    }
  }
  if (JSON.stringify(spec).length > limits.maxSpecSize) {
    return fail(`spec exceeds ${limits.maxSpecSize} characters`, 'limit-exceeded');
  }
  return { ok: true, value: spec };
}
