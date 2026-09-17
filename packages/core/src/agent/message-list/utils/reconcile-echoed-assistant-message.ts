import type { MastraDBMessage, MastraMessageContentV2 } from '../state/types';

type Part = MastraMessageContentV2['parts'][number];

/**
 * Identity key for matching an echoed part against its stored counterpart.
 * Undefined for part types we cannot reliably match (they are treated as new).
 */
function partKey(part: Part): string | undefined {
  const loose = part as Record<string, any>;
  switch (part.type) {
    case 'text':
      return `text:${part.text}`;
    case 'reasoning':
      return `reasoning:${loose.reasoning ?? loose.text ?? ''}`;
    case 'file':
      return `file:${loose.url ?? loose.data ?? ''}`;
    case 'step-start':
      return 'step-start';
    case 'source':
      return `source:${loose.source?.id ?? loose.url ?? loose.sourceId ?? ''}`;
    case 'tool-invocation':
      return `tool:${loose.toolInvocation?.toolCallId}`;
    default: {
      // v5 tool-* / dynamic-tool parts carry a toolCallId
      if (typeof loose.toolCallId === 'string') return `tool:${loose.toolCallId}`;
      return undefined;
    }
  }
}

function hasProviderMetadata(part: Part): boolean {
  const meta = (part as { providerMetadata?: Record<string, unknown> }).providerMetadata;
  return !!meta && Object.keys(meta).length > 0;
}

/**
 * When a client (e.g. `useChat`) resends an assistant message the server already
 * persisted, the echoed copy is lossy: reasoning parts are stripped and provider
 * metadata (OpenAI `itemId`s) is often dropped. If the echo is allowed to replace the
 * stored copy, the reasoning is lost from the prompt (OpenAI Responses then rejects the
 * orphaned `msg_*` item_reference) and, worse, the lossy copy is re-persisted over the
 * stored one.
 *
 * This reconciles the two: the stored message supplies ordering, reasoning parts and
 * provider metadata; the echo supplies any client-side updates to parts it still has
 * (e.g. tool output added via `addToolResult`) plus any genuinely new parts.
 *
 * Returns `undefined` when there is nothing to restore (the echo is not lossy), so
 * callers can keep existing behavior for every other case.
 */
export function reconcileEchoedAssistantMessage(
  stored: MastraDBMessage,
  echoed: MastraDBMessage,
): MastraDBMessage | undefined {
  if (stored.role !== 'assistant' || echoed.role !== 'assistant') return undefined;

  const storedParts = stored.content?.parts ?? [];
  const echoedParts = echoed.content?.parts ?? [];

  const storedHasReasoning = storedParts.some(p => p.type === 'reasoning');
  const echoedHasReasoning = echoedParts.some(p => p.type === 'reasoning');
  const storedHasProviderMetadata = storedParts.some(hasProviderMetadata);
  const echoedHasProviderMetadata = echoedParts.some(hasProviderMetadata);

  const echoLostReasoning = storedHasReasoning && !echoedHasReasoning;
  const echoLostProviderMetadata = storedHasProviderMetadata && !echoedHasProviderMetadata;
  if (!echoLostReasoning && !echoLostProviderMetadata) return undefined;

  const echoedByKey = new Map<string, Part>();
  for (const part of echoedParts) {
    const key = partKey(part);
    if (key && !echoedByKey.has(key)) echoedByKey.set(key, part);
  }

  const consumed = new Set<Part>();
  const parts: Part[] = storedParts.map(storedPart => {
    const key = partKey(storedPart);
    const echoedPart = key ? echoedByKey.get(key) : undefined;
    if (!echoedPart) return storedPart;
    consumed.add(echoedPart);
    const storedMeta = (storedPart as { providerMetadata?: unknown }).providerMetadata;
    return hasProviderMetadata(echoedPart) || !storedMeta
      ? echoedPart
      : ({ ...echoedPart, providerMetadata: storedMeta } as Part);
  });
  for (const part of echoedParts) {
    if (!consumed.has(part)) parts.push(part);
  }

  const metadata =
    stored.content?.metadata || echoed.content?.metadata
      ? { ...stored.content?.metadata, ...echoed.content?.metadata }
      : undefined;

  return {
    ...stored,
    content: { ...stored.content, ...echoed.content, parts, ...(metadata ? { metadata } : {}) },
  };
}
