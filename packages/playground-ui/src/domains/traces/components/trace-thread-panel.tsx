import { useState } from 'react';

import type { ThreadTraceLayout } from '@/domains/traces/components/thread-trace';
import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';
import { DataPanel } from '@/ds/components/DataPanel';

export interface TraceThreadPanelProps {
  threadId: string;
  withQueryTrace: boolean;
  withFeedback: boolean;
  /** Trace to open and scroll to when the thread opens. */
  anchorTraceId?: string;
  onOpenScore: (traceId: string, scoreId: string) => void;
  /** Return to the trace panel this thread view replaced. */
  onBack: () => void;
  /** Close the whole side panel. */
  onClose: () => void;
  /** Accessible drawer name; defaults to the thread id. */
  title?: string;
}

/** The trace drawer swapped for the full thread: every turn as traces, anchored on `anchorTraceId`. */
export function TraceThreadPanel({
  threadId,
  withQueryTrace,
  withFeedback,
  anchorTraceId,
  onOpenScore,
  onBack,
  onClose,
  title,
}: TraceThreadPanelProps) {
  // The drawer takes the full frame as soon as a trace column opens next to the conversation.
  const [layout, setLayout] = useState<ThreadTraceLayout>('conversation');
  return (
    <DataPanel
      open
      onClose={onClose}
      title={title ?? `Thread ${threadId}`}
      size={layout === 'conversation' ? 'wide' : 'full'}
    >
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
          anchorTraceId={anchorTraceId}
          onOpenScore={onOpenScore}
          onLayoutChange={setLayout}
        />
      </div>
    </DataPanel>
  );
}
