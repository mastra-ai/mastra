import { useDeferredValue, useMemo, useState } from 'react';
import type { LightSpanRecord } from '../types';
import { filterSpansKeepingAncestors, toSearchableSpans } from '../utils';

export interface UseTraceSearchResult<Span extends LightSpanRecord = LightSpanRecord> {
  /** The immediate, user-facing input value. Bind this to the search field. */
  query: string;
  setQuery: (query: string) => void;
  /** Rows matching the deferred query. An empty query returns the input array reference. */
  results: Span[];
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
 * Matching is a substring test against a lowercased haystack built once per `spans` array
 * (see `toSearchableSpans`). That is what makes the open-ended `metadata` and `error`
 * payloads searchable: their shapes are unknown, so no fixed list of fields can read them.
 *
 * The haystack lives here, not in the data hooks, so only a mounted search surface pays for
 * flattening. Views that merely render spans (e.g. the thread view, which shows every trace
 * of a thread at once) never build it.
 *
 * Filtering is keyed on a deferred copy of the query, so typing stays responsive while a
 * large list re-filters at lower priority — bind the input to `query`, not to the deferred
 * value. A matching span keeps its ancestors and its whole subtree, so the hierarchy stays
 * intact.
 *
 * `spans` is required. Resolving the loading/empty state is the caller's job — a component
 * holding a query result passes `data?.spans ?? []`.
 */
export function useTraceSearch<Span extends LightSpanRecord>(spans: Span[]): UseTraceSearchResult<Span> {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const searchTextById = useMemo(
    () => new Map(toSearchableSpans(spans).map(span => [span.spanId, span.searchText])),
    [spans],
  );

  const { results, payloadOnlyMatchIds } = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return { results: spans, payloadOnlyMatchIds: new Set<string>() };

    const payloadOnly = new Set<string>();
    const filtered = filterSpansKeepingAncestors(spans, span => {
      if (!searchTextById.get(span.spanId)?.includes(term)) return false;
      // The name is the only part of a span the timeline paints, so a match it doesn't
      // contain came from the payload.
      if (!span.name.toLowerCase().includes(term)) payloadOnly.add(span.spanId);
      return true;
    });

    return { results: filtered, payloadOnlyMatchIds: payloadOnly };
  }, [spans, searchTextById, deferredQuery]);

  return { query, setQuery, results, payloadOnlyMatchIds, isPending: query !== deferredQuery };
}
