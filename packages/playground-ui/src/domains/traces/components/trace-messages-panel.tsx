import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { cn } from '@/utils/cn';

export interface TraceMessagesPanelProps {
  traceId: string;
  className?: string;
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
}

/** The "Messages" view of the trace side column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({ traceId, className, onHighlightSpans }: TraceMessagesPanelProps) {
  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
    </div>
  );
}
