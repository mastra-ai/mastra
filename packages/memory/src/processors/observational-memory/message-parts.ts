import type { MastraDBMessage } from '@mastra/core/agent';
import type { BufferedObservationChunk, ObservationalMemoryRecord } from '@mastra/core/storage';

/**
 * Parse buffered observation chunks from a record, handling both array and
 * stringified JSON forms.
 */
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
 * Find the last completed observation boundary in a message's parts.
 * A completed observation is a start marker followed by an end marker.
 *
 * Returns the index of the END marker (which is the observation boundary),
 * or -1 if no completed observation is found.
 */
export function findLastCompletedObservationBoundary(message: MastraDBMessage): number {
  const parts = message.content?.parts;
  if (!parts || !Array.isArray(parts)) return -1;

  // Search from the end to find the most recent end marker
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] as { type?: string };
    if (part?.type === 'data-om-observation-end') {
      // Found an end marker - this is the observation boundary
      return i;
    }
  }
  return -1;
}

/**
 * Check if a message has an in-progress observation (start without end).
 */
export function hasInProgressObservation(message: MastraDBMessage): boolean {
  const parts = message.content?.parts;
  if (!parts || !Array.isArray(parts)) return false;

  let lastStartIndex = -1;
  let lastEndOrFailedIndex = -1;

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] as { type?: string };
    if (part?.type === 'data-om-observation-start' && lastStartIndex === -1) {
      lastStartIndex = i;
    }
    if (
      (part?.type === 'data-om-observation-end' || part?.type === 'data-om-observation-failed') &&
      lastEndOrFailedIndex === -1
    ) {
      lastEndOrFailedIndex = i;
    }
  }

  // In progress if we have a start that comes after any end/failed
  return lastStartIndex !== -1 && lastStartIndex > lastEndOrFailedIndex;
}

/**
 * Seal messages to prevent new parts from being merged into them.
 * This is used when starting buffering to capture the current content state.
 *
 * Sealing works by:
 * 1. Setting `message.content.metadata.mastra.sealed = true` (message-level flag)
 * 2. Adding `metadata.mastra.sealedAt` to the last part (boundary marker)
 *
 * When MessageList.add() receives a message with the same ID as a sealed message,
 * it creates a new message with only the parts beyond the seal boundary.
 *
 * The messages are mutated in place - since they're references to the same objects
 * in the MessageList, the seal will be recognized immediately.
 *
 * @param messages - Messages to seal (mutated in place)
 */
export function sealMessagesForBuffering(messages: MastraDBMessage[]): void {
  const sealedAt = Date.now();

  for (const msg of messages) {
    if (!msg.content?.parts?.length) continue;

    // Set message-level sealed flag
    if (!msg.content.metadata) {
      msg.content.metadata = {};
    }
    const metadata = msg.content.metadata as { mastra?: { sealed?: boolean } };
    if (!metadata.mastra) {
      metadata.mastra = {};
    }
    metadata.mastra.sealed = true;

    // Add sealedAt to the last part
    const lastPart = msg.content.parts[msg.content.parts.length - 1] as {
      metadata?: { mastra?: { sealedAt?: number } };
    };
    if (!lastPart.metadata) {
      lastPart.metadata = {};
    }
    if (!lastPart.metadata.mastra) {
      lastPart.metadata.mastra = {};
    }
    lastPart.metadata.mastra.sealedAt = sealedAt;
  }
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
 * Create a virtual message containing only the unobserved parts.
 * This is used for token counting and observation.
 */
export function createUnobservedMessage(message: MastraDBMessage): MastraDBMessage | null {
  const unobservedParts = getUnobservedParts(message);
  if (unobservedParts.length === 0) return null;

  return {
    ...message,
    content: {
      ...message.content,
      parts: unobservedParts,
    },
  };
}

/**
 * Get unobserved messages with part-level filtering.
 *
 * This method uses data-om-observation-end markers to filter at the part level:
 * 1. For messages WITH a completed observation: only return parts AFTER the end marker
 * 2. For messages WITHOUT completed observation: check timestamp against lastObservedAt
 *
 * This handles the case where a single message accumulates many parts
 * (like tool calls) during an agentic loop - we only observe the new parts.
 */
export function getUnobservedMessages(
  allMessages: MastraDBMessage[],
  record: ObservationalMemoryRecord,
  opts?: { excludeBuffered?: boolean },
): MastraDBMessage[] {
  const lastObservedAt = record.lastObservedAt;
  // Safeguard: track message IDs that were already observed to prevent re-observation
  // This handles edge cases like process restarts where lastObservedAt might not capture all messages
  const observedMessageIds = new Set<string>(Array.isArray(record.observedMessageIds) ? record.observedMessageIds : []);

  // Only exclude buffered chunk message IDs when called from the buffering path.
  // The main agent context should still see buffered messages until activation.
  if (opts?.excludeBuffered) {
    const bufferedChunks = getBufferedChunks(record);
    for (const chunk of bufferedChunks) {
      if (Array.isArray(chunk.messageIds)) {
        for (const id of chunk.messageIds) {
          observedMessageIds.add(id);
        }
      }
    }
  }

  if (!lastObservedAt && observedMessageIds.size === 0) {
    // No observations yet - all messages are unobserved
    return allMessages;
  }

  const result: MastraDBMessage[] = [];

  for (const msg of allMessages) {
    // First check: skip if this message ID was already observed (safeguard against re-observation)
    if (observedMessageIds?.has(msg.id)) {
      continue;
    }

    // Check if this message has a completed observation
    const endMarkerIndex = findLastCompletedObservationBoundary(msg);
    const inProgress = hasInProgressObservation(msg);

    if (inProgress) {
      // Include the full message for in-progress observations
      // The Observer is currently working on this
      result.push(msg);
    } else if (endMarkerIndex !== -1) {
      // Message has a completed observation - only include parts after it
      const virtualMsg = createUnobservedMessage(msg);
      if (virtualMsg) {
        result.push(virtualMsg);
      }
    } else {
      // No observation markers - fall back to timestamp-based filtering
      if (!msg.createdAt || !lastObservedAt) {
        // Messages without timestamps are always included
        // Also include messages when there's no lastObservedAt timestamp
        result.push(msg);
      } else {
        const msgDate = new Date(msg.createdAt);
        if (msgDate > lastObservedAt) {
          result.push(msg);
        }
      }
    }
  }

  return result;
}
