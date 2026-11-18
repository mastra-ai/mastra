import type { ComponentProps } from 'react';
import { Panel } from 'react-resizable-panels';

import type { SpanRecord, TraceSpanRecord } from '../../types';
import { SpanDataPanelView } from '../span-data-panel-view';
import type { RegisteredTools } from '../span-payload/span-tools-section';
import { useThreadTrace } from './thread-trace-context';
import { PanelSeparator } from '@/lib/resize/separator';
import { cn } from '@/lib/utils';

export type ThreadTraceSpanPanelProps = ComponentProps<'div'>;

/**
 * The resizable side column of the selected span; rendered only while a span is selected. Its children
 * are typically a `ThreadTrace.SpanDetail` fed with the selected span's record.
 */
export function ThreadTraceSpanPanel({ className, children, ...props }: ThreadTraceSpanPanelProps) {
  const { selected } = useThreadTrace();
  if (!selected) return null;
  return (
    <>
      <PanelSeparator variant="pill" />
      <Panel id="thread-trace-span" minSize={384} defaultSize="35%" maxSize="50%">
        <div
          data-slot="thread-trace-span-panel"
          className={cn(
            // Same chrome as the span column of the trace panel: flush to the edge, divided by a left border.
            'flex h-full min-h-0 min-w-0 animate-in flex-col overflow-hidden border-l border-border duration-300 fade-in-0',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </Panel>
    </>
  );
}

export interface ThreadTraceSpanDetailProps {
  /** Full record of the selected span (`getSpan`); the host loads it for `useThreadTrace().selected`. */
  span?: SpanRecord;
  isLoading?: boolean;
  /** Every span of the selected span's trace (`getTrace`), so its tool calls show their results. */
  traceSpans?: TraceSpanRecord[];
  /** The tool registry (`listTools`), so offered tools link to their pages. */
  registeredTools?: RegisteredTools;
  className?: string;
}

/** The selected span's detail, closed back through the root's selection. Draws the record it is given. */
export function ThreadTraceSpanDetail({
  span,
  isLoading,
  traceSpans,
  registeredTools,
  className,
}: ThreadTraceSpanDetailProps) {
  const { selected, selectSpan } = useThreadTrace();
  if (!selected) return null;
  return (
    <SpanDataPanelView
      // Keyed by trace only: stepping between spans of a trace keeps the panel's tab and view.
      key={selected.traceId}
      className={className}
      traceId={selected.traceId}
      spanId={selected.spanId}
      span={span}
      isLoading={isLoading}
      traceSpans={traceSpans}
      registeredTools={registeredTools}
      onClose={() => selectSpan(selected.traceId, undefined)}
    />
  );
}
