/**
 * Thread-level utility functions for Observational Memory.
 *
 * Pure functions for thread-scoped operations: thread tag manipulation,
 * observation section merging, message timestamp extraction, thread sorting,
 * and observation combining.
 */

import type { MastraDBMessage } from '@mastra/core/agent';

/**
 * Strip any `<thread>` or `</thread>` tags from observation text.
 * Thread attribution is handled externally by the system, not by the Observer.
 * This is a defense-in-depth measure.
 */
export function stripThreadTags(observations: string): string {
  return observations.replace(/<thread[^>]*>|<\/thread>/gi, '').trim();
}

/**
 * Get the maximum `createdAt` timestamp from a list of messages.
 * Used to set `lastObservedAt` to the most recent message timestamp
 * instead of current time, ensuring historical data works correctly.
 */
export function getMaxMessageTimestamp(messages: MastraDBMessage[]): Date {
  let maxTime = 0;
  for (const msg of messages) {
    if (msg.createdAt) {
      const msgTime = new Date(msg.createdAt).getTime();
      if (msgTime > maxTime) {
        maxTime = msgTime;
      }
    }
  }
  return maxTime > 0 ? new Date(maxTime) : new Date();
}

/**
 * Append or merge a new thread section into existing observations.
 * If the new section has the same thread ID and date as an existing section,
 * merges the observations into that section to reduce token usage.
 * Otherwise, appends as a new section.
 *
 * Uses string search (not regex) for section matching to avoid
 * polynomial backtracking (CodeQL).
 */
export function replaceOrAppendThreadSection(
  existingObservations: string,
  _threadId: string,
  newThreadSection: string,
): string {
  if (!existingObservations) {
    return newThreadSection;
  }

  // Extract thread ID and date from new section
  const threadIdMatch = newThreadSection.match(/<thread id="([^"]+)">/);
  const dateMatch = newThreadSection.match(/Date:\s*([A-Za-z]+\s+\d+,\s+\d+)/);

  if (!threadIdMatch || !dateMatch) {
    // Can't parse, just append
    return `${existingObservations}\n\n${newThreadSection}`;
  }

  const newThreadId = threadIdMatch[1]!;
  const newDate = dateMatch[1]!;

  // Look for existing section with same thread ID and date.
  // Iterate all occurrences to handle multiple sections with the same thread ID but different dates.
  const threadOpen = `<thread id="${newThreadId}">`;
  const threadClose = '</thread>';
  let existingSection: string | null = null;
  let existingSectionStart = -1;
  let existingSectionEnd = -1;
  let searchFrom = 0;

  while (searchFrom < existingObservations.length) {
    const startIdx = existingObservations.indexOf(threadOpen, searchFrom);
    if (startIdx === -1) break;

    const closeIdx = existingObservations.indexOf(threadClose, startIdx);
    if (closeIdx === -1) break;

    const sectionEnd = closeIdx + threadClose.length;
    const section = existingObservations.slice(startIdx, sectionEnd);

    if (section.includes(`Date: ${newDate}`) || section.includes(`Date:${newDate}`)) {
      existingSection = section;
      existingSectionStart = startIdx;
      existingSectionEnd = sectionEnd;
      break;
    }

    searchFrom = sectionEnd;
  }

  if (existingSection) {
    // Found existing section with same thread ID and date - merge observations
    // Extract observations from new section: everything after the Date: line, before </thread>
    const dateLineEnd = newThreadSection.indexOf('\n', newThreadSection.indexOf('Date:'));
    const newCloseIdx = newThreadSection.lastIndexOf(threadClose);
    if (dateLineEnd !== -1 && newCloseIdx !== -1) {
      const newObsContent = newThreadSection.slice(dateLineEnd + 1, newCloseIdx).trim();
      if (newObsContent) {
        // Insert new observations at the end of the existing section (before </thread>)
        const withoutClose = existingSection.slice(0, existingSection.length - threadClose.length).trimEnd();
        const merged = `${withoutClose}\n${newObsContent}\n${threadClose}`;
        return (
          existingObservations.slice(0, existingSectionStart) + merged + existingObservations.slice(existingSectionEnd)
        );
      }
    }
  }

  // No existing section with same thread ID and date - append
  return `${existingObservations}\n\n${newThreadSection}`;
}

/**
 * Sort thread IDs by their oldest unobserved message timestamp (ascending).
 * This ensures no thread's messages get "stuck" unobserved by processing
 * oldest-first.
 */
export function sortThreadsByOldestMessage(messagesByThread: Map<string, MastraDBMessage[]>): string[] {
  const threadOrder = Array.from(messagesByThread.entries())
    .map(([threadId, messages]) => {
      const oldestTimestamp = Math.min(
        ...messages.map(m => (m.createdAt ? new Date(m.createdAt).getTime() : Date.now())),
      );
      return { threadId, oldestTimestamp };
    })
    .sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);

  return threadOrder.map(t => t.threadId);
}

/**
 * Combine active and buffered observations into a single string.
 * When both exist, separates them with a clear marker.
 */
export function combineObservationsForBuffering(
  activeObservations: string | undefined,
  bufferedObservations: string | undefined,
): string | undefined {
  if (!activeObservations && !bufferedObservations) {
    return undefined;
  }
  if (!activeObservations) {
    return bufferedObservations;
  }
  if (!bufferedObservations) {
    return activeObservations;
  }
  return `${activeObservations}\n\n--- BUFFERED (pending activation) ---\n\n${bufferedObservations}`;
}
