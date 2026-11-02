import { useSpanDetail, useTraceSpans } from '@mastra/react/hooks/traces';
import { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import { TraceDetailsView } from '@/domains/traces/components/trace-details-view';
import { cn } from '@/lib/utils';

export interface TopicTraceDetailsPanelProps {
  traceId: string | null;
  selectedSpanId?: string | null;
  onSpanSelect?: (spanId: string | undefined) => void;
  onClose: () => void;
}

export function TopicTraceDetailsPanel({
  traceId,
  selectedSpanId,
  onSpanSelect,
  onClose,
}: TopicTraceDetailsPanelProps) {
  const traceSpans = useTraceSpans({ traceId: traceId, queryOptions: { enabled: !!traceId } });
  const spanDetail = useSpanDetail({
    traceId: traceId,
    spanId: selectedSpanId,
    queryOptions: { enabled: !!traceId && !!selectedSpanId },
  });

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
          onClose={onSpanSelect ? () => onSpanSelect(undefined) : undefined}
        />
      ) : null}
    </div>
  );
}
