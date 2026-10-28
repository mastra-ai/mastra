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
 * so one left by Factory's app identity pins `reviewDecision` at
 * CHANGES_REQUESTED after a separate reviewer identity approves.
 *
 * A review is selected only when it is its author's latest verdict (comments
 * do not replace a verdict on GitHub), was submitted before the approval, is a
 * change request carrying Factory's verdict marker, and its author is verified
 * as Factory. Nothing is selected unless the approval is still in effect.
 */
export function selectStaleFactoryReviews(
  reviews: readonly Review[],
  approving: { reviewId: string; author: string },
  isFactoryAuthor: (login: string) => boolean,
): Review[] {
  const approval = reviews.find(review => review.id === approving.reviewId);
  if (!approval || approval.state !== 'approved' || !approval.submittedAt) return [];
  const cutoff = approval.submittedAt;
  const latestByAuthor = new Map<string, Review>();
  for (const review of reviews) {
    if (!review.author || review.state === 'pending' || review.state === 'commented') continue;
    const key = review.author.toLowerCase();
    const previous = latestByAuthor.get(key);
    if (!previous || (review.submittedAt ?? '') >= (previous.submittedAt ?? '')) latestByAuthor.set(key, review);
  }
  const approvingAuthor = approving.author.toLowerCase();
  // A later verdict from the same approver supersedes the approval.
  if (latestByAuthor.get(approvingAuthor)?.id !== approval.id) return [];
  return [...latestByAuthor.values()].filter(
    review =>
      review.id !== approving.reviewId &&
      review.author!.toLowerCase() !== approvingAuthor &&
      review.state === 'changes-requested' &&
      !!review.submittedAt &&
      review.submittedAt < cutoff &&
      isFactoryRequestChangesVerdict(review.body) &&
      isFactoryAuthor(review.author!),
  );
}

/** Lists every review on the pull request and dismisses the stale Factory change requests. */
export async function dismissStaleFactoryReviews(
  versionControl: Pick<VersionControl, 'listReviews' | 'dismissReview'>,
  decision: Omit<FactoryDismissStaleReviewsDecision, 'type' | 'idempotencyKey'>,
  isFactoryAuthor: (login: string) => boolean,
  isTrustedApprover: (login: string) => Promise<boolean>,
): Promise<string[]> {
  // The approval marker is plain text anyone can post. Only an approver who
  // could dismiss these reviews on GitHub themselves may trigger it.
  if (!isFactoryAuthor(decision.approvingAuthor) && !(await isTrustedApprover(decision.approvingAuthor))) return [];
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
  }, isFactoryAuthor);
  for (const review of stale) {
    await versionControl.dismissReview({
      ...ref,
      reviewId: review.id,
      message: `Superseded by Factory approval from @${decision.approvingAuthor}.`,
    });
  }
  return stale.map(review => review.id);
}
