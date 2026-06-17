import { useEffect, useMemo, useRef } from 'react';
import { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import { TraceDetailsView } from '@/domains/traces/components/trace-details-view';
import { useSpanDetail } from '@/domains/traces/hooks/use-span-detail';
import { useTraceLightSpans } from '@/domains/traces/hooks/use-trace-light-spans';
import { useTraceSpanNavigation } from '@/domains/traces/hooks/use-trace-span-navigation';
import { cn } from '@/lib/utils';

export interface TopicTraceDetailsPanelProps {
  traceId: string | null;
  selectedSpanId?: string | null;
  onSpanSelect?: (spanId: string | undefined) => void;
  onClose: () => void;
}

export function TopicTraceDetailsPanel({ traceId, selectedSpanId, onSpanSelect, onClose }: TopicTraceDetailsPanelProps) {
  const traceSpans = useTraceLightSpans(traceId);
  const spanDetail = useSpanDetail(traceId, selectedSpanId);
  const autoSelectedTraceIdRef = useRef<string | null>(null);
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(
    traceSpans.data?.spans,
    selectedSpanId,
    spanId => onSpanSelect?.(spanId),
  );

  const defaultSpanId = useMemo(() => {
    const spans = traceSpans.data?.spans;
    if (!spans?.length) return undefined;

    return spans.find(span => span.parentSpanId == null)?.spanId ?? spans[0]?.spanId;
  }, [traceSpans.data?.spans]);

  useEffect(() => {
    autoSelectedTraceIdRef.current = null;
  }, [traceId]);

  useEffect(() => {
    if (!traceId || !defaultSpanId || selectedSpanId || autoSelectedTraceIdRef.current === traceId) return;

    autoSelectedTraceIdRef.current = traceId;
    onSpanSelect?.(defaultSpanId);
  }, [defaultSpanId, onSpanSelect, selectedSpanId, traceId]);

  if (!traceId) return null;

  return (
    <div
      className={cn(
        'grid h-full min-h-0 overflow-auto',
        selectedSpanId ? 'grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4' : 'grid-rows-[minmax(0,1fr)]',
      )}
    >
      <TraceDetailsView
        traceId={traceId}
        spans={traceSpans.data?.spans}
        isLoading={traceSpans.isLoading}
        selectedSpanId={selectedSpanId}
        onSpanSelect={onSpanSelect}
        onClose={onClose}
      />
      {selectedSpanId ? (
        <SpanDataPanelView
          traceId={traceId}
          spanId={selectedSpanId}
          span={spanDetail.data?.span}
          isLoading={spanDetail.isLoading}
          onClose={() => onSpanSelect?.(undefined)}
          onPrevious={handlePreviousSpan}
          onNext={handleNextSpan}
        />
      ) : null}
    </div>
  );
}
