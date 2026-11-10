import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Tool-invocation parts whose `mastra.modelOutput` / `modelOutputComputed`
 * markers this process computed itself (by `applyClientToolModelOutput`).
 * Tracked by object identity, so client-sent copies of the markers never match.
 */
export const serverComputedParts = new WeakSet<object>();

/**
 * Provenance for mapping markers that leave the process (e.g. in
 * `response.messages`) and come back as input. The server signs the markers it
 * writes on response parts with a per-process key; a returned part is trusted
 * only if its signature still matches its tool call, tool name and mapping. A
 * client cannot produce a valid signature, and history from another process
 * (or edited after signing) simply fails verification.
 */
const SIGNATURE_KEY = 'modelOutputSignature';
const processKey = randomBytes(32);

type ToolPart = {
  toolInvocation?: { toolCallId?: string; toolName?: string };
  providerMetadata?: Record<string, unknown>;
};

function mappingOf(part: ToolPart): Record<string, unknown> | undefined {
  const mastra = part.providerMetadata?.mastra;
  if (!mastra || typeof mastra !== 'object' || Array.isArray(mastra)) return undefined;
  const record = mastra as Record<string, unknown>;
  return 'modelOutput' in record || record.modelOutputComputed ? record : undefined;
}

function sign(part: ToolPart, mastra: Record<string, unknown>): string {
  return createHmac('sha256', processKey)
    .update(
      JSON.stringify([
        part.toolInvocation?.toolCallId ?? null,
        part.toolInvocation?.toolName ?? null,
        mastra.modelOutput ?? null,
        !!mastra.modelOutputComputed,
      ]),
    )
    .digest('base64url');
}

/** Sign the mapping markers on a server-produced tool part, if it has any. */
export function signServerMapping(part: ToolPart): void {
  const mastra = mappingOf(part);
  if (!mastra) return;
  mastra[SIGNATURE_KEY] = sign(part, mastra);
}

/** Whether a part's mapping markers carry a valid signature from this process. */
export function hasValidServerMapping(part: ToolPart): boolean {
  const mastra = mappingOf(part);
  const signature = mastra?.[SIGNATURE_KEY];
  if (typeof signature !== 'string') return false;
  const expected = Buffer.from(sign(part, mastra!));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const MODEL_OUTPUT_SIGNATURE_KEY = SIGNATURE_KEY;
