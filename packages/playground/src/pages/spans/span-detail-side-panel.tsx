import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useSpanDetail } from '@mastra/react/hooks/traces';
import { RouteSidePanel, useSelectedItemSidePanel } from '@/lib/route-side-panel';

export type SpanSelection = { traceId: string; spanId: string };

export interface SpanDetailSidePanelProps {
  selection: SpanSelection | undefined;
  /** Loaded spans, in list order, for the previous/next buttons. */
  spans: SpanSelection[];
  onSelect: (selection: SpanSelection) => void;
  onClose: () => void;
  /** When provided, the panel offers a "Go to trace" button that calls it. */
  onShowTrace?: (selection: SpanSelection) => void;
}

/**
 * Shows the selected span in the route side panel, next to the Studio frame.
 * Mobile keeps the drawer, since the edge drawer can't be opened programmatically.
 */
export function SpanDetailSidePanel({ selection, spans, onSelect, onClose, onShowTrace }: SpanDetailSidePanelProps) {
  const isMobile = useIsMobile();
  // Span ids are only unique within a trace, so the pair identifies the selection.
  useSelectedItemSidePanel(selection ? `${selection.traceId}:${selection.spanId}` : undefined, onClose);

  const { data, isLoading } = useSpanDetail({
    traceId: selection?.traceId,
    spanId: selection?.spanId,
    queryOptions: { enabled: !!selection },
  });

  const index = selection
    ? spans.findIndex(span => span.traceId === selection.traceId && span.spanId === selection.spanId)
    : -1;
  const previous = index > 0 ? spans[index - 1] : undefined;
  const next = index >= 0 && index < spans.length - 1 ? spans[index + 1] : undefined;

  const view = selection ? (
    <SpanDataPanelView
      traceId={selection.traceId}
      spanId={selection.spanId}
      span={data?.span}
      isLoading={isLoading}
      onPrevious={previous ? () => onSelect(previous) : undefined}
      onNext={next ? () => onSelect(next) : undefined}
      onClose={onClose}
      onShowTrace={onShowTrace}
    />
  ) : null;

  // The drawer stays mounted so it animates in and out; `selection` drives `open`.
  if (isMobile) {
    return (
      <DataPanel open={!!selection} onClose={onClose} title="Span details">
        {view}
      </DataPanel>
    );
  }
  if (!view) return null;

  return (
    <RouteSidePanel owner="span-detail">
      <DataPanel variant="inline" title="Span details">
        {view}
      </DataPanel>
    </RouteSidePanel>
  );
}
