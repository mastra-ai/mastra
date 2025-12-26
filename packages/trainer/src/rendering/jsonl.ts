/**
 * JSONL utilities for training data.
 */

/**
 * Convert an array of objects to JSONL format.
 */
export function toJsonl(objects: unknown[]): string {
  return objects.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Convert an array of objects to a Uint8Array JSONL buffer.
 */
export function toJsonlBuffer(objects: unknown[]): Uint8Array {
  const jsonl = toJsonl(objects);
  return new TextEncoder().encode(jsonl);
}

/**
 * Parse JSONL content into an array of objects.
 */
export function parseJsonl<T = unknown>(content: string): T[] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as T);
}

/**
 * Parse a JSONL buffer into an array of objects.
 */
export function parseJsonlBuffer<T = unknown>(buffer: Uint8Array): T[] {
  const content = new TextDecoder().decode(buffer);
  return parseJsonl<T>(content);
}

/**
 * Stream JSONL lines from a string.
 */
export function* streamJsonlLines(content: string): Generator<unknown> {
  for (const line of content.split('\n')) {
    if (line.trim()) {
      yield JSON.parse(line);
    }
  }
}
