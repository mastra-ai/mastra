import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { cn } from '@mastra/playground-ui/utils/cn';

import { Eye } from 'lucide-react';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useThreadHasOtherTraces } from '@/domains/traces/hooks/use-thread-has-other-traces';
import { Link } from '@/lib/link';

export interface TraceMessagesPanelProps {
  traceId: string;
  /** Memory thread the trace belongs to; used to decide whether a full-thread link is worth showing. */
  threadId?: string;
  className?: string;
  /** Link to the advanced thread view showing every turn of the thread. */
  fullThreadHref?: string;
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
}

/** The Messages column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({
  traceId,
  threadId,
  className,
  fullThreadHref,
  onHighlightSpans,
}: TraceMessagesPanelProps) {
  // A single-trace thread would show exactly what this column already shows.
  const hasOtherTraces = useThreadHasOtherTraces(threadId);

  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      {fullThreadHref && hasOtherTraces && (
        // Compact, same height as the tab bar it sits next to.
        <DataPanel.Header className="flex min-h-0 items-center justify-center px-2 py-1">
          <Button icon={<Eye />} as={Link} href={fullThreadHref} variant="default" size="xs">
            View full thread
          </Button>
        </DataPanel.Header>
      )}
      {/* DataPanel.Content already scrolls (`overflow-y-auto`) and pads with `p-3`, matching the span tree. */}
      <DataPanel.Content>
        <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
      </DataPanel.Content>
    </div>
  );
}
