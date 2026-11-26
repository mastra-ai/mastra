import { useState } from 'react';
import type { FeedbackOptions } from './feedback-options';

import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';
import { TraceThreadPanelView } from '@/domains/traces/components/trace-thread-panel-view';
import type { TraceThreadPanelViewProps } from '@/domains/traces/components/trace-thread-panel-view';

export interface TraceThreadPanelProps extends Omit<TraceThreadPanelViewProps, 'hasSelectedSpan' | 'children'> {
  withQueryTrace: boolean;
  withFeedback: boolean;
  feedbackOptions?: FeedbackOptions;
  onOpenScore: (traceId: string, scoreId: string) => void;
}

/**
 * Studio's full-thread drawer: {@link TraceThreadPanelView} around a {@link ThreadViewByTrace} fed through
 * the Mastra client. Every turn as traces, opened on the latest one.
 */
export function TraceThreadPanel({
  threadId,
  withQueryTrace,
  withFeedback,
  feedbackOptions,
  onOpenScore,
  ...props
}: TraceThreadPanelProps) {
  // Like the trace panel: the drawer only takes the full frame while a span detail is open.
  const [hasSelectedSpan, setHasSelectedSpan] = useState(false);
  return (
    <TraceThreadPanelView {...props} threadId={threadId} hasSelectedSpan={hasSelectedSpan}>
      {threadId ? (
        <ThreadViewByTrace
          threadId={threadId}
          withQueryTrace={withQueryTrace}
          withFeedback={withFeedback}
          feedbackOptions={feedbackOptions}
          onOpenScore={onOpenScore}
          onSelectedSpanChange={selected => setHasSelectedSpan(selected !== null)}
        />
      ) : null}
    </TraceThreadPanelView>
  );
}
