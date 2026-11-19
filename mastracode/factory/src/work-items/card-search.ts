import type { Card } from '../storage/domains/work-items/base.js';
import { workItemNumber } from './card-number.js';
import { searchableCard } from './search-terms.js';
import type { SearchableCard } from './search-terms.js';

/** What a search reads of a card the server holds; see {@link searchableCard}. */
export function cardSearch(card: Card): SearchableCard {
  return searchableCard({
    id: card.id,
    title: card.title,
    number: workItemNumber(card),
    sourceId: card.externalSource?.externalId,
    key: card.workItem.key,
    urls: [card.externalSource?.url, card.workItem.url],
    sources: card.workItem.sources,
    sessions: card.sessions,
  });
}
