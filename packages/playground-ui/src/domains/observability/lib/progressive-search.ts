type Range = { from: string; to: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The longest range one progressive request searches; wider word searches load in chunks of this size. */
export const PROGRESSIVE_CHUNK_MS = 7 * DAY_MS;

/** A word search over this range loads in chunks (and so shows progress) when the server searches progressively. */
export const searchesInChunks = (range: Range) => Date.parse(range.to) - Date.parse(range.from) > PROGRESSIVE_CHUNK_MS;

const days = (ms: number) => Math.max(1, Math.round(ms / DAY_MS));
const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

export type SearchProgressState = {
  /** The range the user asked for. */
  requestedRange: Range;
  /** The part searched so far, from the latest response. */
  searchedRange: Range | undefined;
  /** More of the range is left to search. */
  searching: boolean;
  stopped: boolean;
  /** The latest chunk failed; what loaded before it stays. */
  failed?: boolean;
};

/**
 * "Searched the last 14 of 30 days…", "Stopped after the last 14 of 30 days.", "Couldn't search past the last 14 of
 * 30 days." or "Searched all 30 days.".
 * Newest-first searches cover the end of the range first ("last"); oldest-first ones the start ("first").
 */
export function searchProgressText({
  requestedRange,
  searchedRange,
  searching,
  stopped,
  failed,
}: SearchProgressState): string {
  const total = days(Date.parse(requestedRange.to) - Date.parse(requestedRange.from));
  if (!searching) return `Searched all ${plural(total)}.`;
  if (!searchedRange) return `Searching ${plural(total)}…`;
  const done = Math.min(total, days(Date.parse(searchedRange.to) - Date.parse(searchedRange.from)));
  const end = searchedRange.to === requestedRange.to ? 'last' : 'first';
  const part = `the ${end} ${done} of ${total} days`;
  if (failed) return `Couldn't search past ${part}.`;
  return stopped ? `Stopped after ${part}.` : `Searched ${part}…`;
}

/** Whether a query predicate contains a word search (`hasAllTokens`), the only filter the server searches in chunks. */
export const hasWordSearch = (where: unknown) =>
  where !== undefined && JSON.stringify(where).includes('"op":"hasAllTokens"');

/** Under a histogram whose word search the server can't chunk (`mergeable: false`): it charts the newest chunk only. */
export const CAPPED_CHART_NOTE = 'The chart covers the last 7 days of this search.';
