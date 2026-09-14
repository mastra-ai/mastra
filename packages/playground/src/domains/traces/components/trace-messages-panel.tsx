import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { cn } from '@mastra/playground-ui/utils/cn';

import { MessagesSquareIcon } from 'lucide-react';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useThreadHasOtherTraces } from '@/domains/traces/hooks/use-thread-has-other-traces';
import { Link } from '@/lib/link';

export interface TraceMessagesPanelProps {
  traceId: string;
  /** Memory thread the trace belongs to; used to decide whether a full-thread link is worth showing. */
  threadId?: string;
  className?: string;
  /** Link to the advanced thread view showing every turn of the thread. Used when `onViewFullThread` is absent. */
  fullThreadHref?: string;
  /** Opens the full thread in place. Takes precedence over `fullThreadHref`. */
  onViewFullThread?: () => void;
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
}

/** The Messages column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({
  traceId,
  threadId,
  className,
  fullThreadHref,
  onViewFullThread,
  onHighlightSpans,
}: TraceMessagesPanelProps) {
  // A single-trace thread would show exactly what this column already shows.
  const hasOtherTraces = useThreadHasOtherTraces(threadId);
  const showFullThreadAction = hasOtherTraces && (onViewFullThread || fullThreadHref);

  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* DataPanel.Content already scrolls (`overflow-y-auto`) and pads with `p-3`, matching the span tree. */}
      <DataPanel.Content>
        {/* Sits at the top of the conversation, scrolling with it; no bordered section of its own. */}
        {showFullThreadAction && (
          <div className="flex justify-center pb-3">
            {onViewFullThread ? (
              <Button icon={<MessagesSquareIcon />} variant="ghost" size="xs" onClick={onViewFullThread}>
                View full thread
              </Button>
            ) : (
              <Button icon={<MessagesSquareIcon />} as={Link} href={fullThreadHref!} variant="ghost" size="xs">
                View full thread
              </Button>
            )}
          </div>
        )}
        <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
      </DataPanel.Content>
    </div>
  );
}
