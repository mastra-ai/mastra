import type { LightSpanRecord } from '@mastra/core/storage';
import { useDeferredValue, useMemo, useState } from 'react';
import { filterSpansKeepingAncestors } from '../utils';

export interface UseTraceSearchResult {
  /** The immediate, user-facing input value. Bind this to the search field. */
  query: string;
  setQuery: (query: string) => void;
  /** Rows matching the deferred query. An empty query returns the input array reference. */
  results: LightSpanRecord[];
  /** True while the deferred value is behind `query` (the list is still catching up). */
  isPending: boolean;
}

/** Light-span fields a search term is matched against, case-insensitively. */
function matchesTerm(span: LightSpanRecord, term: string): boolean {
  const fields = [span.name, span.spanType, span.entityName, span.inputPreview, span.traceId, span.spanId];
  return fields.some(field => typeof field === 'string' && field.toLowerCase().includes(term));
}

/**
 * Client-side search over a flat light span list (the rows returned by `useTraces`).
 *
 * Filtering is keyed on a deferred copy of the query, so typing stays responsive while a
 * large list re-filters at lower priority — bind the input to `query`, not to the deferred
 * value. Ancestors of a matching span are kept so the hierarchy stays intact.
 *
 * `spans` is required. Resolving the loading/empty state is the caller's job — a component
 * holding a query result passes `data?.spans ?? []`.
 */
export function useTraceSearch(spans: LightSpanRecord[]): UseTraceSearchResult {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return spans;
    return filterSpansKeepingAncestors(spans, span => matchesTerm(span, term));
  }, [spans, deferredQuery]);

  return { query, setQuery, results, isPending: query !== deferredQuery };
}
