import { Badge } from '@mastra/playground-ui/components/Badge';

type FeedbackLike = { reviewStatus?: string | null };

/** Dot shown on a Feedback tab only when at least one feedback record still needs review. */
export function NeedsReviewDot({ feedback }: { feedback: FeedbackLike[] | undefined }) {
  if (!feedback?.some(item => item.reviewStatus === 'needs-review')) return null;
  return (
    <Badge
      variant="yellow"
      size="sm"
      indicator="dot"
      className="ml-1.5"
      aria-label="Has feedback needing review"
      data-testid="needs-review-dot"
    />
  );
}
