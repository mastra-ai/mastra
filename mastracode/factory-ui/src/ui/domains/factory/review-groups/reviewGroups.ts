import type { ReviewGroup } from '@mastra/factory/capabilities/review-group';
import type { BoardCandidate } from '../boardCandidates';
import { pullRequestStatusForItem } from '../boardItems';
import type { WorkItem } from '../services/workItems';

export type ReviewCard = { kind: 'work-item'; value: WorkItem } | { kind: 'candidate'; value: BoardCandidate };

export interface ReviewCardGroup {
  reviewGroup?: ReviewGroup;
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

function cardGroup(card: ReviewCard): ReviewGroup | undefined {
  if (card.kind === 'work-item') {
    const status = pullRequestStatusForItem(card.value);
    if (status === 'closed' || status === 'merged') return;
  }
  return card.value.metadata.reviewGroup ?? undefined;
}

export function groupReviewCards(cards: readonly ReviewCard[]): ReviewCardGroup[] {
  const groups = new Map<string, ReviewCardGroup>();
  for (const card of cards) {
    const reviewGroup = cardGroup(card);
    const key = reviewGroup ? `group:${reviewGroup.key}` : reviewCardKey(card);
    const group = groups.get(key);
    if (group) group.cards.push(card);
    else groups.set(key, { reviewGroup, cards: [card] });
  }
  return [...groups.values()].map(group => ({
    ...group,
    cards: group.cards.toSorted((left, right) => (cardGroup(left)?.position ?? 0) - (cardGroup(right)?.position ?? 0)),
  }));
}
