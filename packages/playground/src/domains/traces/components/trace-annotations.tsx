import type { FeedbackRecord, ListFeedbackResponse } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import type {
  TraceReviewSelection,
  TraceReviewTarget,
} from '@mastra/playground-ui/domains/traces/components/trace-review-view';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { HighlighterIcon } from 'lucide-react';
import { useState } from 'react';
import { readReviewerName, saveReviewerName } from '../reviewer-name';

function getAnnotationTarget(feedback: FeedbackRecord): TraceReviewTarget | undefined {
  const target = feedback.metadata?.reviewTarget;
  return target === 'case' || target === 'response' || target === 'reasoning' ? target : undefined;
}

export interface TraceAnnotationComposerProps {
  traceId: string;
  spanId?: string;
  selection: TraceReviewSelection;
  onDone: () => void;
}

export function TraceAnnotationComposer({ traceId, spanId, selection, onDone }: TraceAnnotationComposerProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [reviewerName, setReviewerName] = useState(readReviewerName);

  const saveAnnotation = useMutation({
    mutationFn: () =>
      client.createFeedback({
        feedback: {
          traceId,
          spanId,
          feedbackSource: 'studio',
          feedbackType: 'annotation',
          value: selection.quote,
          comment: note.trim(),
          feedbackUserId: reviewerName.trim() || undefined,
          metadata: { reviewTarget: selection.target, quote: selection.quote },
        },
      }),
    onSuccess: () => {
      toast.success('Annotation saved');
      saveReviewerName(reviewerName.trim());
      onDone();
      void queryClient.invalidateQueries({ queryKey: ['trace-feedback'] });
    },
    onError: () => toast.error('The annotation could not be saved. Try again.'),
  });

  const canSubmit = note.trim().length > 0 && !saveAnnotation.isPending;

  return (
    <form
      aria-label="Annotate selection"
      className="border-border1 bg-surface3 mt-3 rounded-lg border p-3"
      onSubmit={event => {
        event.preventDefault();
        if (canSubmit) saveAnnotation.mutate();
      }}
    >
      <blockquote className="border-neutral4 text-ui-sm text-neutral4 border-l-2 pl-3 italic">
        “{selection.quote}”
      </blockquote>

      <label className="mt-3 block">
        <span className="text-ui-sm text-neutral4 mb-1.5 block">Annotation</span>
        <Textarea
          autoFocus={!('ontouchstart' in window)}
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="What's wrong or noteworthy about this part?"
          spellCheck
          rows={2}
        />
      </label>

      <label className="mt-2 block">
        <span className="text-ui-sm text-neutral4 mb-1.5 block">Your name</span>
        <Input
          value={reviewerName}
          onChange={event => setReviewerName(event.target.value)}
          placeholder="So your team knows who wrote this"
          autoComplete="name"
        />
      </label>

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
          {saveAnnotation.isPending ? 'Saving…' : 'Save annotation'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export interface TraceAnnotationListProps {
  feedbackData?: ListFeedbackResponse | null;
  /** Restrict to one review section. When omitted, every annotation on the trace is shown. */
  target?: TraceReviewTarget;
}

export function TraceAnnotationList({ feedbackData, target }: TraceAnnotationListProps) {
  const annotations = (feedbackData?.feedback ?? []).filter(
    feedback =>
      feedback.feedbackType === 'annotation' && (target === undefined || getAnnotationTarget(feedback) === target),
  );

  if (annotations.length === 0) return null;

  return (
    <ul className="mt-3 grid gap-2" aria-label={target ? `Annotations on ${target}` : 'Annotations'}>
      {annotations.map((annotation, index) => {
        const quote = typeof annotation.metadata?.quote === 'string' ? annotation.metadata.quote : undefined;
        return (
          <li
            key={annotation.feedbackId ?? `${annotation.traceId}-${index}`}
            className="border-border1 bg-surface3 rounded-lg border p-3"
          >
            <div className="text-ui-sm text-neutral3 flex items-center gap-2">
              <HighlighterIcon className="size-3.5" />
              <span className="text-neutral5 font-medium">{annotation.feedbackUserId || 'Unattributed'}</span>
              <span>{format(new Date(annotation.timestamp), 'MMM d, h:mm aaa')}</span>
            </div>
            {quote && (
              <blockquote className="border-neutral4 text-ui-sm text-neutral4 mt-2 border-l-2 pl-3 italic">
                “{quote}”
              </blockquote>
            )}
            {annotation.comment && <p className="text-ui-md text-neutral5 mt-2">{annotation.comment}</p>}
          </li>
        );
      })}
    </ul>
  );
}
