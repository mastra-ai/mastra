import { useMemo } from 'react';

/**
 * Derives previous/next *trace* navigation handlers from the current traces list and the featured
 * row. Returns undefined for handlers that are out of bounds so the consumer can render
 * disabled UI. Mirrors the shape of `useTraceSpanNavigation`.
 *
 * In branches mode rows share a `traceId`, so the consumer can pass a `featuredSpanId` to
 * disambiguate the active row (and receive the new row's `spanId` on prev/next). In traces
 * mode `featuredSpanId` should be null/undefined; only the `traceId` is used.
 */
export function useTraceListNavigation<T extends { traceId: string; spanId?: string | null }>(
  traces: T[],
  featuredTraceId: string | undefined,
  featuredSpanId: string | null | undefined,
  onTraceChange: (traceId: string, spanId?: string) => void,
): {
  featuredTraceIdx: number;
  handlePreviousTrace: (() => void) | undefined;
  handleNextTrace: (() => void) | undefined;
} {
  const featuredTraceIdx = useMemo(
    () =>
      featuredTraceId
        ? traces.findIndex(
            t => t.traceId === featuredTraceId && (featuredSpanId == null || t.spanId === featuredSpanId),
          )
        : -1,
    [traces, featuredTraceId, featuredSpanId],
  );

  // Only forward a spanId on nav when the consumer indicated it's part of the row identity
  // (branches mode). In traces mode `featuredSpanId` is null, so prev/next just sets the new
  // `traceId` and the consumer's handler clears any stale spanId from the URL.
  const passSpanId = featuredSpanId != null;
  const navigateTo = (row: T) => onTraceChange(row.traceId, passSpanId ? (row.spanId ?? undefined) : undefined);

  const handlePreviousTrace = featuredTraceIdx > 0 ? () => navigateTo(traces[featuredTraceIdx - 1]) : undefined;

  const handleNextTrace =
    featuredTraceIdx >= 0 && featuredTraceIdx < traces.length - 1
      ? () => navigateTo(traces[featuredTraceIdx + 1])
      : undefined;

  return { featuredTraceIdx, handlePreviousTrace, handleNextTrace };
}
