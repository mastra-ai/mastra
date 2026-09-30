import { describe, expect, it, vi } from 'vitest';
import type { Review } from '../../capabilities/version-control.js';
import { dismissStaleFactoryReviews, isFactoryApproveVerdict, selectStaleFactoryReviews } from './stale-reviews.js';

let seq = 0;
function review(overrides: Partial<Review>): Review {
  seq += 1;
  return {
    id: String(seq),
    url: null,
    author: 'factory[bot]',
    body: 'Verdict: request changes\n\nFindings...',
    state: 'changes-requested',
    commitId: 'abc',
    submittedAt: `2026-09-30T10:00:${String(seq).padStart(2, '0')}Z`,
    ...overrides,
  };
}

const isFactory = (login: string) => login === 'factory[bot]';

function approval(): Review {
  return review({ author: 'factory-reviewer', state: 'approved', body: 'Verdict: approve' });
}

function select(reviews: Review[], approving: Review) {
  return selectStaleFactoryReviews(reviews, { reviewId: approving.id, author: approving.author! }, isFactory);
}

describe('selectStaleFactoryReviews', () => {
  it('selects an earlier Factory change request', () => {
    const stale = review({});
    const approve = approval();
    expect(select([stale, approve], approve)).toEqual([stale]);
  });

  it('accepts the markdown-wrapped verdict line', () => {
    const stale = review({ body: '**Verdict: request changes**\n\nDetails' });
    const approve = approval();
    expect(select([stale, approve], approve)).toEqual([stale]);
  });

  it('never selects a human change request, even with the exact verdict marker', () => {
    const human = review({ author: 'alice', body: 'Please rename this.' });
    const spoofed = review({ author: 'mallory', body: 'Verdict: request changes' });
    const approve = approval();
    expect(select([human, spoofed, approve], approve)).toEqual([]);
  });

  it('does not let a later comment-only review hide a blocking change request', () => {
    const stale = review({});
    const comment = review({ state: 'commented', body: 'Following up.' });
    const approve = approval();
    expect(select([stale, comment, approve], approve)).toEqual([stale]);
  });

  it('keeps change requests submitted after the approval (delayed execution or retry)', () => {
    const approve = approval();
    const later = review({});
    expect(select([approve, later], approve)).toEqual([]);
  });

  it('selects nothing once the approval is no longer in effect', () => {
    const stale = review({});
    const dismissedApproval = { ...approval(), state: 'dismissed' as const };
    expect(select([stale, dismissedApproval], dismissedApproval)).toEqual([]);
    expect(select([stale], approval())).toEqual([]);
  });

  it('ignores dismissed reviews', () => {
    const dismissed = review({ state: 'dismissed' });
    const approve = approval();
    expect(select([dismissed, approve], approve)).toEqual([]);
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
    const approve = approval();
    const listReviews = vi
      .fn()
      .mockResolvedValueOnce({ reviews: [stale, human], nextCursor: '2' })
      .mockResolvedValueOnce({ reviews: [approve], nextCursor: null });
    const dismissReview = vi.fn().mockResolvedValue(stale);
    const dismissed = await dismissStaleFactoryReviews(
      { listReviews, dismissReview },
      {
        installationId: 7,
        repository: 'acme/repo',
        pullRequestNumber: 42,
        approvingReviewId: approve.id,
        approvingAuthor: 'factory-reviewer',
      },
      isFactory,
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
