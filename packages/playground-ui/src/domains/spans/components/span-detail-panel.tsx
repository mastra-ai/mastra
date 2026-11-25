import { useSpanDetail } from '@mastra/react/hooks/traces';
import { LiveSpanInput, LiveSpanOutput } from '../../traces/components/live-parts';
import { SpanDataPanelView } from '../../traces/components/span-data-panel-view';
import { useStudioTraceNavigation } from '@/domains/traces/hooks/use-studio-trace-navigation';

export type SpanSelection = { traceId: string; spanId: string };

export interface SpanDetailPanelProps {
  selection: SpanSelection;
  /** Loaded spans, in list order, for the previous/next buttons. */
  spans: SpanSelection[];
  onSelect: (selection: SpanSelection) => void;
  onClose?: () => void;
  /** When provided, the panel offers a "Go to trace" button that calls it. */
  onShowTrace?: (selection: SpanSelection) => void;
}

/** The selected span's details, with previous/next over `spans`. Hosts wrap it in their own drawer or side panel. */
export function SpanDetailPanel({ selection, spans, onSelect, onClose, onShowTrace }: SpanDetailPanelProps) {
  const { data, isLoading } = useSpanDetail({ traceId: selection.traceId, spanId: selection.spanId });
  const navigation = useStudioTraceNavigation();

  const index = spans.findIndex(span => span.traceId === selection.traceId && span.spanId === selection.spanId);
  const previous = index > 0 ? spans[index - 1] : undefined;
  const next = index >= 0 && index < spans.length - 1 ? spans[index + 1] : undefined;

  return (
    <SpanDataPanelView
      traceId={selection.traceId}
      spanId={selection.spanId}
      span={data?.span}
      isLoading={isLoading}
      // Each tab loads what it draws when it opens: the tool registry, the trace's spans, the live tool cards.
      input={<LiveSpanInput />}
      output={<LiveSpanOutput />}
      navigation={navigation}
      onPrevious={previous ? () => onSelect(previous) : undefined}
      onNext={next ? () => onSelect(next) : undefined}
      onClose={onClose}
      onShowTrace={onShowTrace}
    />
  );
}
