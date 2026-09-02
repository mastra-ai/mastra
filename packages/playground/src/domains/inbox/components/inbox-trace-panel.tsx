import type { FeedbackRecord } from '@mastra/core/storage';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { format } from 'date-fns/format';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { RouteItemOverlay } from '@/components/route-item-overlay';
import { feedbackDisplayValue } from '@/domains/inbox/utils/feedback-display-value';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';

export interface InboxTracePanelProps {
  feedback: FeedbackRecord;
  traceId: string;
  /** Span the feedback was attached to, if any — opened by default so the reviewer lands on it. */
  initialSpanId?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onMarkReviewed: () => void;
  isMarkingReviewed: boolean;
}

/**
 * Floating side panel for reviewing a feedback item in place — same overlay
 * pattern as experiment/dataset item panels: a small review bar on top of the
 * shared `TraceSpanPanel`; the panel widens when a span is opened.
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
  const { spans, isLoading } = useTraceOrBranchSpans({ traceId, anchorSpanId: null, listMode: 'traces' });

  return (
    <RouteItemOverlay label={`Review feedback for trace ${traceId}`} wide={!!selectedSpanId}>
      <div className="[&>*]:bg-surface3 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-3 [&>*]:rounded-lg [&>*]:shadow-lg">
        <DataPanel className="max-h-[33vh]">
          <DataPanel.Header className="items-start">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <DataPanel.Heading>Feedback</DataPanel.Heading>
                <Badge variant="neutral" emphasis="muted">
                  {feedback.feedbackType}
                </Badge>
                {feedback.feedbackSource && (
                  <Badge variant="neutral" emphasis="muted">
                    {feedback.feedbackSource}
                  </Badge>
                )}
              </div>
              <Txt as="p" variant="ui-sm" className="text-neutral3">
                {format(new Date(feedback.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                {feedback.feedbackUserId ? ` · ${feedback.feedbackUserId}` : null}
              </Txt>
            </div>
            <ButtonsGroup className="ml-auto shrink-0">
              <Button variant="primary" size="sm" onClick={onMarkReviewed} disabled={isMarkingReviewed}>
                <Icon>
                  <Check />
                </Icon>
                Mark as reviewed
              </Button>
            </ButtonsGroup>
          </DataPanel.Header>

          <DataPanel.Content>
            <Txt as="p" variant="ui-md" className="text-neutral5 whitespace-pre-wrap">
              {feedbackDisplayValue(feedback)}
            </Txt>
          </DataPanel.Content>
        </DataPanel>

        <section className="min-h-0 overflow-hidden">
          <TraceSpanPanel
            className="h-full rounded-none border-0 bg-transparent"
            spanPanelClassName="rounded-none border-0 bg-transparent"
            traceId={traceId}
            spans={spans}
            isLoadingSpans={isLoading}
            selectedSpanId={selectedSpanId ?? null}
            initialSpanId={initialSpanId}
            onSpanSelect={setSelectedSpanId}
            onClose={onClose}
            onPrevious={onPrevious}
            onNext={onNext}
            traceHref={`/traces?traceId=${encodeURIComponent(traceId)}`}
            feedbackTabSlot={({ traceId: tid }) => <TraceFeedbackTab traceId={tid} />}
            spanFeedbackTabSlot={({ traceId: tid, spanId: sid }) =>
              tid && sid ? <SpanFeedbackTab key={`${tid}:${sid}`} traceId={tid} spanId={sid} /> : null
            }
          />
        </section>
      </div>
    </RouteItemOverlay>
  );
}
