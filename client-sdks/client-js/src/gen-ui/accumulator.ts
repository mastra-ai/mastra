import { addByPath, applySpecStreamPatch, getByPath } from '@json-render/core';

import { DEFAULT_GENUI_LIMITS, GENUI_PROTOCOL_VERSION } from './types';
import type {
  GenUIDiagnostic,
  GenUIEnvelope,
  GenUILimits,
  GenUIOperation,
  GenUIPatch,
  GenUISpec,
  GenUIState,
  GenUISurface,
  JSONObject,
  JSONValue,
} from './types';
import { checkGenUISpec, parseGenUIEnvelope } from './validate';

/** @experimental Generative UI is in beta and may change without notice. */
export interface AccumulateGenUIOptions {
  limits?: Partial<GenUILimits>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export const resolveGenUILimits = (limits?: Partial<GenUILimits>): GenUILimits =>
  limits ? { ...DEFAULT_GENUI_LIMITS, ...limits } : DEFAULT_GENUI_LIMITS;

/** @experimental Generative UI is in beta and may change without notice. */
export function createGenUIState(): GenUIState {
  return { surfaces: {}, surfaceOrder: [], seenEventIds: {}, buffered: {}, diagnostics: [] };
}

/** Structural equality for JSON values. */
export function jsonEqual(a: JSONValue | undefined, b: JSONValue | undefined): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as JSONValue[];
    return a.length === other.length && a.every((item, index) => jsonEqual(item, other[index]));
  }
  const objA = a as JSONObject;
  const objB = b as JSONObject;
  const keysA = Object.keys(objA);
  if (keysA.length !== Object.keys(objB).length) return false;
  return keysA.every(key => Object.prototype.hasOwnProperty.call(objB, key) && jsonEqual(objA[key], objB[key]));
}

class OperationError extends Error {
  constructor(
    readonly code: GenUIDiagnostic['code'],
    message: string,
  ) {
    super(message);
  }
}

const withDiagnostic = (state: GenUIState, diagnostic: GenUIDiagnostic, limits: GenUILimits): GenUIState => ({
  ...state,
  diagnostics: [...state.diagnostics, diagnostic].slice(-limits.maxDiagnostics),
});

const markSeen = (state: GenUIState, eventId: string): GenUIState => ({
  ...state,
  seenEventIds: { ...state.seenEventIds, [eventId]: true },
});

type Container = Record<string, unknown> | unknown[];

const pointerSegments = (pointer: string) =>
  pointer
    .split('/')
    .slice(1)
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

const isContainer = (value: unknown): value is Container => typeof value === 'object' && value !== null;

/**
 * Working copy of one surface's spec while an envelope applies. Patches go through json-render's
 * RFC 6902 helpers, which mutate in place, so every container on a patch's path is shallow-copied
 * first: the previous spec is never touched and untouched elements keep their identity.
 */
class SpecDraft {
  private readonly owned = new WeakSet<object>();
  spec: GenUISpec;

  constructor(base: GenUISpec) {
    this.spec = { ...base };
    this.owned.add(this.spec);
  }

  replace(spec: GenUISpec) {
    this.spec = spec;
    this.owned.add(spec);
  }

  /** Copy every container from the root down to the parent of the pointer's target. */
  private own(pointer: string) {
    const segments = pointerSegments(pointer);
    let current: Container = this.spec as unknown as Container;
    for (const segment of segments.slice(0, -1)) {
      const key: string | number = Array.isArray(current) ? Number(segment) : segment;
      const child = (current as Record<string | number, unknown>)[key];
      if (!isContainer(child)) return;
      if (!this.owned.has(child)) {
        const copy: Container = Array.isArray(child) ? [...child] : { ...child };
        this.owned.add(copy);
        (current as Record<string | number, unknown>)[key] = copy;
        current = copy;
      } else {
        current = child;
      }
    }
  }

