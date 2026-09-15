import type { LightSpanRecord } from '@mastra/core/storage';
import type { SearchableSpan } from '../types';
import { flattenToSearchText } from './flatten-to-search-text';

/**
 * Attach a precomputed search haystack to each span.
 *
 * Run this once, where the span list is resolved — not per keystroke. Flattening
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
export function toSearchableSpans(spans: LightSpanRecord[]): SearchableSpan[] {
  return spans.map(span => ({
    ...span,
    // Computed from `span`, so a stale `searchText` on the input is overwritten
    // rather than carried through by the spread.
    searchText: flattenToSearchText(span).toLowerCase(),
  }));
}

/**
 * React Query `select` for the `{ traceId, spans }` payload returned by
 * `getTraceLight` and `getBranch`.
 *
 * Enriching here rather than in a component means the flattening runs once per
 * fetch and is cached with the query, so it survives the panel unmounting and
 * remounting. Keep this a module-level reference: React Query re-runs `select`
 * whenever its identity changes, and an inline arrow would re-flatten the whole
 * trace on every render.
 *
 * Deliberately not generic: TypeScript cannot infer a query's `TData` from a
 * generic function passed as `select`, and silently falls back to the unselected
 * type — which would leave `searchText` missing at the call sites.
 *
 * `null` is passed through because a query may resolve to it. `undefined` is not
 * in the signature: React Query only runs `select` once data exists.
 */
export function selectSearchableSpans(
  data: { traceId: string; spans: LightSpanRecord[] } | null,
): { traceId: string; spans: SearchableSpan[] } | null {
  if (!data) return null;

  return { ...data, spans: toSearchableSpans(data.spans) };
}
