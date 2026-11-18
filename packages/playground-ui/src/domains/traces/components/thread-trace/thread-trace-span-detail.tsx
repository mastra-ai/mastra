import type { ReactNode } from 'react';
import type { SpanRecord, TraceSpanRecord } from '../../types';
import { SpanDataPanelView } from '../span-data-panel-view';
import type { RegisteredTools } from '../span-payload/span-tools-section';
import type { TraceToolCallsProps } from '../trace-tool-calls';
import { useThreadTrace } from './thread-trace-context';

export interface ThreadTraceSpanDetailProps extends TraceToolCallsProps {
  /** Full record of the selected span (`getSpan`); the host loads it for `useThreadTrace().selected`. */
  span?: SpanRecord;
  isLoading?: boolean;
  /** Every span of the selected span's trace (`getTrace`), so its tool calls show their results. */
  traceSpans?: TraceSpanRecord[];
  /** The tool registry (`listTools`), so offered tools link to their pages. */
  registeredTools?: RegisteredTools;
  /** Replaces the Input tab (Studio: `LiveSpanInput`). */
  input?: ReactNode;
  /** Replaces the Output tab (Studio: `LiveSpanOutput`). */
  output?: ReactNode;
  className?: string;
}

/**
 * The open span's standard detail, closed back through the root's selection. Draws the record it is given;
 * for another layout, put your own `SpanDataPanel` composition in the root's `spanDetail` slot.
 */
export function ThreadTraceSpanDetail({
  span,
  isLoading,
  traceSpans,
  registeredTools,
  mcpAppTools,
  renderToolCall,
  input,
  output,
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
      mcpAppTools={mcpAppTools}
      renderToolCall={renderToolCall}
      input={input}
      output={output}
      onClose={() => selectSpan(selected.traceId, undefined)}
    />
  );
}
