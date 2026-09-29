import { getChunkProducedAt, stampChunkProducedAt } from './produced-at';

// Run-lifecycle chunks are not part of any persisted message.
const RUN_LIFECYCLE_CHUNK_TYPES = new Set(['start', 'finish', 'abort']);

/**
 * Tracks the persisted assistant message id for chunks of one run and stamps it on each chunk.
 * The response message id can rotate mid-run; every rotation is announced by a `step-start`
 * chunk carrying the new id, which is observed here before any content of the new message.
 */
export function createChunkMessageIdStamper(initialMessageId?: string) {
  let currentMessageId = initialMessageId;

  return <T>(chunk: T): T => {
    if (!chunk || typeof chunk !== 'object') return chunk;
    const c = chunk as { type?: unknown; messageId?: unknown; payload?: { messageId?: unknown } };

    if (c.type === 'step-start' && typeof c.payload?.messageId === 'string') {
      currentMessageId = c.payload.messageId;
    }

    if (!currentMessageId || typeof c.type !== 'string' || RUN_LIFECYCLE_CHUNK_TYPES.has(c.type)) return chunk;
    if (typeof c.messageId === 'string') return chunk;

    const stamped = { ...c, messageId: currentMessageId } as T;
    const producedAt = getChunkProducedAt(chunk);
    if (producedAt !== undefined) stampChunkProducedAt(stamped, producedAt);
    return stamped;
  };
}
