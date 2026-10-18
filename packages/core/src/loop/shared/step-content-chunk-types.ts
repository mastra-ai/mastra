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
