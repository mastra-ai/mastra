import type { LightSpanRecord } from '@mastra/core/storage';
import { useMemo } from 'react';
import { formatHierarchicalSpans } from '../components/format-hierarchical-spans';
import { getAllSpanIds } from './get-all-span-ids';

/**
 * Derives previous/next span navigation handlers from a trace's lightweight spans.
 * Returns undefined for handlers that are out of bounds so the consumer can render disabled UI.
 */
export function useTraceSpanNavigation(
  lightSpans: LightSpanRecord[] | undefined,
  featuredSpanId: string | null | undefined,
  onSpanChange: (spanId: string) => void,
) {
  const timelineSpanIds = useMemo(() => getAllSpanIds(formatHierarchicalSpans(lightSpans ?? [])), [lightSpans]);

  const featuredSpanIdx = featuredSpanId ? timelineSpanIds.indexOf(featuredSpanId) : -1;

  const handlePreviousSpan =
    featuredSpanIdx > 0
      ? () => {
          const spanId = timelineSpanIds[featuredSpanIdx - 1];
          if (spanId !== undefined) onSpanChange(spanId);
        }
      : undefined;

  const handleNextSpan =
    featuredSpanIdx >= 0 && featuredSpanIdx < timelineSpanIds.length - 1
      ? () => {
          const spanId = timelineSpanIds[featuredSpanIdx + 1];
          if (spanId !== undefined) onSpanChange(spanId);
        }
      : undefined;

  return { handlePreviousSpan, handleNextSpan, timelineSpanIds };
}
