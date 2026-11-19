import type { CommitCheckStatus } from '../../capabilities/version-control.js';
import { formatDuration } from './review-status-comment.js';
import type { ReviewStatusState, ReviewStatusStats } from './review-status-comment.js';

export interface ReviewStatusCheck {
  name: string;
  status: CommitCheckStatus;
  title: string;
  summary: string;
}

/**
 * The check run that mirrors a review-status step in the pull request's Checks
 * tab. The check reports that a review ran, not its verdict: approval is a
 * success and every other end is neutral, so a Factory review never fails a
 * required check. The GitHub review carries the verdict.
 */
export function reviewStatusCheck(input: {
  reviewerName: string;
  state: ReviewStatusState;
  stats?: ReviewStatusStats;
  reason?: string;
  /** The review-status comment, linked from the check. */
  commentUrl?: string;
}): ReviewStatusCheck {
  const { state, stats = {} } = input;
  const [status, title] = statusAndTitle(state, stats);
  const lines = [`${input.reviewerName}: ${title.toLowerCase()}.`];
  if (input.reason && (state.phase === 'failed' || state.phase === 'retrying' || state.phase === 'cancelled'))
    lines.push('', input.reason);
  if (stats.durationMs !== undefined) lines.push('', `Took ${formatDuration(stats.durationMs)}.`);
  if (input.commentUrl) lines.push('', `[Review status on the pull request](${input.commentUrl})`);
  return { name: `${input.reviewerName} review`, status, title, summary: lines.join('\n') };
}

function statusAndTitle(state: ReviewStatusState, stats: ReviewStatusStats): [CommitCheckStatus, string] {
  switch (state.phase) {
    case 'queued':
      return ['in-progress', 'Review queued'];
    case 'reviewing':
      return ['in-progress', 'Reviewing'];
    case 'retrying':
      return ['in-progress', `Retrying the review (attempt ${state.attempt})`];
    case 'failed':
      return ['neutral', 'Review failed'];
    case 'cancelled':
      return ['neutral', 'Review cancelled'];
    case 'completed':
      if (stats.verdict === 'approve') return ['success', 'Approved'];
      if (stats.verdict === 'request changes') return ['neutral', 'Changes requested'];
      return ['neutral', 'Review finished'];
  }
}

/** Closes a check left open on a commit the review no longer reports on. */
export function supersededCheck(reviewerName: string, sameRun: boolean): ReviewStatusCheck {
  const title = sameRun ? 'Moved to another commit' : 'Superseded by a newer review';
  return {
    name: `${reviewerName} review`,
    status: 'skipped',
    title,
    summary: sameRun
      ? `${reviewerName} reports this review on another commit of this pull request.`
      : `A newer ${reviewerName} review replaced this one.`,
  };
}
