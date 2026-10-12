import { useReviewSummary } from '@mastra/react/hooks/review';

export function ReviewQueueCount() {
  const { data } = useReviewSummary();
  const awaitingReview = data?.counts.reduce((total, experiment) => total + experiment.needsReview, 0) ?? 0;
  if (awaitingReview === 0) return null;
  return (
    <span
      title={`${awaitingReview} results awaiting review`}
      className="text-ui-sm ml-auto pl-2 text-muted-foreground tabular-nums"
    >
      {awaitingReview}
    </span>
  );
}
