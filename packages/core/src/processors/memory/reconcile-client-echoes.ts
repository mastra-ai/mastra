import type { MastraDBMessage, MastraMessageContentV2 } from '../../agent/message-list';

type V2Part = MastraMessageContentV2['parts'][number];
type ToolInvocationPart = Extract<V2Part, { type: 'tool-invocation' }>;

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
 *   transition (stored `call` → incoming `result`, e.g. a client-side tool
 *   result) is applied to the stored part, preserving the stored args/name.
 * - Any other same-position conflict is resolved in favor of the stored part
 *   (server-authored text wins over a raw client copy).
 * - Parts that only exist on the echo and extend the stored message (e.g.
 *   observation markers) are appended.
 * - The stored `content` string and `metadata` win on conflicts; the `sealed`
 *   flag therefore survives an echo.
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

  // Metadata: stored wins on conflicts (e.g. keeps the `sealed` flag); keys only
  // present on the echo are carried over.
  if (incoming.metadata) {
    merged.metadata = { ...incoming.metadata, ...(stored.metadata ?? {}) };
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

  const incomingUsed = new Set<number>();

  for (let i = 0; i < storedParts.length; i++) {
    const storedPart = storedParts[i]!;
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

    incomingUsed.add(incomingIndex);
    const incomingPart = incomingParts[incomingIndex]!;
    if (
      isToolInvocationPart(incomingPart) &&
      incomingPart.toolInvocation.state === 'result' &&
      storedPart.toolInvocation.state !== 'result'
    ) {
      // Legitimate client-authored transition: advance the stored call with the
      // client's result while preserving the stored args/name.
      const transitioned: ToolInvocationPart = {
        ...storedPart,
        toolInvocation: {
          ...storedPart.toolInvocation,
          ...incomingPart.toolInvocation,
          // The tool call's identity (name + args) is server-authored: the
          // stored args win over the client copy, which only adds the result.
          args: { ...incomingPart.toolInvocation.args, ...storedPart.toolInvocation.args },
        },
      };
      merged.push(transitioned);
    } else {
      merged.push(storedPart); // canonical server state
    }
  }

  // Pass 2: append incoming-only parts that extend the stored message (e.g.
  // observation markers). Same-position conflicts were already resolved in favor
  // of the stored part; unmatched incoming tool parts are dropped as stale echoes
  // of parts the server never stored.
  for (let i = 0; i < incomingParts.length; i++) {
    if (incomingUsed.has(i)) continue;
    const incomingPart = incomingParts[i]!;
    if (isToolInvocationPart(incomingPart)) continue;
    const storedAtPosition = storedParts[i];
    if (storedAtPosition === undefined) {
      merged.push(incomingPart);
    }
  }

  return merged;
}

/**
 * Reconcile the legacy parallel `toolInvocations` array for client-authored
 * transitions, mirroring the part-level merge.
 */
function mergeLegacyToolInvocations(
  stored: MastraMessageContentV2,
  incoming: MastraMessageContentV2,
): MastraMessageContentV2['toolInvocations'] | undefined {
  if (!stored.toolInvocations) return incoming.toolInvocations;
  if (!incoming.toolInvocations) return stored.toolInvocations;

  const incomingById = new Map(incoming.toolInvocations.map(t => [t.toolCallId, t]));
  return stored.toolInvocations.map(t => {
    const incomingEntry = incomingById.get(t.toolCallId);
    if (incomingEntry && incomingEntry.state === 'result' && t.state !== 'result') {
      return {
        ...t,
        ...incomingEntry,
        // Keep the server-authored args of the stored call.
        args: { ...(incomingEntry.args ?? {}), ...(t.args ?? {}) },
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
 * - Lossy or transitional echoes are merged into the stored canonical version
 *   so only supported client-authored changes (e.g. tool results) survive.
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
    reconciled.push(mergeEchoWithStored(message, stored));
  }
  return reconciled;
}
