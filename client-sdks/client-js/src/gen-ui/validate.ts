import { GENUI_PROTOCOL_VERSION } from './types';
import type {
  GenUIEnvelope,
  GenUILimits,
  GenUIOperation,
  GenUIPatch,
  GenUIPlacement,
  GenUISurfaceSource,
  GenUISurfaceStatus,
  GenUISpec,
  JSONObject,
  JSONValue,
} from './types';

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: 'invalid' | 'limit-exceeded' | 'invalid-graph' };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ID_PATTERN = /^[A-Za-z0-9_\-.:]+$/;
const PLACEMENTS: readonly GenUIPlacement[] = ['inline', 'panel', 'standalone', 'overlay'];
const STATUSES: readonly GenUISurfaceStatus[] = ['streaming', 'ready', 'suspended', 'failed', 'aborted'];

type FailureCode = Extract<GenUIParseResult<unknown>, { ok: false }>['code'];

class GenUIValidationError extends Error {
  constructor(
    message: string,
    readonly code: FailureCode,
  ) {
    super(message);
  }
}

const fail = (message: string, code: FailureCode = 'invalid'): never => {
  throw new GenUIValidationError(message, code);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Deep-copy an untrusted value into a fresh JSON value.
 *
 * Rejects non-JSON types (functions, symbols, class instances, `undefined`,
 * non-finite numbers), prototype-polluting keys and excessive nesting. The
 * copy is built from scratch so callers never hold a reference to the input.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function toSafeJSONValue(value: unknown, maxDepth: number, path = '$', depth = 0): JSONValue {
  if (depth > maxDepth) fail(`${path} exceeds max nesting depth ${maxDepth}`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must be a finite number`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => toSafeJSONValue(item, maxDepth, `${path}[${index}]`, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: JSONObject = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) fail(`${path} contains forbidden key "${key}"`);
      const item = value[key];
      if (item === undefined) continue;
      out[key] = toSafeJSONValue(item, maxDepth, `${path}.${key}`, depth + 1);
    }
    return out;
  }
  return fail(`${path} is not a JSON value`);
}

/** @experimental Generative UI is in beta and may change without notice. */
export function toSafeJSONObject(value: unknown, maxDepth: number, path = '$'): JSONObject {
  if (!isPlainObject(value)) fail(`${path} must be a plain object`);
  return toSafeJSONValue(value, maxDepth, path) as JSONObject;
}

/** Approximate serialized size, used for limit enforcement. */
export const jsonSize = (value: JSONValue): number => JSON.stringify(value).length;

const readId = (value: unknown, limits: GenUILimits, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) return fail(`${path} must be a non-empty string`);
  if (value.length > limits.maxIdLength) fail(`${path} exceeds ${limits.maxIdLength} characters`);
  if (!ID_PATTERN.test(value)) fail(`${path} contains unsupported characters`);
  if (FORBIDDEN_KEYS.has(value)) fail(`${path} uses a reserved id`);
  return value;
};

const readOptionalString = (value: unknown, path: string, max = 512): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return fail(`${path} must be a string`);
  if (value.length > max) fail(`${path} exceeds ${max} characters`);
  return value;
};

const readIdList = (value: unknown, limits: GenUILimits, path: string, max: number): string[] => {
  if (!Array.isArray(value)) return fail(`${path} must be an array`);
  if (value.length > max) fail(`${path} exceeds ${max} entries`);
  const ids = value.map((id, index) => readId(id, limits, `${path}[${index}]`));
  if (new Set(ids).size !== ids.length) fail(`${path} contains duplicate ids`);
  return ids;
};

const PATCH_OPS: readonly GenUIPatch['op'][] = ['add', 'remove', 'replace', 'move', 'copy', 'test'];

const SPEC_KEYS = new Set(['root', 'elements', 'state']);

const readPointer = (value: unknown, path: string): string => {
  if (typeof value !== 'string') return fail(`${path} must be a string`);
  if (!value.startsWith('/'))
    fail(`${path} must be a JSON pointer starting with "/"; use replaceSpec for the whole spec`);
  if (value.length > 1024) fail(`${path} exceeds 1024 characters`);
  const segments = value.split('/').slice(1);
  if (!SPEC_KEYS.has(segments[0]!)) fail(`${path} must start with /root, /elements or /state`);
  if (segments.some(segment => FORBIDDEN_KEYS.has(segment.replace(/~1/g, '/').replace(/~0/g, '~')))) {
    fail(`${path} contains a reserved segment`);
  }
  return value;
};

const readPatch = (value: unknown, limits: GenUILimits, path: string): GenUIPatch => {
  if (!isPlainObject(value)) return fail(`${path} must be an object`);
  if (!PATCH_OPS.includes(value.op as GenUIPatch['op'])) fail(`${path}.op must be one of ${PATCH_OPS.join(', ')}`);
  const patch: GenUIPatch = { op: value.op as GenUIPatch['op'], path: readPointer(value.path, `${path}.path`) };
  if (patch.op === 'move' || patch.op === 'copy') patch.from = readPointer(value.from, `${path}.from`);
  if (patch.op === 'add' || patch.op === 'replace' || patch.op === 'test') {
    if (value.value === undefined) fail(`${path}.value is required for "${patch.op}"`);
    patch.value = toSafeJSONValue(value.value, limits.maxValueDepth, `${path}.value`);
  }
  return patch;
};

const readPatches = (value: unknown, limits: GenUILimits, path: string): GenUIPatch[] => {
  if (!Array.isArray(value)) return fail(`${path} must be an array`);
  if (value.length > limits.maxPatchesPerOperation) fail(`${path} exceeds ${limits.maxPatchesPerOperation} patches`);
  return value.map((patch, index) => readPatch(patch, limits, `${path}[${index}]`));
};

/**
 * Check the shape, limits and graph of a spec. Children may reference elements that have not arrived
 * yet (they render as nothing), but an element can't have two parents, appear in a cycle or nest
 * deeper than `maxTreeDepth`.
 */
const checkSpec = (spec: Record<string, unknown>, limits: GenUILimits, path: string): GenUISpec => {
  if (typeof spec.root !== 'string') fail(`${path}.root must be a string`);
  if (spec.root !== '') readId(spec.root, limits, `${path}.root`);
  if (!isPlainObject(spec.elements)) fail(`${path}.elements must be an object`);
  if (spec.state !== undefined && !isPlainObject(spec.state)) fail(`${path}.state must be an object`);
  const elements = spec.elements as Record<string, unknown>;
  const ids = Object.keys(elements);
  if (ids.length > limits.maxElementsPerSurface)
    fail(`${path} exceeds ${limits.maxElementsPerSurface} elements`, 'limit-exceeded');
  const parentOf = new Map<string, string>();
  for (const id of ids) {
    readId(id, limits, `${path}.elements key`);
    const element = elements[id];
    const at = `${path}.elements.${id}`;
    if (!isPlainObject(element)) return fail(`${at} must be an object`);
    readId(element.type, limits, `${at}.type`);
    if (!isPlainObject(element.props)) fail(`${at}.props must be an object`);
    const children =
      element.children === undefined
        ? []
        : readIdList(element.children, limits, `${at}.children`, limits.maxChildrenPerElement);
    if (element.slots !== undefined) {
      if (!isPlainObject(element.slots)) fail(`${at}.slots must be an object`);
      for (const [slot, list] of Object.entries(element.slots as Record<string, unknown>)) {
        children.push(...readIdList(list, limits, `${at}.slots.${slot}`, limits.maxChildrenPerElement));
      }
    }
    for (const child of new Set(children)) {
      if (child === id) fail(`element "${id}" lists itself as a child`, 'invalid-graph');
      const other = parentOf.get(child);
      if (other !== undefined)
        fail(
          `element "${child}" has two parents ("${other}" and "${id}"); to move it, update both parents in the same envelope`,
          'invalid-graph',
        );
      parentOf.set(child, id);
    }
  }
  // Every element has at most one parent, so walking up from any element either ends or loops.
  for (const id of ids) {
    let depth = 1;
    for (let at = parentOf.get(id); at !== undefined; at = parentOf.get(at)) {
      if (at === id) fail(`element "${id}" is part of a cycle`, 'invalid-graph');
      if (++depth > limits.maxTreeDepth)
        fail(`element "${id}" is nested deeper than ${limits.maxTreeDepth}`, 'limit-exceeded');
    }
  }
  if (jsonSize(spec as JSONObject) > limits.maxSpecSize)
    fail(`${path} exceeds ${limits.maxSpecSize} characters`, 'limit-exceeded');
  return spec as unknown as GenUISpec;
};

const readSpec = (value: unknown, limits: GenUILimits, path: string): GenUISpec => {
  const copy = toSafeJSONObject(value, limits.maxValueDepth + 4, path);
  return checkSpec(copy, limits, path);
};

const readSource = (value: unknown, path: string): GenUISurfaceSource | undefined => {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) return fail(`${path} must be an object`);
  const source: GenUISurfaceSource = {};
  for (const key of ['agentId', 'runId', 'toolCallId', 'workflowId'] as const) {
    const item = readOptionalString(value[key], `${path}.${key}`);
    if (item !== undefined) source[key] = item;
  }
  return source;
};

const readOperation = (value: unknown, limits: GenUILimits, path: string): GenUIOperation => {
  if (!isPlainObject(value)) return fail(`${path} must be an object`);
  switch (value.op) {
    case 'createSurface': {
      const placement = value.placement;
      if (placement !== undefined && !PLACEMENTS.includes(placement as GenUIPlacement)) {
        fail(`${path}.placement must be one of ${PLACEMENTS.join(', ')}`);
      }
      const op: Extract<GenUIOperation, { op: 'createSurface' }> = { op: 'createSurface' };
      if (value.spec !== undefined) op.spec = readSpec(value.spec, limits, `${path}.spec`);
      if (value.replace !== undefined) {
        if (typeof value.replace !== 'boolean') fail(`${path}.replace must be a boolean`);
        if (value.replace) op.replace = true;
      }
      if (placement !== undefined) op.placement = placement as GenUIPlacement;
      const catalogId = readOptionalString(value.catalogId, `${path}.catalogId`, limits.maxIdLength);
      if (catalogId !== undefined) op.catalogId = catalogId;
      const catalogVersion = readOptionalString(value.catalogVersion, `${path}.catalogVersion`, 64);
      if (catalogVersion !== undefined) op.catalogVersion = catalogVersion;
      const title = readOptionalString(value.title, `${path}.title`);
      if (title !== undefined) op.title = title;
      const source = readSource(value.source, `${path}.source`);
      if (source) op.source = source;
      return op;
    }
    case 'patch':
      return { op: 'patch', patches: readPatches(value.patches, limits, `${path}.patches`) };
    case 'replaceSpec':
      return { op: 'replaceSpec', spec: readSpec(value.spec, limits, `${path}.spec`) };
    case 'setStatus': {
      if (!STATUSES.includes(value.status as GenUISurfaceStatus)) {
        fail(`${path}.status must be one of ${STATUSES.join(', ')}`);
      }
      const op: Extract<GenUIOperation, { op: 'setStatus' }> = {
        op: 'setStatus',
        status: value.status as GenUISurfaceStatus,
      };
      const error = readOptionalString(value.error, `${path}.error`, 2000);
      if (error !== undefined) op.error = error;
      return op;
    }
    case 'deleteSurface':
      return { op: 'deleteSurface' };
    default:
      return fail(`${path}.op "${String(value.op)}" is not a supported GenUI operation`);
  }
};

const wrap = <T>(read: () => T): GenUIParseResult<T> => {
  try {
    return { ok: true, value: read() };
  } catch (error) {
    if (error instanceof GenUIValidationError) return { ok: false, error: error.message, code: error.code };
    throw error;
  }
};

/**
 * Validate and deep-copy a list of untrusted GenUI operations (e.g. LLM tool arguments).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parseGenUIOperations(value: unknown, limits: GenUILimits): GenUIParseResult<GenUIOperation[]> {
  return wrap(() => {
    if (!Array.isArray(value)) return fail('operations must be an array');
    if (value.length === 0) fail('operations must not be empty');
    if (value.length > limits.maxOperationsPerEnvelope) {
      fail(`operations exceed ${limits.maxOperationsPerEnvelope} entries`);
    }
    return value.map((op, index) => readOperation(op, limits, `operations[${index}]`));
  });
}

/**
 * Validate and deep-copy an untrusted GenUI envelope.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parseGenUIEnvelope(value: unknown, limits: GenUILimits): GenUIParseResult<GenUIEnvelope> {
  return wrap(() => {
    if (!isPlainObject(value)) return fail('envelope must be an object');
    if (value.version !== GENUI_PROTOCOL_VERSION) {
      fail(`unsupported GenUI protocol version ${String(value.version)}`);
    }
    const envelope: GenUIEnvelope = {
      version: GENUI_PROTOCOL_VERSION,
      eventId: readId(value.eventId, limits, 'eventId'),
      surfaceId: readId(value.surfaceId, limits, 'surfaceId'),
      operations: [],
    };
    if (value.baseRevision !== undefined) {
      if (!Number.isInteger(value.baseRevision) || (value.baseRevision as number) < 0) {
        fail('baseRevision must be a non-negative integer');
      }
      envelope.baseRevision = value.baseRevision as number;
    }
    const operations = parseGenUIOperations(value.operations, limits);
    if (!operations.ok) fail(operations.error, operations.code);
    else envelope.operations = operations.value;
    return envelope;
  });
}

/**
 * Validate an untrusted spec (e.g. the `ui_surface` tool input) and deep-copy it.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parseGenUISpec(value: unknown, limits: GenUILimits): GenUIParseResult<GenUISpec> {
  return wrap(() => readSpec(value, limits, 'spec'));
}

/**
 * Check a spec built from trusted, already-copied JSON (shape, limits, graph) without copying it.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function checkGenUISpec(spec: GenUISpec, limits: GenUILimits): GenUIParseResult<GenUISpec> {
  return wrap(() => {
    if (!isPlainObject(spec)) return fail('spec must be an object');
    return checkSpec(spec as unknown as Record<string, unknown>, limits, 'spec');
  });
}
