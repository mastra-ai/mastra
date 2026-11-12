/** Live shell output kept for display, in string code units. Matches the controller's display state. */
export const MAX_DISPLAYED_SHELL_OUTPUT = 1024 * 1024;

/**
 * Appends `chunk` to `existing`, keeping only the last `limit` code units. Slices before
 * concatenating so an oversized chunk never builds an even larger intermediate string.
 */
export function appendBoundedOutput(existing: string, chunk: string, limit = MAX_DISPLAYED_SHELL_OUTPUT): string {
  if (chunk.length >= limit) return copyTail(chunk, limit);
  return existing.slice(-(limit - chunk.length)) + chunk;
}

/**
 * Returns the last `length` code units as an independent string. A plain `slice` can share the
 * parent's memory, which would keep an oversized chunk alive after it has been trimmed.
 */
function copyTail(text: string, length: number): string {
  return JSON.parse(JSON.stringify(text.slice(-length))) as string;
}
