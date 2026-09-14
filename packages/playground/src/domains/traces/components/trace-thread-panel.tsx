import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeftIcon } from 'lucide-react';

import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';

export interface TraceThreadPanelProps {
  threadId: string;
  /** Return to the trace panel this thread view replaced. */
  onBack: () => void;
  /** Close the whole side panel. */
  onClose: () => void;
  className?: string;
}

/** The trace side panel swapped for the full thread: every turn as traces, anchored on the URL's `traceId`. */
export function TraceThreadPanel({ threadId, onBack, onClose, className }: TraceThreadPanelProps) {
  return (
    <DataPanel className={cn('h-full min-h-0', className)}>
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
