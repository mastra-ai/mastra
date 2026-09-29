import { getChunkProducedAt, stampChunkProducedAt } from './produced-at';

// Run-lifecycle chunks are not part of any persisted message.
const RUN_LIFECYCLE_CHUNK_TYPES = new Set(['start', 'finish', 'abort']);

// Signal parts are persisted as their own `role: 'signal'` message whose id is the signal id.
const SIGNAL_CHUNK_TYPES = new Set(['data-signal', 'data-user-message']);

/**
 * Tracks the persisted assistant message id for chunks of one run and stamps it on each chunk.
 * `step-start` chunks carry the id at step boundaries and are observed here. Other rotations
 * (signal drains, processor `rotateResponseMessageId`, `processorRetryFeedback`, resume) are not
 * announced by a `step-start`, so callers must pass an explicit `messageId` on those chunks.
 */
export function createChunkMessageIdStamper(initialMessageId?: string) {
  let currentMessageId = initialMessageId;

  return <T>(chunk: T): T => {
    if (!chunk || typeof chunk !== 'object') return chunk;
    const c = chunk as { type?: unknown; messageId?: unknown; payload?: { messageId?: unknown } };

    if (c.type === 'step-start' && typeof c.payload?.messageId === 'string') {
      currentMessageId = c.payload.messageId;
    }

    return withChunkMessageId(chunk, currentMessageId);
  };
}

/**
 * Stamps `messageId` on a content chunk unless it already carries one. Signal parts get their own
 * signal id. Run-lifecycle chunks are returned unchanged. Preserves the chunk's `producedAt` stamp.
 */
export function withChunkMessageId<T>(chunk: T, responseMessageId: string | undefined): T {
  if (!chunk || typeof chunk !== 'object') return chunk;
  const c = chunk as { type?: unknown; messageId?: unknown; data?: { id?: unknown } };
  if (typeof c.type !== 'string' || RUN_LIFECYCLE_CHUNK_TYPES.has(c.type)) return chunk;
  if (typeof c.messageId === 'string') return chunk;
  const messageId = SIGNAL_CHUNK_TYPES.has(c.type) && typeof c.data?.id === 'string' ? c.data.id : responseMessageId;
  if (!messageId) return chunk;

  const stamped = { ...c, messageId } as T;
  const producedAt = getChunkProducedAt(chunk);
  if (producedAt !== undefined) stampChunkProducedAt(stamped, producedAt);
  return stamped;
}
