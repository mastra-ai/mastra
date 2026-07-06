import type { LightSpanRecord } from '@mastra/core/storage';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceTimeline } from './trace-timeline';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';

type HierarchicalSpans = ReturnType<typeof formatHierarchicalSpans>;

export interface TraceDetailsViewProps {
  traceId: string;
  /** Lightweight spans for the trace. Caller fetches via useTraceLightSpans. */
  spans: LightSpanRecord[] | undefined;
  isLoading?: boolean;
  onClose: () => void;
  /** Called when the user clicks a span in the timeline. Toggling a selected span off passes undefined. */
  onSpanSelect?: (spanId: string | undefined) => void;
  /** Fully controlled selection — the span to highlight. Pass whatever the parent's source of truth is. */
  selectedSpanId?: string | null;
}

function TraceDetailsContent({
  isLoading,
  hierarchicalSpans,
  onSpanClick,
  selectedSpanId,
  expandedSpanIds,
  setExpandedSpanIds,
}: {
  isLoading?: boolean;
  hierarchicalSpans: HierarchicalSpans;
  onSpanClick: (id: string) => void;
  selectedSpanId?: string | null;
  expandedSpanIds: string[];
  setExpandedSpanIds: Dispatch<SetStateAction<string[]>>;
}) {
  if (isLoading) {
    return <DataDetailsPanel.LoadingData>Loading trace...</DataDetailsPanel.LoadingData>;
  }
  if (hierarchicalSpans.length === 0) {
    return <DataDetailsPanel.NoData>No spans found for this trace.</DataDetailsPanel.NoData>;
  }
  return (
    <DataDetailsPanel.Content>
      <TraceTimeline
        hierarchicalSpans={hierarchicalSpans}
        onSpanClick={onSpanClick}
        selectedSpanId={selectedSpanId ?? undefined}
        expandedSpanIds={expandedSpanIds}
        setExpandedSpanIds={setExpandedSpanIds}
      />
    </DataDetailsPanel.Content>
  );
}

/**
 * Compact trace panel using `DataDetailsPanel` (popover-style). Renders the timeline only —
 * no trace header KV, no evaluate/save actions. Use this for inline trace inspection from a
 * list page (e.g. the Logs page). For the full-width trace view, use `TraceDataPanelView`.
 */
export function TraceDetailsView({
  traceId,
  spans,
  isLoading,
  onClose,
  onSpanSelect,
  selectedSpanId,
}: TraceDetailsViewProps) {
  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(spans ?? []), [spans]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const handleSpanClick = (id: string) => {
    onSpanSelect?.(selectedSpanId === id ? undefined : id);
  };

  return (
    <DataDetailsPanel>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Trace <b># {traceId}</b>
        </DataDetailsPanel.Heading>
        <DataDetailsPanel.CloseButton onClick={onClose} />
      </DataDetailsPanel.Header>

      <TraceDetailsContent
        isLoading={isLoading}
        hierarchicalSpans={hierarchicalSpans}
        onSpanClick={handleSpanClick}
        selectedSpanId={selectedSpanId}
        expandedSpanIds={expandedSpanIds}
        setExpandedSpanIds={setExpandedSpanIds}
      />
    </DataDetailsPanel>
  );
}
