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

// Every part field the message adapters carry into stored `providerMetadata`:
// stored and UI parts use `providerMetadata`, UI tool parts `callProviderMetadata`,
// model-message parts `providerOptions`.
const PART_METADATA_KEYS = ['providerMetadata', 'callProviderMetadata', 'providerOptions'] as const;

function stripPart(part: unknown): unknown {
  if (!part || typeof part !== 'object') return part;
  let next = part as Record<string, unknown>;
  for (const key of PART_METADATA_KEYS) {
    const metadata = next[key];
    if (!metadata || typeof metadata !== 'object') continue;
    const mastra = (metadata as { mastra?: unknown }).mastra;
    const nextMastra = withoutModelOutputOrigin(mastra);
    if (nextMastra !== mastra) next = { ...next, [key]: { ...metadata, mastra: nextMastra } };
  }
  return next;
}

function stripParts(parts: unknown): unknown {
  if (!Array.isArray(parts)) return parts;
  let changed = false;
  const nextParts = parts.map(part => {
    const next = stripPart(part);
    if (next !== part) changed = true;
    return next;
  });
  return changed ? nextParts : parts;
}

/**
 * Remove the stamp from a message's parts in any message format (stored
 * `content.parts`, UI `parts`, model-message `content` array). Returns the same
 * object when nothing carries a stamp; otherwise a copy, so objects the caller
 * or a MessageList still holds are never mutated.
 */
export function withoutModelOutputOriginInMessage<T>(message: T): T {
  if (!message || typeof message !== 'object') return message;
  let next = message as Record<string, unknown>;
  const parts = stripParts(next.parts);
  if (parts !== next.parts) next = { ...next, parts };
  const content = next.content;
  if (Array.isArray(content)) {
    const nextContent = stripParts(content);
    if (nextContent !== content) next = { ...next, content: nextContent };
  } else if (content && typeof content === 'object') {
    const contentParts = (content as { parts?: unknown }).parts;
    const nextContentParts = stripParts(contentParts);
    if (nextContentParts !== contentParts) next = { ...next, content: { ...content, parts: nextContentParts } };
  }
  return next as T;
}
