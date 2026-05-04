import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { BufferedObservationChunk, ObservationalMemoryRecord } from '@mastra/core/storage';

/**
 * Find the index of the last completed observation boundary (end marker) in a message's parts.
 * Returns -1 if no completed observation is found.
 */
export function findLastCompletedObservationBoundary(message: MastraDBMessage): number {
  const parts = message.content?.parts;
  if (!parts || !Array.isArray(parts)) return -1;

  // Search from the end to find the most recent end marker
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] as { type?: string };
    if (part?.type === 'data-om-observation-end') {
      return i;
    }
  }
  return -1;
}

/**
 * Get unobserved parts from a message.
 * If the message has a completed observation (start + end), only return parts after the end.
 * If observation is in progress (start without end), include parts before the start.
 * Otherwise, return all parts.
 */
export function getUnobservedParts(message: MastraDBMessage): MastraDBMessage['content']['parts'] {
  const parts = message.content?.parts;
  if (!parts || !Array.isArray(parts)) return [];

  const endMarkerIndex = findLastCompletedObservationBoundary(message);
  if (endMarkerIndex === -1) {
    // No completed observation - all parts are unobserved
    // (This includes the case where observation is in progress)
    return parts.filter(p => {
      const part = p as { type?: string };
      // Exclude start markers that are in progress
      return part?.type !== 'data-om-observation-start';
    });
  }

  // Return only parts after the end marker (excluding start/end/failed markers)
  return parts.slice(endMarkerIndex + 1).filter(p => {
    const part = p as { type?: string };
    return !part?.type?.startsWith('data-om-observation-');
  });
}

/**
 * Check if a message has any unobserved parts.
 */
export function hasUnobservedParts(message: MastraDBMessage): boolean {
  return getUnobservedParts(message).length > 0;
}

/**
 * Compute a cursor pointing at the latest message by createdAt.
 * Used to derive a stable observation boundary for replay pruning.
 */
export function getLastObservedMessageCursor(
  messages: MastraDBMessage[],
): { createdAt: string; id: string } | undefined {
  let latest: MastraDBMessage | undefined;
  for (const msg of messages) {
    if (!msg?.id || !msg.createdAt) continue;
    if (!latest || new Date(msg.createdAt).getTime() > new Date(latest.createdAt!).getTime()) {
      latest = msg;
    }
  }
  return latest ? { createdAt: new Date(latest.createdAt!).toISOString(), id: latest.id } : undefined;
}

/**
 * Check if a message is at or before a cursor (by createdAt then id).
 */
export function isMessageAtOrBeforeCursor(msg: MastraDBMessage, cursor: { createdAt: string; id: string }): boolean {
  if (!msg.createdAt) return false;
  const msgIso = new Date(msg.createdAt).toISOString();
  if (msgIso < cursor.createdAt) return true;
  if (msgIso === cursor.createdAt && msg.id === cursor.id) return true;
  return false;
}

/**
 * Safely extract buffered observation chunks from a record.
 * Handles both array and JSON-string formats, returning empty array if malformed.
 */
/**
 * Filter out already-observed messages from the in-memory context.
 * Uses marker-boundary pruning (preferred) or record-based fallback.
 *
 * The `fallbackCursor` is optional — callers that need it should resolve it
 * from thread metadata before calling this function.
 */
