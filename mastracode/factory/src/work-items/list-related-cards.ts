import { isPullRequestCard } from '../boards/semantics.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { workItemBranchSource } from '../work-item-branch.js';
import { relatedCardIndex } from './related-cards.js';
import type { PullRequestFacts } from './related-cards.js';

const CARD_PULL_REQUESTS: PullRequestFacts<Card> = {
  isPullRequest: card => isPullRequestCard({ source: workItemBranchSource(card.externalSource) }),
  headBranch: card => {
    const branch = card.workItem.metadata?.headBranch;
    return typeof branch === 'string' ? branch : undefined;
  },
};

// One index per list version: `listShared` returns the same array until a card changes.
const relatedByList = new WeakMap<readonly Card[], (card: Card) => Card[]>();

/** Reads the cards related to one of the list's cards, in list order. */
export function relatedCardsIn(list: readonly Card[]): (card: Card) => Card[] {
  let relatedTo = relatedByList.get(list);
  if (!relatedTo) {
    relatedTo = relatedCardIndex(list, CARD_PULL_REQUESTS);
    relatedByList.set(list, relatedTo);
  }
  return relatedTo;
}
