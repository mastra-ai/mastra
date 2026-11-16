import type { Card } from '../storage/domains/work-items/base.js';
import { workItemNumber } from './card-number.js';

/** What a search reads of a card, lowercased: its title, its key (`ENG-42`), its number and its source id. */
export function cardSearchText(card: Card): string {
  const number = workItemNumber(card);
  // `#12` also answers a search for `12`.
  return [card.title, card.workItem.key, number === null ? null : `#${number}`, card.externalSource?.externalId]
    .join(' ')
    .toLowerCase();
}
