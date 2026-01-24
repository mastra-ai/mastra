import type { ObservabilityEvent } from './types.js';

/**
 * Serializes observability events to JSONL format.
 *
 * JSONL (JSON Lines) format:
 * - One JSON object per line
 * - Each line is a complete, valid JSON object
 * - Lines are separated by newline characters (\n)
 * - Easy to stream and parse incrementally
 */

/**
 * Serialize a single event to a JSON line (without trailing newline)
 */
export function serializeEvent(event: ObservabilityEvent): string {
  return JSON.stringify(event);
}

/**
 * Serialize multiple events to JSONL format
 * Returns a string with each event on its own line, ending with a newline
 */
export function serializeEvents(events: ObservabilityEvent[]): string {
  if (events.length === 0) {
    return '';
  }

  return events.map(serializeEvent).join('\n') + '\n';
}

/**
 * Estimate the serialized size of an event in bytes
 * Used for buffer size tracking without full serialization
 */
export function estimateEventSize(event: ObservabilityEvent): number {
  // Use JSON.stringify for accurate estimation
  // Add 1 for the newline character
  return Buffer.byteLength(JSON.stringify(event), 'utf8') + 1;
}

/**
 * Serialize events to a Buffer for binary writing
 */
export function serializeEventsToBuffer(events: ObservabilityEvent[]): Buffer {
  return Buffer.from(serializeEvents(events), 'utf8');
}

/**
 * Parse JSONL content back to events (for testing/validation)
 */
export function parseJsonl<T = ObservabilityEvent>(content: string): T[] {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  return lines.map(line => JSON.parse(line) as T);
}
