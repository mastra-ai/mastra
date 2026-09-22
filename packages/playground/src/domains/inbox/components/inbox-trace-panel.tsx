import type { FeedbackItem } from '@mastra/client-js';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
import { format } from 'date-fns/format';
import { CalendarClock, Check } from 'lucide-react';
import { useState } from 'react';

import { feedbackDisplayValue } from '@/domains/inbox/utils/feedback-display-value';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';
import { feedbackAuthorLabel } from '@/domains/traces/utils/feedback-author';

export interface InboxTracePanelProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  feedback?: FeedbackItem;
  traceId?: string;
  /** Span the feedback was attached to, if any — opened by default so the reviewer lands on it. */
  initialSpanId?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onMarkReviewed: () => void;
  isMarkingReviewed: boolean;
}

/**
 * Drawer for reviewing a feedback item in place: the shared `TraceSpanPanel`
 * with a feedback summary pinned above the trace header.
 */
export function InboxTracePanel({
  feedback,
  traceId,
  initialSpanId,
  onClose,
  onPrevious,
  onNext,
  onMarkReviewed,
  isMarkingReviewed,
}: InboxTracePanelProps) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId);
  // Reset the selected span when the reviewed feedback changes, without remounting the drawer.
  const [prevFeedbackId, setPrevFeedbackId] = useState(feedback?.feedbackId);
  if (feedback?.feedbackId !== prevFeedbackId) {
    setPrevFeedbackId(feedback?.feedbackId);
    setSelectedSpanId(initialSpanId);
  }
  const { spans, isLoading } = useTraceOrBranchSpans({ traceId, anchorSpanId: null, listMode: 'traces' });

  return (
    <TraceSpanPanel
      title={`Review feedback for trace ${traceId ?? ''}`}
      size={selectedSpanId ? 'full' : 'wide'}
      headerSlot={
        feedback && (
          <FeedbackSummary feedback={feedback} onMarkReviewed={onMarkReviewed} isMarkingReviewed={isMarkingReviewed} />
        )
      }
      traceId={feedback ? traceId : undefined}
      spans={spans}
      isLoadingSpans={isLoading}
      selectedSpanId={selectedSpanId ?? null}
      initialSpanId={initialSpanId}
      onSpanSelect={setSelectedSpanId}
      onClose={onClose}
      onPrevious={onPrevious}
      onNext={onNext}
      traceHref={traceId ? `/traces?traceId=${encodeURIComponent(traceId)}` : undefined}
      feedbackTabSlot={({ traceId: tid }) => <TraceFeedbackTab traceId={tid} />}
      spanFeedbackTabSlot={({ traceId: tid, spanId: sid }) =>
        tid && sid ? <SpanFeedbackTab key={`${tid}:${sid}`} traceId={tid} spanId={sid} /> : null
      }
    />
  );
}

interface FeedbackSummaryProps {
  feedback: FeedbackItem;
  onMarkReviewed: () => void;
  isMarkingReviewed: boolean;
}

function FeedbackSummary({ feedback, onMarkReviewed, isMarkingReviewed }: FeedbackSummaryProps) {
  const author = feedbackAuthorLabel(feedback) ?? feedback.feedbackUserId;

  return (
    <section aria-label="Feedback" className="border-border flex max-h-[33vh] shrink-0 flex-col border-b">
      <DataPanel.Header>
        <DataPanel.HeaderContent>
          <DataPanel.Heading>
            Feedback
            <Badge variant="neutral" emphasis="muted">
              {feedback.feedbackType}
            </Badge>
            {feedback.feedbackSource && (
              <Badge variant="neutral" emphasis="muted">
                {feedback.feedbackSource}
              </Badge>
            )}
          </DataPanel.Heading>
          <DataPanel.Metadata>
            {author && (
              <DataPanel.Meta
                icon={<Avatar name={author} src={feedback.author?.avatarUrl} size="sm" />}
                tooltip="Author"
              >
                {author}
              </DataPanel.Meta>
            )}
            <DataPanel.Meta
              icon={<CalendarClock />}
              tooltip={`Submitted at ${format(new Date(feedback.timestamp), 'MMM dd, yyyy HH:mm:ss')}`}
            >
              {format(new Date(feedback.timestamp), 'MMM dd, yyyy HH:mm')}
            </DataPanel.Meta>
          </DataPanel.Metadata>
        </DataPanel.HeaderContent>
        <DataPanel.HeaderActions>
          <Button variant="primary" size="sm" onClick={onMarkReviewed} disabled={isMarkingReviewed} icon={<Check />}>
            Mark as reviewed
          </Button>
        </DataPanel.HeaderActions>
      </DataPanel.Header>
      <div className="min-h-0 overflow-y-auto p-3">
        <Txt as="p" variant="body" tone="ink" className="whitespace-pre-wrap">
          {feedbackDisplayValue(feedback)}
        </Txt>
      </div>
    </section>
  );
}
