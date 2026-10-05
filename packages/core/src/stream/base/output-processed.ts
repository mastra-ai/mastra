/**
 * Chunks that already ran through the run's output processors before they
 * reached this stream (durable tool chunks, processed in the tool-call step
 * before publishing). MastraModelOutput passes them through without running
 * the processors again.
 */
const outputProcessedChunks = new WeakSet<object>();

export function markChunkOutputProcessed(chunk: unknown) {
  if (chunk && typeof chunk === 'object') outputProcessedChunks.add(chunk);
}

export function isChunkOutputProcessed(chunk: unknown): boolean {
  return !!chunk && typeof chunk === 'object' && outputProcessedChunks.has(chunk);
}
