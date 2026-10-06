/**
 * Chunk types that represent actual model output for a step. Used to detect a
 * "zero-output" step: a stream that finishes with reason `other` without ever
 * producing any of these must not re-enter the loop (issue #21897) — the
 * request would be re-issued unchanged and spin until maxSteps.
 *
 * Shared by the regular agentic loop and the durable agentic loop so both
 * apply the same definition of "produced output".
 */
export const STEP_CONTENT_CHUNK_TYPES: ReadonlySet<string> = new Set([
  'text-delta',
  'reasoning-delta',
  'tool-call',
  'tool-call-delta',
  'tool-result',
  'object',
  'object-result',
  'file',
  'source',
]);

/**
 * The first provider chunk that starts a response worth keeping. Until one arrives a
 * model request has produced only reasoning or metadata, and a queued signal may cancel it.
 */
export function startsResponseContent(chunk: { type: string }): boolean {
  if (chunk.type === 'reasoning-delta') return false;
  return (
    STEP_CONTENT_CHUNK_TYPES.has(chunk.type) ||
    chunk.type === 'text-start' ||
    chunk.type === 'text-end' ||
    chunk.type === 'tool-call-input-streaming-start' ||
    chunk.type === 'tool-call-input-streaming-end' ||
    chunk.type === 'tool-error'
  );
}
