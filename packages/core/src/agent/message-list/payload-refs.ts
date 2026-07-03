import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from './state/types';

/**
 * Payload refs: storage-level dedupe of `providerMetadata.mastra.modelOutput`.
 *
 * When a tool defines `toModelOutput()`, the mapped model-facing output is persisted at
 * `providerMetadata.mastra.modelOutput` alongside the raw `toolInvocation.result`. For
 * media-heavy tools (screenshots, file reads) the exact same large string payload ends up
 * stored twice in the same part — once inside `result`, once inside `modelOutput`.
 *
 * `dedupeMessagePayloadRefs` (write path) replaces string values inside `modelOutput` that
 * are byte-identical to a string inside the sibling `result` with a namespaced marker
 * pointing at the result's JSON path. `rehydrateMessagePayloadRefs` (read path) resolves
 * markers back into the full strings, so in-process consumers always see today's shape.
 *
 * - Scope is a single tool-invocation part: markers only ever point into the sibling result.
 * - Only strings >= PAYLOAD_REF_MIN_LENGTH chars are deduped (small strings aren't worth a marker).
 * - Both functions are pure: inputs are never mutated; unchanged messages/parts are returned
 *   by reference.
 * - Rows written before this existed contain no markers and pass through rehydrate untouched,
 *   so no migration is needed.
 */

/** Namespaced marker key. A marker is `{ [PAYLOAD_REF_KEY]: <path into sibling result> }`. */
export const PAYLOAD_REF_KEY = '$mastra_tool_result_ref';

/** Minimum string length (in UTF-16 code units) for a value to be replaced with a ref. */
export const PAYLOAD_REF_MIN_LENGTH = 1024;

type PathSegment = string | number;

function isPlainObjectOrArray(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function isPayloadRefMarker(value: unknown): value is { [PAYLOAD_REF_KEY]: PathSegment[] } {
  if (!isPlainObjectOrArray(value) || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== PAYLOAD_REF_KEY) return false;
  const path = (value as Record<string, unknown>)[PAYLOAD_REF_KEY];
  return Array.isArray(path) && path.every(seg => typeof seg === 'string' || typeof seg === 'number');
}

/**
 * Collect all string values >= PAYLOAD_REF_MIN_LENGTH inside `result`, keyed by string value.
 * First path encountered (depth-first, key order) wins, making dedupe deterministic.
 */
function indexLargeStrings(result: unknown): Map<string, PathSegment[]> | undefined {
  let index: Map<string, PathSegment[]> | undefined;
  const seen = new Set<object>();

  const walk = (value: unknown, path: PathSegment[]): void => {
    if (typeof value === 'string') {
      if (value.length >= PAYLOAD_REF_MIN_LENGTH) {
        index ??= new Map();
        if (!index.has(value)) index.set(value, path);
      }
      return;
    }
    if (!isPlainObjectOrArray(value)) return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], [...path, i]);
    } else {
      for (const key of Object.keys(value)) walk((value as Record<string, unknown>)[key], [...path, key]);
    }
  };

  walk(result, []);
  return index;
}

/**
 * Walk `value`, replacing string values found in `index` with ref markers.
 * Returns the original reference when nothing changed.
 */
function replaceStringsWithRefs(
  value: unknown,
  index: Map<string, PathSegment[]>,
): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const path = index.get(value);
    if (path) return { value: { [PAYLOAD_REF_KEY]: path }, changed: true };
    return { value, changed: false };
  }
  if (!isPlainObjectOrArray(value)) return { value, changed: false };
  // Leave anything already marker-shaped alone (idempotency + user-data safety).
  if (isPayloadRefMarker(value)) return { value, changed: false };

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(item => {
      const res = replaceStringsWithRefs(item, index);
      if (res.changed) changed = true;
      return res.value;
    });
    return changed ? { value: next, changed } : { value, changed: false };
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const res = replaceStringsWithRefs((value as Record<string, unknown>)[key], index);
    if (res.changed) changed = true;
    next[key] = res.value;
  }
  return changed ? { value: next, changed } : { value, changed: false };
}

