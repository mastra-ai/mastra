import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';

import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';

export interface TraceThreadPanelProps {
  threadId: string;
  /** Return to the trace panel this thread view replaced. */
  onBack: () => void;
  /** Close the whole side panel. */
  onClose: () => void;
  /** Accessible drawer name; defaults to the thread id. */
  title?: string;
}

/** The trace drawer swapped for the full thread: every turn as traces, anchored on the URL's `traceId`. */
export function TraceThreadPanel({ threadId, onBack, onClose, title }: TraceThreadPanelProps) {
  // Wide like the trace panel by default; go full width only while a span detail is open beside the turns.
  const [hasSelectedSpan, setHasSelectedSpan] = useState(false);

  return (
    <DataPanel open onClose={onClose} title={title ?? `Thread ${threadId}`} size={hasSelectedSpan ? 'full' : 'wide'}>
      <DataPanel.Header>
        <DataPanel.CloseButton onClick={onClose} />
        <Button size="sm" variant="ghost" onClick={onBack} aria-label="Back to trace" tooltip="Back to trace">
          <ArrowLeftIcon />
        </Button>
        <DataPanel.Heading>
          Thread
          <DataPanel.CopyId id={threadId} />
        </DataPanel.Heading>
      </DataPanel.Header>
      {/* Inside the framed panel the turns' details columns read as one strip: no top rounding, no horizontal borders. */}
      <div className="min-h-0 flex-1 [&_[data-slot=thread-trace-details]]:rounded-t-none [&_[data-slot=thread-trace-details]]:border-y-0">
        <ThreadViewByTrace
          threadId={threadId}
          onSelectedSpanChange={selected => setHasSelectedSpan(selected !== null)}
        />
      </div>
    </DataPanel>
  );
}
