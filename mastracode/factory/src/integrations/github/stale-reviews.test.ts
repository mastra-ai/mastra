import { describe, expect, it, vi } from 'vitest';
import type { Review } from '../../capabilities/version-control.js';
import { dismissStaleFactoryReviews, isFactoryApproveVerdict, selectStaleFactoryReviews } from './stale-reviews.js';

let seq = 0;
function review(overrides: Partial<Review>): Review {
  seq += 1;
  return {
    id: String(seq),
    url: null,
    author: 'factory-old',
    body: 'Verdict: request changes\n\nFindings...',
    state: 'changes-requested',
    commitId: 'abc',
    submittedAt: `2026-09-30T10:00:${String(seq).padStart(2, '0')}Z`,
    ...overrides,
  };
}

const approving = { reviewId: 'approve-1', author: 'factory-reviewer' };

describe('selectStaleFactoryReviews', () => {
  it('selects an older Factory change request from another identity', () => {
    const stale = review({});
    expect(selectStaleFactoryReviews([stale], approving)).toEqual([stale]);
  });

  it('accepts the markdown-wrapped verdict line', () => {
    const stale = review({ body: '**Verdict: request changes**\n\nDetails' });
    expect(selectStaleFactoryReviews([stale], approving)).toEqual([stale]);
  });

  it('never selects a human change request', () => {
    const human = review({ author: 'alice', body: 'Please rename this.' });
    const quoted = review({ author: 'bob', body: 'Looks off.\nVerdict: request changes' });
    expect(selectStaleFactoryReviews([human, quoted], approving)).toEqual([]);
  });

  it('ignores a reviewer whose latest review supersedes the change request', () => {
    const older = review({});
    const newer = review({ state: 'commented', body: 'Verdict: approve' });
    expect(selectStaleFactoryReviews([older, newer], approving)).toEqual([]);
  });

  it('ignores dismissed reviews and the approving author', () => {
    const dismissed = review({ state: 'dismissed' });
    const own = review({ author: 'Factory-Reviewer' });
    expect(selectStaleFactoryReviews([dismissed, own], approving)).toEqual([]);
  });
});

describe('isFactoryApproveVerdict', () => {
  it('matches only the first-line approve verdict', () => {
    expect(isFactoryApproveVerdict('Verdict: approve\n\nok')).toBe(true);
    expect(isFactoryApproveVerdict('**Verdict:** approve')).toBe(true);
    expect(isFactoryApproveVerdict('LGTM\nVerdict: approve')).toBe(false);
    expect(isFactoryApproveVerdict(null)).toBe(false);
  });
});

describe('dismissStaleFactoryReviews', () => {
  it('pages through reviews and dismisses only stale Factory change requests', async () => {
    const stale = review({});
    const human = review({ author: 'alice', body: 'nit' });
    const listReviews = vi
      .fn()
      .mockResolvedValueOnce({ reviews: [stale], nextCursor: '2' })
      .mockResolvedValueOnce({ reviews: [human], nextCursor: null });
    const dismissReview = vi.fn().mockResolvedValue(stale);
    const dismissed = await dismissStaleFactoryReviews(
      { listReviews, dismissReview },
      {
        installationId: 7,
        repository: 'acme/repo',
        pullRequestNumber: 42,
        approvingReviewId: 'approve-1',
        approvingAuthor: 'factory-reviewer',
      },
    );
    expect(dismissed).toEqual([stale.id]);
    expect(listReviews).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '2', pullRequestId: '42' }));
    expect(dismissReview).toHaveBeenCalledTimes(1);
    expect(dismissReview).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/repo',
        reviewId: stale.id,
      }),
    );
  });
});
