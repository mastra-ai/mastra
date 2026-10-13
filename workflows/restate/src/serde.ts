import type { AgentExecutionOptions } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { ChunkType } from '@mastra/core/stream';

import type { RestateSerializableOptions } from './types';

const NON_SERIALIZABLE_OPTION_KEYS = new Set([
  'onChunk',
  'onStepFinish',
  'onFinish',
  'onError',
  'onSuspended',
  'onAbort',
  'onIterationComplete',
  'abortSignal',
  'prepareStep',
  'delegation',
  'transform',
  'isTaskComplete',
  'untilIdle',
  '_skipBgTaskWait',
]);

/**
 * Convert caller options into the JSON-safe subset that crosses the Restate
 * invocation boundary. Non-serializable fields (closures, signals) are
 * dropped; the service handler reconstructs callbacks for event recording.
 */
export function serializeOptions(options: AgentExecutionOptions<any> | undefined): RestateSerializableOptions {
  if (!options) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (NON_SERIALIZABLE_OPTION_KEYS.has(key)) {
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    // `requireToolApproval` may be a function on the caller side; only its
    // truthiness crosses the Restate boundary. The service handler installs
    // its own approval callback that suspends via an awakeable.
    if (key === 'requireToolApproval') {
      out[key] = !!value;
      continue;
    }
    out[key] = value;
  }
  return out as RestateSerializableOptions;
}

/**
 * Convert `MessageListInput` into a JSON-safe `CoreMessage[]` for the wire.
 * Strings are wrapped as user messages; `MessageList` instances are read
 * through their `get.all.core` accessor when available.
 */
export function serializeMessages(messages: unknown): CoreMessage[] {
  if (typeof messages === 'string') {
    return [{ role: 'user', content: messages } as CoreMessage];
  }
  if (Array.isArray(messages)) {
    return messages as CoreMessage[];
  }
  const list = messages as { get?: { all?: { core?: CoreMessage[] } } } | undefined;
  if (list && typeof list.get === 'object' && list.get?.all?.core) {
    return list.get.all.core;
  }
  return messages as CoreMessage[];
}

/**
 * Best-effort JSON-safety check for a stream chunk. Restate serializes
 * handler results with JSON serde, so non-serializable payloads must be
 * dropped rather than failing the whole run.
 */
export function isJSONSafe(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return a JSON-safe copy of a chunk, or `undefined` when the chunk cannot
 * be serialized. Chunks are recorded for client-side stream reconstruction
 * and `observe()` replay.
 */
export function sanitizeChunk(chunk: ChunkType<any>): ChunkType | undefined {
  if (!isJSONSafe(chunk)) {
    return undefined;
  }
  return chunk as ChunkType;
}
