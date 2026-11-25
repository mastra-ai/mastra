import type { Card } from '../storage/domains/work-items/base.js';
import { workItemBranchSource } from '../work-item-branch.js';
import { isPullRequestCard } from './change-requests.js';
import { closingLinksIn } from './closing-pull-requests.js';
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
    const byBranch = relatedCardIndex(list, CARD_PULL_REQUESTS);
    // A card holding a pull request also relates to the other cards of issues it closes.
    const closing = closingLinksIn(list);
    const position = new Map(list.map((card, index) => [card, index]));
    relatedTo = card => {
      const linked = closing.linkedCards(card);
      const related = byBranch(card);
      if (linked.length === 0) return related;
      return [...new Set([...related, ...linked])].toSorted((a, b) => position.get(a)! - position.get(b)!);
    };
    relatedByList.set(list, relatedTo);
  }
  return relatedTo;
}