  apply(patch: GenUIPatch) {
    this.own(patch.path);
    if (patch.op === 'move') this.own(patch.from!);
    const target = this.spec as unknown as Record<string, unknown>;
    if (patch.op === 'copy') {
      // A copy must not share containers with its source, or a later write to one would change both.
      addByPath(target, patch.path, structuredClone(getByPath(target, patch.from!)));
      return;
    }
    applySpecStreamPatch(target, patch);
  }
}

const createSurfaceBase = (
  envelope: GenUIEnvelope,
  op: Extract<GenUIOperation, { op: 'createSurface' }>,
): GenUISurface => {
  const surface: GenUISurface = {
    id: envelope.surfaceId,
    protocolVersion: GENUI_PROTOCOL_VERSION,
    revision: 0,
    status: 'streaming',
    spec: op.spec ?? { root: '', elements: {} },
    elementRevisions: {},
    placement: op.placement ?? 'inline',
    anchorEventId: envelope.eventId,
  };
  if (op.catalogId !== undefined) surface.catalogId = op.catalogId;
  if (op.catalogVersion !== undefined) surface.catalogVersion = op.catalogVersion;
  if (op.title !== undefined) surface.title = op.title;
  if (op.source !== undefined) surface.source = op.source;
  return surface;
};

/** Header of an existing surface that a `createSurface` with `replace` rebuilds; the spec follows as a `replaceSpec`. */
const rebuildSurfaceBase = (
  existing: GenUISurface,
  op: Extract<GenUIOperation, { op: 'createSurface' }>,
): GenUISurface => {
  const { error: _error, title: _title, ...rest } = existing;
  const surface: GenUISurface = { ...rest, status: 'streaming', placement: op.placement ?? existing.placement };
  if (op.title !== undefined) surface.title = op.title;
  if (op.catalogId !== undefined) surface.catalogId = op.catalogId;
  if (op.catalogVersion !== undefined) surface.catalogVersion = op.catalogVersion;
  if (op.source !== undefined) surface.source = op.source;
  return surface;
};

