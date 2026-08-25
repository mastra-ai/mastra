import type { FeedbackRecord } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import type { TraceReviewSelection } from '@mastra/playground-ui/domains/traces/components/trace-review-view';
import { RawDataDisclosure } from '@mastra/playground-ui/domains/traces/components/trace-review-view';
import { formatSpanDuration } from '@mastra/playground-ui/domains/traces/utils/span-utils';
import {
  getReadableTraceInput,
  getReadableTraceOutput,
} from '@mastra/playground-ui/domains/traces/utils/trace-review-utils';
import { cn } from '@mastra/playground-ui/utils/cn';
import { format } from 'date-fns';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, HighlighterIcon, PencilLineIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ConversationThread } from '../hooks/use-conversation-threads';
import { AnnotatedMarkdown } from '@/domains/traces/components/annotated-markdown';
import { TraceAnnotationComposer, TraceAnnotationList } from '@/domains/traces/components/trace-annotations';
import { TraceReviewFeedback } from '@/domains/traces/components/trace-review-feedback';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

type ThreadTurn = ConversationThread['turns'][number];

const assessmentLabels = {
  accurate: { label: 'Accurate', Icon: CheckCircle2Icon, className: 'text-neutral5' },
  'needs-correction': { label: 'Needs correction', Icon: PencilLineIcon, className: 'text-neutral4' },
  unsafe: { label: 'Potentially unsafe', Icon: AlertTriangleIcon, className: 'text-accent2' },
} as const;

type AssessmentKey = keyof typeof assessmentLabels;

function getAssessmentKey(feedback: FeedbackRecord): AssessmentKey {
  if (feedback.value === 1) return 'accurate';
  if (feedback.value === -1) return 'unsafe';
  return 'needs-correction';
}

function getConsensus(reviews: FeedbackRecord[]): { key: AssessmentKey; count: number } | undefined {
  if (reviews.length === 0) return undefined;
  const counts = new Map<AssessmentKey, number>();
  for (const review of reviews) {
    const key = getAssessmentKey(review);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Safety concerns win ties; otherwise the most common assessment.
  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] === 'unsafe' ? -1 : b[0] === 'unsafe' ? 1 : 0),
  );
  const top = ranked[0]!;
  return { key: top[0], count: top[1] };
}

function ReviewedBadge({ reviews }: { reviews: FeedbackRecord[] }) {
  const consensus = getConsensus(reviews);
  if (!consensus) return null;
  const consensusUi = assessmentLabels[consensus.key];

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" aria-label={`Reviewed: ${consensusUi.label}. Show review details`} />}
        className="text-neutral5 hover:bg-surface4 flex cursor-default items-center gap-1 rounded-md px-1 py-0.5"
      >
        <CheckCircle2Icon className="size-3.5" /> Reviewed
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-80 p-3">
        <p className={cn('flex items-center gap-1.5 text-ui-md font-medium', consensusUi.className)}>
          <consensusUi.Icon className="size-4" />
          {consensusUi.label}
          {reviews.length > 1 && (
            <span className="text-neutral3 font-normal">
              {consensus.count} of {reviews.length} reviews
            </span>
          )}
        </p>
        <ul className="mt-2 grid gap-2">
          {reviews.map((review, index) => {
            const ui = assessmentLabels[getAssessmentKey(review)];
            return (
              <li key={review.feedbackId ?? index} className="bg-surface3 rounded-lg p-2">
                <div className="text-ui-sm text-neutral3 flex items-center gap-2">
                  <ui.Icon className={cn('size-3.5', ui.className)} />
                  <span className="text-neutral5 font-medium">{review.feedbackUserId || 'Unattributed'}</span>
                  <span>{format(new Date(review.timestamp), 'MMM d, h:mm aaa')}</span>
                </div>
                {review.comment && <p className="text-ui-sm text-neutral5 mt-1">{review.comment}</p>}
              </li>
            );
          })}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function getSelectionInside(container: HTMLElement | null): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !container) return '';
  if (!selection.anchorNode || !container.contains(selection.anchorNode)) return '';
  return selection.toString().trim();
}

