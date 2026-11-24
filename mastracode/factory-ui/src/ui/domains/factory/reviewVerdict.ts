export type ReviewVerdict = { approved: boolean; outdated: boolean; label: string };

/**
 * The last verdict a review pass recorded; the card rests in Reviewing until the PR merges.
 * Once a push moves the PR past the reviewed head the verdict is kept but marked outdated,
 * so a stale approval never reads as current while the next pass runs.
 */
export function reviewVerdict(metadata: Record<string, unknown>): ReviewVerdict | undefined {
  const verdict = metadata.reviewVerdict;
  if (verdict !== 'approve' && verdict !== 'request changes') return undefined;
  const reviewed = typeof metadata.reviewedHeadSha === 'string' ? metadata.reviewedHeadSha : undefined;
  const head = typeof metadata.pullRequestHeadSha === 'string' ? metadata.pullRequestHeadSha : undefined;
  const outdated = reviewed !== undefined && head !== undefined && reviewed.toLowerCase() !== head.toLowerCase();
  const label = `${verdict === 'approve' ? 'Approved' : 'Changes requested'}${outdated ? ' (outdated)' : ''}`;
  return { approved: verdict === 'approve' && !outdated, outdated, label };
}

/**
 * The last self-review verdict on a Work card, with the round count, shown while the
 * branch moves between Building and Review before any change request exists.
 */
export function selfReviewVerdict(
  metadata: Record<string, unknown>,
): { approved: boolean; outdated: boolean; label: string } | undefined {
  const verdict = metadata.selfReviewVerdict;
  if (verdict !== 'approve' && verdict !== 'request changes') return undefined;
  const rounds = typeof metadata.selfReviewRounds === 'number' ? metadata.selfReviewRounds : 0;
  const label = `Self-review: ${verdict === 'approve' ? 'approved' : 'changes requested'}${rounds > 0 ? ` (round ${rounds})` : ''}`;
  return { approved: verdict === 'approve', outdated: false, label };
}
