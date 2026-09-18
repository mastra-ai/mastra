import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';

import { MessagesSquareIcon } from 'lucide-react';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useThreadHasOtherTraces } from '@/domains/traces/hooks/use-thread-has-other-traces';

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

export interface TraceMessagesPanelActionsProps {
  /** Memory thread the trace belongs to; used to decide whether a full-thread action is worth showing. */
  threadId?: string;
  /** Opens the full thread in place. */
  onViewFullThread?: () => void;
}

/** Header action for the "Messages" view: opens the whole thread when there is more of it to see. */
export function TraceMessagesPanelActions({ threadId, onViewFullThread }: TraceMessagesPanelActionsProps) {
  // A single-trace thread would show exactly what the column already shows.
  const hasOtherTraces = useThreadHasOtherTraces(threadId);
  if (!hasOtherTraces || !onViewFullThread) return null;

  return (
    <Button icon={<MessagesSquareIcon />} variant="ghost" size="sm" onClick={onViewFullThread}>
      Open full thread
    </Button>
  );
}
