/**
 * Provenance stamp for `providerMetadata.mastra.modelOutput`.
 *
 * Only code that runs a tool's `toModelOutput` (or commits a processor's model
 * output) writes the stamp, and every client-facing ingress removes it, so a
 * stamped projection was computed by the server. The stamp is plain JSON: it
 * survives serialization, durable step boundaries and memory round trips.
 * Unstamped projections predate it (or came from a client) and are judged by
 * `dropUnmappedClientToolMarkers`.
 */
export const MODEL_OUTPUT_ORIGIN_KEY = 'modelOutputOrigin';
const SERVER_ORIGIN = 'server';

export function stampServerModelOutput<T extends Record<string, unknown>>(mastra: T): T {
  return { ...mastra, [MODEL_OUTPUT_ORIGIN_KEY]: SERVER_ORIGIN };
}

/** `mastra` without the stamp, or the same object when it carries none. */
export function withoutModelOutputOrigin<T>(mastra: T): T {
  if (!mastra || typeof mastra !== 'object' || !(MODEL_OUTPUT_ORIGIN_KEY in mastra)) return mastra;
  const { [MODEL_OUTPUT_ORIGIN_KEY]: _origin, ...rest } = mastra as Record<string, unknown>;
  return rest as T;
}

export function hasServerModelOutput(part: { providerMetadata?: unknown }): boolean {
  const mastra = (part.providerMetadata as { mastra?: unknown } | undefined)?.mastra;
  return (
    !!mastra &&
    typeof mastra === 'object' &&
    (mastra as Record<string, unknown>)[MODEL_OUTPUT_ORIGIN_KEY] === SERVER_ORIGIN
  );
}

function stripPart(part: unknown): unknown {
  if (!part || typeof part !== 'object') return part;
  const providerMetadata = (part as { providerMetadata?: unknown }).providerMetadata;
  if (!providerMetadata || typeof providerMetadata !== 'object') return part;
  const mastra = (providerMetadata as { mastra?: unknown }).mastra;
  const nextMastra = withoutModelOutputOrigin(mastra);
  if (nextMastra === mastra) return part;
  return { ...part, providerMetadata: { ...providerMetadata, mastra: nextMastra } };
}

/**
 * Remove the stamp from a stored-format message's parts. Returns the same
 * object when nothing carries a stamp; otherwise a copy, so objects the caller
 * or a MessageList still holds are never mutated.
 */
export function withoutModelOutputOriginInMessage<T>(message: T): T {
  if (!message || typeof message !== 'object') return message;
  const content = (message as { content?: unknown }).content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return message;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return message;
  let changed = false;
  const nextParts = parts.map(part => {
    const next = stripPart(part);
    if (next !== part) changed = true;
    return next;
  });
  if (!changed) return message;
  return { ...message, content: { ...content, parts: nextParts } };
}

/**
 * Remove the stamp from client-supplied stored-format messages, replacing
 * affected entries of `messages` in place with copies. For server boundaries
 * that persist client messages without going through a MessageList.
 */
export function stripClientModelOutputOrigin(messages: unknown): void {
  if (!Array.isArray(messages)) return;
  for (let index = 0; index < messages.length; index++) {
    messages[index] = withoutModelOutputOriginInMessage(messages[index]);
  }
}
