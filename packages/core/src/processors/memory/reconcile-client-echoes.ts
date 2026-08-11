import type { MastraDBMessage, MastraMessageContentV2, MastraToolInvocation } from '../../agent/message-list';

type V2Part = MastraMessageContentV2['parts'][number];
type ToolInvocationPart = Extract<V2Part, { type: 'tool-invocation' }>;

/**
 * Pick the fields for a supported client-authored terminal transition.
 *
 * A stored `call` may become either:
 * - `result`, including the v4-compatible `isError` and `errorText` markers.
 * - `output-error`, including only the v6 error text.
 *
 * Everything else (`toolName`, `toolCallId`, `args`, `rawInput`, ...) remains
 * server-authored. In particular, fields for one terminal state are not
 * accepted on the other terminal state.
 */
function pickClientTerminalTransition(
  stored: MastraToolInvocation,
  incoming: MastraToolInvocation,
): Partial<MastraToolInvocation> | undefined {
  if (stored.state !== 'call') return undefined;

  if (incoming.state === 'result') {
    return {
      state: 'result',
      ...(incoming.result !== undefined ? { result: incoming.result } : {}),
      ...(incoming.isError !== undefined ? { isError: incoming.isError } : {}),
      ...(incoming.errorText !== undefined ? { errorText: incoming.errorText } : {}),
    };
  }

  if (incoming.state === 'output-error' && incoming.errorText !== undefined) {
    return { state: 'output-error', errorText: incoming.errorText };
  }

  return undefined;
}

/**
 * Canonicalize a value for deep comparison: sorts object keys and normalizes
 * Dates so two structurally-identical messages compare equal regardless of
 * serialization order (DB rows vs client-converted transcripts).
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return out;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function isToolInvocationPart(part: V2Part): part is ToolInvocationPart {
  return part.type === 'tool-invocation';
}

function getToolCallId(part: ToolInvocationPart): string | undefined {
  return part.toolInvocation?.toolCallId;
}

/**
 * Merge a client-echoed message against the canonical stored record.
 *
 * Client transcripts echo previously-persisted messages back with the same IDs.
 * Message persistence is a whole-record upsert, so blindly re-saving an echo
 * would let a stale or lossy client copy silently replace server-authored
 * content (output-processor transformations, tool history, metadata).
 *
 * Rules (stored = canonical server state, incoming = client echo):
 * - Tool-invocation parts are matched by `toolCallId`. A client-authored
 *   transition from a stored `call` to an incoming `result` or `output-error`
 *   is applied to the stored part. The client may contribute the result/error
 *   fields for that terminal state; `toolName`, `toolCallId` and `args` always
 *   come from the stored (server-authored) invocation.
 * - Any other same-position conflict is resolved in favor of the stored part
 *   (server-authored text wins over a raw client copy).
 * - Incoming-only parts are never accepted: a client echo cannot introduce
 *   tool history, text, or other parts the server never stored. Client-side
 *   presentation parts (e.g. observation markers) are re-created by the client
 *   on each render and do not belong in the persisted record.
 * - The stored `content` string and `metadata` win in full; echo-only keys are
 *   never carried over, so a client cannot pre-seed keys the server hasn't set
 *   yet (e.g. `sealed`).
 */
export function mergeEchoWithStored(incoming: MastraDBMessage, stored: MastraDBMessage): MastraDBMessage {
  return {
    ...stored,
    content: mergeEchoContent(stored.content, incoming.content),
  };
}

function mergeEchoContent(stored: MastraMessageContentV2, incoming: MastraMessageContentV2): MastraMessageContentV2 {
  const merged: MastraMessageContentV2 = {
    ...stored,
    format: 2,
    parts: mergeEchoParts(stored.parts ?? [], incoming.parts ?? []),
    toolInvocations: mergeLegacyToolInvocations(stored, incoming),
  };

  // Content string: the stored (server-authored) version is canonical; only adopt
  // the incoming string when the stored message never had one.
  if (!merged.content && incoming.content) {
    merged.content = incoming.content;
  }

  return merged;
}

