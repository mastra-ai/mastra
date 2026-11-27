import type { Card } from '../storage/domains/work-items/base.js';
import { cardSearch } from '../work-items/card-search.js';
import { matchesSearch, searchTerms } from '../work-items/search-terms.js';
import type { SearchableCard } from '../work-items/search-terms.js';
import { sourceExternalId } from '../work-items/source-external-id.js';

interface UnstartedCard {
  card: Card;
  search: SearchableCard;
}

// One list per board version: `listShared` returns the same array until a card changes.
const unstartedByBoard = new WeakMap<readonly Card[], UnstartedCard[]>();

function unstarted(board: readonly Card[]): UnstartedCard[] {
  let cards = unstartedByBoard.get(board);
  if (!cards) {
    cards = board
      .filter(card => Object.keys(card.sessions).length === 0)
      // Cards updated at the same instant keep the board's order, newest created first.
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(card => ({ card, search: cardSearch(card) }));
    unstartedByBoard.set(board, cards);
  }
  return cards;
}

/**
 * The cards holding no session that answer every word of `query` (see `searchTerms`), most recently
 * updated first: the first `limit` of them, and how many there are in all.
 */
export function unstartedCards(board: readonly Card[], query: string, limit: number): { cards: Card[]; total: number } {
  const terms = searchTerms(query);
  const matches = unstarted(board).filter(({ search }) => matchesSearch(search, terms));
  return { cards: matches.slice(0, limit).map(({ card }) => card), total: matches.length };
}

/**
 * The cards filed from one of `sources`, each a source id or a URL, in board order. A pull request
 * attached to an issue card counts as filed on that card.
 */
export function cardsFiledFrom(board: readonly Card[], sources: readonly string[]): Card[] {
  const wanted = new Set(sources);
  return board.filter(card =>
    [
      card.externalSource?.externalId,
      card.externalSource?.url,
      card.workItem.url,
      ...card.workItem.sources.flatMap(source => [sourceExternalId(source), source.url]),
    ].some(key => typeof key === 'string' && wanted.has(key)),
  );
}

/** The cards whose id is one of `ids`, in board order. An id no card has is left out. */
export function cardsWithIds(board: readonly Card[], ids: readonly string[]): Card[] {
  const wanted = new Set(ids);
  return board.filter(card => wanted.has(card.id));
}
