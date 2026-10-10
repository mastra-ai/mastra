import { useState } from 'react';

import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';
import { DataPanel } from '@/ds/components/DataPanel';

export interface TraceThreadPanelProps {
  /** Keep the panel mounted and toggle `open` so the drawer animates in and out. */
  open: boolean;
  threadId: string;
  withQueryTrace: boolean;
  withFeedback: boolean;
  onOpenScore: (traceId: string, scoreId: string) => void;
  /** Close the thread drawer, revealing the trace panel underneath. */
  onClose: () => void;
  /** Sibling-drawer elevation (see `DataPanel`); defaults to 2, above the trace panel. */
  depth?: 1 | 2 | 3;
  /** Accessible drawer name; defaults to the thread id. */
  title?: string;
  /** Close button label; defaults to "Back to trace" for the drawer stacked above a trace. */
  closeLabel?: string;
}

/** The full thread in its own drawer, stacked above the trace panel: every turn as traces, opened on the latest one. */
export function TraceThreadPanel({
  open,
  threadId,
  withQueryTrace,
  withFeedback,
  onOpenScore,
  onClose,
  depth = 2,
  title,
  closeLabel = 'Back to trace',
}: TraceThreadPanelProps) {
  // Like the trace panel: the drawer only takes the full frame while a span detail is open.
  const [hasSelectedSpan, setHasSelectedSpan] = useState(false);
  return (
    <DataPanel
      open={open}
      onClose={onClose}
      title={title ?? `Thread ${threadId}`}
      depth={depth}
      size={hasSelectedSpan ? 'full' : 'wide'}
    >
      <DataPanel.Header>
        <DataPanel.CloseButton onClick={onClose} label={closeLabel} tooltip={closeLabel} />
        <DataPanel.HeaderContent>
          <DataPanel.Heading>
            Thread
            <DataPanel.CopyId id={threadId} />
          </DataPanel.Heading>
        </DataPanel.HeaderContent>
      </DataPanel.Header>
      <div className="min-h-0 flex-1">
        {threadId ? (
          <ThreadViewByTrace
            threadId={threadId}
            withQueryTrace={withQueryTrace}
            withFeedback={withFeedback}
            onOpenScore={onOpenScore}
            onSelectedSpanChange={selected => setHasSelectedSpan(selected !== null)}
          />
        ) : null}
      </div>
    </DataPanel>
  );
}
