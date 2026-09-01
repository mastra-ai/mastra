import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { format } from 'date-fns';
import { useState } from 'react';
import { Link } from 'react-router';

import { useFeedback, useUpdateFeedbackReviewStatus } from '@/domains/feedback/hooks/use-feedback';
import { useInboxDatasetReviewItems } from '@/domains/review/hooks/use-inbox-review-items';

type ReviewFilter = 'all' | 'needs-review' | 'reviewed';

function displayValue(feedback: { comment?: string | null; value: unknown; feedbackType: string }) {
  if (feedback.comment) return feedback.comment;
  if (typeof feedback.value === 'string') return feedback.value;
  if (feedback.feedbackType === 'thumbs') return feedback.value ? 'Thumbs up' : 'Thumbs down';
  return JSON.stringify(feedback.value) ?? String(feedback.value);
}

function displayDatasetInput(input: unknown) {
  if (typeof input === 'string') return input;
  return JSON.stringify(input) ?? String(input);
}

export default function InboxPage() {
  const [page, setPage] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('needs-review');
  const feedbackQuery = useFeedback({
    page,
    reviewStatus: reviewFilter === 'all' ? undefined : reviewFilter,
  });
  const updateReviewStatus = useUpdateFeedbackReviewStatus();
  const datasetReviewQuery = useInboxDatasetReviewItems();
  const pagination = feedbackQuery.data?.pagination;

  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>Inbox</PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Txt variant="ui-lg" className="text-neutral6">
            Dataset items
          </Txt>
          <Txt variant="ui-sm" className="text-neutral3">
            Experiment results waiting for review.
          </Txt>
        </div>

        <div className="border-border1 overflow-hidden rounded-md border">
          {datasetReviewQuery.isLoading ? (
            <div className="p-6">
              <Txt variant="ui-sm" className="text-neutral3">
                Loading dataset items…
              </Txt>
            </div>
          ) : datasetReviewQuery.error ? (
            <div className="p-6">
              <Txt variant="ui-sm" className="text-neutral3">
                Dataset review items are unavailable.
              </Txt>
            </div>
          ) : datasetReviewQuery.data?.length ? (
            <ul className="divide-border1 divide-y">
              {datasetReviewQuery.data.map(item => (
                <li key={`${item.experimentId}-${item.id}`} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="yellow" size="sm" indicator="dot">
                          Needs review
                        </Badge>
                        <Txt variant="ui-xs" className="text-neutral3">
                          Dataset item
                        </Txt>
                      </div>
                      <Txt variant="ui-md" className="text-neutral6 break-words">
                        {displayDatasetInput(item.input)}
                      </Txt>
                    </div>
                    <Button
                      as={Link}
                      to={`/datasets/${encodeURIComponent(item.datasetId)}?tab=review`}
                      variant="outline"
                      size="sm"
                    >
                      Review item
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Txt variant="ui-xs" className="text-neutral3">
                      Experiment: {item.experimentId}
                    </Txt>
                    {item.traceId ? (
                      <Link
                        className="text-ui-xs text-accent1 hover:underline"
                        to={`/traces?traceId=${encodeURIComponent(item.traceId)}`}
                      >
                        View trace
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6">
              <Txt variant="ui-sm" className="text-neutral3">
                No dataset items need review.
              </Txt>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Txt variant="ui-lg" className="text-neutral6">
              Feedback
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3">
              Review feedback submitted for traces and spans.
            </Txt>
          </div>
          <Select
            value={reviewFilter}
            onValueChange={value => {
              setReviewFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Review status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All feedback</SelectItem>
              <SelectItem value="needs-review">Needs review</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-border1 overflow-hidden rounded-md border">
          {feedbackQuery.isLoading ? (
            <div className="p-6">
              <Txt variant="ui-sm" className="text-neutral3">
                Loading feedback…
              </Txt>
            </div>
          ) : feedbackQuery.error ? (
            <div className="p-6">
              <Txt variant="ui-sm" className="text-neutral3">
                Feedback is unavailable.
              </Txt>
            </div>
          ) : feedbackQuery.data?.feedback.length ? (
            <ul className="divide-border1 divide-y">
              {feedbackQuery.data.feedback.map(feedback => {
                const feedbackId = feedback.feedbackId;
                const isReviewed = feedback.reviewStatus === 'reviewed';
                return (
                  <li
                    key={feedbackId ?? `${feedback.timestamp.toISOString()}-${feedback.traceId}`}
                    className="flex flex-col gap-3 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={isReviewed ? 'green' : 'yellow'} size="sm" indicator="dot">
                            {isReviewed ? 'Reviewed' : 'Needs review'}
                          </Badge>
                          <Txt variant="ui-xs" className="text-neutral3">
                            {feedback.spanId ? 'Span feedback' : feedback.traceId ? 'Trace feedback' : 'Feedback'}
                          </Txt>
                        </div>
                        <Txt variant="ui-md" className="text-neutral6 break-words">
                          {displayValue(feedback)}
                        </Txt>
                      </div>
                      {!isReviewed && feedbackId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateReviewStatus.isPending}
                          onClick={() => updateReviewStatus.mutate({ feedbackId, reviewStatus: 'reviewed' })}
                        >
                          Mark reviewed
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Txt variant="ui-xs" className="text-neutral3">
                        {format(feedback.timestamp, 'MMM d, yyyy, h:mm:ss aaa')}
                      </Txt>
                      {feedback.traceId ? (
                        <Link
                          className="text-ui-xs text-accent1 hover:underline"
                          to={`/traces?traceId=${encodeURIComponent(feedback.traceId)}`}
                        >
                          View trace
                        </Link>
                      ) : null}
                      {feedback.feedbackSource ? (
                        <Txt variant="ui-xs" className="text-neutral3">
                          Source: {feedback.feedbackSource}
                        </Txt>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-6">
              <Txt variant="ui-sm" className="text-neutral3">
                No feedback matches this filter.
              </Txt>
            </div>
          )}
        </div>

        {pagination && (pagination.hasMore || page > 0) ? (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(current => current - 1)}>
              Previous
            </Button>
            <Txt variant="ui-xs" className="text-neutral3">
              Page {page + 1}
            </Txt>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasMore}
              onClick={() => setPage(current => current + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </PageLayout.MainArea>
    </PageLayout>
  );
}
