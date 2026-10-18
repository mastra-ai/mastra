import type { LightSpanRecord } from '../types';
import { flattenToSearchText } from './flatten-to-search-text';

/**
 * Attach a precomputed search haystack to each span.
 *
 * Run this once per span list — not per keystroke. Flattening
 * walks every nested payload, so doing it inside a filter would repeat the whole
 * walk for every character typed.
 *
 * The whole record is flattened, which is what reaches `metadata` and `error`:
 * their shapes are open-ended, so no fixed list of fields can read them. The
 * text is lowercased here so matching is a bare `includes` with no per-span
 * `toLowerCase` on every keystroke.
 *
 * Inputs are left untouched; each result is a new object.
 */
export function toSearchableSpans<Span extends LightSpanRecord>(spans: Span[]): Array<Span & { searchText: string }> {
  return spans.map(span => ({
    ...span,
    // Computed from `span`, so a stale `searchText` on the input is overwritten
    // rather than carried through by the spread.
    searchText: flattenToSearchText(span).toLowerCase(),
  }));
}
