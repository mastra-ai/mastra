import { describe, expect, it } from 'vitest';
import { pullRequestCandidate } from '../boardCandidates';
import { pullRequest, reviewGroup, reviewWorkItem } from './__tests__/fixtures';
import type { ReviewCardGroup } from './reviewGroups';
import { groupReviewCards, reviewCards } from './reviewGroups';

const cardTitles = (groups: readonly ReviewCardGroup[]) =>
  groups.flatMap(group => group.cards.map(card => card.value.title));

describe('Review PR stacks', () => {
  it('uses native positions at the earliest member while retaining unrelated card order', () => {
    const cards = reviewCards(
      [],
      [
        pullRequest(3, reviewGroup(3)),
        pullRequest(9),
        pullRequest(1, reviewGroup(1)),
        pullRequest(2, reviewGroup(2)),
        pullRequest(8),
      ].map(pullRequestCandidate),
    );
    expect(cardTitles(groupReviewCards(cards))).toEqual([
      'Pull request 1',
      'Pull request 2',
      'Pull request 3',
      'Pull request 9',
      'Pull request 8',
    ]);
  });

  it('preserves stack identity when the bottom and middle members are missing', () => {
    const card = pullRequestCandidate(pullRequest(3, reviewGroup(3)));
    expect(groupReviewCards(reviewCards([], [card]))).toEqual([
      { reviewGroup: reviewGroup(3), cards: [{ kind: 'candidate', value: card }] },
    ]);
  });

  it('keeps stacks with the same number and different provider IDs separate', () => {
    const cards = reviewCards(
      [],
      [pullRequest(1, reviewGroup(1, 100, 7)), pullRequest(2, reviewGroup(1, 200, 7), 'acme/other')].map(
        pullRequestCandidate,
      ),
    );
    expect(groupReviewCards(cards).map(group => group.reviewGroup?.key)).toEqual([
      reviewGroup(1, 100).key,
      reviewGroup(1, 200).key,
    ]);
  });

  it('groups by the review contract independently of the intake source', () => {
    const issueOrigin = reviewWorkItem(pullRequest(1, reviewGroup(1)));
    issueOrigin.source = 'linear-issue';
    const manualOrigin = reviewWorkItem(pullRequest(2, reviewGroup(2)));
    manualOrigin.source = 'manual';
    expect(groupReviewCards(reviewCards([issueOrigin, manualOrigin], []))).toHaveLength(1);
  });

  it('keeps closed, merged, and ordinary dependent PRs ungrouped', () => {
    const closed = reviewWorkItem(pullRequest(1, reviewGroup(1)));
    const merged = reviewWorkItem(pullRequest(2, reviewGroup(2)));
    closed.metadata.state = 'closed';
    merged.metadata.merged = true;
    const ordinary = pullRequestCandidate({ ...pullRequest(3), baseBranch: 'feature-1' });
    const groups = groupReviewCards(reviewCards([closed, merged], [ordinary]));
    expect(groups).toHaveLength(3);
    expect(groups.every(group => group.reviewGroup === undefined)).toBe(true);
  });
});