/** Resolve a marker path inside `result`. Returns the string, or undefined if it doesn't resolve. */
function resolvePayloadRef(result: unknown, path: PathSegment[]): string | undefined {
  let current: unknown = result;
  for (const seg of path) {
    if (!isPlainObjectOrArray(current)) return undefined;
    current = Array.isArray(current) ? current[seg as number] : (current as Record<string, unknown>)[seg as string];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Walk `value`, resolving ref markers against `result`.
 * Markers that don't resolve to a string are left byte-identical (no throw).
 * Returns the original reference when nothing changed.
 */
function resolveRefsWithResult(value: unknown, result: unknown): { value: unknown; changed: boolean } {
  if (!isPlainObjectOrArray(value)) return { value, changed: false };

  if (isPayloadRefMarker(value)) {
    const resolved = resolvePayloadRef(result, (value as Record<string, unknown>)[PAYLOAD_REF_KEY] as PathSegment[]);
    if (resolved !== undefined) return { value: resolved, changed: true };
    return { value, changed: false };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(item => {
      const res = resolveRefsWithResult(item, result);
      if (res.changed) changed = true;
      return res.value;
    });
    return changed ? { value: next, changed } : { value, changed: false };
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const res = resolveRefsWithResult((value as Record<string, unknown>)[key], result);
    if (res.changed) changed = true;
    next[key] = res.value;
  }
  return changed ? { value: next, changed } : { value, changed: false };
}

function getModelOutput(part: MastraToolInvocationPart): unknown {
  const mastra = part.providerMetadata?.mastra;
  if (!mastra || typeof mastra !== 'object') return undefined;
  if (!('modelOutput' in mastra)) return undefined;
  return (mastra as Record<string, unknown>).modelOutput;
}

function withModelOutput(part: MastraToolInvocationPart, modelOutput: unknown): MastraToolInvocationPart {
  const mastra = {
    ...(part.providerMetadata?.mastra as Record<string, unknown>),
    modelOutput,
  } as NonNullable<MastraToolInvocationPart['providerMetadata']>[string];
  return {
    ...part,
    providerMetadata: {
      ...part.providerMetadata,
      mastra,
    },
  };
}

function isDedupableToolInvocationPart(part: MastraMessagePart): part is MastraToolInvocationPart {
  return (
    part.type === 'tool-invocation' &&
    (part as MastraToolInvocationPart).toolInvocation?.state === 'result' &&
    'result' in (part as MastraToolInvocationPart).toolInvocation
  );
}

function transformMessages(
  messages: MastraDBMessage[],
  transformPart: (part: MastraToolInvocationPart) => MastraToolInvocationPart | undefined,
): MastraDBMessage[] {
  let anyMessageChanged = false;
  const nextMessages = messages.map(message => {
    const parts = message.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return message;

    let messageChanged = false;
    const nextParts = parts.map(part => {
      if (!isDedupableToolInvocationPart(part)) return part;
      const nextPart = transformPart(part);
      if (nextPart === undefined) return part;
      messageChanged = true;
      return nextPart;
    });

    if (!messageChanged) return message;
    anyMessageChanged = true;
    return { ...message, content: { ...message.content, parts: nextParts } };
  });
  return anyMessageChanged ? nextMessages : messages;
}

/**
 * Write-path transform: replace large strings inside `providerMetadata.mastra.modelOutput`
 * that are byte-identical to strings inside the sibling `toolInvocation.result` with ref
 * markers. Pure; returns the input array by reference when nothing changed.
 */
export function dedupeMessagePayloadRefs(messages: MastraDBMessage[]): MastraDBMessage[] {
  return transformMessages(messages, part => {
    const modelOutput = getModelOutput(part);
    if (modelOutput === undefined) return undefined;
    const index = indexLargeStrings(part.toolInvocation.result);
    if (!index) return undefined;
    const { value, changed } = replaceStringsWithRefs(modelOutput, index);
    if (!changed) return undefined;
    return withModelOutput(part, value);
  });
}

/**
 * Read-path transform: resolve ref markers inside `providerMetadata.mastra.modelOutput`
 * against the sibling `toolInvocation.result`. Markers that don't resolve are left as-is.
 * Pure; returns the input array by reference when nothing changed.
 */
export function rehydrateMessagePayloadRefs(messages: MastraDBMessage[]): MastraDBMessage[] {
  return transformMessages(messages, part => {
    const modelOutput = getModelOutput(part);
    if (modelOutput === undefined) return undefined;
    const { value, changed } = resolveRefsWithResult(modelOutput, part.toolInvocation.result);
    if (!changed) return undefined;
    return withModelOutput(part, value);
  });
}
