import type { SpanRecord } from '@mastra/core/storage';
import { DataDetailsPanel } from '@mastra/playground-ui';
import { useEffect, useMemo, useState } from 'react';
import { useTraceSpans } from '../hooks/use-trace-spans';
import { formatHierarchicalSpans } from './trace/format-hierarchical-spans';
import { getAllSpanIds } from './trace/get-descendant-ids';
import { TraceTimeline } from './trace/trace-timeline';

export interface TraceDetailsProps {
  traceId: string;
  onClose: () => void;
  onSpanSelect?: (span: SpanRecord | undefined) => void;
  initialSpanId?: string | null;
}

export function TraceDetails({ traceId, onClose, onSpanSelect, initialSpanId }: TraceDetailsProps) {
  const { data: traceData, isLoading } = useTraceSpans(traceId);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId ?? undefined);

  // Sync selected span when initialSpanId or trace data changes
  useEffect(() => {
    if (initialSpanId && traceData?.spans) {
      const span = traceData.spans.find(s => s.spanId === initialSpanId);
      if (span) {
        setSelectedSpanId(initialSpanId);
        onSpanSelect?.(span);
        return;
      }
    }
    // Clear stale selection when initialSpanId is null/missing or span not found
    setSelectedSpanId(undefined);
    onSpanSelect?.(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpanId, traceData?.spans]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(traceData?.spans ?? []), [traceData?.spans]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const handleSpanClick = (id: string) => {
    const newId = selectedSpanId === id ? undefined : id;
    setSelectedSpanId(newId);
    const span = newId ? traceData?.spans?.find(s => s.spanId === newId) : undefined;
    onSpanSelect?.(span);
  };

  return (
    <DataDetailsPanel>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Trace <b># {traceId}</b>
        </DataDetailsPanel.Heading>
        <DataDetailsPanel.CloseButton onClick={onClose} />
      </DataDetailsPanel.Header>

      {isLoading ? (
        <DataDetailsPanel.LoadingData>Loading trace...</DataDetailsPanel.LoadingData>
      ) : hierarchicalSpans.length === 0 ? (
        <DataDetailsPanel.NoData>No spans found for this trace.</DataDetailsPanel.NoData>
      ) : (
        <DataDetailsPanel.Content>
          <TraceTimeline
            hierarchicalSpans={hierarchicalSpans}
            onSpanClick={handleSpanClick}
            selectedSpanId={selectedSpanId}
            expandedSpanIds={expandedSpanIds}
            setExpandedSpanIds={setExpandedSpanIds}
          />
        </DataDetailsPanel.Content>
      )}
    </DataDetailsPanel>
  );
}
