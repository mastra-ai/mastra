import { useState } from 'react';

import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';
import { DataPanel } from '@/ds/components/DataPanel';

export interface TraceThreadPanelProps {
  threadId: string;
  withQueryTrace: boolean;
  withFeedback: boolean;
  onOpenScore: (traceId: string, scoreId: string) => void;
  /** Return to the trace panel this thread view replaced. */
  onBack: () => void;
  /** Close the whole side panel. */
  onClose: () => void;
  /** Accessible drawer name; defaults to the thread id. */
  title?: string;
}

/** The trace drawer swapped for the full thread: every turn as traces, opened on the latest one. */
export function TraceThreadPanel({
  threadId,
  withQueryTrace,
  withFeedback,
  onOpenScore,
  onBack,
  onClose,
  title,
}: TraceThreadPanelProps) {
  // Like the trace panel: the drawer only takes the full frame while a span detail is open.
  const [hasSelectedSpan, setHasSelectedSpan] = useState(false);
  return (
    <DataPanel open onClose={onClose} title={title ?? `Thread ${threadId}`} size={hasSelectedSpan ? 'full' : 'wide'}>
      <DataPanel.Header>
        {/* The leading arrow leaves this view for the trace it replaced; the drawer itself still closes via Escape / backdrop. */}
        <DataPanel.CloseButton onClick={onBack} label="Back to trace" tooltip="Back to trace" />
        <DataPanel.HeaderContent>
          <DataPanel.Heading>
            Thread
            <DataPanel.CopyId id={threadId} />
          </DataPanel.Heading>
        </DataPanel.HeaderContent>
      </DataPanel.Header>
      <div className="min-h-0 flex-1">
        <ThreadViewByTrace
          threadId={threadId}
          withQueryTrace={withQueryTrace}
          withFeedback={withFeedback}
          onOpenScore={onOpenScore}
          onSelectedSpanChange={selected => setHasSelectedSpan(selected !== null)}
        />
      </div>
    </DataPanel>
  );
}
