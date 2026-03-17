// Regex that captures the ISO 8601 date from each message boundary delimiter
const BOUNDARY_WITH_DATE_RE =
  /\n{2,}--- message boundary \((\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\) ---\n{2,}/;

/**
 * Given a raw `activeObservations` string (from an `ObservationalMemoryRecord`),
 * return only the observation text that would have been visible at `asOf`.
 *
 * Each chunk boundary contains the `lastObservedAt` timestamp of the messages
 * that were observed to produce the chunk that follows it. A chunk is included
 * when its boundary date is ≤ `asOf` (meaning those observations existed before
 * or at the target moment). The very first chunk has no preceding boundary and
 * is always included.
 *
 * @param activeObservations - The full `activeObservations` string from the OM record
 * @param asOf - The point in time to query (e.g. a message's `createdAt`)
 * @returns The filtered observations string, or an empty string if none match
 */
export function getObservationsAsOf(activeObservations: string, asOf: Date): string {
  const trimmed = activeObservations.trim();
  if (!trimmed) return '';

  // Split while keeping the delimiter (with captured date) interleaved
  const parts = trimmed.split(BOUNDARY_WITH_DATE_RE);

  // parts is: [chunk0, date1, chunk1, date2, chunk2, ...]
  // chunk0 has no boundary date — always included
  const chunks: string[] = [];
  const firstChunk = parts[0]?.trim();
  if (firstChunk) {
    chunks.push(firstChunk);
  }

  for (let i = 1; i < parts.length; i += 2) {
    const dateStr = parts[i]!;
    const chunk = parts[i + 1]?.trim();
    if (!chunk) continue;

    const boundaryDate = new Date(dateStr);
    if (isNaN(boundaryDate.getTime())) continue;

    if (boundaryDate <= asOf) {
      chunks.push(chunk);
    }
  }

  return chunks.join('\n\n');
}
