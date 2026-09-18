import type { ComponentProps } from 'react';

import { useSpanDetail } from '../../hooks/use-span-detail';
import { useTraceSpanNavigation } from '../../hooks/use-trace-span-navigation';
import { useTraceSpans } from '../../hooks/use-trace-spans';
import { SpanDataPanelView } from '../span-data-panel-view';
import { useThreadTrace } from './thread-trace-context';
import { cn } from '@/lib/utils';

export interface ThreadTraceSpanPanelProps extends Omit<ComponentProps<'div'>, 'children'> {
  panelClassName?: string;
}

/**
 * The side panel with the selected span's detail. The cell stays mounted (empty) while no span
 * is selected so the root grid can animate its column open and closed.
 */
export function ThreadTraceSpanPanel({ className, panelClassName, ...props }: ThreadTraceSpanPanelProps) {
  const { selected } = useThreadTrace();
  return (
    <div
      data-slot="thread-trace-span-panel"
      className={cn(
        'min-h-0 min-w-0 overflow-hidden',
        selected && 'animate-in pr-4 pb-4 duration-300 fade-in-0',
        className,
      )}
      {...props}
    >
      {selected && (
        // Keyed by trace only: the panel's queries already follow `spanId`, so prev/next keep the DOM.
        <SelectedSpanPanel
          key={selected.traceId}
          traceId={selected.traceId}
          spanId={selected.spanId}
          panelClassName={panelClassName}
        />
      )}
    </div>
  );
}

interface SelectedSpanPanelProps {
  traceId: string;
  spanId: string;
  panelClassName?: string;
}

function SelectedSpanPanel({ traceId, spanId, panelClassName }: SelectedSpanPanelProps) {
  const { selectSpan } = useThreadTrace();
  const onSpanSelect = (nextSpanId: string | undefined) => selectSpan(traceId, nextSpanId);
  const { data: spanDetailData, isLoading } = useSpanDetail(traceId, spanId);
  const { data: traceData } = useTraceSpans(traceId);
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(traceData?.spans, spanId, onSpanSelect);

  return (
    <SpanDataPanelView
      className={cn('h-full', panelClassName)}
      traceId={traceId}
      spanId={spanId}
      span={spanDetailData?.span}
      isLoading={isLoading}
      onClose={() => onSpanSelect(undefined)}
      onPrevious={handlePreviousSpan}
      onNext={handleNextSpan}
    />
  );
}
