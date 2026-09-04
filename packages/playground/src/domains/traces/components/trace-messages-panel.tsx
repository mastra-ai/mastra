import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';

import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { Link } from '@/lib/link';

export interface TraceMessagesPanelProps {
  traceId: string;
  className?: string;
  /** Link to the advanced thread view showing every turn of the thread. */
  fullThreadHref?: string;
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
}

/** The "Messages" column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({ traceId, className, fullThreadHref, onHighlightSpans }: TraceMessagesPanelProps) {
  return (
    <DataPanel data-testid="messages-panel" className={cn('h-full rounded-none border-0 bg-transparent', className)}>
      <DataPanel.Header>
        <DataPanel.Heading>Messages</DataPanel.Heading>
      </DataPanel.Header>
      <DataPanel.Content>
        <div className="flex h-full min-h-0 flex-col">
          {fullThreadHref && (
            <div className="flex justify-center px-3 pt-2">
              <Button as={Link} href={fullThreadHref} variant="default" size="xs">
                View full thread
              </Button>
            </div>
          )}
          <ScrollArea className="min-h-0 flex-1">
            <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
          </ScrollArea>
        </div>
      </DataPanel.Content>
    </DataPanel>
  );
}
