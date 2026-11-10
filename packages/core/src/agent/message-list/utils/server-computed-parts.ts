import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Tool-invocation parts whose `mastra.modelOutput` / `modelOutputComputed`
 * markers this process computed itself (by `applyClientToolModelOutput`).
 * Tracked by object identity, so client-sent copies of the markers never match.
 */
export const serverComputedParts = new WeakSet<object>();

/**
 * Provenance for mapping markers that leave the process (e.g. in
 * `response.messages`) and come back as input. When a tool result the server
 * executed is committed, the stored part's mapping is signed with a per-process
 * key over the tool call, tool name, state, raw result, error flag, provider
 * execution, background task, payload transform and the mapping itself. A
 * returned part is trusted only if that signature still matches. A client
 * cannot produce one; history from another process, or changed after signing,
 * fails verification and is stripped and recomputed instead.
 */
const SIGNATURE_KEY = 'modelOutputSignature';
const processKey = randomBytes(32);

type ToolPart = {
  providerExecuted?: boolean;
  toolInvocation?: { toolCallId?: string; toolName?: string; state?: string; result?: unknown; isError?: boolean };
  providerMetadata?: Record<string, unknown>;
};

function mappingOf(part: ToolPart): Record<string, unknown> | undefined {
  const mastra = part.providerMetadata?.mastra;
  if (!mastra || typeof mastra !== 'object' || Array.isArray(mastra)) return undefined;
  const record = mastra as Record<string, unknown>;
  return record.modelOutput != null ? record : undefined;
}

// Bind the mapping to the raw result and every field that decides whether a
// mapping applies, so a signed mapping cannot be moved onto other content.
function sign(part: ToolPart, mastra: Record<string, unknown>): string {
  const invocation = part.toolInvocation;
  return createHmac('sha256', processKey)
    .update(
      JSON.stringify([
        invocation?.toolCallId ?? null,
        invocation?.toolName ?? null,
        invocation?.state ?? null,
        invocation?.result ?? null,
        !!invocation?.isError,
        !!part.providerExecuted,
        mastra.backgroundTask ?? null,
        mastra.toolPayloadTransform ?? null,
        mastra.toolPayloadProjection ?? null,
        mastra.modelOutput,
      ]),
    )
    .digest('base64url');
}

/** Sign the mapping markers on a server-produced tool part, if it has any. */
export function signServerMapping(part: ToolPart): void {
  const mastra = mappingOf(part);
  // The server never maps provider-executed results; such markers are not its own.
  if (!mastra || part.providerExecuted || part.toolInvocation?.state !== 'result') return;
  try {
    mastra[SIGNATURE_KEY] = sign(part, mastra);
  } catch {
    // Unserializable result: leave it unsigned, it is recomputed on the way back in.
  }
}

/** Whether a part's mapping markers carry a valid signature from this process. */
export function hasValidServerMapping(part: ToolPart): boolean {
  const mastra = mappingOf(part);
  const signature = mastra?.[SIGNATURE_KEY];
  if (typeof signature !== 'string') return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(sign(part, mastra!));
  } catch {
    return false;
  }
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const MODEL_OUTPUT_SIGNATURE_KEY = SIGNATURE_KEY;
