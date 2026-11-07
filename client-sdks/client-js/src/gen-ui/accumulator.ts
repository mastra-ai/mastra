import { addByPath, applySpecPatch, getByPath } from '@json-render/core';

import { DEFAULT_GENUI_LIMITS, GENUI_PROTOCOL_VERSION } from './types';
import type {
  GenUIDiagnostic,
  GenUIEnvelope,
  GenUILimits,
  GenUIOperation,
  GenUISpec,
  GenUIState,
  GenUISurface,
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

const EMPTY_SPEC: GenUISpec = { root: '', elements: {} };

type CreateSurface = Extract<GenUIOperation, { op: 'createSurface' }>;

/** Header of a new surface, or of an existing one that a `createSurface` with `replace` rebuilds in place. */
const surfaceHeader = (envelope: GenUIEnvelope, op: CreateSurface, existing?: GenUISurface): GenUISurface => {
  const surface: GenUISurface = {
    id: envelope.surfaceId,
    protocolVersion: GENUI_PROTOCOL_VERSION,
    revision: existing?.revision ?? 0,
    status: 'streaming',
    spec: structuredClone(op.spec ?? EMPTY_SPEC),
    placement: op.placement ?? existing?.placement ?? 'inline',
    anchorEventId: existing?.anchorEventId ?? envelope.eventId,
  };
  if (op.title !== undefined) surface.title = op.title;
  const source = op.source ?? existing?.source;
  if (source !== undefined) surface.source = source;
  return surface;
};

/**
 * Apply an envelope's operations to a surface, or throw an `OperationError`. `null` means deleted.
 * Patches run through json-render on a private copy of the spec, so the previous state is never touched.
 */
const applyOperations = (
  base: GenUISurface,
  operations: readonly GenUIOperation[],
  limits: GenUILimits,
  created: boolean,
): GenUISurface | null => {
  let surface = base;
  let spec: GenUISpec | undefined = created ? base.spec : undefined;
  for (const op of operations) {
    switch (op.op) {
      case 'createSurface':
        throw new OperationError('invalid-operation', 'createSurface must be the first operation of an envelope');
      case 'patch':
        spec ??= structuredClone(surface.spec);
        for (const patch of op.patches) {
          const target = spec as unknown as Record<string, unknown>;
          try {
            if (patch.op === 'copy') {
              // json-render copies by reference; a later write to either side would change both.
              addByPath(target, patch.path, structuredClone(getByPath(target, patch.from!)));
            } else {
              applySpecPatch(spec, patch);
            }
          } catch (error) {
            throw new OperationError(
              'invalid-operation',
              `patch ${patch.op} ${patch.path} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
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
  if (spec) {
    const checked = checkGenUISpec(spec, limits);
    if (!checked.ok) {
      throw new OperationError(checked.code === 'invalid' ? 'invalid-operation' : checked.code, checked.error);
    }
    surface = { ...surface, spec };
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
  try {
    const surface = creating
      ? applyOperations(surfaceHeader(envelope, first, existing), rest, limits, true)
      : applyOperations(existing!, envelope.operations, limits, false);
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
 * Surfaces an envelope does not touch keep their object identity.
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
