/**
 * Epoch ms at which a model output produced each chunk. Recorded when the
 * chunk is emitted, before any consumer can queue it, so thread history can
 * compare it with storage stamps regardless of how long publishing took.
 */
const chunkProducedAt = new WeakMap<object, number>();

export function stampChunkProducedAt(chunk: unknown, at: number) {
  if (chunk && typeof chunk === 'object') chunkProducedAt.set(chunk, at);
}

export function getChunkProducedAt(chunk: unknown): number | undefined {
  return chunk && typeof chunk === 'object' ? chunkProducedAt.get(chunk) : undefined;
}
