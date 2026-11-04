import { GENUI_PROTOCOL_VERSION } from './types';
import type {
  GenUIEnvelope,
  GenUILimits,
  GenUINodeInput,
  GenUIOperation,
  GenUIPlacement,
  GenUISurfaceSource,
  GenUISurfaceStatus,
  JSONObject,
  JSONValue,
} from './types';

export type GenUIParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ID_PATTERN = /^[A-Za-z0-9_\-.:]+$/;
const PLACEMENTS: readonly GenUIPlacement[] = ['inline', 'panel', 'standalone', 'overlay'];
const STATUSES: readonly GenUISurfaceStatus[] = ['streaming', 'ready', 'suspended', 'failed', 'aborted'];

class GenUIValidationError extends Error {}

const fail = (message: string): never => {
  throw new GenUIValidationError(message);
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

const readKeyList = (value: unknown, path: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(key => typeof key !== 'string')) return fail(`${path} must be a string[]`);
  return [...(value as string[])];
};

const readProps = (value: unknown, limits: GenUILimits, path: string): JSONObject => {
  if (value === undefined) return {};
  const props = toSafeJSONObject(value, limits.maxValueDepth, path);
  if (jsonSize(props) > limits.maxPropsSize) fail(`${path} exceeds ${limits.maxPropsSize} characters`);
  return props;
};

const readData = (value: unknown, limits: GenUILimits, path: string): JSONObject => {
  const data = toSafeJSONObject(value, limits.maxValueDepth, path);
  if (jsonSize(data) > limits.maxDataSize) fail(`${path} exceeds ${limits.maxDataSize} characters`);
  return data;
};

const readNode = (value: unknown, limits: GenUILimits, path: string): GenUINodeInput => {
  if (!isPlainObject(value)) return fail(`${path} must be an object`);
  return {
    id: readId(value.id, limits, `${path}.id`),
    component: readId(value.component, limits, `${path}.component`),
    props: readProps(value.props, limits, `${path}.props`),
    children:
      value.children === undefined
        ? []
        : readIdList(value.children, limits, `${path}.children`, limits.maxChildrenPerNode),
  };
};

const readNodes = (value: unknown, limits: GenUILimits, path: string): GenUINodeInput[] => {
  if (!Array.isArray(value)) return fail(`${path} must be an array`);
  if (value.length > limits.maxNodesPerSurface) fail(`${path} exceeds ${limits.maxNodesPerSurface} nodes`);
  return value.map((node, index) => readNode(node, limits, `${path}[${index}]`));
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
      if (value.rootId !== undefined) op.rootId = readId(value.rootId, limits, `${path}.rootId`);
      if (placement !== undefined) op.placement = placement as GenUIPlacement;
      const catalogId = readOptionalString(value.catalogId, `${path}.catalogId`, limits.maxIdLength);
      if (catalogId !== undefined) op.catalogId = catalogId;
      const catalogVersion = readOptionalString(value.catalogVersion, `${path}.catalogVersion`, 64);
      if (catalogVersion !== undefined) op.catalogVersion = catalogVersion;
      const title = readOptionalString(value.title, `${path}.title`);
      if (title !== undefined) op.title = title;
      const source = readSource(value.source, `${path}.source`);
      if (source) op.source = source;
      if (value.data !== undefined) op.data = readData(value.data, limits, `${path}.data`);
      if (value.nodes !== undefined) op.nodes = readNodes(value.nodes, limits, `${path}.nodes`);
      return op;
    }
    case 'upsertNodes':
      return { op: 'upsertNodes', nodes: readNodes(value.nodes, limits, `${path}.nodes`) };
    case 'updateProps': {
      const op: Extract<GenUIOperation, { op: 'updateProps' }> = {
        op: 'updateProps',
        nodeId: readId(value.nodeId, limits, `${path}.nodeId`),
      };
      if (value.set !== undefined) op.set = readProps(value.set, limits, `${path}.set`);
      const unset = readKeyList(value.unset, `${path}.unset`);
      if (unset) op.unset = unset;
      return op;
    }
    case 'removeNodes':
      return {
        op: 'removeNodes',
        nodeIds: readIdList(value.nodeIds, limits, `${path}.nodeIds`, limits.maxNodesPerSurface),
      };
    case 'setChildren':
      return {
        op: 'setChildren',
        nodeId: readId(value.nodeId, limits, `${path}.nodeId`),
        children: readIdList(value.children, limits, `${path}.children`, limits.maxChildrenPerNode),
      };
    case 'setRoot':
      return { op: 'setRoot', rootId: value.rootId === null ? null : readId(value.rootId, limits, `${path}.rootId`) };
    case 'replaceData':
      return { op: 'replaceData', data: readData(value.data, limits, `${path}.data`) };
    case 'patchData': {
      const op: Extract<GenUIOperation, { op: 'patchData' }> = { op: 'patchData' };
      if (value.set !== undefined) op.set = readData(value.set, limits, `${path}.set`);
      const unset = readKeyList(value.unset, `${path}.unset`);
      if (unset) op.unset = unset;
      return op;
    }
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
    if (error instanceof GenUIValidationError) return { ok: false, error: error.message };
    throw error;
  }
};

/** Validate and deep-copy a list of untrusted GenUI operations (e.g. LLM tool arguments). */
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

/** Validate and deep-copy an untrusted GenUI envelope. */
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
    if (!operations.ok) fail(operations.error);
    else envelope.operations = operations.value;
    return envelope;
  });
}
