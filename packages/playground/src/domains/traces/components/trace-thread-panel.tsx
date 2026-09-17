import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { ArrowLeftIcon } from 'lucide-react';

import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';

export interface TraceThreadPanelProps {
  threadId: string;
  /** Return to the trace panel this thread view replaced. */
  onBack: () => void;
  /** Close the whole side panel. */
  onClose: () => void;
  /** Accessible drawer name; defaults to the thread id. */
  title?: string;
  className?: string;
}

/** The trace drawer swapped for the full thread: every turn as traces, anchored on the URL's `traceId`. */
export function TraceThreadPanel({ threadId, onBack, onClose, title, className }: TraceThreadPanelProps) {
  return (
    <DataPanel open onClose={onClose} title={title ?? `Thread ${threadId}`} size="full" className={className}>
      <DataPanel.Header>
        <Button size="md" variant="ghost" onClick={onBack} aria-label="Back to trace" tooltip="Back to trace">
          <ArrowLeftIcon />
        </Button>
        <DataPanel.Heading className="min-w-0 items-center">
          Thread <b className="truncate">{threadId}</b>
        </DataPanel.Heading>
        <DataPanel.CloseButton onClick={onClose} className="ml-auto shrink-0" />
      </DataPanel.Header>
      {/* Inside the framed panel the turns' details columns read as one strip: no top rounding, no horizontal borders. */}
      <div className="min-h-0 flex-1 [&_[data-slot=thread-trace-details]]:rounded-t-none [&_[data-slot=thread-trace-details]]:border-y-0">
        <ThreadViewByTrace threadId={threadId} />
      </div>
    </DataPanel>
  );
}
