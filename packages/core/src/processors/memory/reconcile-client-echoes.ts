import type { MastraDBMessage, MastraMessageContentV2, MastraToolInvocation } from '../../agent/message-list';

type V2Part = MastraMessageContentV2['parts'][number];
type ToolInvocationPart = Extract<V2Part, { type: 'tool-invocation' }>;
type ClientTerminalTransition =
  | { state: 'result'; result: unknown; isError?: boolean; errorText?: string }
  | { state: 'output-error'; errorText: string };

/**
 * The exhaustive set of fields a client echo may contribute when it advances a
 * stored tool `call` to a terminal state, keyed by that terminal state. This is
 * the single source of truth for the client-contributable surface: every other
 * field on a tool invocation (`toolName`, `toolCallId`, `args`, `rawInput`,
 * `approval`, ...) is server-authored and is always taken from the stored
 * record. `pickClientTerminalTransition` copies only these keys, so a client
 * cannot smuggle server-authored fields through a terminal transition.
 */
export const CLIENT_CONTRIBUTABLE_TERMINAL_FIELDS = {
  result: ['result', 'isError', 'errorText'],
  'output-error': ['errorText'],
} as const satisfies Record<ClientTerminalTransition['state'], readonly (keyof MastraToolInvocation)[]>;

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
): ClientTerminalTransition | undefined {
  if (stored.state !== 'call') return undefined;

  if (incoming.state === 'result') {
    // `result` is the defining payload of the transition and is always carried
    // (even when explicitly undefined); the remaining whitelisted markers are
    // only carried when the client actually set them. No field outside
    // CLIENT_CONTRIBUTABLE_TERMINAL_FIELDS can ever be copied from the client.
    const transition: ClientTerminalTransition = { state: 'result', result: incoming.result };
    for (const field of CLIENT_CONTRIBUTABLE_TERMINAL_FIELDS.result) {
      if (field === 'result') continue;
      const value = incoming[field];
      if (value !== undefined) {
        (transition as Record<string, unknown>)[field] = value;
      }
    }
    return transition;
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

/**
 * Whether a part is server-authored state that observational memory writes onto
 * a message and a client echo must never be able to erase or forge.
 *
 * Observational memory appends `data-om-*` observation marker parts
 * (`data-om-observation-start`/`-end`/`-failed`, `data-om-buffering-*`,
 * `data-om-activation`, `data-om-thread-update`) to messages — including user
 * messages — to record observation boundaries. They are server-owned: a client
 * echo may neither drop them (they are re-added from the stored record) nor
 * inject them (they are stripped from the incoming editable surface).
 */
function isServerOwnedEchoPart(part: V2Part): boolean {
  const type = (part as { type?: unknown }).type;
  return typeof type === 'string' && type.startsWith('data-om-');
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

/**
 * Merge a client echo of a *user* message.
 *
 * The client is the author of the user-visible content, so a genuine
 * edit-and-resend (same ID, changed text) must survive rather than be discarded
 * by a server-wins merge. But observational memory writes server-authored state
 * onto user messages — `data-om-*` observation marker parts and
 * `content.metadata` (which carries `mastra.sealed`) — and a lossy echo that
 * dropped them must not be able to erase them.
 *
 * So the client may replace only the editable content surface: its own non-marker
 * parts and the `content` string. Server-owned metadata and observation marker
 * parts are always taken from the stored record. The client can neither drop the
 * markers (they are re-added from stored) nor inject new ones (they are stripped
 * from the incoming parts), and it cannot pre-seed metadata keys the server never
 * set (the whole metadata object comes from stored).
 */
function mergeUserEcho(incoming: MastraDBMessage, stored: MastraDBMessage): MastraDBMessage {
  const storedContent = stored.content;
  const incomingContent = incoming.content;

  const clientEditableParts = (incomingContent.parts ?? []).filter(part => !isServerOwnedEchoPart(part));
  const serverMarkerParts = (storedContent.parts ?? []).filter(isServerOwnedEchoPart);

  const mergedContent: MastraMessageContentV2 = {
    ...storedContent, // retain server-owned metadata (e.g. mastra.sealed)
    format: 2,
    // Client-editable content first, then the server-owned markers. Observational
    // memory appends its markers after the user content, so this preserves both
    // their presence and their trailing position regardless of what the echo sent.
    parts: [...clientEditableParts, ...serverMarkerParts],
  };

  // The content string is user-editable; adopt the client's when present.
  if (incomingContent.content !== undefined) {
    mergedContent.content = incomingContent.content;
  }

  return { ...stored, content: mergedContent };
}

function mergeEchoContent(stored: MastraMessageContentV2, incoming: MastraMessageContentV2): MastraMessageContentV2 {
  const merged: MastraMessageContentV2 = {
    ...stored,
    format: 2,
    parts: mergeEchoParts(stored.parts ?? [], incoming.parts ?? []),
    toolInvocations: mergeLegacyToolInvocations(stored, incoming),
  };

  // Content string: the stored (server-authored) version is canonical; only adopt
  // the incoming string when the stored message never had one. An empty stored
  // string is a stored value (e.g. a redaction pass), not an absent one.
  if (merged.content === undefined && incoming.content !== undefined) {
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
 * - For matched entries the client may only advance `call` → `result`, using
 *   the shared result-transition fields while the stored `args` (and everything
 *   else) survive. Legacy invocations cannot represent `output-error`.
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
    const transition = incomingEntry ? pickClientTerminalTransition(t, incomingEntry) : undefined;
    if (transition?.state === 'result') {
      // Reuse the same result-field policy as content.parts while keeping the
      // server-authored args — and everything else — from the stored entry.
      return {
        ...t,
        ...transition,
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
 * - Messages with a genuinely-new ID (no stored record anywhere) are returned
 *   untouched.
 * - Messages whose ID resolves to a canonical record on a *different*
 *   thread/resource (`foreignIds`) are dropped: persistence upserts on ID, so
 *   saving such an echo "as new" would clobber the foreign canonical record (and
 *   drag foreign content into this thread). A genuinely new message carries a
 *   fresh client ID, never one already owned by another thread.
 * - Identical echoes of stored messages are dropped — re-persisting them would
 *   overwrite the canonical record with a copy.
 * - For assistant (and system) messages, lossy or transitional echoes are
 *   merged into the stored canonical version so only supported client-authored
 *   changes (e.g. tool results) survive.
 * - For user messages the client IS the author of the content, so an
 *   edit-and-resend that reuses the message ID is kept — but only the editable
 *   surface (text/content and the client's own parts). Server-authored
 *   observation markers and metadata (e.g. `mastra.sealed`) are retained from
 *   the stored record, so a lossy echo cannot erase them.
 */
export function reconcileClientEchoes(
  messages: MastraDBMessage[],
  storedById: ReadonlyMap<string, MastraDBMessage>,
  foreignIds: ReadonlySet<string> = new Set(),
): MastraDBMessage[] {
  const reconciled: MastraDBMessage[] = [];
  for (const message of messages) {
    const stored = message.id ? storedById.get(message.id) : undefined;
    if (!stored) {
      // Known-foreign ID: dropping it protects the foreign canonical record from
      // an ID-keyed upsert clobber. Genuinely-new IDs fall through and are kept.
      if (message.id && foreignIds.has(message.id)) {
        continue;
      }
      reconciled.push(message);
      continue;
    }
    if (messagesContentEqual(message, stored)) {
      continue; // stale echo — already persisted, nothing to write
    }
    if (stored.role === 'user' && message.role === 'user') {
      // Client-authored user content: keep the edit, but never let a lossy echo
      // erase server-authored observation markers or sealed metadata.
      reconciled.push(mergeUserEcho(message, stored));
      continue;
    }
    reconciled.push(mergeEchoWithStored(message, stored));
  }
  return reconciled;
}
