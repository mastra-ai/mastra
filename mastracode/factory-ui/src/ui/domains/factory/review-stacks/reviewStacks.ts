import type { PullRequestStack } from '@mastra/factory/capabilities/pull-request-stack';
import type { BoardCandidate } from '../boardCandidates';
import { pullRequestStatusForItem } from '../boardItems';
import type { WorkItem } from '../services/workItems';

export type ReviewCard = { kind: 'work-item'; value: WorkItem } | { kind: 'candidate'; value: BoardCandidate };

export interface ReviewCardGroup {
  stack?: PullRequestStack;
  cards: ReviewCard[];
}

export function reviewCardKey(card: ReviewCard): string {
  return card.kind === 'work-item' ? `work-item:${card.value.id}` : `candidate:${card.value.sourceKey}`;
}

export function reviewCards(workItems: readonly WorkItem[], candidates: readonly BoardCandidate[]): ReviewCard[] {
  return [
    ...workItems.map((value): ReviewCard => ({ kind: 'work-item', value })),
    ...candidates.map((value): ReviewCard => ({ kind: 'candidate', value })),
  ];
}

function cardStack(card: ReviewCard): PullRequestStack | undefined {
  if (card.value.source !== 'github-pr') return;
  if (card.kind === 'work-item') {
    const status = pullRequestStatusForItem(card.value);
    if (status === 'closed' || status === 'merged') return;
  }
  return card.value.metadata.stack;
}

export function groupReviewCards(cards: readonly ReviewCard[]): ReviewCardGroup[] {
  const groups = new Map<string, ReviewCardGroup>();
  for (const card of cards) {
    const stack = cardStack(card);
    const key = stack ? `stack:${stack.id}` : reviewCardKey(card);
    const group = groups.get(key);
    if (group) group.cards.push(card);
    else groups.set(key, { stack, cards: [card] });
  }
  return [...groups.values()].map(group => ({
    ...group,
    cards: group.cards.toSorted((left, right) => (cardStack(left)?.position ?? 0) - (cardStack(right)?.position ?? 0)),
  }));
}
