import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { SpanDetailPanel } from '@mastra/playground-ui/domains/spans/components/span-detail-panel';
import type { SpanSelection } from '@mastra/playground-ui/domains/spans/components/span-detail-panel';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { RouteSidePanel, useSelectedItemSidePanel } from '@/lib/route-side-panel';

export type { SpanSelection };

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

  const view = selection ? (
    <SpanDetailPanel
      selection={selection}
      spans={spans}
      onSelect={onSelect}
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
