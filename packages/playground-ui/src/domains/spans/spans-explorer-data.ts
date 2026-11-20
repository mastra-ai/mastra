import type { AggregateSpansResponse } from '@mastra/client-js';
import type { SpanRow } from '@mastra/react/hooks/traces';
import type { FilterBarField } from '@/ds/components/FilterBar';

/**
 * The data the spans explorer draws. The explorer never fetches: the host loads each piece (Studio:
 * `useSpansListQuery`, `useSpansHistogramQuery`, `useSpansFilterBarFields`; an MCP app: its own tools)
 * and passes it down.
 */

export type SpansExplorerSpans = {
  spans: readonly SpanRow[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isError: boolean;
  error?: unknown;
  /** Called when the end of the list scrolls into view and `hasNextPage` is set. */
  onLoadMore: () => void;
};

/** Span and error counts over the list's window, or nothing when the host can't aggregate it. */
export type SpansExplorerHistogramData = {
  /** The window the counts cover: the request's `timeRange`. */
  timeRange: { from: string; to: string };
  rows: AggregateSpansResponse['rows'];
  isLoading: boolean;
  isError: boolean;
  /** The previous counts stay on screen, dimmed, while the new ones load. */
  isUpdating: boolean;
};

/** The filter bar's fields, value suggestions included. */
export type SpansExplorerFilterFields = FilterBarField[];
