import { DataDetailsPanel } from '@mastra/playground-ui';
import { useEffect, useMemo, useState } from 'react';

import { formatHierarchicalSpans } from './trace/format-hierarchical-spans';
import { getAllSpanIds } from './trace/get-descendant-ids';
import { TraceTimeline } from './trace/trace-timeline';
import { useTraceLightSpans } from '@/domains/traces/hooks/use-trace-light-spans';

export interface TraceDetailsProps {
  traceId: string;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  initialSpanId?: string | null;
}

export function TraceDetails({ traceId, onClose, onSpanSelect, initialSpanId }: TraceDetailsProps) {
  const { data: traceLight, isLoading } = useTraceLightSpans(traceId);
  const spans = traceLight?.spans;
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId ?? undefined);

  // Sync selected span when initialSpanId or trace data changes
  useEffect(() => {
    if (initialSpanId && spans) {
      const found = spans.find(s => s.spanId === initialSpanId);
      if (found) {
        setSelectedSpanId(initialSpanId);
        onSpanSelect?.(initialSpanId);
        return;
      }
    }
    // Clear stale selection when initialSpanId is null/missing or span not found
    setSelectedSpanId(undefined);
    onSpanSelect?.(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpanId, spans]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(spans ?? []), [spans]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const handleSpanClick = (id: string) => {
    const newId = selectedSpanId === id ? undefined : id;
    setSelectedSpanId(newId);
    onSpanSelect?.(newId);
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