export function ThreadTurnCard({
  turn,
  index,
  onInspectTrace,
}: {
  turn: ThreadTurn;
  index: number;
  onInspectTrace: (traceId: string) => void;
}) {
  const responseRef = useRef<HTMLDivElement>(null);
  const [selectedQuote, setSelectedQuote] = useState('');
  const [pendingAnnotation, setPendingAnnotation] = useState<TraceReviewSelection | undefined>();
  const [showReviewForm, setShowReviewForm] = useState(false);

  const { data: feedbackData } = useTraceFeedback({ traceId: turn.traceId });
  const reviews = (feedbackData?.feedback ?? []).filter(feedback => feedback.feedbackType === 'review');
  const annotations = (feedbackData?.feedback ?? []).filter(feedback => feedback.feedbackType === 'annotation');
  const isReviewed = reviews.length > 0;

  const caseText = getReadableTraceInput(turn.input);
  const responseText = getReadableTraceOutput(turn.output);
  const duration = formatSpanDuration(turn.startedAt, turn.endedAt);
  const failed = turn.status === 'error';

  const refreshSelection = () => setSelectedQuote(getSelectionInside(responseRef.current));

  return (
    <article className="border-border1 bg-surface2 rounded-xl border p-4">
      <header className="text-ui-sm text-neutral3 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-neutral5 font-medium">Turn {index + 1}</span>
        {turn.entityName && <span className="bg-surface5 rounded-full px-2 py-0.5">{turn.entityName}</span>}
        {duration && <span className="tabular-nums">{duration}</span>}
        {failed && (
          <span className="text-accent2 flex items-center gap-1">
            <AlertCircleIcon className="size-3.5" /> This turn failed
          </span>
        )}
        <ReviewedBadge reviews={reviews} />
        <span className="ml-auto flex items-center gap-1">
          {selectedQuote && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              aria-label={`Annotate selection in turn ${index + 1}`}
              onClick={() => {
                setPendingAnnotation({ target: 'response', quote: selectedQuote });
                setSelectedQuote('');
              }}
            >
              <HighlighterIcon />
              Annotate selection
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowReviewForm(open => !open)}>
            {showReviewForm ? 'Hide review' : isReviewed ? 'Review again' : 'Review turn'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onInspectTrace(turn.traceId)}>
            Full trace
          </Button>
        </span>
      </header>

      <div className="grid gap-3">
        <div className="bg-surface5 max-w-[65ch] justify-self-end rounded-lg px-4 py-3">
          {caseText ? (
            <MarkdownRenderer className="text-ui-md text-neutral6">{caseText}</MarkdownRenderer>
          ) : (
            <p className="text-ui-md text-neutral3">No readable message was recorded.</p>
          )}
        </div>
        <div
          ref={responseRef}
          onMouseUp={refreshSelection}
          onKeyUp={refreshSelection}
          className={cn('max-w-[65ch] rounded-lg bg-surface3 px-4 py-3', failed && 'border border-accent2/40')}
        >
          {responseText ? (
            <AnnotatedMarkdown annotations={annotations} className="text-ui-md text-neutral5">
              {responseText}
            </AnnotatedMarkdown>
          ) : (
            <p className="text-ui-md text-neutral3">No readable response was recorded.</p>
          )}
        </div>
      </div>

      <RawDataDisclosure label="Raw turn data" value={{ input: turn.input, output: turn.output }} />

      <TraceAnnotationList feedbackData={feedbackData} />

      {pendingAnnotation && (
        <TraceAnnotationComposer
          traceId={turn.traceId}
          spanId={turn.spanId}
          selection={pendingAnnotation}
          onDone={() => setPendingAnnotation(undefined)}
        />
      )}

      {showReviewForm && (
        <div className="mt-3">
          <TraceReviewFeedback traceId={turn.traceId} spanId={turn.spanId} />
        </div>
      )}
    </article>
  );
}