function mergeEchoParts(storedParts: V2Part[], incomingParts: V2Part[]): V2Part[] {
  const merged: V2Part[] = [];

  // Pass 1: match tool-invocation parts by toolCallId (order-independent) and
  // apply client-authored transitions.
  const incomingToolById = new Map<string, number>();
  incomingParts.forEach((part, index) => {
    if (isToolInvocationPart(part)) {
      const toolCallId = getToolCallId(part);
      if (toolCallId) incomingToolById.set(toolCallId, index);
    }
  });

  for (const storedPart of storedParts) {
    if (!isToolInvocationPart(storedPart)) {
      merged.push(storedPart);
      continue;
    }

    const toolCallId = getToolCallId(storedPart);
    const incomingIndex = toolCallId ? incomingToolById.get(toolCallId) : undefined;
    if (incomingIndex === undefined) {
      merged.push(storedPart);
      continue;
    }

    const incomingPart = incomingParts[incomingIndex]!;
    const transition = isToolInvocationPart(incomingPart)
      ? pickClientTerminalTransition(storedPart.toolInvocation, incomingPart.toolInvocation)
      : undefined;
    if (transition) {
      // Legitimate client-authored transition: advance the stored call with the
      // matching terminal fields. The tool call's identity (name, call id,
      // args) is server-authored and stays as stored.
      const transitioned: ToolInvocationPart = {
        ...storedPart,
        toolInvocation: {
          ...storedPart.toolInvocation,
          ...transition,
          args: storedPart.toolInvocation.args,
        },
      };
      merged.push(transitioned);
    } else {
      merged.push(storedPart); // canonical server state
    }
  }

  return merged;
}

/**
 * Reconcile the legacy parallel `toolInvocations` array for client-authored
 * successful-result transitions:
 *
 * - The stored array is canonical; a client copy can never introduce tool
 *   history (names, args, results) the server never stored, so when the stored
 *   message has no array the incoming one is dropped entirely.
 * - For matched entries the client may only advance `call` → `result`,
 *   contributing `state`/`result` while the stored `args` (and everything else)
 *   survive.
 */
function mergeLegacyToolInvocations(
  stored: MastraMessageContentV2,
  incoming: MastraMessageContentV2,
): MastraMessageContentV2['toolInvocations'] | undefined {
  if (!stored.toolInvocations) return undefined;
  if (!incoming.toolInvocations) return stored.toolInvocations;

  const incomingById = new Map(incoming.toolInvocations.map(t => [t.toolCallId, t]));
  return stored.toolInvocations.map(t => {
    const incomingEntry = incomingById.get(t.toolCallId);
    if (incomingEntry && incomingEntry.state === 'result' && t.state === 'call') {
      // The client may only advance the invocation: take its `state`/`result`
      // (narrowed to `result` by the guard) while keeping the server-authored
      // args — and everything else — from the stored entry.
      return {
        ...t,
        state: incomingEntry.state,
        result: incomingEntry.result,
        args: t.args,
      };
    }
    return t;
  });
}

/**
 * Strip presentation-level `createdAt` stamps from message parts.
 *
 * `MessageList.add` stamps a `createdAt` onto every part (and re-stamps the
 * message `createdAt`) when the client transcript is loaded, so an unchanged
 * echo differs from its stored record only in these timestamps. They are not
 * content, so they must not defeat the equality check.
 */
function stripPartTimestamps(content: MastraMessageContentV2): unknown {
  const parts = (content.parts ?? []).map(part => {
    if (!part || typeof part !== 'object' || !('createdAt' in part)) return part;
    const { createdAt: _createdAt, ...rest } = part as { createdAt?: unknown } & Record<string, unknown>;
    return rest;
  });
  return { ...content, parts };
}

/**
 * Whether an incoming message is content-identical to its stored record (an
 * unchanged echo that never needs to be persisted again).
 */
export function messagesContentEqual(a: MastraDBMessage, b: MastraDBMessage): boolean {
  return a.role === b.role && isDeepEqual(stripPartTimestamps(a.content), stripPartTimestamps(b.content));
}

/**
 * Reconcile a batch of client-submitted input messages against their stored
 * records (looked up by ID, independent of the recall window):
 *
 * - Messages with no stored record are returned untouched (genuinely new).
 * - Identical echoes of stored messages are dropped — re-persisting them would
 *   overwrite the canonical record with a copy.
 * - For assistant (and system) messages, lossy or transitional echoes are
 *   merged into the stored canonical version so only supported client-authored
 *   changes (e.g. tool results) survive.
 * - For user messages the client IS the author, so reconciliation is restricted
 *   to skipping unchanged echoes: an edit-and-resend that reuses the message ID
 *   is kept as-is (last-write-wins), never silently discarded by a
 *   server-wins merge.
 */
export function reconcileClientEchoes(
  messages: MastraDBMessage[],
  storedById: ReadonlyMap<string, MastraDBMessage>,
): MastraDBMessage[] {
  const reconciled: MastraDBMessage[] = [];
  for (const message of messages) {
    const stored = message.id ? storedById.get(message.id) : undefined;
    if (!stored) {
      reconciled.push(message);
      continue;
    }
    if (messagesContentEqual(message, stored)) {
      continue; // stale echo — already persisted, nothing to write
    }
    if (stored.role === 'user') {
      reconciled.push(message); // client-authored edit, last-write-wins
      continue;
    }
    reconciled.push(mergeEchoWithStored(message, stored));
  }
  return reconciled;
}
