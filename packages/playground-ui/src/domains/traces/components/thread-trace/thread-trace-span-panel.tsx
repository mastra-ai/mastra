import { useSpanDetail, useTraceSpans } from '@mastra/react/hooks';
import type { ComponentProps } from 'react';
import { Panel } from 'react-resizable-panels';

import { useTraceSpanNavigation } from '../../hooks/use-trace-span-navigation';
import { SpanDataPanelView } from '../span-data-panel-view';
import { useThreadTrace } from './thread-trace-context';
import { PanelSeparator } from '@/lib/resize/separator';
import { cn } from '@/lib/utils';

export interface ThreadTraceSpanPanelProps extends Omit<ComponentProps<'div'>, 'children'> {
  panelClassName?: string;
}

/**
 * The resizable side column with the selected span's detail; rendered only while a
 * span is selected.
 */
export function ThreadTraceSpanPanel({ className, panelClassName, ...props }: ThreadTraceSpanPanelProps) {
  const { selected } = useThreadTrace();
  if (!selected) return null;
  return (
    <>
      <PanelSeparator variant="pill" />
      <Panel id="thread-trace-span" minSize={320} defaultSize="35%" maxSize="50%">
        <div
          data-slot="thread-trace-span-panel"
          className={cn(
            // Same chrome as the span column of the trace panel: flush to the edge, divided by a left border.
            'flex h-full min-h-0 min-w-0 animate-in flex-col overflow-hidden border-l border-border duration-300 fade-in-0',
            className,
          )}
          {...props}
        >
          {/* Keyed by trace only: the panel's queries already follow `spanId`, so prev/next keep the DOM. */}
          <SelectedSpanPanel
            key={selected.traceId}
            traceId={selected.traceId}
            spanId={selected.spanId}
            panelClassName={panelClassName}
          />
        </div>
      </Panel>
    </>
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
  const { data: spanDetailData, isLoading } = useSpanDetail({
    traceId: traceId,
    spanId: spanId,
    queryOptions: { enabled: !!traceId && !!spanId },
  });
  const { data: traceData } = useTraceSpans({ traceId: traceId, queryOptions: { enabled: !!traceId } });
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(traceData?.spans, spanId, onSpanSelect);

  return (
    <SpanDataPanelView
      className={panelClassName}
      traceId={traceId}
      spanId={spanId}
      span={spanDetailData?.span}
      isLoading={isLoading}
      onPrevious={handlePreviousSpan}
      onNext={handleNextSpan}
      onClose={() => selectSpan(traceId, undefined)}
    />
  );
}
