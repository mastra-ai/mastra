import { useDeferredValue, useMemo, useState } from 'react';
import type { SearchableSpan } from '../types';
import { filterSpansKeepingAncestors } from '../utils';

export interface UseTraceSearchResult {
  /** The immediate, user-facing input value. Bind this to the search field. */
  query: string;
  setQuery: (query: string) => void;
  /** Rows matching the deferred query. An empty query returns the input array reference. */
  results: SearchableSpan[];
  /**
   * Spans that matched somewhere other than their name — in `metadata`, `attributes` or
   * `error`. Their row shows no visible occurrence of the term, so the surface needs to say
   * why it is there. Ancestors kept only to preserve the hierarchy are not in here: they did
   * not match at all. Empty while the query is empty.
   */
  payloadOnlyMatchIds: Set<string>;
  /** True while the deferred value is behind `query` (the list is still catching up). */
  isPending: boolean;
}

/**
 * Client-side search over a flat span list.
 *
 * Matching is a substring test against `searchText`, the haystack built once per span when
 * the query resolved (see `toSearchableSpans`). That is what makes the open-ended `metadata`
 * and `error` payloads searchable: their shapes are unknown, so no fixed list of fields can
 * read them. Both sides are already lowercased, so the test is a bare `includes`.
 *
 * Filtering is keyed on a deferred copy of the query, so typing stays responsive while a
 * large list re-filters at lower priority — bind the input to `query`, not to the deferred
 * value. A matching span keeps its ancestors and its whole subtree, so the hierarchy stays
 * intact.
 *
 * `spans` is required. Resolving the loading/empty state is the caller's job — a component
 * holding a query result passes `data?.spans ?? []`.
 */
export function useTraceSearch(spans: SearchableSpan[]): UseTraceSearchResult {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const { results, payloadOnlyMatchIds } = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return { results: spans, payloadOnlyMatchIds: new Set<string>() };

    const payloadOnly = new Set<string>();
    const filtered = filterSpansKeepingAncestors(spans, span => {
      if (!span.searchText.includes(term)) return false;
      // The name is the only part of a span the timeline paints, so a match it doesn't
      // contain came from the payload.
      if (!span.name.toLowerCase().includes(term)) payloadOnly.add(span.spanId);
      return true;
    });

    return { results: filtered, payloadOnlyMatchIds: payloadOnly };
  }, [spans, deferredQuery]);

  return { query, setQuery, results, payloadOnlyMatchIds, isPending: query !== deferredQuery };
}
