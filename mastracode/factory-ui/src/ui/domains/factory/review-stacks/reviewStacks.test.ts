import { describe, expect, it } from 'vitest';
import { pullRequestCandidate } from '../boardCandidates';
import { pullRequest, pullRequestStack, reviewWorkItem } from './__tests__/fixtures';
import type { ReviewCardGroup } from './reviewStacks';
import { groupReviewCards, reviewCards } from './reviewStacks';

const cardTitles = (groups: readonly ReviewCardGroup[]) =>
  groups.flatMap(group => group.cards.map(card => card.value.title));

describe('Review PR stacks', () => {
  it('uses native positions at the earliest member while retaining unrelated card order', () => {
    const cards = reviewCards(
      [],
      [
        pullRequest(3, pullRequestStack(3)),
        pullRequest(9),
        pullRequest(1, pullRequestStack(1)),
        pullRequest(2, pullRequestStack(2)),
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
    const card = pullRequestCandidate(pullRequest(3, pullRequestStack(3)));
    expect(groupReviewCards(reviewCards([], [card]))).toEqual([
      { stack: pullRequestStack(3), cards: [{ kind: 'candidate', value: card }] },
    ]);
  });

  it('keeps stacks with the same number and different provider IDs separate', () => {
    const cards = reviewCards(
      [],
      [pullRequest(1, pullRequestStack(1, 100, 7)), pullRequest(2, pullRequestStack(1, 200, 7), 'acme/other')].map(
        pullRequestCandidate,
      ),
    );
    expect(groupReviewCards(cards).map(group => group.stack?.id)).toEqual([100, 200]);
  });

  it('keeps closed, merged, and ordinary dependent PRs ungrouped', () => {
    const closed = reviewWorkItem(pullRequest(1, pullRequestStack(1)));
    const merged = reviewWorkItem(pullRequest(2, pullRequestStack(2)));
    closed.metadata.state = 'closed';
    merged.metadata.merged = true;
    const ordinary = pullRequestCandidate({ ...pullRequest(3), baseBranch: 'feature-1' });
    const groups = groupReviewCards(reviewCards([closed, merged], [ordinary]));
    expect(groups).toHaveLength(3);
    expect(groups.every(group => group.stack === undefined)).toBe(true);
  });
});
