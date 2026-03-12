import type { MastraDBMessage } from '@mastra/core/agent';

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
 * Filter messages for persistence, handling sealed message deduplication.
 *
 * - Sealed messages WITH observation markers: keep (storage upserts)
 * - Sealed messages WITHOUT markers: skip (already persisted by async buffering)
 * - Unsealed messages: keep
 *
 * Also updates sealedIds and state after filtering.
 */
export function filterMessagesForPersistence(
  messagesToSave: MastraDBMessage[],
  sealedIds: Set<string>,
  state: Record<string, unknown>,
): MastraDBMessage[] {
  const filtered: MastraDBMessage[] = [];
  for (const msg of messagesToSave) {
    if (sealedIds.has(msg.id)) {
      if (findLastCompletedObservationBoundary(msg) !== -1) {
        filtered.push(msg);
      }
      // else: sealed for buffering only, already persisted — skip to avoid duplication
    } else {
      filtered.push(msg);
    }
  }

  // Track IDs of messages that now have observation markers (sealed)
  for (const msg of filtered) {
    if (findLastCompletedObservationBoundary(msg) !== -1) {
      sealedIds.add(msg.id);
    }
  }
  state.sealedIds = sealedIds;

  return filtered;
}
