import { DEFAULT_GENUI_LIMITS, GENUI_PROTOCOL_VERSION } from './types';
import type {
  GenUIDiagnostic,
  GenUIEnvelope,
  GenUILimits,
  GenUINode,
  GenUINodeInput,
  GenUIOperation,
  GenUIState,
  GenUISurface,
  JSONObject,
  JSONValue,
} from './types';
import { jsonSize, parseGenUIEnvelope } from './validate';

export interface AccumulateGenUIOptions {
  limits?: Partial<GenUILimits>;
}

export const resolveGenUILimits = (limits?: Partial<GenUILimits>): GenUILimits =>
  limits ? { ...DEFAULT_GENUI_LIMITS, ...limits } : DEFAULT_GENUI_LIMITS;

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

const arraysEqual = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

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

/** Shallow-merge `set` into `base` and drop `unset`, returning `base` itself when nothing changes. */
const mergeObject = (base: JSONObject, set: JSONObject | undefined, unset: string[] | undefined): JSONObject => {
  let next: JSONObject | undefined;
  for (const [key, value] of Object.entries(set ?? {})) {
    if (Object.prototype.hasOwnProperty.call(base, key) && jsonEqual(base[key], value)) continue;
    next ??= { ...base };
    next[key] = value;
  }
  for (const key of unset ?? []) {
    if (!Object.prototype.hasOwnProperty.call(next ?? base, key)) continue;
    next ??= { ...base };
    delete next[key];
  }
  return next ?? base;
};

/** Mutable working copy of one surface while an envelope's operations are applied. */
class SurfaceDraft {
  private nodes: Record<string, GenUINode>;
  private nodesCopied = false;
  surface: GenUISurface;
  deleted = false;

  constructor(
    base: GenUISurface,
    private readonly revision: number,
    private readonly limits: GenUILimits,
  ) {
    this.surface = base;
    this.nodes = base.nodes as Record<string, GenUINode>;
  }

  private writableNodes() {
    if (!this.nodesCopied) {
      this.nodes = { ...this.nodes };
      this.nodesCopied = true;
    }
    return this.nodes;
  }

  private patch(update: Partial<GenUISurface>) {
    this.surface = { ...this.surface, ...update };
  }

  private requireNode(id: string): GenUINode {
    const node = Object.prototype.hasOwnProperty.call(this.nodes, id) ? this.nodes[id] : undefined;
    if (!node) throw new OperationError('invalid-operation', `node "${id}" does not exist`);
    return node;
  }

  private upsert(input: GenUINodeInput) {
    const existing = Object.prototype.hasOwnProperty.call(this.nodes, input.id) ? this.nodes[input.id] : undefined;
    const props = input.props ?? {};
    const children = input.children ?? [];
    if (
      existing &&
      existing.component === input.component &&
      arraysEqual(existing.children, children) &&
      jsonEqual(existing.props, props)
    ) {
      return;
    }
    this.writableNodes()[input.id] = {
      id: input.id,
      component: input.component,
      props,
      children,
      revision: this.revision,
    };
  }

  apply(op: GenUIOperation) {
    if (this.deleted) throw new OperationError('invalid-operation', `surface was deleted earlier in this envelope`);
    switch (op.op) {
      case 'createSurface':
        throw new OperationError('invalid-operation', 'createSurface must be the first operation of an envelope');
      case 'upsertNodes':
        op.nodes.forEach(node => this.upsert(node));
        return;
      case 'updateProps': {
        const node = this.requireNode(op.nodeId);
        const props = mergeObject(node.props, op.set, op.unset);
        if (props === node.props) return;
        if (jsonSize(props) > this.limits.maxPropsSize) {
          throw new OperationError('limit-exceeded', `props of node "${op.nodeId}" exceed ${this.limits.maxPropsSize}`);
        }
        this.writableNodes()[op.nodeId] = { ...node, props, revision: this.revision };
        return;
      }
      case 'removeNodes': {
        const removed = new Set<string>();
        const stack = [...op.nodeIds];
        while (stack.length) {
          const id = stack.pop()!;
          if (removed.has(id) || !Object.prototype.hasOwnProperty.call(this.nodes, id)) continue;
          removed.add(id);
          stack.push(...this.nodes[id]!.children);
        }
        if (removed.size === 0) return;
        const nodes = this.writableNodes();
        removed.forEach(id => delete nodes[id]);
        for (const node of Object.values(nodes)) {
          if (node.children.some(child => removed.has(child))) {
            nodes[node.id] = {
              ...node,
              children: node.children.filter(child => !removed.has(child)),
              revision: this.revision,
            };
          }
        }
        if (this.surface.rootId && removed.has(this.surface.rootId)) this.patch({ rootId: null });
        return;
      }
      case 'setChildren': {
        const node = this.requireNode(op.nodeId);
        if (arraysEqual(node.children, op.children)) return;
        this.writableNodes()[op.nodeId] = { ...node, children: op.children, revision: this.revision };
        return;
      }
      case 'setRoot':
        if (this.surface.rootId !== op.rootId) this.patch({ rootId: op.rootId });
        return;
      case 'replaceData':
        if (!jsonEqual(this.surface.data, op.data)) this.patch({ data: op.data });
        return;
      case 'patchData': {
        const data = mergeObject(this.surface.data, op.set, op.unset);
        if (data === this.surface.data) return;
        if (jsonSize(data) > this.limits.maxDataSize) {
          throw new OperationError('limit-exceeded', `surface data exceeds ${this.limits.maxDataSize}`);
        }
        this.patch({ data });
        return;
      }
      case 'setStatus': {
        const { error: _error, ...rest } = this.surface;
        this.surface =
          op.status === 'failed'
            ? { ...rest, status: op.status, error: op.error ?? 'Surface failed' }
            : { ...rest, status: op.status };
        return;
      }
      case 'deleteSurface':
        this.deleted = true;
    }
  }