/** Apply an envelope's operations to a surface, or throw an `OperationError`. `null` means deleted. */
const applyOperations = (
  base: GenUISurface,
  operations: readonly GenUIOperation[],
  limits: GenUILimits,
): GenUISurface | null => {
  let surface = base;
  // A new surface always goes through the draft so its initial spec gets element revisions.
  let draft = base.revision === 0 ? new SpecDraft(base.spec) : undefined;
  for (const op of operations) {
    switch (op.op) {
      case 'createSurface':
        throw new OperationError('invalid-operation', 'createSurface must be the first operation of an envelope');
      case 'patch':
        draft ??= new SpecDraft(surface.spec);
        for (const patch of op.patches) {
          try {
            draft.apply(patch);
          } catch (error) {
            throw new OperationError(
              'invalid-operation',
              `patch ${patch.op} ${patch.path} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        break;
      case 'replaceSpec':
        draft ??= new SpecDraft(surface.spec);
        draft.replace(op.spec);
        break;
      case 'setStatus': {
        const { error: _error, ...rest } = surface;
        surface =
          op.status === 'failed'
            ? { ...rest, status: op.status, error: op.error ?? 'Surface failed' }
            : { ...rest, status: op.status };
        break;
      }
      case 'deleteSurface':
        if (op !== operations[operations.length - 1]) {
          throw new OperationError('invalid-operation', 'deleteSurface must be the last operation of an envelope');
        }
        return null;
    }
  }
  if (draft) {
    const checked = checkGenUISpec(draft.spec, limits);
    if (!checked.ok) {
      throw new OperationError(checked.code === 'invalid' ? 'invalid-operation' : checked.code, checked.error);
    }
    const revision = base.revision + 1;
    const previous = base.spec.elements;
    const elementRevisions: Record<string, number> = {};
    for (const [id, element] of Object.entries(draft.spec.elements)) {
      elementRevisions[id] = element === previous[id] ? (base.elementRevisions[id] ?? revision) : revision;
    }
    return { ...surface, spec: draft.spec, elementRevisions, revision };
  }
  return { ...surface, revision: base.revision + 1 };
};

type ApplyResult = { state: GenUIState } | { buffer: true } | { reject: GenUIDiagnostic };

/** Apply one validated envelope (no dedup/buffering concerns). */
const applyEnvelope = (state: GenUIState, envelope: GenUIEnvelope, limits: GenUILimits): ApplyResult => {
  const { surfaceId, eventId } = envelope;
  const existing = Object.prototype.hasOwnProperty.call(state.surfaces, surfaceId)
    ? state.surfaces[surfaceId]
    : undefined;
  const [first, ...rest] = envelope.operations;
  const creating = first?.op === 'createSurface';

  if (creating && existing && !first.replace) {
    return { reject: { code: 'surface-exists', message: `surface "${surfaceId}" already exists`, eventId, surfaceId } };
  }
  if (!creating && !existing) return { buffer: true };
  if (existing && envelope.baseRevision !== undefined) {
    if (envelope.baseRevision < existing.revision) {
      return {
        reject: {
          code: 'stale-revision',
          message: `envelope targets revision ${envelope.baseRevision} but surface is at ${existing.revision}`,
          eventId,
          surfaceId,
        },
      };
    }
    if (envelope.baseRevision > existing.revision) return { buffer: true };
  }
  if (creating && state.surfaceOrder.length >= limits.maxSurfaces) {
    return {
      reject: { code: 'limit-exceeded', message: `exceeds ${limits.maxSurfaces} surfaces`, eventId, surfaceId },
    };
  }

  const rebuilding = creating && existing !== undefined;
  const base = rebuilding
    ? rebuildSurfaceBase(existing, first)
    : (existing ?? createSurfaceBase(envelope, first as Extract<GenUIOperation, { op: 'createSurface' }>));
  const operations: readonly GenUIOperation[] = rebuilding
    ? [{ op: 'replaceSpec', spec: first.spec ?? { root: '', elements: {} } }, ...rest]
    : creating
      ? rest
      : envelope.operations;
  try {
    const surface = applyOperations(base, operations, limits);
    if (!surface) {
      const { [surfaceId]: _removed, ...surfaces } = state.surfaces;
      return { state: { ...state, surfaces, surfaceOrder: state.surfaceOrder.filter(id => id !== surfaceId) } };
    }
    return {
      state: {
        ...state,
        surfaces: { ...state.surfaces, [surfaceId]: surface },
        surfaceOrder: creating && !rebuilding ? [...state.surfaceOrder, surfaceId] : state.surfaceOrder,
      },
    };
  } catch (error) {
    if (error instanceof OperationError) {
      return { reject: { code: error.code, message: error.message, eventId, surfaceId } };
    }
    throw error;
  }
};

const isBuffered = (state: GenUIState, envelope: GenUIEnvelope) =>
  (state.buffered[envelope.surfaceId] ?? []).some(item => item.eventId === envelope.eventId);

/** Apply buffered envelopes for a surface until none are applicable. */
const flushBuffered = (state: GenUIState, surfaceId: string, limits: GenUILimits): GenUIState => {
  let current = state;
  let progressed = true;
  while (progressed) {
    progressed = false;
    const queue = current.buffered[surfaceId];
    if (!queue?.length) break;
    for (const envelope of queue) {
      const result = applyEnvelope(current, envelope, limits);
      if ('buffer' in result) continue;
      const remaining = queue.filter(item => item !== envelope);
      const { [surfaceId]: _queue, ...others } = current.buffered;
      const buffered = remaining.length ? { ...others, [surfaceId]: remaining } : others;
      current =
        'state' in result
          ? markSeen({ ...result.state, buffered }, envelope.eventId)
          : markSeen(withDiagnostic({ ...current, buffered }, result.reject, limits), envelope.eventId);
      progressed = true;
      break;
    }
  }
  return current;
};

/**
 * Deterministic GenUI reducer.
 *
 * Accepts an untrusted envelope (the `data` of a `data-gen-ui` part) and
 * returns the next immutable state. Duplicate event ids return the same state
 * reference, so replaying a stream or reloading history is idempotent.
 * Unchanged surfaces and spec elements keep their object identity (structural sharing).
 * Invalid envelopes never throw — they are recorded in `state.diagnostics`.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function accumulateGenUI(state: GenUIState, rawEnvelope: unknown, options?: AccumulateGenUIOptions): GenUIState {
  const limits = resolveGenUILimits(options?.limits);
  const record =
    typeof rawEnvelope === 'object' && rawEnvelope !== null ? (rawEnvelope as Record<string, unknown>) : {};
  const rawEventId = typeof record.eventId === 'string' ? record.eventId : undefined;
  const rawSurfaceId = typeof record.surfaceId === 'string' ? record.surfaceId : undefined;

  if (rawEventId && Object.prototype.hasOwnProperty.call(state.seenEventIds, rawEventId)) return state;

  if (record.version !== GENUI_PROTOCOL_VERSION) {
    const next = withDiagnostic(
      state,
      {
        code: 'unsupported-version',
        message: `unsupported GenUI protocol version ${String(record.version)}`,
        eventId: rawEventId,
        surfaceId: rawSurfaceId,
      },
      limits,
    );
    return rawEventId ? markSeen(next, rawEventId) : next;
  }

  const parsed = parseGenUIEnvelope(rawEnvelope, limits);
  if (!parsed.ok) {
    const next = withDiagnostic(
      state,
      {
        code: parsed.code === 'invalid' ? 'invalid-envelope' : parsed.code,
        message: parsed.error,
        eventId: rawEventId,
        surfaceId: rawSurfaceId,
      },
      limits,
    );
    return rawEventId ? markSeen(next, rawEventId) : next;
  }

  const envelope = parsed.value;
  if (isBuffered(state, envelope)) return state;

  const result = applyEnvelope(state, envelope, limits);
  if ('reject' in result) return markSeen(withDiagnostic(state, result.reject, limits), envelope.eventId);
  if ('buffer' in result) {
    const queue = state.buffered[envelope.surfaceId] ?? [];
    if (queue.length >= limits.maxBufferedEnvelopes) {
      return markSeen(
        withDiagnostic(
          state,
          {
            code: 'buffer-overflow',
            message: `more than ${limits.maxBufferedEnvelopes} envelopes waiting for surface "${envelope.surfaceId}"`,
            eventId: envelope.eventId,
            surfaceId: envelope.surfaceId,
          },
          limits,
        ),
        envelope.eventId,
      );
    }
    return {
      ...state,
      buffered: { ...state.buffered, [envelope.surfaceId]: [...queue, envelope] },
    };
  }
  return flushBuffered(markSeen(result.state, envelope.eventId), envelope.surfaceId, limits);
}

/**
 * Minimal structural message shape so the reducer works with any Mastra message representation.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIMessageLike {
  id: string;
  content?: { parts?: ReadonlyArray<unknown> } | unknown;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIEnvelopeRef {
  messageId: string;
  partIndex: number;
  envelope: unknown;
}

/**
 * Collect `data-gen-ui` part payloads from messages in presentation order.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function extractGenUIEnvelopes(messages: ReadonlyArray<GenUIMessageLike>): GenUIEnvelopeRef[] {
  const refs: GenUIEnvelopeRef[] = [];
  for (const message of messages) {
    const content = message.content as { parts?: ReadonlyArray<unknown> } | undefined;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    parts.forEach((part, partIndex) => {
      if (typeof part === 'object' && part !== null && (part as { type?: unknown }).type === 'data-gen-ui') {
        refs.push({ messageId: message.id, partIndex, envelope: (part as { data?: unknown }).data });
      }
    });
  }
  return refs;
}

/**
 * Rebuild GenUI state from persisted or live messages. Deterministic for a given message list.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function reduceGenUIMessages(
  messages: ReadonlyArray<GenUIMessageLike>,
  options?: AccumulateGenUIOptions,
): GenUIState {
  return extractGenUIEnvelopes(messages).reduce(
    (state, ref) => accumulateGenUI(state, ref.envelope, options),
    createGenUIState(),
  );
}