export function filterObservedMessages(opts: {
  messageList: MessageList;
  record?: ObservationalMemoryRecord;
  useMarkerBoundaryPruning?: boolean;
  fallbackCursor?: { createdAt: string; id: string };
}): void {
  const { messageList, record } = opts;
  const allMessages = messageList.get.all.db();
  const useMarkerBoundaryPruning = opts.useMarkerBoundaryPruning ?? true;

  let markerMessageIndex = -1;
  let markerMessage: MastraDBMessage | null = null;

  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];
    if (!msg) continue;
    if (findLastCompletedObservationBoundary(msg) !== -1) {
      markerMessageIndex = i;
      markerMessage = msg;
      break;
    }
  }

  if (useMarkerBoundaryPruning && markerMessage && markerMessageIndex !== -1) {
    const messagesToRemove: string[] = [];
    for (let i = 0; i < markerMessageIndex; i++) {
      const msg = allMessages[i];
      if (msg?.id && msg.id !== 'om-continuation') {
        messagesToRemove.push(msg.id);
      }
    }

    if (messagesToRemove.length > 0) {
      messageList.removeByIds(messagesToRemove);
    }

    const unobserved = getUnobservedParts(markerMessage);
    if (unobserved.length === 0) {
      if (markerMessage.id) messageList.removeByIds([markerMessage.id]);
    } else if (unobserved.length < (markerMessage.content?.parts?.length ?? 0)) {
      markerMessage.content.parts = unobserved;
    }
  } else if (record) {
    const observedIds = new Set<string>(Array.isArray(record.observedMessageIds) ? record.observedMessageIds : []);

    const derivedCursor =
      opts.fallbackCursor ??
      getLastObservedMessageCursor(allMessages.filter(msg => !!msg?.id && observedIds.has(msg.id) && !!msg.createdAt));
    const lastObservedAt = record.lastObservedAt;
    const messagesToRemove: string[] = [];

    for (const msg of allMessages) {
      if (!msg?.id || msg.id === 'om-continuation') continue;

      if (observedIds.has(msg.id)) {
        messagesToRemove.push(msg.id);
        continue;
      }

      if (derivedCursor && isMessageAtOrBeforeCursor(msg, derivedCursor)) {
        messagesToRemove.push(msg.id);
        continue;
      }

      if (lastObservedAt && msg.createdAt) {
        const msgDate = new Date(msg.createdAt);
        if (msgDate <= lastObservedAt) {
          messagesToRemove.push(msg.id);
        }
      }
    }

    if (messagesToRemove.length > 0) {
      messageList.removeByIds(messagesToRemove);
    }
  }
}

export function getBufferedChunks(record: ObservationalMemoryRecord | null | undefined): BufferedObservationChunk[] {
  if (!record?.bufferedObservationChunks) return [];
  if (Array.isArray(record.bufferedObservationChunks)) return record.bufferedObservationChunks;
  if (typeof record.bufferedObservationChunks === 'string') {
    try {
      const parsed = JSON.parse(record.bufferedObservationChunks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Sort threads by their oldest unobserved message.
 * Returns thread IDs in order from oldest to most recent.
 */
/**
 * Combine active and buffered observations for the buffering observer context.
 */
export function combineObservationsForBuffering(
  activeObservations: string | undefined,
  bufferedObservations: string | undefined,
): string | undefined {
  if (!activeObservations && !bufferedObservations) return undefined;
  if (!activeObservations) return bufferedObservations;
  if (!bufferedObservations) return activeObservations;
  return `${activeObservations}\n\n--- BUFFERED (pending activation) ---\n\n${bufferedObservations}`;
}

export function sortThreadsByOldestMessage(messagesByThread: Map<string, MastraDBMessage[]>): string[] {
  return Array.from(messagesByThread.entries())
    .map(([threadId, messages]) => ({
      threadId,
      oldestTimestamp: Math.min(...messages.map(m => (m.createdAt ? new Date(m.createdAt).getTime() : Date.now()))),
    }))
    .sort((a, b) => a.oldestTimestamp - b.oldestTimestamp)
    .map(t => t.threadId);
}

/**
 * Strip any thread tags that the Observer might have added.
 * Thread attribution is handled externally by the system, not by the Observer.
 */
export function stripThreadTags(observations: string): string {
  // Match <thread ...> and </thread> via a single bounded pattern. Using
  // a \b word boundary after "thread" prevents the engine from starting
  // a hot path at every "<thread..." position in the input, which is how
  // the polynomial worst case materialises on attacker-crafted strings.
  return observations.replace(/<\/?thread\b[^>]{0,1024}>/gi, '').trim();
}
