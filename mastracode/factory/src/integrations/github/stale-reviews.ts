import type { Review, VersionControl } from '../../capabilities/version-control.js';
import { normalizedVerdictLine } from '../../review-verdict.js';
import type { FactoryDismissStaleReviewsDecision } from '../../rules/types.js';

export function isFactoryApproveVerdict(body: string | null | undefined): boolean {
  return /^verdict: ?(approve|approved)$/.test(normalizedVerdictLine(body ?? undefined) ?? '');
}

export function isFactoryRequestChangesVerdict(body: string | null | undefined): boolean {
  return /^verdict: ?(request changes|changes requested)$/.test(normalizedVerdictLine(body ?? undefined) ?? '');
}

/**
 * Factory change requests an approval has superseded. GitHub keeps a reviewer's
 * change request blocking until that same reviewer approves or it is dismissed,
 * so one left by another Factory identity (a rotated reviewer token, say) pins
 * `reviewDecision` at CHANGES_REQUESTED. Only each author's latest review is
 * considered, and only when it carries Factory's verdict marker — human reviews
 * are never selected.
 */
export function selectStaleFactoryReviews(
  reviews: readonly Review[],
  approving: { reviewId: string; author: string },
): Review[] {
  const latestByAuthor = new Map<string, Review>();
  for (const review of reviews) {
    if (!review.author || review.state === 'pending') continue;
    const key = review.author.toLowerCase();
    const previous = latestByAuthor.get(key);
    if (!previous || (review.submittedAt ?? '') >= (previous.submittedAt ?? '')) latestByAuthor.set(key, review);
  }
  const approvingAuthor = approving.author.toLowerCase();
  return [...latestByAuthor.values()].filter(
    review =>
      review.id !== approving.reviewId &&
      review.author!.toLowerCase() !== approvingAuthor &&
      review.state === 'changes-requested' &&
      isFactoryRequestChangesVerdict(review.body),
  );
}

/** Lists every review on the pull request and dismisses the stale Factory change requests. */
export async function dismissStaleFactoryReviews(
  versionControl: Pick<VersionControl, 'listReviews' | 'dismissReview'>,
  decision: Omit<FactoryDismissStaleReviewsDecision, 'type' | 'idempotencyKey'>,
): Promise<string[]> {
  const ref = {
    connection: { type: 'app-installation' as const, installationId: decision.installationId },
    sourceId: decision.repository,
    pullRequestId: String(decision.pullRequestNumber),
  };
  const reviews: Review[] = [];
  let cursor: string | undefined;
  do {
    const page = await versionControl.listReviews({ ...ref, ...(cursor ? { cursor } : {}) });
    reviews.push(...page.reviews);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  const stale = selectStaleFactoryReviews(reviews, {
    reviewId: decision.approvingReviewId,
    author: decision.approvingAuthor,
  });
  for (const review of stale) {
    await versionControl.dismissReview({
      ...ref,
      reviewId: review.id,
      message: `Superseded by Factory approval from @${decision.approvingAuthor}.`,
    });
  }
  return stale.map(review => review.id);
}
