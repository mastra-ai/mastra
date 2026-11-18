import type { ReactNode } from 'react';
import { Panel } from 'react-resizable-panels';

import { SpanDataPanelView } from '../span-data-panel-view';
import type { SpanDataPanelViewProps } from '../span-data-panel-view';
import { useTracePanelColumns } from './trace-panel-columns-context';
import { useTracePanel } from './trace-panel-context';
import { useScrollToFirstHighlight } from '@/hooks/use-scroll-to-first-highlight';
import { PanelSeparator } from '@/lib/resize/separator';

export interface TracePanelSpanPanelProps {
  /** Whether the column shows; defaults to whether a span is open. */
  open?: boolean;
  /** Typically a `TracePanel.SpanDetail` fed with the open span's record. */
  children: ReactNode;
}

/**
 * The resizable column after the main one, holding the open span. A match deep in a large payload sits
 * below the fold, so the first painted match is brought into view when the column opens. Render it last
 * in `TracePanel.Body`.
 */
export function TracePanelSpanPanel({ open, children }: TracePanelSpanPanelProps) {
  const { selectedSpanId, query } = useTracePanel();
  const { spanWidth } = useTracePanelColumns();
  // Scoped to this column only: the span tree must never be scrolled by this.
  const { ref: scrollToMatchRef } = useScrollToFirstHighlight<HTMLDivElement>(query, selectedSpanId);
  if (!(open ?? !!selectedSpanId)) return null;
  return (
    <>
      <PanelSeparator variant="pill" />
      <Panel
        id="trace-span"
        minSize={384}
        maxSize="50%"
        defaultSize={spanWidth()}
        groupResizeBehavior="preserve-pixel-size"
      >
        <div
          ref={scrollToMatchRef}
          data-highlight
          className="flex h-full min-h-0 animate-in flex-col border-l border-surface-rim duration-300 fade-in-0"
        >
          {children}
        </div>
      </Panel>
    </>
  );
}

export type TracePanelSpanDetailProps = Omit<SpanDataPanelViewProps, 'traceId' | 'spanId' | 'onClose'>;

/**
 * The open span's detail, closed back through the root's selection. Draws the record it is given
 * (`getSpan`); with `traceSpans` (`getTrace`), its tool calls show their results.
 */
export function TracePanelSpanDetail(props: TracePanelSpanDetailProps) {
  const { traceId, selectedSpanId, selectSpan } = useTracePanel();
  if (!selectedSpanId) return null;
  return (
    <SpanDataPanelView {...props} traceId={traceId} spanId={selectedSpanId} onClose={() => selectSpan(undefined)} />
  );
}
