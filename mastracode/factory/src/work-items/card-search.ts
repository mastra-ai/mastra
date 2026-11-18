import type { Card } from '../storage/domains/work-items/base.js';
import { workItemNumber } from './card-number.js';
import { searchableCard } from './search-terms.js';
import type { SearchableCard } from './search-terms.js';

/**
 * What a search reads of a card: its title, its key (`ENG-42`), its number and its source id as
 * words; the keys and links of every issue and pull request it carries, so a pull request attached
 * to its issue's card finds that card; and its id and branches, pasted whole.
 */
export function cardSearch(card: Card): SearchableCard {
  const number = workItemNumber(card);
  const sources = card.workItem.sources;
  const keys = [card.workItem.key, ...sources.map(source => source.key)];
  return searchableCard({
    // `#12` also answers a search for `12`. Attached keys bring their numbers: `acme/app#30772`.
    words: [card.title, number === null ? null : `#${number}`, card.externalSource?.externalId, ...keys],
    ids: [
      card.id,
      ...Object.values(card.sessions).map(session => session.branch),
      // An outside contributor's pull request is worked on its own branch.
      ...sources.map(source => source.metadata?.headBranch),
    ],
    sourceKeys: keys,
    links: [card.externalSource?.url, card.workItem.url, ...sources.map(source => source.url)],
  });
}
