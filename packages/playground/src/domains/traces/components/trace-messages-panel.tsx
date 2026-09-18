import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
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

/** The Messages column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({
  traceId,
  threadId,
  className,
  onViewFullThread,
  onHighlightSpans,
}: TraceMessagesPanelProps) {
  // A single-trace thread would show exactly what this column already shows.
  const hasOtherTraces = useThreadHasOtherTraces(threadId);
  const showFullThreadAction = hasOtherTraces && Boolean(onViewFullThread);

  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Same chrome as the Span column header, so the two side columns line up. */}
      <DataPanel.Header>
        <DataPanel.HeaderContent>
          <DataPanel.Heading>Messages</DataPanel.Heading>
        </DataPanel.HeaderContent>
        {showFullThreadAction && (
          <DataPanel.HeaderActions>
            <Button icon={<MessagesSquareIcon />} variant="ghost" size="sm" onClick={onViewFullThread}>
              Open full thread
            </Button>
          </DataPanel.HeaderActions>
        )}
      </DataPanel.Header>
      {/* The turn view brings its own `p-4`; no extra content padding so the top gap equals the side gap. */}
      <DataPanel.Content className="p-0">
        <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
      </DataPanel.Content>
    </div>
  );
}
