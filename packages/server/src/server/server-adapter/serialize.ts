import { safeStringify } from '@mastra/core/utils';

export type SerializedStreamChunk = { ok: true; json: string } | { ok: false; error: Error };

/**
 * Serializes a stream chunk to JSON for wire transport.
 *
 * Stream chunks can contain values that plain `JSON.stringify` throws on
 * (e.g. BigInt produced by zod coercions/transforms in structuredOutput
 * schemas, or circular references) — `safeStringify` handles those. A single
 * bad chunk must never kill the whole stream — Studio relies on later chunks
 * (`workflow-step-result`, `workflow-finish`) to render run state.
 *
 * Returns `{ ok: false, error }` if the chunk cannot be serialized at all
 * (e.g. a throwing getter/toJSON) — callers should log the error, skip the
 * chunk, and keep streaming.
 */
export function serializeStreamChunk(chunk: unknown): SerializedStreamChunk {
  try {
    return { ok: true, json: safeStringify(withPlainPayloadError(chunk)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * `JSON.stringify(new Error('x'))` keeps only own enumerable fields, so an Error subclass that sets `name`
 * arrives as `{ name }` and clients show `[object Object]`. Send the message too; never the stack.
 */
function withPlainPayloadError(chunk: unknown): unknown {
  if (!chunk || typeof chunk !== 'object' || !('payload' in chunk)) return chunk;
  const { payload } = chunk;
  if (!payload || typeof payload !== 'object' || !('error' in payload) || !(payload.error instanceof Error)) {
    return chunk;
  }
  const { error } = payload;
  const plain: Record<string, unknown> = { ...error, message: error.message };
  if (error.name !== 'Error') plain.name = error.name;
  return { ...chunk, payload: { ...payload, error: plain } };
}
