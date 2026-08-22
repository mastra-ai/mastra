import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import type { TraceReviewTarget } from '@mastra/playground-ui/domains/traces/components/trace-review-view';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckCircle2Icon, PencilLineIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { readReviewerName } from '../reviewer-name';
import { cn } from '@/lib/utils';

const assessments = [
  { value: 1, label: 'Accurate', Icon: CheckCircle2Icon },
  { value: 0, label: 'Needs correction', Icon: PencilLineIcon },
  { value: -1, label: 'Potentially unsafe', Icon: AlertTriangleIcon },
] as const;

type AssessmentValue = (typeof assessments)[number]['value'];

const targetLabels: Record<TraceReviewTarget, string> = {
  case: 'the case',
  response: 'the agent response',
  reasoning: 'how the response was produced',
};

export interface TraceReviewFeedbackProps {
  traceId: string;
  spanId?: string;
  target?: TraceReviewTarget;
  onClearTarget?: () => void;
}

export function TraceReviewFeedback({ traceId, spanId, target, onClearTarget }: TraceReviewFeedbackProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [assessment, setAssessment] = useState<AssessmentValue | undefined>();
  const [comment, setComment] = useState('');
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (target) commentRef.current?.focus();
  }, [target]);

  const submitReview = useMutation({
    mutationFn: () =>
      client.createFeedback({
        feedback: {
          traceId,
          spanId,
          feedbackSource: 'studio',
          feedbackType: 'review',
          value: assessment ?? 0,
          comment: comment.trim() || undefined,
          feedbackUserId: readReviewerName().trim() || undefined,
          metadata: target ? { reviewTarget: target } : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Review saved');
      setAssessment(undefined);
      setComment('');
      onClearTarget?.();
      void queryClient.invalidateQueries({ queryKey: ['trace-feedback'] });
    },
    onError: () => toast.error('The review could not be saved. Try again.'),
  });

  const canSubmit = assessment !== undefined && !submitReview.isPending;

  return (
    <form
      aria-label="Clinical review"
      className="border-border1 bg-surface2 rounded-xl border p-4"
      onSubmit={event => {
        event.preventDefault();
        if (canSubmit) submitReview.mutate();
      }}
    >
      <h3 className="text-ui-lg text-neutral6 font-medium">Your review</h3>
      <p className="text-ui-sm text-neutral3 mt-1">
        {target ? `Note about ${targetLabels[target]}.` : 'Rate the response and add an optional note.'}
      </p>

      <div role="radiogroup" aria-label="Overall assessment" className="mt-3 flex flex-wrap gap-2">
        {assessments.map(({ value, label, Icon }) => {
          const selected = assessment === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setAssessment(selected ? undefined : value)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-ui-md transition-colors',
                'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55',
                selected
                  ? value === -1
                    ? 'border-accent2 bg-accent2/10 text-accent2'
                    : 'border-neutral6 bg-neutral6 text-surface1'
                  : 'border-border1 bg-transparent text-neutral4 hover:bg-surface4 hover:text-neutral6',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="text-ui-sm text-neutral4 mb-1.5 block">Note (optional)</span>
        <Textarea
          ref={commentRef}
          value={comment}
          onChange={event => setComment(event.target.value)}
          placeholder="What should change about this response?"
          spellCheck
          rows={3}
        />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
          {submitReview.isPending ? 'Saving…' : 'Save review'}
        </Button>
        {target && onClearTarget && (
          <Button type="button" variant="ghost" size="md" onClick={onClearTarget}>
            Clear section
          </Button>
        )}
      </div>
    </form>
  );
}
