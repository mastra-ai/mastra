import { describe, expect, it } from 'vitest';
import { pullRequestCandidate } from '../boardCandidates';
import { pullRequest, reviewWorkItem } from './__tests__/fixtures';
import { buildReviewStackIndex, groupReviewCards, reviewCardKey, reviewCards } from './reviewStacks';

describe('Review PR stacks', () => {
  it('orders a chain base-first at its earliest card, retaining unrelated card order', () => {
    const cards = reviewCards(
      [],
      [pullRequest(3, 'feature-2'), pullRequest(9), pullRequest(2, 'feature-1'), pullRequest(1), pullRequest(8)].map(
        pullRequestCandidate,
      ),
    );
    const stacks = buildReviewStackIndex(cards);
    expect(
      groupReviewCards(cards, stacks)
        .flat()
        .map(card => card.value.title),
    ).toEqual(['Pull request 1', 'Pull request 2', 'Pull request 3', 'Pull request 9', 'Pull request 8']);
    expect(new Set([...stacks.values()].map(member => member.stack.id)).size).toBe(1);
  });

  it('keeps sibling branches in board order and preserves a stack across filtered-out members', () => {
    const cards = reviewCards(
      [],
      [pullRequest(4, 'feature-1'), pullRequest(3, 'feature-2'), pullRequest(2, 'feature-1'), pullRequest(1)].map(
        pullRequestCandidate,
      ),
    );
    const stacks = buildReviewStackIndex(cards);
    expect(
      groupReviewCards(cards, stacks)
        .flat()
        .map(card => card.value.title),
    ).toEqual(['Pull request 1', 'Pull request 4', 'Pull request 2', 'Pull request 3']);
    const filtered = cards.filter(card => card.value.metadata.number !== 2);
    expect(
      groupReviewCards(filtered, stacks)
        .flat()
        .map(card => card.value.title),
    ).toEqual(['Pull request 1', 'Pull request 4', 'Pull request 3']);
  });

  it('does not join matching branch names from different repositories or hosts', () => {
    const otherHost = { ...pullRequest(4, 'feature-1'), url: 'https://github.example.com/acme/app/pull/4' };
    const cards = reviewCards(
      [],
      [pullRequest(1), pullRequest(2, 'feature-1', 'acme/other'), otherHost].map(pullRequestCandidate),
    );
    expect(buildReviewStackIndex(cards).size).toBe(0);
  });

  it('deduplicates saved and candidate PR identities without treating them as ambiguous heads', () => {
    const cards = reviewCards(
      [reviewWorkItem(pullRequest(1))],
      [pullRequest(1), pullRequest(2, 'feature-1')].map(pullRequestCandidate),
    );
    const stacks = buildReviewStackIndex(cards);
    expect(stacks.get(reviewCardKey(cards[0]))?.stack).toBe(stacks.get(reviewCardKey(cards[1]))?.stack);
    expect(stacks.get(reviewCardKey(cards[2]))?.position).toBe(1);
  });

  it('leaves incomplete, non-PR, closed and merged cards ungrouped', () => {
    const base = reviewWorkItem(pullRequest(1));
    const child = reviewWorkItem(pullRequest(2, 'feature-1'));
    const invalidBases = [
      { ...base, metadata: { headBranch: 'feature-1' } },
      { ...base, metadata: { headBranch: 1, baseBranch: 'main' } },
      { ...base, metadata: { headBranch: '', baseBranch: 'main' } },
      { ...base, url: 'invalid' },
      { ...base, url: null },
      { ...base, url: 'https://github.com/acme/app/issues/1' },
      { ...base, metadata: { ...base.metadata, state: 'closed' } },
      { ...base, metadata: { ...base.metadata, merged: true } },
    ];
    for (const invalidBase of invalidBases) {
      expect(buildReviewStackIndex(reviewCards([invalidBase, child], [])).size).toBe(0);
    }
    expect(buildReviewStackIndex(reviewCards([{ ...base, source: 'github-issue' }, child], [])).size).toBe(0);
  });

  it('leaves ambiguous heads and their dependents ungrouped', () => {
    const duplicateHead = { ...pullRequest(2), headBranch: 'feature-1' };
    const cards = reviewCards(
      [],
      [pullRequest(1), duplicateHead, pullRequest(3, 'feature-1'), pullRequest(4, 'feature-3')].map(
        pullRequestCandidate,
      ),
    );
    expect(buildReviewStackIndex(cards).size).toBe(0);
  });

  it('leaves cycles and their dependents ungrouped while keeping unrelated valid stacks', () => {
    const cards = reviewCards(
      [],
      [
        pullRequest(1, 'feature-2'),
        pullRequest(2, 'feature-1'),
        pullRequest(3, 'feature-2'),
        pullRequest(4, 'feature-4'),
        pullRequest(5),
        pullRequest(6, 'feature-5'),
      ].map(pullRequestCandidate),
    );
    expect([...buildReviewStackIndex(cards).keys()]).toEqual(['candidate:github-pr:5', 'candidate:github-pr:6']);
  });
});
