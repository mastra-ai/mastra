import { SpanDataPanelView } from '../span-data-panel-view';
import type { SpanDataPanelViewProps } from '../span-data-panel-view';
import { useTracePanel } from './trace-panel-context';

export type TracePanelSpanDetailProps = Omit<SpanDataPanelViewProps, 'traceId' | 'spanId' | 'onClose'>;

/**
 * The open span's standard detail, closed back through the root's selection. It draws the record it is
 * given (`getSpan`); with `traceSpans` (`getTrace`), its tool calls show their results. For another
 * layout, put your own `SpanDataPanel` composition in the body's span slot, reading `useTracePanel()`.
 */
export function TracePanelSpanDetail(props: TracePanelSpanDetailProps) {
  const { traceId, selectedSpanId, selectSpan } = useTracePanel();
  if (!selectedSpanId) return null;
  return (
    <SpanDataPanelView {...props} traceId={traceId} spanId={selectedSpanId} onClose={() => selectSpan(undefined)} />
  );
}
