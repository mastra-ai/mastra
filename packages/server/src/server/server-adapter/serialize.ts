import { safeStringify } from '@mastra/core/utils';

export type SerializedStreamChunk = { ok: true; json: string } | { ok: false; error: Error };

/** Chunks marked by {@link shareStreamChunk}, with their JSON once the first stream serializes them. */
const sharedChunks = new WeakMap<object, SerializedStreamChunk | undefined>();

/**
 * Mark a chunk that is enqueued, unchanged, on several streams so it is
 * serialized once instead of once per stream. The chunk must not be mutated
 * afterwards: every stream receives the JSON of its first serialization.
 */
export function shareStreamChunk<T extends object>(chunk: T): T {
  if (!sharedChunks.has(chunk)) sharedChunks.set(chunk, undefined);
  return chunk;
}

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
  const shared = typeof chunk === 'object' && chunk !== null && sharedChunks.has(chunk);
  if (shared) {
    const serialized = sharedChunks.get(chunk);
    if (serialized) return serialized;
  }
  let serialized: SerializedStreamChunk;
  try {
    serialized = { ok: true, json: safeStringify(withPlainPayloadError(chunk)) };
  } catch (error) {
    serialized = { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
  if (shared) sharedChunks.set(chunk as object, serialized);
  return serialized;
}

/**
 * `JSON.stringify(new Error('x'))` keeps only own enumerable fields, so an Error subclass that sets `name`
 * arrives as `{ name }` and clients show `[object Object]`. Send the message too; never the stack. An
 * error whose class curates its JSON (`toJSON`, e.g. MastraError) keeps that shape, so fields it leaves
 * out stay out.
 */
function withPlainPayloadError(chunk: unknown): unknown {
  if (!chunk || typeof chunk !== 'object' || !('payload' in chunk)) return chunk;
  const { payload } = chunk;
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return chunk;
  const { error } = payload;
  if (!(error instanceof Error)) return withoutStack(chunk, payload, error);
  const plain: Record<string, unknown> = { ...(curatedJson(error) ?? error), message: error.message };
  delete plain.stack;
  if (!plain.name && error.name !== 'Error') plain.name = error.name;
  return { ...chunk, payload: { ...payload, error: plain } };
}

/** An error that is already a plain object (a replayed one) is kept as is, minus its stack. */
function withoutStack(chunk: object, payload: object, error: unknown): unknown {
  if (!error || typeof error !== 'object' || Array.isArray(error) || !('stack' in error)) return chunk;
  const { stack: _stack, ...rest } = error as Record<string, unknown>;
  return { ...chunk, payload: { ...payload, error: rest } };
}

function curatedJson(error: Error): Record<string, unknown> | undefined {
  const toJSON = (error as { toJSON?: unknown }).toJSON;
  if (typeof toJSON !== 'function') return undefined;
  try {
    const json: unknown = toJSON.call(error);
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
