/**
 * A pull request closing several issues is held by one card: the card that authored it, or the
 * first issue it closes. The other issues' cards are linked to it: they find it in a search, count
 * as having a pull request, and relate to the card that holds it, without holding it themselves.
 */

import type { Card } from '../storage/domains/work-items/base.js';
import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';
import { cardFacts } from './card-facts.js';
import { cardSearch } from './card-search.js';
import { closedWorkItemIds, pullRequestSources } from './change-requests.js';
import type { SearchableCard } from './search-terms.js';

export interface ClosingLinks {
  /** The cards holding those pull requests, and the cards this one's pull requests close. */
  linkedCards(card: Card): readonly Card[];
  /** The card's search, with the pull requests closing it. */
  search(card: Card): SearchableCard;
  /** Whether the card has a pull request, its own, attached, or closing it from another card. */
  hasPullRequest(card: Card): boolean;
}

// One scan per list version: `listShared` returns the same array until a card changes.
const linksByList = new WeakMap<readonly Card[], ClosingLinks>();

export function closingLinksIn(list: readonly Card[]): ClosingLinks {
  let links = linksByList.get(list);
  if (links) return links;
  const byId = new Map(list.map(card => [card.id, card]));
  const closingPullRequests = new Map<string, WorkItemSourceRow[]>();
  const holders = new Map<string, Card[]>();
  const closed = new Map<string, Card[]>();
  const push = <T>(index: Map<string, T[]>, key: string, value: T) => {
    const bucket = index.get(key);
    if (!bucket) index.set(key, [value]);
    else if (!bucket.includes(value)) bucket.push(value);
  };
  for (const holder of list) {
    for (const source of pullRequestSources(holder)) {
      for (const id of closedWorkItemIds(source)) {
        const card = byId.get(id);
        if (!card || card === holder) continue;
        push(closingPullRequests, id, source);
        push(holders, id, holder);
        push(closed, holder.id, card);
      }
    }
  }
  const searches = new Map<string, SearchableCard>();
  links = {
    linkedCards: card => [...(holders.get(card.id) ?? []), ...(closed.get(card.id) ?? [])],
    search: card => {
      const pullRequests = closingPullRequests.get(card.id);
      if (!pullRequests) return cardFacts(card).search;
      let search = searches.get(card.id);
      if (!search) {
        search = cardSearch(card, pullRequests);
        searches.set(card.id, search);
      }
      return search;
    },
    hasPullRequest: card => cardFacts(card).hasPullRequest || closingPullRequests.has(card.id),
  };
  linksByList.set(list, links);
  return links;
}