  /** Validate graph invariants and produce the next immutable surface. */
  finish(): GenUISurface {
    const nodes = this.nodes;
    const ids = Object.keys(nodes);
    if (ids.length > this.limits.maxNodesPerSurface) {
      throw new OperationError('limit-exceeded', `surface exceeds ${this.limits.maxNodesPerSurface} nodes`);
    }
    // Iterative three-color DFS over all nodes: rejects cycles anywhere and
    // computes each node's subtree height in post-order to enforce the depth
    // limit on every path. Missing child ids are allowed so a parent can stream
    // in before its children.
    const visiting = new Set<string>();
    const height = new Map<string, number>();
    for (const start of ids) {
      if (height.has(start)) continue;
      const stack: Array<{ id: string; next: number }> = [{ id: start, next: 0 }];
      visiting.add(start);
      while (stack.length) {
        const frame = stack[stack.length - 1]!;
        const children = nodes[frame.id]!.children;
        if (frame.next >= children.length) {
          const childHeights = children.map(child => height.get(child) ?? 0);
          const nodeHeight = 1 + Math.max(0, ...childHeights);
          if (nodeHeight > this.limits.maxTreeDepth) {
            throw new OperationError('limit-exceeded', `tree depth exceeds ${this.limits.maxTreeDepth}`);
          }
          height.set(frame.id, nodeHeight);
          visiting.delete(frame.id);
          stack.pop();
          continue;
        }
        const child = children[frame.next++]!;
        if (!Object.prototype.hasOwnProperty.call(nodes, child) || height.has(child)) continue;
        if (visiting.has(child)) throw new OperationError('invalid-graph', `cycle detected at node "${child}"`);
        visiting.add(child);
        stack.push({ id: child, next: 0 });
      }
    }
    return { ...this.surface, nodes, revision: this.revision };
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
    rootId: op.rootId ?? op.nodes?.[0]?.id ?? null,
    nodes: {},
    data: op.data ?? {},
    placement: op.placement ?? 'inline',
    anchorEventId: envelope.eventId,
  };
  if (op.catalogId !== undefined) surface.catalogId = op.catalogId;
  if (op.catalogVersion !== undefined) surface.catalogVersion = op.catalogVersion;
  if (op.title !== undefined) surface.title = op.title;
  if (op.source !== undefined) surface.source = op.source;
  return surface;
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

  if (creating && existing) {
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

  const base = existing ?? createSurfaceBase(envelope, first as Extract<GenUIOperation, { op: 'createSurface' }>);
  const draft = new SurfaceDraft(base, base.revision + 1, limits);
  try {
    if (creating) {
      (first as Extract<GenUIOperation, { op: 'createSurface' }>).nodes?.forEach(node =>
        draft.apply({ op: 'upsertNodes', nodes: [node] }),
      );
    }
    (creating ? rest : envelope.operations).forEach(op => draft.apply(op));
    if (draft.deleted) {
      const { [surfaceId]: _removed, ...surfaces } = state.surfaces;
      return { state: { ...state, surfaces, surfaceOrder: state.surfaceOrder.filter(id => id !== surfaceId) } };
    }
    const surface = draft.finish();
    return {
      state: {
        ...state,
        surfaces: { ...state.surfaces, [surfaceId]: surface },
        surfaceOrder: creating ? [...state.surfaceOrder, surfaceId] : state.surfaceOrder,
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
 * Unchanged surfaces and nodes keep their object identity (structural sharing).
 * Invalid envelopes never throw — they are recorded in `state.diagnostics`.
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
      { code: 'invalid-envelope', message: parsed.error, eventId: rawEventId, surfaceId: rawSurfaceId },
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

/** Minimal structural message shape so the reducer works with any Mastra message representation. */
export interface GenUIMessageLike {
  id: string;
  content?: { parts?: ReadonlyArray<unknown> } | unknown;
}

export interface GenUIEnvelopeRef {
  messageId: string;
  partIndex: number;
  envelope: unknown;
}

/** Collect `data-gen-ui` part payloads from messages in presentation order. */
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

/** Rebuild GenUI state from persisted or live messages. Deterministic for a given message list. */
export function reduceGenUIMessages(
  messages: ReadonlyArray<GenUIMessageLike>,
  options?: AccumulateGenUIOptions,
): GenUIState {
  return extractGenUIEnvelopes(messages).reduce(
    (state, ref) => accumulateGenUI(state, ref.envelope, options),
    createGenUIState(),
  );
}
