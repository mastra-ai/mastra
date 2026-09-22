import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';

import { MessagesSquareIcon } from 'lucide-react';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useThreadHasOtherTraces } from '@/domains/traces/hooks/use-thread-has-other-traces';

export interface TraceMessagesPanelProps {
  traceId: string;
  /** Memory thread the trace belongs to; used to decide whether a full-thread action is worth showing. */
  threadId?: string;
  className?: string;
  /** Opens the full thread in place. */
  onViewFullThread?: () => void;
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
}

/**
 * The "Messages" view of the trace side column: the trace rendered as one
 * reconstructed agent turn, with an "Open full thread" entry point at the top of
 * the conversation when the thread has more turns than this one.
 */
export function TraceMessagesPanel({
  traceId,
  threadId,
  className,
  onViewFullThread,
  onHighlightSpans,
}: TraceMessagesPanelProps) {
  // A single-trace thread would show exactly what the column already shows.
  const hasOtherTraces = useThreadHasOtherTraces(threadId);
  const showFullThreadAction = hasOtherTraces && !!onViewFullThread;

  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      {showFullThreadAction && (
        <div className="flex justify-center px-4 pt-4">
          <Button icon={<MessagesSquareIcon />} variant="ghost" size="sm" onClick={onViewFullThread}>
            Open full thread
          </Button>
        </div>
      )}
      <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
    </div>
  );
}
