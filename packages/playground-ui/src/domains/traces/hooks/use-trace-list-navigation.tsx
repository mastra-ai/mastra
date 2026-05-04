import { useMemo } from 'react';

/**
 * Derives previous/next *trace* navigation handlers from the current traces list and the featured
 * trace id. Returns undefined for handlers that are out of bounds so the consumer can render
 * disabled UI. Mirrors the shape of `useTraceSpanNavigation`.
 */
export function useTraceListNavigation<T extends { traceId: string }>(
  traces: T[],
  featuredTraceId: string | undefined,
  onTraceChange: (traceId: string) => void,
): {
  featuredTraceIdx: number;
  handlePreviousTrace: (() => void) | undefined;
  handleNextTrace: (() => void) | undefined;
} {
  const featuredTraceIdx = useMemo(
    () => (featuredTraceId ? traces.findIndex(t => t.traceId === featuredTraceId) : -1),
    [traces, featuredTraceId],
  );

  const handlePreviousTrace =
    featuredTraceIdx > 0 ? () => onTraceChange(traces[featuredTraceIdx - 1].traceId) : undefined;

  const handleNextTrace =
    featuredTraceIdx >= 0 && featuredTraceIdx < traces.length - 1
      ? () => onTraceChange(traces[featuredTraceIdx + 1].traceId)
      : undefined;

  return { featuredTraceIdx, handlePreviousTrace, handleNextTrace };
}
